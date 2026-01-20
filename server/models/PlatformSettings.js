const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform_fees', unique: true },
    enabled: { type: Boolean, default: true },
    percentage: { type: Number, default: 0 }, // e.g., 5 for 5%
    fixed: { type: Number, default: 0 }, // e.g., ₹10 fixed
    minFee: { type: Number, default: 0 },
    maxFee: { type: Number, default: 0 }, // 0 means no cap
    notes: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
