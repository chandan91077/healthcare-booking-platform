// Payments route:
// Handles payment creation/verification and settlement reporting for admin/doctor views.
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { protect } = require('../middleware/authMiddleware');

const CASHFREE_API_VERSION = '2023-08-01';

function isProductionCashfreeEnv() {
    return String(process.env.CASHFREE_ENV || '').trim().toLowerCase() === 'production';
}

function getCashfreeBaseUrl() {
    return isProductionCashfreeEnv()
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
        
}

function getCashfreeHeaders() {
    return {
        'x-client-id': process.env.CASHFREE_KEY_ID,
        'x-client-secret': process.env.CASHFREE_KEY_SECRET,
        'x-api-version': CASHFREE_API_VERSION,
        'Content-Type': 'application/json',
    };
}

function isLocalhostUrl(url) {
    if (!url) return true;
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(String(url).trim());
}

async function confirmAppointmentPayment({ appointment, patientId, cashfreeOrderId, cashfreePaymentId, cashfreePaymentStatus }) {
    const existingPayment = await Payment.findOne({
        appointment_id: appointment._id,
        cashfree_order_id: cashfreeOrderId,
    });

    if (!existingPayment) {
        await Payment.create({
            appointment_id: appointment._id,
            patient_id: patientId,
            amount: Number(appointment.amount || 0),
            status: 'completed',
            settlement_status: 'unsettled',
            cashfree_order_id: cashfreeOrderId,
            cashfree_payment_id: cashfreePaymentId,
            cashfree_payment_status: cashfreePaymentStatus,
        });
    }

    appointment.payment_status = 'paid';
    appointment.status = 'confirmed';

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
            message: `Payment received. Your appointment on ${appointment.appointment_date} at ${appointment.appointment_time} is confirmed.`,
            data: {
                appointment_id: appointment._id,
                payment_method: 'online',
                payment_status: appointment.payment_status,
            },
        });
    } catch (notifyErr) {
        console.error('Failed to create payment confirmation notification', notifyErr);
    }
}

function buildDoctorKey(doctor) {
    if (!doctor) return null;
    const doctorId = String(doctor._id || doctor.id || '');
    if (!doctorId) return null;
    return doctorId;
}

function buildDoctorLabel(doctor) {
    const fullName = doctor?.user_id?.full_name || 'Doctor';
    return /^dr\.?\s/i.test(fullName) ? fullName : `Dr. ${fullName}`;
}

async function fetchCompletedPaymentsWithRelations(filter = {}) {
    return Payment.find({ status: 'completed', ...filter })
        .populate('patient_id', 'full_name email')
        .populate({
            path: 'appointment_id',
            populate: [
                {
                    path: 'doctor_id',
                    populate: { path: 'user_id', select: 'full_name email' },
                },
                { path: 'patient_id', select: 'full_name email' },
            ],
        })
        .sort({ createdAt: -1 });
}

function getPaymentAmount(payment) {
    return Number(payment?.amount || 0);
}

function getDoctorEarningAmount(payment) {
    const appointmentDoctorFee = Number(payment?.appointment_id?.doctor_fee);
    if (Number.isFinite(appointmentDoctorFee) && appointmentDoctorFee > 0) {
        return appointmentDoctorFee;
    }

    const appointmentAmount = Number(payment?.appointment_id?.amount || 0);
    const appointmentPlatformFee = Number(payment?.appointment_id?.platform_fee || 0);
    if (Number.isFinite(appointmentAmount) && appointmentAmount > 0) {
        if (Number.isFinite(appointmentPlatformFee) && appointmentPlatformFee > 0) {
            return Math.max(0, appointmentAmount - appointmentPlatformFee);
        }
        return appointmentAmount;
    }

    const paymentAmount = getPaymentAmount(payment);
    if (Number.isFinite(paymentAmount) && paymentAmount > 0) {
        if (Number.isFinite(appointmentPlatformFee) && appointmentPlatformFee > 0) {
            return Math.max(0, paymentAmount - appointmentPlatformFee);
        }
        return paymentAmount;
    }

    if (Number.isFinite(appointmentDoctorFee) && appointmentDoctorFee >= 0) {
        return appointmentDoctorFee;
    }

    return 0;
}

