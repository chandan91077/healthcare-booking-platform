const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
    },
    patient_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    appointment_date: {
        type: String, // Storing as string YYYY-MM-DD for simplicity (compatible with MongoDB/MERN)
        required: true,
    },
    appointment_time: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending',
    },
    amount: {
        type: Number,
        required: true,
    },
    notes: {
        type: String,
        default: '',
    },
    payment_status: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending',
    },
    video_unlocked: {
        type: Boolean,
        default: false,
    },
    chat_unlocked: {
        type: Boolean,
        default: false,
    },
    zoom_join_url: {
        type: String,
        default: null,
    },
    meeting_provider: {
        type: String,
        default: '', // e.g., 'zoom' | 'meet'
    },
    meeting_time: {
        type: String,
        default: null, // ISO datetime string when scheduled by doctor
    },
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
