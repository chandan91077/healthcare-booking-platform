const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/authMiddleware');

// Process a payment
router.post('/', protect, async (req, res) => {
    try {
        const {
            appointment_id,
            amount,
            razorpay_order_id,
            razorpay_payment_id,
            payment_method = 'online',
        } = req.body;

        const method = String(payment_method).toLowerCase() === 'cash' ? 'cash' : 'online';

        // Create payment record
        const payment = await Payment.create({
            appointment_id,
            patient_id: req.user._id,
            amount,
            status: method == 'cash' ? 'pending' : 'completed',
            razorpay_order_id: method == 'online' ? razorpay_order_id : undefined,
            razorpay_payment_id: method == 'online' ? razorpay_payment_id : undefined,
        });

        // Update appointment status
        const appointment = await Appointment.findById(appointment_id);
        if (appointment) {
            appointment.payment_status = method == 'online' ? 'paid' : 'pending';
            appointment.status = 'confirmed';

            // Unlock chat/video if emergency
            if (appointment.appointment_type === 'emergency') {
                appointment.chat_unlocked = true;
                appointment.video_unlocked = true;
            }
            await appointment.save();

            try {
                const Notification = require('../models/Notification');
                await Notification.create({
                    user_id: appointment.patient_id,
                    type: 'appointment_confirmed',
                    message:
                        method == 'online'
                            ? `Payment received. Your appointment on ${appointment.appointment_date} at ${appointment.appointment_time} is confirmed.`
                            : `Cash payment selected. Your appointment on ${appointment.appointment_date} at ${appointment.appointment_time} is confirmed.`,
                    data: {
                        appointment_id: appointment._id,
                        payment_method: method,
                        payment_status: appointment.payment_status,
                    },
                });
            } catch (notifyErr) {
                console.error('Failed to create payment confirmation notification', notifyErr);
            }
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
