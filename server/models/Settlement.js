const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    period_start: {
        type: Date,
        required: true,
    },
    period_end: {
        type: Date,
        required: true,
    },
    settled_date: {
        type: Date,
        default: Date.now,
    },
    payment_method: {
        type: String,
        enum: ['bank_transfer', 'check', 'cash', 'other'],
        default: 'bank_transfer',
    },
    transaction_id: String,
    notes: String,
    settled_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

module.exports = mongoose.model('Settlement', settlementSchema);
