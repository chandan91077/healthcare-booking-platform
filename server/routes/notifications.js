// Notifications route:
// Provides notification feed access and read/clear actions for authenticated users.
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { protect } = require('../middleware/authMiddleware');

function buildRecipientInfo(user) {
    return {
        user_id: user?._id?.toString() || '',
        email: user?.email || '',
        full_name: user?.full_name || '',
        role: user?.role || '',
    };
}

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

// Mark all notifications for current user as read
router.put('/mark-all-read', protect, async (req, res) => {
    try {
        const result = await Notification.updateMany({ user_id: req.user._id, read: false }, { $set: { read: true } });
        res.json({ modifiedCount: result.modifiedCount || result.nModified || 0 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Clear all notifications for current user
router.delete('/clear-all', protect, async (req, res) => {
    try {
        const result = await Notification.deleteMany({ user_id: req.user._id });
        res.json({ deletedCount: result.deletedCount || 0 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin broadcast update (audience + channel)
router.post('/admin/broadcast', protect, async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required.' });
        }

        const allowedAudience = new Set(['doctor', 'patient', 'both']);
        const allowedChannels = new Set(['in_app', 'email']);

        const title = req.body?.title?.toString().trim() || 'MediConnect Update';
        const message = req.body?.message?.toString().trim() || '';
        const audience = req.body?.audience?.toString().trim() || 'both';

        const rawChannels = req.body?.channels;
        const channels = (Array.isArray(rawChannels) ? rawChannels : [rawChannels])
            .map((channel) => channel?.toString().trim())
            .filter((channel) => allowedChannels.has(channel));

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        if (!allowedAudience.has(audience)) {
            return res.status(400).json({ message: 'Invalid audience.' });
        }

        if (channels.length === 0) {
            return res.status(400).json({ message: 'Select at least one channel.' });
        }

        const roles = audience === 'both' ? ['doctor', 'patient'] : [audience];
        const users = await User.find({ role: { $in: roles } })
            .select('_id email full_name role notification_preferences');

        const sendInApp = channels.includes('in_app');
        const sendEmailChannel = channels.includes('email');

        let inAppSent = 0;
        const inAppFailed = [];
        if (sendInApp) {
            const inAppResults = await Promise.allSettled(
                users.map(async (targetUser) => {
                    await Notification.create({
                        user_id: targetUser._id,
                        type: 'admin_update',
                        message,
                        data: {
                            title,
                            audience,
                            channels,
                            sent_by: req.user._id,
                        },
                    });
                    return buildRecipientInfo(targetUser);
                })
            );

            inAppResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    inAppSent += 1;
                    return;
                }

                const user = users[index] || null;
                inAppFailed.push({
                    ...buildRecipientInfo(user),
                    reason: result.reason?.message || 'Failed to create app notification.',
                });
            });
        }

        let emailSent = 0;
        const emailFailed = [];
        const emailSkipped = [];

        if (sendEmailChannel) {
            const subject = title;
            const text = `${title}\n\n${message}`;
            const html = `
                <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
                  <h2 style="margin-bottom: 8px;">${title}</h2>
                  <p style="white-space: pre-line;">${message}</p>
                </div>
            `;

            const emailResults = await Promise.allSettled(
                users.map(async (targetUser) => {
                    if (!targetUser.email) {
                        throw new Error('Missing email address.');
                    }

                    const sent = await sendEmail({
                        to: targetUser.email,
                        subject,
                        text,
                        html,
                    });

                    if (!sent) {
                        throw new Error('Email delivery failed.');
                    }

                    return buildRecipientInfo(targetUser);
                })
            );

            emailResults.forEach((result, index) => {
                const targetUser = users[index];
                const info = buildRecipientInfo(targetUser);

                if (result.status === 'fulfilled') {
                    emailSent += 1;
                    return;
                }

                const reason = result.reason?.message || 'Email delivery failed.';
                if (!targetUser?.email) {
                    emailSkipped.push({
                        ...info,
                        reason,
                    });
                    return;
                }

                emailFailed.push({
                    ...info,
                    reason,
                });
            });
        }

        return res.status(201).json({
            message: 'Update processed.',
            recipients: users.length,
            in_app_sent: inAppSent,
            in_app_failed: inAppFailed,
            email_sent: emailSent,
            email_failed: emailFailed,
            email_skipped: emailSkipped,
            audience,
            channels,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Failed to send update.' });
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

// Delete a single notification
router.delete('/:id', protect, async (req, res) => {
    try {
        const notif = await Notification.findById(req.params.id);
        if (!notif) return res.status(404).json({ message: 'Notification not found' });
        if (notif.user_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
        await notif.deleteOne();
        res.json({ message: 'Notification deleted' });
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