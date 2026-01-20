const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/authMiddleware');
const axios = require('axios');
const crypto = require('crypto');

// Create Cashfree payment order
router.post('/create-order', protect, async (req, res) => {
    try {
        const { appointment_id, amount } = req.body;

        if (!appointment_id || !amount) {
            return res.status(400).json({ message: 'Appointment ID and amount are required' });
        }

        // Verify appointment exists and belongs to user
        const appointment = await Appointment.findById(appointment_id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.patient_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Generate unique order ID
        const orderId = `order_${Date.now()}_${appointment_id.slice(-8)}`;
        
        // Cashfree API endpoint (sandbox for testing, production for live)
        const cashfreeUrl = process.env.CASHFREE_ENV === 'production' 
            ? 'https://api.cashfree.com/pg/orders'
            : 'https://sandbox.cashfree.com/pg/orders';

        const orderData = {
            order_id: orderId,
            order_amount: amount,
            order_currency: 'INR',
            customer_details: {
                customer_id: req.user._id.toString(),
                customer_name: req.user.full_name || 'Patient',
                customer_email: req.user.email,
                customer_phone: req.user.phone || '9999999999'
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL}/payment/callback/${appointment_id}`,
                notify_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/webhook`
            },
            order_note: `Payment for Appointment ${appointment_id}`
        };

        const response = await axios.post(cashfreeUrl, orderData, {
            headers: {
                'x-client-id': process.env.CASHFREE_KEY_ID,
                'x-client-secret': process.env.CASHFREE_KEY_SECRET,
                'x-api-version': '2023-08-01',
                'Content-Type': 'application/json'
            }
        });

        res.json({
            order_id: response.data.order_id,
            payment_session_id: response.data.payment_session_id,
            order_token: response.data.order_token,
            cf_order_id: response.data.cf_order_id
        });
    } catch (error) {
        console.error('Cashfree order creation error:', error.response?.data || error.message);
        res.status(500).json({ 
            message: 'Failed to create payment order', 
            error: error.response?.data?.message || error.message 
        });
    }
});

