const express = require('express')
const multer = require('multer')
const path = require('path')
const Folder = require('../Models/Folder')
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
        const rootFolder = await Folder.findOne({ path: '/Root/' });
        const halfPopulated = await populateFolders(rootFolder);
        const populatedFolder = await populateFiles(halfPopulated)

        res.status(200).json(populatedFolder);
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


router.post('/add_root',requireAuth, async (req, res) => {
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
        console.log("Username " ,req.username)
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

router.delete('/delete', async (req, res) => {
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

    try {
        const folder = await Folder.findById(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        const files = req.files.map(file => ({
            name: file.originalname,
            path: file.path,
            size: file.size,
            type: file.mimetype,
            folder: folderId
        }));

        const savedFiles = await File.insertMany(files);

        folder.files.push(...savedFiles.map(file => file._id));
        await folder.save();

        res.status(201).json(savedFiles);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.post('/permission/:folderId', async (req, res) => {
    const { folderId } = req.params;
    const { username, action } = req.body
    try {
        const folder = await Folder.findById(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        if (action === 'read')
            folder.read.push(username)
        if (action === 'write')
            folder.write.push(username)
        if (action === 'readWrite')
            folder.readWrite.push(username)

        await folder.save();

        res.status(201).json(folder);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send('Internal Server Error');
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
                if (!file) return res.status(404).send('File not found');

                const newParentFolder = await Folder.findById(newParentId);
                if (!newParentFolder) return res.status(404).send('New parent folder not found');

                file.folder = newParentId;
                await file.save();

                newParentFolder.files.push(file._id);
                await newParentFolder.save();

                await Folder.findByIdAndUpdate(parentId, { $pull: { files: file._id } });

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