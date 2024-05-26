// routes/folders.js
const express = require('express');
const router = express.Router();
const Folder = require('../Models/Folder');



// Create a new folder
router.post('/folders', async (req, res) => {
  const { name, parentId } = req.body;

  try {
    const newFolder = new Folder({ name, parentId });
    await newFolder.save();
    res.status(201).send(newFolder);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Get all folders for a user
router.get('/folders', async (req, res) => {
  const userId = req.user._id;

  try {
    const folders = await Folder.find({ userId });
    res.send(folders);
  } catch (error) {
    res.status(500).send(error);
  }
});

module.exports = router;
