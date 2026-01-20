const express = require('express');
const router = express.Router();
const PlatformSettings = require('../models/PlatformSettings');
const { protect } = require('../middleware/authMiddleware');

// Helper to get current settings (create default if missing)
async function getOrCreateSettings() {
  let doc = await PlatformSettings.findOne({ key: 'platform_fees' });
  if (!doc) {
    doc = await PlatformSettings.create({});
  }
  return doc;
}

// GET /api/settings/platform-fees
router.get('/platform-fees', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings/platform-fees
router.put('/platform-fees', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }
    const { enabled, percentage, fixed, minFee, maxFee, notes } = req.body;
    const settings = await getOrCreateSettings();

    if (typeof enabled !== 'undefined') settings.enabled = !!enabled;
    if (typeof percentage !== 'undefined') settings.percentage = Math.max(0, Number(percentage) || 0);
    if (typeof fixed !== 'undefined') settings.fixed = Math.max(0, Number(fixed) || 0);
    if (typeof minFee !== 'undefined') settings.minFee = Math.max(0, Number(minFee) || 0);
    if (typeof maxFee !== 'undefined') settings.maxFee = Math.max(0, Number(maxFee) || 0);
    if (typeof notes !== 'undefined') settings.notes = String(notes || '');
    settings.updatedBy = req.user._id;

    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
