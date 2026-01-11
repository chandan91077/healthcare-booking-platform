const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/authMiddleware');

// Process a payment
router.post('/', protect, async (req, res) => {
    try {
        const { appointment_id, amount, razorpay_order_id, razorpay_payment_id } = req.body;

        // Create payment record
        const payment = await Payment.create({
            appointment_id,
            patient_id: req.user._id,
            amount,
            status: 'completed', // Simulating success
            razorpay_order_id,
            razorpay_payment_id,
        });

        // Update appointment status
        const appointment = await Appointment.findById(appointment_id);
        if (appointment) {
            appointment.payment_status = 'paid'; // Match enum: ['pending', 'paid', 'failed']
            appointment.status = 'confirmed';

            // Unlock chat/video if emergency
            if (appointment.appointment_type === 'emergency') {
                appointment.chat_unlocked = true;
                appointment.video_unlocked = true;
            }
            await appointment.save();
        }

        res.status(201).json(payment);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get payments for a user (optional, for history)
router.get('/', protect, async (req, res) => {
    try {
        const payments = await Payment.find({ patient_id: req.user._id });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
