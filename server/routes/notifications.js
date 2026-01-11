const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// Get notifications for current user
router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ user_id: req.user._id }).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get unread count
router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ user_id: req.user._id, read: false });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark a notification as read
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notif = await Notification.findById(req.params.id);
        if (!notif) return res.status(404).json({ message: 'Notification not found' });
        if (notif.user_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
        notif.read = true;
        await notif.save();
        res.json(notif);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark all notifications for current user as read
router.put('/mark-all-read', protect, async (req, res) => {
    try {
        const result = await Notification.updateMany({ user_id: req.user._id, read: false }, { $set: { read: true } });
        res.json({ modifiedCount: result.modifiedCount || result.nModified || 0 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get notification preferences
router.get('/preferences', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('notification_preferences');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.notification_preferences);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update notification preferences
router.put('/preferences', protect, async (req, res) => {
    try {
        const { email, push, video_calls, appointments } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.notification_preferences = {
            email: email !== undefined ? email : user.notification_preferences.email,
            push: push !== undefined ? push : user.notification_preferences.push,
            video_calls: video_calls !== undefined ? video_calls : user.notification_preferences.video_calls,
            appointments: appointments !== undefined ? appointments : user.notification_preferences.appointments,
        };

        await user.save();
        res.json(user.notification_preferences);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;