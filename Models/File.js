const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, required: true },
    type: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const File = mongoose.model('File', fileSchema);
module.exports = File;