function getPaymentSettledAmount(payment) {
    const amount = getDoctorEarningAmount(payment);
    if (payment?.settlement_status === 'settled') {
        return amount;
    }

    const explicitSettledAmount = Number(payment?.settled_amount || 0);
    if (!Number.isFinite(explicitSettledAmount) || explicitSettledAmount <= 0) {
        return 0;
    }

    return Math.min(explicitSettledAmount, amount);
}

function getPaymentUnsettledAmount(payment) {
    const amount = getDoctorEarningAmount(payment);
    const settledAmount = getPaymentSettledAmount(payment);
    return Math.max(0, amount - settledAmount);
}

router.post('/cashfree/order', protect, async (req, res) => {
    try {
        const { appointment_id } = req.body || {};

        if (!appointment_id) {
            return res.status(400).json({ message: 'appointment_id is required' });
        }

        if (!process.env.CASHFREE_KEY_ID || !process.env.CASHFREE_KEY_SECRET) {
            return res.status(500).json({ message: 'Cashfree credentials are not configured on the server' });
        }

        const appointment = await Appointment.findById(appointment_id).populate({
            path: 'doctor_id',
            populate: { path: 'user_id', select: 'full_name' },
        });

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.patient_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this appointment payment' });
        }

        if (appointment.payment_status === 'paid') {
            return res.status(400).json({ message: 'Appointment is already paid' });
        }

        const orderId = `appt_${appointment._id}_${Date.now()}`.slice(0, 45);
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';

        if (isProductionCashfreeEnv() && isLocalhostUrl(frontendBaseUrl)) {
            return res.status(400).json({
                message: 'Production Cashfree requires a public FRONTEND_URL (not localhost). Update FRONTEND_URL in server .env or use CASHFREE_ENV=sandbox for local testing.',
            });
        }

        const orderPayload = {
            order_id: orderId,
            order_amount: Number(appointment.amount || 0),
            order_currency: 'INR',
            customer_details: {
                customer_id: String(req.user._id),
                customer_name: req.user.full_name || 'Patient',
                customer_email: req.user.email || 'patient@example.com',
                customer_phone: req.user.phone || '9999999999',
            },
            order_meta: {
                return_url: `${frontendBaseUrl}/payment/${appointment._id}?cashfree_order_id=${orderId}`,
            },
            order_note: `Appointment payment for ${appointment?.doctor_id?.user_id?.full_name || 'Doctor'}`,
        };

        const { data } = await axios.post(`${getCashfreeBaseUrl()}/orders`, orderPayload, {
            headers: getCashfreeHeaders(),
        });

        res.json({
            order_id: data.order_id,
            payment_session_id: data.payment_session_id,
            cashfree_env: isProductionCashfreeEnv() ? 'production' : 'sandbox',
        });
    } catch (error) {
        const providerStatus = Number(error?.response?.status || 0);
        const providerMessage =
            error?.response?.data?.message ||
            error?.response?.data?.error_description ||
            error?.response?.data?.error ||
            error?.message ||
            'Failed to create Cashfree order';

        const statusCode = providerStatus >= 400 && providerStatus < 500 ? 400 : 500;
        res.status(statusCode).json({ message: providerMessage });
    }
});

