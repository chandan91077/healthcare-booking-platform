const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    appointment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
    },
    sender_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        default: '',
    },
    file_url: {
        type: String, // S3 URL
        default: '',
    },
    message_type: {
        type: String,
        enum: ['text', 'image', 'file'],
        default: 'text',
    },
    is_read: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
