const express = require('express');
const multer  = require('multer');
const path = require('path');

const app = express();

// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/') // specify the directory where you want to store uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
})

// Initialize multer upload
const upload = multer({ storage: storage });

// POST route to handle file upload
app.post('/upload', upload.single('image'), function (req, res) {
  // req.file contains information about the uploaded file
  res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});












//--------------------------------Add Site Component -------------------------------------------------
import React, { useState, useEffect } from 'react';
import {useLocation} from 'react-router-dom'
import '../output.css'; // Import custom styles

const DisplaySites = () => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const location=useLocation()
    const username=location.state?.username

  useEffect(() => {
    const fetchSites = async () => {
      try {
          const response = await fetch('http://localhost:4000/site/all');
          
        if (!response.ok) {
          throw new Error('Failed to fetch sites');
        }
        const data = await response.json();
        setSites(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchSites();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="site-container">
          <h1 className="text-center text-2xl font-bold mb-10">Welcome <b className='text-3xl'>{username}</b> Here Is Your Sites List To Choose</h1>
      <div className="site-grid">
        {sites.map((site) => (
          <div key={site._id} className="bg-white shadow-lg rounded-lg p-4 site-hover">
            <h2 className="text-xl font-semibold mb-2">{site.siteName}</h2>
            <p className="text-gray-700 mb-2">{site.description}</p>
            <p className="text-gray-700 mb-2"><strong>Address:</strong> {site.location.address}</p>
            <p className="text-gray-700 mb-2"><strong>Coordinates:</strong> {site.location.coordinates.join(', ')}</p>
            <p className="text-gray-700 mb-2"><strong>Distance:</strong> {site.distance} km</p>
            <p className="text-gray-700 mb-2"><strong>Opening Hours:</strong> {site.openingHours}</p>
            <p className="text-gray-700 mb-2"><strong>Categories:</strong> {site.categories}</p>
            <p className="text-gray-700 mb-2"><strong>Facilities:</strong> {site.facilitiesAvailable.join(', ')}</p>
            <p className="text-gray-700 mb-2"><strong>Rating:</strong> {site.rating}</p>
            {site.images.length > 0 && <img src={site.images[0]} alt={site.siteName} className="w-full h-48 object-cover mb-2 rounded-lg" />}
            <p className="text-gray-700 mb-2"><strong>Transportations:</strong> {site.transportations.join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DisplaySites;









//---------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const Folder = require('../models/Folder');

router.post('/copy', requireAuth, async (req, res) => {
    const { files, parentId, newParentId } = req.body;

    for (const [key, value] of Object.entries(files)) {
        const id = key;
        const type = value.isFile ? 'file' : 'folder';

        if (id === parentId) continue;

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
                    folder: newParentId,
                    hashedName: file.hashedName,
                    owner: file.owner
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
                    parent: newParentId,
                    owner: folder.owner // Copy the owner information
                });

                const savedFolder = await newFolder.save();
                newParentFolder.subfolders.push(savedFolder._id);
                await newParentFolder.save();

                await copySubfoldersAndFiles(folder, savedFolder);
            }

        } catch (error) {
            console.error('Error copying item:', error);
            return res.status(500).send('Internal Server Error');
        }
    }

    res.status(201).send('Copied successfully');
});

async function copySubfoldersAndFiles(sourceFolder, destinationFolder) {
    for (const subfolder of sourceFolder.subfolders) {
        const newSubfolderPath = `${destinationFolder.path}${subfolder.name}/`;

        const newSubfolder = new Folder({
            name: subfolder.name,
            path: newSubfolderPath,
            parent: destinationFolder._id,
            owner: subfolder.owner // Copy the owner information
        });

        const savedSubfolder = await newSubfolder.save();
        destinationFolder.subfolders.push(savedSubfolder._id);
        await destinationFolder.save();

        await copySubfoldersAndFiles(subfolder, savedSubfolder); // Recursive call
    }

    for (const file of sourceFolder.files) {
        const newFile = new File({
            path: `${destinationFolder.path}${file.name}`,
            name: file.name,
            size: file.size,
            type: file.type,
            folder: destinationFolder._id,
            hashedName: file.hashedName,
            owner: file.owner // Copy the owner information
        });

        const savedFile = await newFile.save();
        destinationFolder.files.push(savedFile._id);
        await destinationFolder.save();
    }
}

module.exports = router;


//---------------------------------------------------------
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    }
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
//-----------------------------------------------------------------

const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const Notification = require('./models/Notification'); // Assuming a Notification model is defined

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        // Process the uploaded file (e.g., save to database or file system)
        
        // Create a notification for the admin
        const notification = new Notification({
            type: 'file_upload',
            message: `A new file was uploaded by user ${req.user.id}`,
            timestamp: new Date(),
            read: false
        });

        await notification.save();

        // Notify the admin (e.g., via WebSocket or email)
        // Here we're just sending a response
        res.status(200).json({ message: 'File uploaded and admin notified' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Notification schema (for reference)
const notificationSchema = new mongoose.Schema({
    type: String,
    message: String,
    timestamp: Date,
    read: Boolean
});

const Notification = mongoose.model('Notification', notificationSchema);

mongoose.connect('mongodb://localhost:27017/your-db-name', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    app.listen(4000, () => {
        console.log('Server is running on port 4000');
    });
}).catch(err => console.error('Failed to connect to MongoDB', err));


//----------------------------------without socket io

To implement a notification system for the admin when a file is uploaded without using Socket.io, you can leverage a database to store notifications and then periodically poll the database for new notifications. Here's a step-by-step guide to achieve this:

Step 1: Modify the Upload Route to Create Notifications
First, update the file upload route to create a notification entry in the database whenever a file is uploaded.

javascript
Copy code
const express = require('express');
const router = express.Router();
const multer = require('multer');
const File = require('../models/File');
const Notification = require('../models/Notification'); // Import the Notification model

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = new File({
            name: req.file.filename,
            path: req.file.path,
            size: req.file.size,
            type: req.file.mimetype,
            owner: req.user._id // Assuming you have user authentication
        });

        const savedFile = await file.save();

        // Create a notification for the admin
        const notification = new Notification({
            message: `A new file has been uploaded: ${file.name}`,
            userId: req.user._id // The user who uploaded the file
        });

        await notification.save();

        res.status(201).send(savedFile);
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
Step 2: Create a Notification Model
Create a Notification model to store notifications in the database.

javascript
Copy code
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    read: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Notification', NotificationSchema);
Step 3: Admin Route to Fetch Notifications
Create a route for the admin to fetch notifications. This route will return all unread notifications.

javascript
Copy code
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

router.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find({ read: false });
        res.status(200).send(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
Step 4: Admin Polling for Notifications
The admin client will periodically poll the /notifications endpoint to check for new notifications.

javascript
Copy code
import React, { useEffect, useState } from 'react';

const AdminDashboard = () => {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await fetch('http://localhost:4000/admin/notifications');
                const data = await response.json();
                setNotifications(data);
            } catch (error) {
                console.error('Error fetching notifications:', error);
            }
        };

        // Poll the server every 10 seconds
        const interval = setInterval(fetchNotifications, 10000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <h2>Admin Dashboard</h2>
            <h3>Notifications</h3>
            <ul>
                {notifications.map(notification => (
                    <li key={notification._id}>{notification.message}</li>
                ))}
            </ul>
        </div>
    );
};

export default AdminDashboard;
Step 5: Mark Notifications as Read
Optionally, you can add functionality to mark notifications as read once the admin has viewed them.

Server-side
javascript
Copy code
router.post('/notifications/markAsRead', async (req, res) => {
    try {
        await Notification.updateMany({ read: false }, { read: true });
        res.status(200).send('Notifications marked as read');
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
Client-side
javascript
Copy code
const markNotificationsAsRead = async () => {
    try {
        await fetch('http://localhost:4000/admin/notifications/markAsRead', {
            method: 'POST'
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
    }
};

// Call this function after fetching and displaying the notifications
useEffect(() => {
    markNotificationsAsRead();
}, [notifications]);
By following these steps, you can implement a notification system that alerts the admin when a file is uploaded, without using Socket.io. The system uses the database to store notifications and polling to check for new notifications periodically
