const express = require('express')
const Book = require('../Models/Folder')
const {requireAuth}=require('../Middleware/AuthMiddleware')
const router = express.Router()



router.get('/folders', async (req, res) => {
    const folders = await Folder.find().populate({
        path: 'subfolders',
        populate: {
            path: 'subfolders',
            populate: {
                path: 'subfolders'
            }
        }
    }).exec();
    res.json(folders);
});

router.post('/folders', async (req, res) => {
    const newFolder = new Folder({
        name: req.body.name,
        path: req.body.path || '/', // Root by default or provided path
    });
    await newFolder.save();
    res.json(newFolder);
});

router.post('/folders/:id/subfolders', async (req, res) => {
    const parentFolder = await Folder.findById(req.params.id);
    const newSubfolder = new Folder({
        name: req.body.name,
        path: `${parentFolder.path}${parentFolder.name}/`,
    });
    parentFolder.subfolders.push(newSubfolder);
    await newSubfolder.save();
    await parentFolder.save();
    res.json(newSubfolder);
});

router.delete('/folders/:id', async (req, res) => {
    const folder = await Folder.findById(req.params.id);
    await Folder.deleteMany({ _id: { $in: folder.subfolders } });
    await File.deleteMany({ _id: { $in: folder.files } });
    await Folder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Folder and its contents deleted' });
});

router.post('/folders/:id/files', async (req, res) => {
    const folder = await Folder.findById(req.params.id);
    const newFile = new File({
        name: req.file.filename,
        path: `uploads/${req.file.filename}`,
        size: req.file.size,
        type: req.file.mimetype
    });
    folder.files.push(newFile);
    await newFile.save();
    await folder.save();
    res.json(folder);
});