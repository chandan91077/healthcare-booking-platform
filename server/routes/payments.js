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
        const appointment = await Appointment.findById(appointment_id)
            .populate('patient_id', 'full_name email')
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } });
        
        if (appointment) {
            appointment.payment_status = 'paid'; // Match enum: ['pending', 'paid', 'failed']
            appointment.status = 'confirmed';

            // Unlock chat/video if emergency
            if (appointment.appointment_type === 'emergency') {
                appointment.chat_unlocked = true;
                appointment.video_unlocked = true;
            }
            await appointment.save();
            
            // Send payment confirmation emails
            try {
                const emailService = require('../services/emailService');
                const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                // Email to patient
                await emailService.sendEmail({
                    to: appointment.patient_id.email,
                    subject: 'Payment Successful - Appointment Confirmed - MediConnect',
                    text: `Dear ${appointment.patient_id.full_name},\n\nYour payment of ₹${amount} has been successfully processed.\n\nYour appointment is now confirmed!\n\nAppointment Details:\n- Doctor: ${appointment.doctor_id.user_id?.full_name || 'Doctor'}\n- Date: ${appointmentDate}\n- Time: ${appointment.appointment_time}\n- Amount Paid: ₹${amount}\n\nYou can now chat with your doctor through the MediConnect platform.\n\nThank you for using MediConnect.\n\nBest regards,\nThe MediConnect Team`,
                    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #10b981;">✓ Payment Successful</h2>
                        <p>Dear ${appointment.patient_id.full_name},</p>
                        <p style="color: #10b981; font-weight: bold;">Your payment of ₹${amount} has been successfully processed.</p>
                        <p style="font-size: 18px; font-weight: bold;">Your appointment is now confirmed!</p>
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Appointment Details</h3>
                            <p><strong>Doctor:</strong> ${appointment.doctor_id.user_id?.full_name || 'Doctor'}</p>
                            <p><strong>Date:</strong> ${appointmentDate}</p>
                            <p><strong>Time:</strong> ${appointment.appointment_time}</p>
                            <p><strong>Amount Paid:</strong> ₹${amount}</p>
                        </div>
                        <p>You can now chat with your doctor through the MediConnect platform.</p>
                        <p>Best regards,<br/>The MediConnect Team</p>
                    </div>`
                });
                
                // Email to doctor
                if (appointment.doctor_id.user_id?.email) {
                    await emailService.sendEmail({
                        to: appointment.doctor_id.user_id.email,
                        subject: 'Appointment Confirmed - Payment Received - MediConnect',
                        text: `Dear Dr. ${appointment.doctor_id.user_id?.full_name},\n\nPayment has been received for an appointment with ${appointment.patient_id.full_name}.\n\nThe appointment is now confirmed.\n\nAppointment Details:\n- Patient: ${appointment.patient_id.full_name}\n- Date: ${appointmentDate}\n- Time: ${appointment.appointment_time}\n- Amount: ₹${amount}\n\nBest regards,\nThe MediConnect Team`,
                        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #10b981;">Appointment Confirmed - Payment Received</h2>
                            <p>Dear Dr. ${appointment.doctor_id.user_id?.full_name},</p>
                            <p>Payment has been received for an appointment with ${appointment.patient_id.full_name}.</p>
                            <p style="color: #10b981; font-weight: bold;">The appointment is now confirmed.</p>
                            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0;">Appointment Details</h3>
                                <p><strong>Patient:</strong> ${appointment.patient_id.full_name}</p>
                                <p><strong>Date:</strong> ${appointmentDate}</p>
                                <p><strong>Time:</strong> ${appointment.appointment_time}</p>
                                <p><strong>Amount:</strong> ₹${amount}</p>
                            </div>
                            <p>Best regards,<br/>The MediConnect Team</p>
                        </div>`
                    });
                }
            } catch (emailError) {
                console.error('Failed to send payment confirmation emails:', emailError);
                // Don't fail the payment if email fails
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
