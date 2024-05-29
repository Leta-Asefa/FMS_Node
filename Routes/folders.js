const express = require('express')
const multer = require('multer')
const path=require('path')
const Folder = require('../Models/Folder')
const File = require('../Models/File')
const { requireAuth } = require('../Middleware/AuthMiddleware')
const router = express.Router()


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null,'UploadedFiles')
    },
    filename: (req, file, cb) => {
        cb(null,Date.now()+path.extname(file.originalname))
    }
})
const upload=multer({storage:storage})



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
        const populatedFolder=await populateFiles(halfPopulated)
        
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
        const populatedFolder=await populateFiles(halfPopulated)
        
        res.status(200).json(populatedFolder);
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.json({error});
    }
});


router.post('/add_root', async (req, res) => {
    try {
        const { name, path, files, subfolders } = req.body;

        const newFolder = new Folder({
            name,
            path: path || `/Root/`,
            files: files || [],
            subfolders: subfolders || []
        });

        const savedFolder = await newFolder.save();

        res.status(201).json(savedFolder);
    } catch (error) {
        console.error('Error adding folder:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/add_subfolder', async (req, res) => {
    try {
        const { parentId, name, files, subfolders,owner } = req.body;
        const parentFolder = await Folder.findById(parentId);
        if (!parentFolder) {
            return res.status(404).send('Parent folder not found');
        }
        const path=parentFolder.path+name+'/'
        console.log("Owner=",owner,"Path=",path)
        const data={
            name,
            owner:owner||'',
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
    const {data}=req.body
    try {

        for (const element of data) {
            if (element.isFile) {
                await File.findByIdAndDelete(element.id);
                console.log("After deleting",data)
            } else {
                await Folder.findByIdAndDelete(element.id);
            }
        }
        
        res.json({"response":"Deleted Successfully !"})
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.json({'error':"No Folder To Be Deleted (folderId not found)"});
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
    const {username,action}=req.body
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
    const {newName}=req.body
    try {
      const folder = await Folder.findById(folderId);
  
      if (!folder) {
        return res.status(404).send('Folder not found');
        }
        folder.name = newName
        
      await folder.save();
  
      res.status(201).json(folder);
    } catch (error) {
      console.error('Error renaming folders:', error);
      res.status(500).send('Internal Server Error');
    }
  });


  router.post('/rename/file/:fileId', async (req, res) => {
    const {fileId} = req.params;
    const {newName}=req.body
    try {
      const file = await File.findById(fileId);
  
      if (!file) {
        return res.status(404).send('File not found');
        }
        const fileExtension = file.name.split('.').pop();
        file.name = newName+'.'+fileExtension
        
      await file.save();
  
      res.status(201).json(file);
    } catch (error) {
      console.error('Error renaming file:', error);
      res.status(500).send('Internal Server Error');
    }
  });

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