router.post('/cashfree/verify', protect, async (req, res) => {
    try {
        const { appointment_id, order_id } = req.body || {};

        if (!appointment_id || !order_id) {
            return res.status(400).json({ message: 'appointment_id and order_id are required' });
        }

        const appointment = await Appointment.findById(appointment_id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.patient_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this appointment payment' });
        }

        const { data } = await axios.get(`${getCashfreeBaseUrl()}/orders/${order_id}/payments`, {
            headers: getCashfreeHeaders(),
        });

        const payments = Array.isArray(data) ? data : [];
        const successfulPayment = payments.find((payment) => payment.payment_status === 'SUCCESS');

        if (!successfulPayment) {
            // Payment failed — free the time slot
            appointment.status = 'cancelled';
            appointment.payment_status = 'failed';
            appointment.notes = (appointment.notes || '') + ' Payment failed or not completed.';
            await appointment.save();

            return res.status(400).json({
                message: 'Payment not completed. Appointment cancelled and time slot freed.',
                payment_status: payments[0]?.payment_status || 'PENDING',
            });
        }

        await confirmAppointmentPayment({
            appointment,
            patientId: req.user._id,
            cashfreeOrderId: order_id,
            cashfreePaymentId: successfulPayment.cf_payment_id || successfulPayment.payment_id || '',
            cashfreePaymentStatus: successfulPayment.payment_status,
        });

        res.json({
            message: 'Payment verified successfully',
            payment_status: successfulPayment.payment_status,
            appointment_status: appointment.status,
        });
    } catch (error) {
        const providerStatus = Number(error?.response?.status || 0);
        const providerMessage =
            error?.response?.data?.message ||
            error?.response?.data?.error_description ||
            error?.response?.data?.error ||
            error?.message ||
            'Failed to verify Cashfree payment';

        const statusCode = providerStatus >= 400 && providerStatus < 500 ? 400 : 500;
        res.status(statusCode).json({ message: providerMessage });
    }
});

