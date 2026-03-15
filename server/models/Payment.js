// Payment model:
// Tracks appointment payments, provider references, and settlement progress.
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    appointment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
    },
    patient_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    settlement_status: {
        type: String,
        enum: ['unsettled', 'settled'],
        default: 'unsettled',
    },
    settled_amount: {
        type: Number,
        default: 0,
    },
    last_settlement_amount: {
        type: Number,
        default: 0,
    },
    settled_at: {
        type: Date,
        default: null,
    },
    settled_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    settlement_notes: {
        type: String,
        default: '',
    },
    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String,
    cashfree_order_id: String,
    cashfree_payment_id: String,
    cashfree_payment_status: String,
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
