const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const Folder = require('../Models/Folder')
const User = require('../Models/User')
const File = require('../Models/File')
const { requireAuth } = require('../Middleware/AuthMiddleware')
const router = express.Router()


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'UploadedFiles')
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname))
    }
})
const upload = multer({ storage: storage })



router.get('/all', async (req, res) => {
    try {
        const folders = await Folder.find();
        res.status(200).json(folders);
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/root', async (req, res) => {
    try {
        const rootFolder = await Folder.findOne({ path: '/Root/' }).populate('subfolders');
        if (!rootFolder) {
            return res.status(404).send('Root folder not found');
        }
        res.status(200).json(rootFolder);
    } catch (error) {
        console.error('Error fetching root folder:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/all_populated', async (req, res) => {
    try {
        const rootFolders = await Folder.find();
        // const halfPopulated = await populateFolders(rootFolder);
        // const populatedFolder = await populateFiles(halfPopulated)

        res.status(200).json(rootFolders);
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/all_populated/:id', async (req, res) => {
    try {
        const rootFolder = await Folder.findById(req.params.id);
        const halfPopulated = await populateFolders(rootFolder);
        const populatedFolder = await populateFiles(halfPopulated)

        res.status(200).json(populatedFolder);
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.json({ error });
    }
});


router.post('/add_root', requireAuth, async (req, res) => {
    try {
        const { name, path, files, subfolders } = req.body;

        const newFolder = new Folder({
            name,
            path: path || `/Root/`,
            files: files || [],
            subfolders: subfolders || []
        });

        const savedFolder = await newFolder.save();
        console.log('Created Root Folder ', savedFolder)
        console.log("Username ", req.username)
        res.status(201).json(savedFolder);
    } catch (error) {
        console.error('Error adding folder:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/add_subfolder', async (req, res) => {
    try {
        const { parentId, name, files, subfolders, owner } = req.body;
        const parentFolder = await Folder.findById(parentId);
        if (!parentFolder) {
            return res.status(404).send('Parent folder not found');
        }
        const path = parentFolder.path + name + '/'
        const data = {
            name,
            owner: owner || '',
            path: path || '/',
            files: files || [],
            subfolders: subfolders || []
        }
        const newSubfolder = new Folder(data);

        const savedSubfolder = await newSubfolder.save();


        parentFolder.subfolders.push(savedSubfolder._id);
        await parentFolder.save();

        res.status(201).json({ savedSubfolder, parentFolder });
    } catch (error) {
        console.error('Error adding subfolder:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.delete('/delete_all', async (req, res) => {
    try {
        await Folder.deleteMany({});
        await File.deleteMany({});
        res.send("Deleted !")
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.delete('/delete', requireAuth, async (req, res) => {
    const { data } = req.body;
    try {
        for (const element of data) {
            if (element.isFile) {
                const file = await File.findByIdAndDelete(element.id);
                if (file) {
                    await Folder.findByIdAndUpdate(file.folder, { $pull: { files: file._id } });
                }
            } else {
                const folder = await Folder.findByIdAndDelete(element.id);

            }
        }

        res.json({ "response": "Deleted Successfully !" });
    } catch (error) {
        console.error('Error deleting items:', error);
        res.status(500).json({ 'error': "An error occurred while deleting items." });
    }
});



router.post('/upload/:folderId', upload.array('files', 50), async (req, res) => {
    const { folderId } = req.params;
    const owner = req.body.owner
    console.log("owner ",owner)
    try {
        const folder = await Folder.findById(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        console.log(req.files)

        const files = req.files.map(file => ({
            name: file.originalname,
            hashedName:file.filename,
            path: file.path,
            size: file.size,
            type: file.mimetype,
            folder: folderId,
            owner:owner
        }));

        console.log(files)

        const savedFiles = await File.insertMany(files);

        folder.files.push(...savedFiles.map(file => file._id));
        await folder.save();

        res.status(201).json(savedFiles);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/users/:folderId', async (req, res) => {
    try {
        const folder = await Folder.findById(req.params.folderId);
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const userSet = new Set([...folder.read, ...folder.write, ...folder.readWrite]);
        const users = [];

        for (const username of userSet) {
            const user = await User.findOne({ username }); // Assuming you have a User model
            if (user) {
                let accessControl;
                if (folder.read.includes(username)) accessControl = 'read';
                if (folder.write.includes(username)) accessControl = 'write';
                if (folder.readWrite.includes(username)) accessControl = 'readWrite';
                users.push({
                    _id: user._id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    accessControl: accessControl
                });
            }
        }

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



router.post('/updatePermission/:folderId', async (req, res) => {
    const { username, action } = req.body;
    try {
        const folder = await Folder.findById(req.params.folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        if (action === 'read') {
            // Remove from other permissions
            folder.write = folder.write.filter(user => user !== username);
            folder.readWrite = folder.readWrite.filter(user => user !== username);

            if (!folder.read.includes(username)) {
                folder.read.push(username);
            }
        } else if (action === 'write') {
            // Remove from other permissions
            folder.read = folder.read.filter(user => user !== username);
            folder.readWrite = folder.readWrite.filter(user => user !== username);

            if (!folder.write.includes(username)) {
                folder.write.push(username);
            }
        } else if (action === 'readWrite') {
            // Remove from other permissions
            folder.read = folder.read.filter(user => user !== username);
            folder.write = folder.write.filter(user => user !== username);

            if (!folder.readWrite.includes(username)) {
                folder.readWrite.push(username);
            }
        } else {
            return res.status(400).send('Invalid action');
        }

        await folder.save();

        res.status(200).json('User permission updated');
    } catch (error) {
        console.error('Error updating permissions:', error);
        res.status(500).send('Internal Server Error');
    }
});



router.post('/permission/:folderId', async (req, res) => {
    const { folderId } = req.params;
    const { selectedUsers, action } = req.body
    try {
        const folder = await Folder.findById(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }
        for (const user of selectedUsers) {
            if (action === 'read' || typeof action === 'undefined') {
                if (!folder.read.includes(user.username)) {
                    folder.read.push(user.username);
                }
            }
            if (action === 'write') {
                if (!folder.write.includes(user.username)) {
                    folder.write.push(user.username);
                }
            }
            if (action === 'readWrite') {
                if (!folder.readWrite.includes(user.username)) {
                    folder.readWrite.push(user.username);
                }
            }
        }

        await folder.save();

        res.status(201).json(folder);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/removeUserAccess', async (req, res) => {
    const { folderId, username } = req.body;

    
   
    try {
        const folder = await Folder.findById(folderId);
        
        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        // Remove user from read, write, and readWrite arrays
        folder.read = folder.read.filter(user => user !== username);
        folder.write = folder.write.filter(user => user !== username);
        folder.readWrite = folder.readWrite.filter(user => user !== username);

        await folder.save();


        res.status(200).send('User access removed successfully');
    } catch (error) {
        res.status(500).send('Internal server error');
    }
});

router.post('/rename/:folderId', async (req, res) => {
    const { folderId } = req.params;
    const { newName } = req.body
    try {
        const folder = await Folder.findById(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        const newPath = replaceLastOccurrence(folder.path, folder.name, newName);


        //  let newPath = folder.path.replace(`/${folder.name}/`, `/${newName}/`);
        folder.path = newPath
        folder.name = newName


        await folder.save();

        res.status(201).json(folder);
    } catch (error) {
        console.error('Error renaming folders:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.post('/rename/file/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const { newName } = req.body
    try {
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).send('File not found');
        }
        const fileExtension = file.name.split('.').pop();
        file.name = newName + '.' + fileExtension

        await file.save();

        res.status(201).json(file);
    } catch (error) {
        console.error('Error renaming file:', error);
        res.status(500).send('Internal Server Error');
    }
});

async function copySubfoldersAndFiles(folder, newFolder) {
    for (const subfolderId of folder.subfolders) {
        const subfolder = await Folder.findById(subfolderId).populate('subfolders files');

        const newSubfolder = new Folder({
            name: subfolder.name,
            path: `${newFolder.path}${subfolder.name}/`,
            parent: newFolder._id
        });

        const savedSubfolder = await newSubfolder.save();
        newFolder.subfolders.push(savedSubfolder._id);

        // Recursively copy subfolders
        await copySubfoldersAndFiles(subfolder, savedSubfolder);
    }

    for (const fileId of folder.files) {
        const file = await File.findById(fileId);

        const newFile = new File({
            path: `${newFolder.path}${file.name}`,
            name: file.name,
            size: file.size,
            type: file.type,
            folder: newFolder._id
        });

        const savedFile = await newFile.save();
        newFolder.files.push(savedFile._id);
    }

    await newFolder.save(); // Save the updated new folder with new subfolder and file references
}

// Main route to handle copying
router.post('/copy', async (req, res) => {

    const { files, parentId, newParentId } = req.body;

    for (const [key, value] of Object.entries(files)) {
        const id = key
        const type = value.isFile ? 'file' : 'folder'
        if (files[key] === parentId)
            continue

        try {
            if (type === 'file') {
                const file = await File.findById(id);
                if (!file) return res.status(404).send('File not found');

                const newParentFolder = await Folder.findById(newParentId);

                const newFile = new File({
                    path: `${newParentFolder.path}${file.name}`,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    folder: newParentId
                });

                const savedFile = await newFile.save();
                newParentFolder.files.push(savedFile._id);
                await newParentFolder.save();

            } else if (type === 'folder') {
                const folder = await Folder.findById(id).populate('subfolders files');
                if (!folder) return res.status(404).send('Folder not found');

                const newParentFolder = await Folder.findById(newParentId);
                const newFolderPath = `${newParentFolder.path}${folder.name}/`;

                const newFolder = new Folder({
                    name: folder.name,
                    path: newFolderPath,
                    parent: newParentId
                });

                const savedFolder = await newFolder.save();
                newParentFolder.subfolders.push(savedFolder._id);
                await newParentFolder.save();

                await copySubfoldersAndFiles(folder, savedFolder);
            }

        } catch (error) {
            console.error('Error copying item:', error);
            res.status(500).send('Internal Server Error');
        }



    }

    res.status(201).send('Copied successfully');


});


router.post('/move', async (req, res) => {
    const { files, parentId, newParentId } = req.body;


    for (const [key, value] of Object.entries(files)) {
        const id = key
        const type = value.isFile ? 'file' : 'folder'
        if (files[key] === parentId)
            continue

        try {
            if (type === 'file') {
                const file = await File.findById(id);
                if (!file) {
                    res.status(404).send('File not found');
                    return;
                }

                const newParentFolder = await Folder.findById(newParentId);
                if (!newParentFolder) {
                    res.status(404).send('New parent folder not found');
                    return;
                }

                file.folder = newParentId;
                await file.save();

                newParentFolder.files.push(file._id);
                await newParentFolder.save();

                const oldParentFolder = await Folder.findById(parentId);
                if (oldParentFolder) {
                    oldParentFolder.files.pull(file._id);
                    await oldParentFolder.save();
                } else {
                    res.status(404).send('Old parent folder not found');
                    return;
                }
            } else if (type === 'folder') {
                const folder = await Folder.findById(id).populate('subfolders files');
                if (!folder) return res.status(404).send('Folder not found');

                const newParentFolder = await Folder.findById(newParentId);
                if (!newParentFolder) return res.status(404).send('New parent folder not found');

                const oldPath = folder.path;
                const newPath = `${newParentFolder.path}${folder.name}/`;

                const updatePaths = async (folder, oldPath, newPath) => {
                    if (!folder) return; // Ensure the folder is not null
                    folder.path = folder.path.replace(oldPath, newPath);
                    await folder.save();

                    for (const subfolder of folder.subfolders) {
                        const subfolderData = await Folder.findById(subfolder);
                        await updatePaths(subfolderData, oldPath, newPath);
                    }

                    for (const file of folder.files) {
                        const fileData = await File.findById(file);
                        if (fileData) { // Ensure the fileData is not null
                            fileData.path = fileData.path.replace(oldPath, newPath);
                            await fileData.save();
                        }
                    }
                };

                await updatePaths(folder, oldPath, newPath);



                newParentFolder.subfolders.push(folder._id);
                await newParentFolder.save();

                // Remove the folder from the old parent's subfolders array
                await Folder.findByIdAndUpdate(parentId, { $pull: { subfolders: folder._id } });
            }
        } catch (error) {
            console.error('Error moving item:', error);
            res.status(500).send('Internal Server Error');
        }



    }

    res.status(201).send('Copied successfully');

});



router.post('/search/:searchString', async (req, res) => {
    try {
        const searchString = req.params.searchString;
        const {username}=req.body
        
        // Escape special characters in the searchString
        const escapedSearchString = escapeRegex(searchString);
        // Query for files matching the regular expression and sort them ascendingly by name
        const regex = new RegExp(escapedSearchString, 'i');
        
        console.log(username)
        const files = await File.find({ name: { $regex: regex },owner:username }).sort({ name: 1 });
        // Send the response with the found files
        res.json(files);
    } catch (error) {
        // Handle any errors that occur during the query or response sending
        console.error('Error searching files:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.get('/openfile/:fileId', async (req, res) => {
    try {
      const fileId = req.params.fileId;
      const file = await File.findById(fileId);
    
      if (!file) {
        return res.status(404).send('File not found');
      }
    
      // Construct direct URL to the file
      const fileUrl = `http://localhost:4000/uploads/${file.hashedName}`; // Adjust port number as needed
    
      res.json({
        url: fileUrl,
        type: file.type,
        name: file.name
      });
    } catch (error) {
      res.status(500).send('Server error');
    }
  });
 
  
  
  
  
  


function replaceLastOccurrence(path, folderName, newName) {
    const target = `/${folderName}/`;
    const replacement = `/${newName}/`;

    // Find the index of the last occurrence of the target string
    const lastIndex = path.lastIndexOf(target);

    // If the target string is not found, return the original path
    if (lastIndex === -1) {
        return path;
    }

    // Split the path into two parts: before the target and after the target
    const beforeTarget = path.slice(0, lastIndex);
    const afterTarget = path.slice(lastIndex + target.length);

    // Reconstruct the path with the replacement
    const newPath = beforeTarget + replacement + afterTarget;

    return newPath;
}

function escapeRegex(string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

const populateFolders = async (folder) => {
    const populatedFolder = await Folder.populate(folder, { path: 'subfolders' });
    for (let subfolder of populatedFolder.subfolders) {
        await populateFolders(subfolder);
    }
    return populatedFolder;
};

const populateFiles = async (folder) => {
    const populatedFile = await Folder.populate(folder, { path: 'files' });
    return populatedFile;
};


module.exports = router