// Process a payment
router.post('/', protect, async (req, res) => {
    try {
        const { appointment_id, amount, razorpay_order_id, razorpay_payment_id, cashfree_order_id, payment_method } = req.body;

        // Create payment record
        const payment = await Payment.create({
            appointment_id,
            patient_id: req.user._id,
            amount,
            status: 'completed', // Simulating success
            razorpay_order_id: razorpay_order_id || cashfree_order_id,
            razorpay_payment_id: razorpay_payment_id || cashfree_order_id,
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

// Admin: Get doctor revenue summary (grouped by doctor)
router.get('/admin/doctor-revenue', protect, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const { startDate, endDate } = req.query;
        
        // Build date filter
        const dateFilter = {};
        if (startDate) {
            dateFilter.$gte = new Date(startDate);
        }
        if (endDate) {
            dateFilter.$lte = new Date(endDate);
        }

        // Find all completed appointments with date filter
        const matchStage = dateFilter.$gte || dateFilter.$lte
            ? { appointment_date: dateFilter }
            : {};

        const appointments = await Appointment.find({
            payment_status: 'paid',
            ...matchStage
        }).populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } });

        // Group by doctor and calculate totals
        const doctorRevenue = {};
        
        appointments.forEach(appt => {
            const doctorId = appt.doctor_id?._id?.toString();
            const doctorName = appt.doctor_id?.user_id?.full_name || 'Unknown Doctor';
            const doctorEmail = appt.doctor_id?.user_id?.email || '';
            const baseAmount = appt.base_amount || appt.amount || 0;
            const platformFee = appt.platform_fee || 0;

            if (!doctorRevenue[doctorId]) {
                doctorRevenue[doctorId] = {
                    doctorId,
                    doctorName,
                    doctorEmail,
                    totalEarnings: 0,
                    platformFeesCollected: 0,
                    totalAppointments: 0,
                    completedConsultations: 0,
                    emergencyBookings: 0,
                    appointments: []
                };
            }

            doctorRevenue[doctorId].totalEarnings += baseAmount;
            doctorRevenue[doctorId].platformFeesCollected += platformFee;
            doctorRevenue[doctorId].totalAppointments += 1;
            
            // Count completed consultations
            if (appt.status === 'completed') {
                doctorRevenue[doctorId].completedConsultations += 1;
            }
            
            // Count emergency bookings
            if (appt.appointment_type === 'emergency') {
                doctorRevenue[doctorId].emergencyBookings += 1;
            }
            
            doctorRevenue[doctorId].appointments.push({
                _id: appt._id,
                appointment_date: appt.appointment_date,
                appointment_time: appt.appointment_time,
                patient_name: appt.patient_id?.full_name || 'Unknown Patient',
                base_amount: baseAmount,
                platform_fee: platformFee,
                total_amount: appt.amount,
                status: appt.status,
                appointment_type: appt.appointment_type
            });
        });

        const revenueList = Object.values(doctorRevenue).sort((a, b) => b.totalEarnings - a.totalEarnings);
        
        res.json({
            totalPlatformFees: revenueList.reduce((sum, dr) => sum + dr.platformFeesCollected, 0),
            totalDoctorEarnings: revenueList.reduce((sum, dr) => sum + dr.totalEarnings, 0),
            doctorCount: revenueList.length,
            doctorRevenue: revenueList
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Mark doctor settlement
router.post('/admin/settlements', protect, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const { doctor_id, amount, period_start, period_end, payment_method, transaction_id, notes } = req.body;

        if (!doctor_id || !amount || !period_start || !period_end) {
            return res.status(400).json({ message: 'Missing required fields: doctor_id, amount, period_start, period_end' });
        }

        const Settlement = require('../models/Settlement');
        const settlement = await Settlement.create({
            doctor_id,
            amount,
            period_start: new Date(period_start),
            period_end: new Date(period_end),
            payment_method: payment_method || 'bank_transfer',
            transaction_id,
            notes,
            settled_by: req.user._id,
            settled_date: new Date()
        });

        res.status(201).json({
            message: 'Settlement recorded successfully',
            settlement
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Get settlements for a doctor
router.get('/admin/settlements/:doctorId', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const Settlement = require('../models/Settlement');
        const settlements = await Settlement.find({ doctor_id: req.params.doctorId })
            .populate('settled_by', 'full_name')
            .sort({ settled_date: -1 });

        res.json(settlements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Doctor: Get their own settlements
router.get('/settlements', protect, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const Settlement = require('../models/Settlement');
        const Doctor = require('../models/Doctor');
        
        // Get doctor's database ID
        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor record not found' });
        }

        const settlements = await Settlement.find({ doctor_id: doctor._id })
            .populate('settled_by', 'full_name')
            .sort({ settled_date: -1 });

        res.json(settlements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Cashfree Webhook for payment verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        const rawBody = req.body.toString();
        
        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', process.env.CASHFREE_KEY_SECRET)
            .update(timestamp + rawBody)
            .digest('base64');

        if (signature !== expectedSignature) {
            return res.status(401).json({ message: 'Invalid signature' });
        }

        const event = JSON.parse(rawBody);
        
        // Handle payment success event
        if (event.type === 'PAYMENT_SUCCESS_WEBHOOK') {
            const { order } = event.data;
            const appointmentId = order.order_tags?.appointment_id;
            
            if (appointmentId) {
                const appointment = await Appointment.findById(appointmentId);
                if (appointment && appointment.payment_status !== 'paid') {
                    appointment.payment_status = 'paid';
                    appointment.status = 'confirmed';
                    
                    if (appointment.appointment_type === 'emergency') {
                        appointment.chat_unlocked = true;
                        appointment.video_unlocked = true;
                    }
                    
                    await appointment.save();
                    
                    // Create payment record
                    await Payment.create({
                        appointment_id: appointmentId,
                        patient_id: appointment.patient_id,
                        amount: order.order_amount,
                        status: 'completed',
                        razorpay_order_id: order.order_id,
                        razorpay_payment_id: order.cf_order_id
                    });
                }
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
