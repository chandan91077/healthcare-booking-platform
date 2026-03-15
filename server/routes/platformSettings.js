// Platform settings route:
// Exposes platform fee configuration for admin and public read access.
const express = require('express');
const router = express.Router();
const PlatformSettings = require('../models/PlatformSettings');
const { protect } = require('../middleware/authMiddleware');

async function getOrCreateSettings() {
    let settings = await PlatformSettings.findOne({ key: 'global' });
    if (!settings) {
        settings = await PlatformSettings.create({ key: 'global', platform_fee: 0 });
    }
    return settings;
}

router.get('/public', async (req, res) => {
    try {
        const settings = await getOrCreateSettings();
        res.json({ platform_fee: Number(settings.platform_fee || 0) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const settings = await getOrCreateSettings();
        res.json({
            platform_fee: Number(settings.platform_fee || 0),
            updated_at: settings.updatedAt,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.patch('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const nextFee = Number(req.body?.platform_fee);
        if (!Number.isFinite(nextFee) || nextFee < 0) {
            return res.status(400).json({ message: 'platform_fee must be a non-negative number' });
        }

        const settings = await getOrCreateSettings();
        settings.platform_fee = Number(nextFee.toFixed(2));
        settings.updated_by = req.user._id;
        await settings.save();

        res.json({
            message: 'Platform fee updated successfully',
            platform_fee: Number(settings.platform_fee || 0),
            updated_at: settings.updatedAt,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;