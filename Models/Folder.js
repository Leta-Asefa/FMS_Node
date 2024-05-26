const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const folderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    path: { type: String, required: true },
    files: [{ type: Schema.Types.ObjectId, ref: 'File' }],
    subfolders: [{ type: Schema.Types.ObjectId, ref: 'Folder' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Folder = mongoose.model('Folder', folderSchema);
module.exports = Folder;
