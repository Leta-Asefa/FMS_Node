const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Folder, User, File, Notification } = require('../Models'); // Assuming you have index.js that exports all models
const { requireAuth } = require('../Middleware/AuthMiddleware');
const { Sequelize} = require('sequelize');
const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'UploadedFiles');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.get('/all', requireAuth, async (req, res) => {
    try {
        const folders = await req.db.Folder.findAll();
        res.status(200).json(folders);
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/root', requireAuth, async (req, res) => {
    try {
        const rootFolder = await req.db.Folder.findOne({ where: { path: '/Root/' }, include: [{ model: req.db.Folder, as: 'subfolders' }] });
        if (!rootFolder) {
            return res.status(404).send('Root folder not found');
        }
        res.status(200).json(rootFolder);
    } catch (error) {
        console.error('Error fetching root folder:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/all_populated', requireAuth, async (req, res) => {
    try {
        const rootFolders = await req.db.Folder.findAll();
        res.status(200).json(rootFolders);
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/all_populated/:id', requireAuth, async (req, res) => {
    try {
        const rootFolder = await req.db.Folder.findByPk(req.params.id);
        const halfPopulated = await populateFolders(rootFolder.dataValues, req);
        const populatedFolder = await populateFiles(halfPopulated, req);
        res.status(200).json(populatedFolder);

    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.json({ error });
    }
});

router.post('/add_root', requireAuth, async (req, res) => {
    try {
        const { name, path, files, subfolders } = req.body;

        const newFolder = await req.db.Folder.create({
            name,
            path: path || `/Root/`,
            files: files || [],
            subfolders: subfolders || []
        });

        res.status(201).json(newFolder);
    } catch (error) {
        console.error('Error adding folder:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/add_subfolder', requireAuth, async (req, res) => {
    try {
        const { parentId, name, owner } = req.body;
        const parentFolder = await req.db.Folder.findByPk(parentId);
        if (!parentFolder) {
            return res.status(404).send('Parent folder not found');
        }

        const path = `${parentFolder.path}${name}/`;

        // Create a new subfolder
        const newSubfolder = await req.db.Folder.create({
            name,
            owner: owner || '',
            path: path || '/',
            ParentFolderId: parentFolder.id || '-',// Assuming you have a foreign key set up for parent-child relationship
            files: [],
            subfolders: [],
            read: '',
            write: '',
            readWrite: ''
        });


        // Add the subfolder to the parent folder's subfolders
        parentFolder.subfolders = [...parentFolder.subfolders, newSubfolder.id]
        await parentFolder.save()

        res.status(201).json({ newSubfolder, parentFolder });
    } catch (error) {
        console.error('Error adding subfolder:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.delete('/delete', requireAuth, async (req, res) => {
    const { data } = req.body;
    const foldersName = [];
    const filesName = [];
    let owner;
    try {
        for (const element of data) {
            if (element.isFile) {
                const file = await req.db.File.findByPk(element.id);
                const folder = await req.db.Folder.findByPk(file.dataValues.folderId);
                if (file) {


                    await req.db.Folder.update({ files: folder.dataValues.files.filter(fid => element.id !== fid) }, { where: { id: folder.dataValues.id } })
                    owner = file.owner
                    filesName.push(file.name)
                    await file.destroy();

                }
            } else {
                const folderToBeDeleted = await req.db.Folder.findByPk(element.id);
                const parentFolder = await req.db.Folder.findByPk(folderToBeDeleted.dataValues.ParentFolderId);
                console.log(parentFolder);
                if (folderToBeDeleted) {


                    await req.db.Folder.update({ subfolders: parentFolder.subfolders.filter(fid => folderToBeDeleted.dataValues.id !== fid) }, { where: { id: folderToBeDeleted.dataValues.ParentFolderId } })
                    owner = folderToBeDeleted.path.split('/')[1]
                    foldersName.push(folderToBeDeleted.name)
                    await folderToBeDeleted.destroy();

                }
            }
        }

         const notification = await req.db.Notification.create({
            owner: owner,
            message: `${req.cookies.username} from ${owner} org. deletes these files [  ${filesName} ] and folders[  ${foldersName}  ]`
        }); 

        res.json({ response: 'Deleted Successfully!' });
    } catch (error) {
        console.error('Error deleting items:', error);
        res.status(500).json({ error: 'An error occurred while deleting items.' });
    }
});


router.post('/upload/:folderId', requireAuth, upload.array('files', 50), async (req, res) => {
    const { folderId } = req.params;
    const owner = req.body.owner;

    try {
        const folder = await req.db.Folder.findByPk(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        const files = req.files.map(file => ({
            name: file.originalname,
            hashedName: file.filename,
            path: file.path,
            size: file.size,
            type: file.mimetype,
            folderId: folderId,
            owner: owner,
        }));

        const savedFiles = await req.db.File.bulkCreate(files);
        savedFiles.map(file => {
            folder.dataValues.files.push(file.dataValues.id)
        })
        await req.db.Folder.update({ files: folder.dataValues.files }, { where: { id: folder.dataValues.id } })

        const notification = await  req.db.Notification.create({
            owner: owner,
            message: `${req.files.length} file(s) are uploaded by ${req.cookies.username} from ${owner} org. File names are ${req.files.map(file=>` " ${file.originalname}" `)}`
        })

        res.status(201).json(savedFiles);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/openfile/:fileId', requireAuth, async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const file = await req.db.File.findByPk(fileId);

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


async function copySubfoldersAndFiles(folder, newFolder, req) {
    if (folder.subfolders === false && folder.files === false) {
        return
    }
    for (const subfolderId of folder.subfolders) {
        const subfolder = await req.db.Folder.findByPk(subfolderId)
        const newFolderPath = `${newFolder.path}${folder.name}/`;

        const savedFolder = await req.db.Folder.create({
            name: subfolder.name,
            path: newFolderPath,
            ParentFolderId: newFolder.id,
            files: [],
            subfolders: []
        });

        const updatedFiles = [...newFolder.subfolders, savedFolder.id];
        await newFolder.update({ subfolders: updatedFiles });

        // Recursively copy subfolders
        await copySubfoldersAndFiles(subfolder, savedFolder,req);
    }

    for (const fileId of folder.files) {
        const file = await req.db.File.findByPk(fileId);

        const savedFile = await req.db.File.create({
            path: `${file.dataValues.path}`,
            name: file.dataValues.name,
            size: file.dataValues.size,
            type: file.dataValues.type,
            folderId: newFolder.id,
            hashedName: file.dataValues.hashedName,
            owner: file.dataValues.owner
        });

        const updatedFiles = [...newFolder.files, savedFile.id];
        await newFolder.update({ files: updatedFiles });

    }

    await newFolder.save(); // Save the updated new folder with new subfolder and file references
}


// Main route to handle copying
router.post('/copy', requireAuth, async (req, res) => {

    const { files, parentId, newParentId } = req.body;

    for (const [key, value] of Object.entries(files)) {
        const id = key
        const type = value.isFile ? 'file' : 'folder'
        if (files[key] === parentId)
            continue

        try {
            if (type === 'file') {
                const file = await req.db.File.findByPk(id);
                if (!file) return res.status(404).send('File not found');

                const newParentFolder = await req.db.Folder.findByPk(newParentId);


                const savedFile = await req.db.File.create({
                    path: `${file.dataValues.path}`,
                    name: file.dataValues.name,
                    size: file.dataValues.size,
                    type: file.dataValues.type,
                    folderId: newParentFolder.dataValues.id,
                    hashedName: file.dataValues.hashedName,
                    owner: file.dataValues.owner
                });

                const updatedFiles = [...newParentFolder.files, savedFile.id];
                await newParentFolder.update({ files: updatedFiles });



            } else if (type === 'folder') {
                const folder = await req.db.Folder.findByPk(id)

                if (!folder) return res.status(404).send('Folder not found');

                const newParentFolder = await req.db.Folder.findByPk(newParentId);
                const newFolderPath = `${newParentFolder.path}${folder.name}/`;

                const savedFolder = await req.db.Folder.create({
                    name: folder.name,
                    path: newFolderPath,
                    ParentFolderId: newParentId,
                    files: [],
                    subfolders: []
                });

                const updatedFiles = [...newParentFolder.subfolders, savedFolder.id];
                await newParentFolder.update({ subfolders: updatedFiles });

                await copySubfoldersAndFiles(folder, savedFolder,req);
            }

        } catch (error) {
            console.error('Error copying item:', error);
            res.status(500).send('Internal Server Error');
        }

    }
    res.status(201).send('Copied successfully');

});


router.post('/move', requireAuth, async (req, res) => {
    const { files, parentId, newParentId } = req.body;

    for (const [key, value] of Object.entries(files)) {
        const id = key
        const type = value.isFile ? 'file' : 'folder'
        if (files[key] === parentId)
            continue

        try {
            if (type === 'file') {
                const file = await req.db.File.findByPk(id);
                if (!file) {
                    res.status(404).send('File not found');
                    return;
                }

                const newParentFolder = await req.db.Folder.findByPk(newParentId);
                if (!newParentFolder) {
                    res.status(404).send('New parent folder not found');
                    return;
                }

                await file.update({ folderId: newParentId });


                const updatedFiles = [...newParentFolder.files, file.id];
                await newParentFolder.update({ files: updatedFiles });


                const oldParentFolder = await req.db.Folder.findByPk(parentId);
                if (oldParentFolder) {
                    const updatedFiles = oldParentFolder.files.filter(fileId=>fileId!==file.id)
                    await oldParentFolder.update({ files: updatedFiles });
                } else {
                    res.status(404).send('Old parent folder not found');
                    return;
                }
            } else if (type === 'folder') {
                const folder = await req.db.Folder.findByPk(id);
                if (!folder) {
                    res.status(404).send('Folder not found');
                    return;
                }

                const newParentFolder = await req.db.Folder.findByPk(newParentId);
                if (!newParentFolder) {
                    res.status(404).send('New parent folder not found');
                    return;
                }

                const oldPath = folder.path;
                const newPath = `${newParentFolder.path}${folder.name}/`;

                const updatePaths = async (folder, oldPath, newPath) => {
                    if (!folder) return;
                    folder.path = folder.path.replace(oldPath, newPath);
                    await folder.save();

                    for (const subfolder of folder.subfolders) {
                        const subfolderData = await req.db.Folder.findByPk(subfolder.id);
                        await updatePaths(subfolderData, oldPath, newPath);
                    }

                    for (const file of folder.files) {
                        const fileData = await req.db.File.findByPk(file.id);
                        if (fileData) {
                            fileData.path = fileData.path.replace(oldPath, newPath);
                            await fileData.save();
                        }
                    }
                };

                await updatePaths(folder, oldPath, newPath);

                const updatedSubfolders = [...newParentFolder.subfolders, folder.id];
                await newParentFolder.update({ subfolders: updatedSubfolders });

                const oldParentFolder = await req.db.Folder.findByPk(parentId);
                if (oldParentFolder) {
                    const updatedSubfolders = oldParentFolder.subfolders.filter(subfolderId => subfolderId !== folder.id);
                    await oldParentFolder.update({ subfolders: updatedSubfolders });
                } else {
                    res.status(404).send('Old parent folder not found');
                    return;
                }
            }
        } catch (error) {
            console.error('Error moving item:', error);
            res.status(500).send('Internal Server Error');
        }
    }
    res.status(201).send('Moved successfully');

});


router.post('/search/:searchString',requireAuth, async (req, res) => {
    try {
        const searchString = req.params.searchString;
        const {username}=req.body
        const escapeRegex= (string)=> {
            return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        }
        // Escape special characters in the searchString
        const escapedSearchString = escapeRegex(searchString);
        // Query for files matching the regular expression and sort them ascendingly by name
        const regex = new RegExp(escapedSearchString);
        
        const files = await req.db.File.findAll({
            where: {
              name: {
                [Sequelize.Op.regexp]: escapedSearchString  // Use the appropriate operator for regex
              },
              owner: username
            },
            order: [
              ['name', 'ASC']
            ]
          });
        // Send the response with the found files
        res.json(files);
    } catch (error) {
        // Handle any errors that occur during the query or response sending
        console.error('Error searching files:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/rename/:folderId',requireAuth, async (req, res) => {
    const { folderId } = req.params;
    const { newName } = req.body
    try {
        const folder = await req.db.Folder.findByPk(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        const newPath = replaceLastOccurrence(folder.path, folder.name, newName);
        const oldName=folder.name
        const owner = folder.path.split('/')[1]

        await folder.update({ path: newPath,name:newName });

        
        const notification = await req.db.Notification.create({
            owner: owner,
            message: `${req.cookies.username} from " ${owner} " org. renames the file from "${oldName}" to "${newName}".`
        })


        res.status(201).json(folder);

    } catch (error) {
        console.error('Error renaming folders:', error);
        res.status(500).send('Internal Server Error');
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

router.post('/rename/file/:fileId',requireAuth, async (req, res) => {
    const { fileId } = req.params;
    const { newName } = req.body
    try {
        const file = await req.db.File.findByPk(fileId);
        const oldName=file.name
        if (!file) {
            return res.status(404).send('File not found');
        }
       
        const fileExtension = file.name.split('.').pop();
        const newNameWithExtension = newName + '.' + fileExtension
        await file.update({ name: newNameWithExtension });

        
        const notification = await req.db.Notification.create({
            owner: file.owner,
            message: `${req.cookies.username} from " ${file.owner} " org. renames the file from "${oldName}" to "${newName}".`
        })

     
        res.status(201).json(file);
    } catch (error) {
        console.error('Error renaming file:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.get('/users/:folderId', requireAuth, async (req, res) => {
    try {
        const folder = await req.db.Folder.findByPk(req.params.folderId);
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const readUsernames = folder.read || [];
        const writeUsernames = folder.write || [];
        const readWriteUsernames = folder.readWrite || [];

        const allUsernames = [...new Set([...readUsernames, ...writeUsernames, ...readWriteUsernames])];

        const users = await req.db.User.findAll({
            where: {
                username: {
                    [Sequelize.Op.in]: allUsernames
                }
            }
        });

        const usersWithAccessControl = users.map(user => {
            let accessControl;
            if (readUsernames.includes(user.username)) accessControl = 'read';
            if (writeUsernames.includes(user.username)) accessControl = 'write';
            if (readWriteUsernames.includes(user.username)) accessControl = 'readWrite';
            return {
                id: user.id,  // Adjust the field name if needed
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                accessControl: accessControl
            };
        });

        res.json(usersWithAccessControl);

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.post('/updatePermission/:folderId', requireAuth, async (req, res) => {
    const { username, action } = req.body;
    try {
        const folder = await req.db.Folder.findByPk(req.params.folderId);
        let newWriteValue,newReadValue,newReadWriteValue
        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        if (action === 'read') {
            // Remove from other permissions
            newWriteValue = folder.write.filter(user => user !== username);
            newReadWriteValue = folder.readWrite.filter(user => user !== username);

            if (!folder.read.includes(username)) {
               newReadValue= [...folder.read,username]
            }
        } else if (action === 'write') {
            // Remove from other permissions
            newReadValue = folder.read.filter(user => user !== username);
            newReadWriteValue = folder.readWrite.filter(user => user !== username);

            if (!folder.write.includes(username)) {
                newWriteValue= [...folder.write,username]
            }
        } else if (action === 'readWrite') {
            // Remove from other permissions
            newReadValue = folder.read.filter(user => user !== username);
            newWriteValue = folder.write.filter(user => user !== username);

            if (!folder.readWrite.includes(username)) {
                newReadWriteValue= [...folder.readWrite,username]
            }
        } else {
            return res.status(400).send('Invalid action');
        }

        await folder.update({ read: newReadValue,write:newWriteValue,readWrite:newReadWriteValue });


        res.status(200).json('User permission updated');
    } catch (error) {
        console.error('Error updating permissions:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/permission/:folderId', requireAuth, async (req, res) => {
    const { folderId } = req.params;
    const { selectedUsers, action } = req.body
    const selectedUsersUsername = selectedUsers.map(user => user.username);
    try {
        const folder = await req.db.Folder.findByPk(folderId);
        let newWriteValue, newReadValue, newReadWriteValue
        console.log(selectedUsers);
        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        if (action==="write") {
            newWriteValue = [...folder.write, ...selectedUsersUsername];
            
        }

        if (action==="read"|| typeof action === 'undefined') {
            newReadValue =[...folder.read, ...selectedUsersUsername];
            console.log("read",[...folder.read, ...selectedUsers]);
            
        }

        if (action==="readWrite") {
            newReadWriteValue =[...folder.readWrite, ...selectedUsersUsername];
        }

         await folder.update({ read: newReadValue,write:newWriteValue,readWrite:newReadWriteValue });

        res.status(200).json('Permissions updated');
    } catch (error) {
        console.error('Error updating permissions:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/removeUserAccess',requireAuth, async (req, res) => {
    const { folderId, username } = req.body;
    let newReadValue,newWriteValue,newReadWriteValue
    try {
        const folder = await req.db.Folder.findByPk(folderId);
        
        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        // Remove user from read, write, and readWrite arrays
        newReadValue = folder.read.filter(user => user !== username);
        newWriteValue = folder.write.filter(user => user !== username);
        newReadWriteValue = folder.readWrite.filter(user => user !== username);

        await folder.update( { read:newReadValue, write:newWriteValue, readWrite:newReadWriteValue } );


        res.status(200).send('User access removed successfully');
    } catch (error) {
        res.status(500).send('Internal server error');
    }
});

async function populateFiles(folder, req) {
    let populatedFolder = [];

    for (const file of folder.files) {
        const fileData = await req.db.File.findOne({
            where: { id: file }
        });
        populatedFolder.push(fileData.dataValues);
    }
    folder.files = populatedFolder

    return folder;
}

const populateFolders = async (folder, req) => {
    let populatedFolder = [];

    for (const subfolder of folder.subfolders) {
        const detailedSubFolder = await req.db.Folder.findOne({
            where: { id: subfolder }
        });
        populatedFolder.push(detailedSubFolder.dataValues);
    }
    folder.subfolders = populatedFolder

    return folder;
};




module.exports = router;
