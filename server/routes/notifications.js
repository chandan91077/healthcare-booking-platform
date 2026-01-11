const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
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

module.exports = router;