// Explicitly mark a payment as failed (called by clients when Cashfree SDK errors out)
router.post('/cashfree/fail', protect, async (req, res) => {
    try {
        const { appointment_id } = req.body || {};
        if (!appointment_id) {
            return res.status(400).json({ message: 'appointment_id is required' });
        }

        const appointment = await Appointment.findById(appointment_id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.patient_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (appointment.payment_status === 'paid') {
            return res.status(400).json({ message: 'Appointment is already paid' });
        }

        appointment.status = 'cancelled';
        appointment.payment_status = 'failed';
        appointment.notes = (appointment.notes || '') + ' Payment failed via client report.';
        await appointment.save();

        res.json({ message: 'Appointment cancelled due to payment failure. Time slot freed.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Process a payment
router.post('/', protect, async (req, res) => {
    try {
        const {
            appointment_id,
            razorpay_order_id,
            razorpay_payment_id,
            payment_method = 'online',
        } = req.body;

        const method = String(payment_method).toLowerCase() === 'cash' ? 'cash' : 'online';

        const appointment = await Appointment.findById(appointment_id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.patient_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this appointment payment' });
        }

        // Create payment record
        const payment = await Payment.create({
            appointment_id,
            patient_id: req.user._id,
            amount: Number(appointment.amount || 0),
            status: method === 'cash' ? 'pending' : 'completed',
            settlement_status: 'unsettled',
            razorpay_order_id: method === 'online' ? razorpay_order_id : undefined,
            razorpay_payment_id: method === 'online' ? razorpay_payment_id : undefined,
        });

        // Online payments confirm immediately, cash stays pending until handled later.
        appointment.payment_status = method === 'online' ? 'paid' : 'pending';
        appointment.status = method === 'online' ? 'confirmed' : 'pending';

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
                type: method === 'online' ? 'appointment_confirmed' : 'payment_pending',
                message:
                    method === 'online'
                        ? `Payment received. Your appointment on ${appointment.appointment_date} at ${appointment.appointment_time} is confirmed.`
                        : `Cash payment is pending for your appointment on ${appointment.appointment_date} at ${appointment.appointment_time}. It will be cancelled automatically if not completed in time.`,
                data: {
                    appointment_id: appointment._id,
                    payment_method: method,
                    payment_status: appointment.payment_status,
                },
            });
        } catch (notifyErr) {
            console.error('Failed to create payment confirmation notification', notifyErr);
        }

        res.status(201).json({
            payment,
            appointment,
            appointment_confirmed: appointment.status === 'confirmed',
            appointment_pending: appointment.status === 'pending',
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get payments for a user (optional, for history)
router.get('/', protect, async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            const payments = await fetchCompletedPaymentsWithRelations();
            return res.json(payments);
        }

        if (req.user.role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: req.user._id });
            if (!doctor) {
                return res.json([]);
            }

            const payments = await fetchCompletedPaymentsWithRelations();
            const doctorPayments = payments.filter((payment) => {
                const doctorId = payment?.appointment_id?.doctor_id?._id || payment?.appointment_id?.doctor_id;
                return doctorId && doctorId.toString() === doctor._id.toString();
            });

            return res.json(doctorPayments);
        }

        const payments = await Payment.find({ patient_id: req.user._id });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/admin/all', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const payments = await fetchCompletedPaymentsWithRelations();
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/admin/doctor-earnings', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const payments = await fetchCompletedPaymentsWithRelations();
        const grouped = new Map();

        for (const payment of payments) {
            const appointment = payment.appointment_id;
            const doctor = appointment?.doctor_id;
            const doctorKey = buildDoctorKey(doctor);
            if (!doctorKey) continue;

            if (!grouped.has(doctorKey)) {
                grouped.set(doctorKey, {
                    doctor_id: doctorKey,
                    doctor_name: buildDoctorLabel(doctor),
                    doctor_email: doctor?.user_id?.email || null,
                    total_earnings: 0,
                    settled_earnings: 0,
                    unsettled_earnings: 0,
                    total_payments: 0,
                    unsettled_payments: 0,
                    normal_appointments: 0,
                    emergency_appointments: 0,
                });
            }

            const row = grouped.get(doctorKey);
            const amount = getDoctorEarningAmount(payment);
            const settledAmount = getPaymentSettledAmount(payment);
            const unsettledAmount = getPaymentUnsettledAmount(payment);
            const hasUnsettledAmount = unsettledAmount > 1e-9;
            const appointmentType = String(appointment?.appointment_type || '').toLowerCase();

            row.total_earnings += amount;
            row.total_payments += 1;

            if (appointmentType === 'emergency') {
                row.emergency_appointments += 1;
            } else {
                row.normal_appointments += 1;
            }

            row.settled_earnings += settledAmount;
            row.unsettled_earnings += unsettledAmount;

            if (hasUnsettledAmount) {
                row.unsettled_payments += 1;
            }
        }

        res.json(Array.from(grouped.values()));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.patch('/admin/settle-doctor/:doctorId', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const { doctorId } = req.params;
        const { notes = '', settlement_amount } = req.body || {};

        let requestedAmount = null;
        if (settlement_amount !== undefined && settlement_amount !== null && settlement_amount !== '') {
            requestedAmount = Number(settlement_amount);
            if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
                return res.status(400).json({ message: 'settlement_amount must be a positive number' });
            }
        }

        const payments = await fetchCompletedPaymentsWithRelations();
        const doctorPayments = payments.filter((payment) => {
            const appointmentDoctorId = payment?.appointment_id?.doctor_id?._id || payment?.appointment_id?.doctor_id;
            const isUnsettled = getPaymentUnsettledAmount(payment) > 1e-9;
            return appointmentDoctorId && appointmentDoctorId.toString() === doctorId.toString() && isUnsettled;
        });

        if (doctorPayments.length === 0) {
            return res.status(404).json({ message: 'No unsettled completed payments found for this doctor' });
        }

        const orderedDoctorPayments = [...doctorPayments].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const totalUnsettledAmount = orderedDoctorPayments.reduce((sum, payment) => {
            return sum + getPaymentUnsettledAmount(payment);
        }, 0);

        const targetAmount = requestedAmount === null
            ? totalUnsettledAmount
            : Math.min(requestedAmount, totalUnsettledAmount);

        const settledAt = new Date();
        let remainingToSettle = targetAmount;
        let settledAmount = 0;
        let touchedPaymentsCount = 0;

        for (const payment of orderedDoctorPayments) {
            if (remainingToSettle <= 1e-9) break;

            const unsettledAmount = getPaymentUnsettledAmount(payment);
            if (unsettledAmount <= 1e-9) continue;

            const settleNow = Math.min(unsettledAmount, remainingToSettle);
            const nextSettledAmount = getPaymentSettledAmount(payment) + settleNow;
            const paymentAmount = getDoctorEarningAmount(payment);
            const isNowFullySettled = nextSettledAmount >= paymentAmount - 1e-9;

            payment.settled_amount = Number(nextSettledAmount.toFixed(2));
            payment.last_settlement_amount = Number(settleNow.toFixed(2));
            payment.settlement_status = isNowFullySettled ? 'settled' : 'unsettled';
            payment.settled_at = settledAt;
            payment.settled_by = req.user._id;
            payment.settlement_notes = String(notes || '');
            await payment.save();

            settledAmount += settleNow;
            remainingToSettle -= settleNow;
            touchedPaymentsCount += 1;
        }

        if (settledAmount <= 1e-9) {
            return res.status(400).json({ message: 'Unable to settle the requested amount' });
        }

        settledAmount = Number(settledAmount.toFixed(2));
        const remainingUnsettledAmount = totalUnsettledAmount - settledAmount;

        try {
            const Notification = require('../models/Notification');
            const doctorUserId = orderedDoctorPayments[0]?.appointment_id?.doctor_id?.user_id?._id;
            if (doctorUserId) {
                const noteSuffix = String(notes || '').trim() ? ` Note: ${String(notes).trim()}` : '';
                await Notification.create({
                    user_id: doctorUserId,
                    type: 'earning_settlement',
                    message: `Admin settled ₹${settledAmount} of your earnings. Remaining unsettled: ₹${remainingUnsettledAmount}.${noteSuffix}`,
                    data: {
                        settled_amount: settledAmount,
                        remaining_unsettled_amount: remainingUnsettledAmount,
                        settled_at: settledAt,
                    },
                });
            }
        } catch (notifyErr) {
            console.error('Settlement notification failed', notifyErr);
        }

        res.json({
            message: 'Doctor earnings settled successfully',
            settled_payments: touchedPaymentsCount,
            settled_amount: settledAmount,
            requested_settlement_amount: requestedAmount,
            total_unsettled_before_settlement: totalUnsettledAmount,
            remaining_unsettled_amount: Number(remainingUnsettledAmount.toFixed(2)),
            settled_at: settledAt,
            note: String(notes || ''),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/doctor/summary', protect, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Not authorized as doctor' });
        }

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor profile not found' });
        }

        const payments = await fetchCompletedPaymentsWithRelations();
        const doctorPayments = payments.filter((payment) => {
            const appointmentDoctorId = payment?.appointment_id?.doctor_id?._id || payment?.appointment_id?.doctor_id;
            return appointmentDoctorId && appointmentDoctorId.toString() === doctor._id.toString();
        });

        const grossEarnings = doctorPayments.reduce((sum, payment) => sum + getDoctorEarningAmount(payment), 0);
        const settledEarnings = doctorPayments.reduce((sum, payment) => sum + getPaymentSettledAmount(payment), 0);
        const unsettledEarnings = doctorPayments.reduce((sum, payment) => sum + getPaymentUnsettledAmount(payment), 0);

        const recentSettlements = doctorPayments
            .filter((payment) => Number(payment.last_settlement_amount || 0) > 0)
            .slice(0, 10)
            .map((payment) => ({
                payment_id: payment._id,
                amount: Number(payment.last_settlement_amount || payment.amount || 0),
                settled_at: payment.settled_at,
                settlement_notes: payment.settlement_notes || '',
                appointment_id: payment?.appointment_id?._id || payment?.appointment_id,
                appointment_date: payment?.appointment_id?.appointment_date || null,
                appointment_time: payment?.appointment_id?.appointment_time || null,
            }));

        res.json({
            total_earnings: Number(grossEarnings.toFixed(2)),
            gross_earnings: grossEarnings,
            settled_earnings: Number(settledEarnings.toFixed(2)),
            unsettled_earnings: Number(unsettledEarnings.toFixed(2)),
            total_payments: doctorPayments.length,
            settled_payments: doctorPayments.filter((payment) => payment.settlement_status === 'settled').length,
            unsettled_payments: doctorPayments.filter((payment) => getPaymentUnsettledAmount(payment) > 1e-9).length,
            recent_settlements: recentSettlements,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
