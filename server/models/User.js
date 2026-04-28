// User model:
// Core account identity, role, credentials, locale, and notification preferences.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: false,
        default: null,
    },
    firebase_uid: {
        type: String,
        sparse: true,
        index: true,
        default: null,
    },
    full_name: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['patient', 'doctor', 'admin'],
        default: 'patient',
    },
    avatar_url: {
        type: String,
        default: '',
    },
    phone: {
        type: String,
        default: '',
    },
    locale: {
        type: String,
        default: 'en'
    },
    notification_preferences: {
        email: {
            type: Boolean,
            default: true,
        },
        push: {
            type: Boolean,
            default: true,
        },
        video_calls: {
            type: Boolean,
            default: true,
        },
        appointments: {
            type: Boolean,
            default: true,
        },
    },
    activeSession: {
        sessionId: {
            type: String,
            default: null,
        },
        deviceInfo: {
            type: String,
            default: null,
        },
        loginTime: {
            type: Date,
            default: null,
        },
        lastActivityTime: {
            type: Date,
            default: null,
        },
    },
}, { timestamps: true });

// Encrypt password using bcrypt (only when a password is present and modified)
userSchema.pre('save', async function (next) {
    if (!this.password || !this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
