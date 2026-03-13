const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            default: 'global',
            unique: true,
            required: true,
        },
        platform_fee: {
            type: Number,
            default: 0,
            min: 0,
        },
        updated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);