const express = require('express');
const router = express.Router();
const Notification = require('../Models/Notification');
const requireAuth = require('../Middleware/AuthMiddleware');
// Route to get all notifications
router.get('/all', async (req, res) => {
    try {
        const owner=req.cookies.username==="@gonder"?/.*/:req.cookies.username
        const notifications = await Notification.find({owner:owner }).sort({ read: 1 });
         res.status(200).json(notifications);
    } catch (error) {
        console.error('Error retrieving notifications:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to get read notifications
router.get('/read', async (req, res) => {
    try {
        const owner=req.cookies.username==="@gonder"?/.*/:req.cookies.username
        const notifications = await Notification.find({ owner:owner,read: true });
        res.status(200).json(notifications);
    } catch (error) {
        console.error('Error retrieving notifications:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to get unread notifications
router.get('/unread', async (req, res) => {
    try {
        const owner=req.cookies.username==="@gonder"?/.*/:req.cookies.username
        const notifications = await Notification.find({owner:owner, read: false });
        res.status(200).json(notifications);
    } catch (error) {
        console.error('Error retrieving notifications:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to mark a notification as read
router.get('/read/:id', async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).send('Notification not found');
        }

        notification.read = true;
        await notification.save();

        res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.patch('/markAllAsRead', async (req, res) => {
    try {
        const owner=req.cookies.username==="@gonder"?/.*/:req.cookies.username
        await Notification.updateMany({owner:owner,read: false}, { $set: { read: true } });
        res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
