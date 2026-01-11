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
    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String,
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
