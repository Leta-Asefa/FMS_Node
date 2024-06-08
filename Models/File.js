const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hashedName: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number },
  type: { type: String },
  owner: {type:String},
  folder: { type: Schema.Types.ObjectId, ref: 'Folder' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', fileSchema);
