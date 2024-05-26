const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const Folder = require('./Models/Folder');
const File = require('./Models/File');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/folderdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Error connecting to MongoDB', err);
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

// Routes
app.get('/folders', async (req, res) => {
    const folders = await Folder.find().populate('subfolders files');
    res.json(folders);
});

app.post('/folders', async (req, res) => {
    const newFolder = new Folder({
        name: req.body.name,
        path: req.body.path || '/', // Root by default or provided path
    });
    await newFolder.save();
    res.json(newFolder);
});

app.post('/folders/:id/subfolders', async (req, res) => {
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

app.delete('/folders/:id', async (req, res) => {
    const folder = await Folder.findById(req.params.id);
    await Folder.deleteMany({ _id: { $in: folder.subfolders } });
    await File.deleteMany({ _id: { $in: folder.files } });
    await Folder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Folder and its contents deleted' });
});

app.post('/folders/:id/files', upload.single('file'), async (req, res) => {
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
