const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Folder, User, File, Notification } = require('../Models'); // Assuming you have index.js that exports all models
const { requireAuth } = require('../Middleware/AuthMiddleware');
const { where } = require('sequelize');
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
        const populatedFolder = await populateFiles( halfPopulated,req);
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
                const folder=await req.db.Folder.findByPk(file.dataValues.folderId);
                if (file) {
                     
                    
                    await req.db.Folder.update({ files: folder.dataValues.files.filter(fid=>element.id!==fid) }, { where: { id: folder.dataValues.id } })

                    await file.destroy();

                }
            } else {
                const folderToBeDeleted = await req.db.Folder.findByPk(element.id);
                const parentFolder = await req.db.Folder.findByPk(folderToBeDeleted.dataValues.ParentFolderId);
                console.log(parentFolder);
                if (folderToBeDeleted) {
                     
                    
                    await req.db.Folder.update({ subfolders: parentFolder.subfolders.filter(fid=>folderToBeDeleted.dataValues.id!==fid) }, { where: { id: folderToBeDeleted.dataValues.ParentFolderId } })

                    await folderToBeDeleted.destroy();

                }
            }
        }

        /* const notification = await req.db.Notification.create({
            owner: owner,
            message: `${req.cookies.username} from ${owner} org. deletes these files [  ${filesName} ] and folders[  ${foldersName}  ]`
        }); */

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

        res.status(201).json(savedFiles);
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/openfile/:fileId',requireAuth, async (req, res) => {
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

router.get('/users/:folderId', requireAuth, async (req, res) => {
    try {
        const folder = await req.db.Folder.findByPk(req.params.folderId);
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const userSet = new Set([...folder.read, ...folder.write, ...folder.readWrite]);
        const users = [];

        for (const username of userSet) {
            const user = await req.db.User.findOne({ where: { username } });
            if (user) {
                let accessControl;
                if (folder.read.includes(username)) accessControl = 'read';
                if (folder.write.includes(username)) accessControl = 'write';
                if (folder.readWrite.includes(username)) accessControl = 'readWrite';
                users.push({
                    id: user.id,
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

router.post('/updatePermission/:folderId', requireAuth, async (req, res) => {
    const { username, action } = req.body;
    try {
        const folder = await req.db.Folder.findByPk(req.params.folderId);

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

router.post('/permission/:folderId', requireAuth, async (req, res) => {
    const { folderId } = req.params;
    const { write, read, readWrite } = req.body;

    try {
        const folder = await req.db.Folder.findByPk(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        if (write) {
            folder.write = [...new Set([...folder.write, ...write])];
        }

        if (read) {
            folder.read = [...new Set([...folder.read, ...read])];
        }

        if (readWrite) {
            folder.readWrite = [...new Set([...folder.readWrite, ...readWrite])];
        }

        await req.db.Folder.save();

        res.status(200).json('Permissions updated');
    } catch (error) {
        console.error('Error updating permissions:', error);
        res.status(500).send('Internal Server Error');
    }
});

async function populateFiles(folder,req) {
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
