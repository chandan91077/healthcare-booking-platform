const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    specialization: {
        type: String,
        required: true,
    },
    experience_years: {
        type: Number,
        required: true,
    },
    consultation_fee: {
        type: Number,
        required: true,
    },
    emergency_fee: {
        type: Number,
        default: 0,
    },
    bio: {
        type: String,
        default: '',
    },
    // Location information for patients to see (state + more specific location/address)
    state: {
        type: String,
        default: '',
    },
    location: {
        type: String,
        default: '',
    },
    is_verified: {
        type: Boolean,
        default: false,
    },
    medical_license_url: {
        type: String,
        default: '',
    },
    verification_status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
    },
    rejection_reason: {
        type: String,
        default: null,
    },
    rejection_history: [{
        reason: String,
        date: { type: Date, default: Date.now },
        rejectedAt: String
    }],
    profile_image_url: { // Separate from User avatar if needed, or sync them
        type: String,
    }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);
