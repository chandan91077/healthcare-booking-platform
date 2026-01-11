const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');

// Get appointment by ID
router.get('/:id', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate({
                path: 'doctor_id',
                populate: { path: 'user_id', select: 'full_name' }
            })
            .populate('patient_id', 'full_name email avatar_url');

        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
        res.json(appointment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get appointments for a specific doctor (optionally filtered by date)
router.get('/doctor/:doctorId', protect, async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { date } = req.query;
        const query = { doctor_id: doctorId };
        if (date) query.appointment_date = date;

        const appointments = await Appointment.find(query)
            .populate('patient_id', 'full_name email')
            .sort({ appointment_date: -1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all appointments for a user (patient or doctor)
router.get('/', protect, async (req, res) => {
    try {
        let query = {};
        const { role, _id } = req.user;

        if (role === 'patient') {
            query.patient_id = _id;
        } else if (role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: _id });
            if (doctor) {
                query.doctor_id = doctor._id;
            } else {
                return res.json([]); // valid doctor profile needed
            }
        }

        const appointments = await Appointment.find(query)
            .populate({
                path: 'doctor_id',
                populate: { path: 'user_id', select: 'full_name' }
            })
            .populate('patient_id', 'full_name email avatar_url')
            .sort({ appointment_date: -1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create appointment (patient)
router.post('/', protect, async (req, res) => {
    try {
        const { doctor_id, appointment_date, appointment_time, appointment_type = 'scheduled', amount } = req.body;

        // Only patients can create appointments
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can create appointments' });
        }

        const patient_id = req.user._id;

        const doctor = await Doctor.findById(doctor_id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

        // For scheduled appointments, check doctor availability and slot free
        if (appointment_type !== 'emergency') {
            const dateObj = new Date(appointment_date);
            const dayOfWeek = dateObj.getDay(); // 0-6

            const avail = await require('../models/Availability').findOne({ doctor_id, day_of_week: dayOfWeek, is_available: true });
            if (!avail) {
                return res.status(400).json({ message: 'Doctor is not available on this date' });
            }

            // Check time within availability (start_time <= appointment_time < end_time)
            const toMinutes = (t) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            if (toMinutes(appointment_time) < toMinutes(avail.start_time) || toMinutes(appointment_time) >= toMinutes(avail.end_time)) {
                return res.status(400).json({ message: 'Selected time is outside doctor availability' });
            }

            // Check existing non-cancelled appointment at same time
            const existing = await Appointment.findOne({ doctor_id, appointment_date, appointment_time, status: { $ne: 'cancelled' } });
            if (existing) {
                return res.status(409).json({ message: 'This slot is already booked' });
            }
        } else {
            // Emergency booking: allow at any time and preempt existing non-cancelled appointments
            const conflicting = await Appointment.find({ doctor_id, appointment_date, appointment_time, status: { $ne: 'cancelled' } });
            const Notification = require('../models/Notification');
            for (const appt of conflicting) {
                appt.status = 'cancelled';
                appt.notes = (appt.notes || '') + ' Preempted by emergency booking';
                await appt.save();

                // Create a notification for the affected patient
                try {
                    await Notification.create({
                        user_id: appt.patient_id,
                        type: 'preempted',
                        message: `Your appointment on ${appointment_date} at ${appointment_time} with the doctor was cancelled due to an emergency booking.`,
                        data: { appointment_id: appt._id, doctor_id, appointment_date, appointment_time },
                    });
                } catch (nerr) {
                    console.error('Failed to create notification for preempted appointment', nerr);
                }
            }
        }

        const appointment = await Appointment.create({
            doctor_id,
            patient_id,
            appointment_date,
            appointment_time,
            appointment_type,
            amount,
            status: appointment_type === 'emergency' ? 'confirmed' : 'pending',
            payment_status: appointment_type === 'emergency' ? 'paid' : 'pending',
            chat_unlocked: appointment_type === 'emergency',
            video_unlocked: appointment_type === 'emergency',
        });

        res.status(201).json(appointment);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
});

// Update appointment (e.g. status)
router.put('/:id', protect, async (req, res) => {
    try {
        const { status, payment_status, notes } = req.body;
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        // Authorization: only the doctor assigned or the patient can update (depending on field)
        // For status updates to 'confirmed'/'cancelled' by doctor:
        if (status && req.user.role === 'doctor') {
            appointment.status = status;
            if (status === 'confirmed') {
                appointment.chat_unlocked = true;
                appointment.video_unlocked = true;
            }
        } else if (status === 'cancelled' && req.user.role === 'patient') {
            appointment.status = status;
        }

        if (payment_status) appointment.payment_status = payment_status;
        if (notes) appointment.notes = notes;

        await appointment.save();
        res.json(appointment);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Doctor-only: set chat/video permissions and optionally set/send zoom link
router.put('/:id/permissions', protect, async (req, res) => {
    try {
        const { chat_unlocked, video_unlocked, zoom_join_url, auto_send, meeting_provider, meeting_time } = req.body;
        const appointment = await Appointment.findById(req.params.id)
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email locale' } })
            .populate({ path: 'patient_id', select: 'full_name email locale' });
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        // Only the doctor who owns this appointment can change permissions
        const doctor = await Doctor.findById(appointment.doctor_id._id || appointment.doctor_id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
        if (req.user.role !== 'doctor' || req.user._id.toString() !== doctor.user_id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const Notification = require('../models/Notification');

        if (typeof chat_unlocked !== 'undefined') {
            const prev = appointment.chat_unlocked;
            appointment.chat_unlocked = !!chat_unlocked;
            if (appointment.chat_unlocked && !prev) {
                // notify patient that chat is enabled (generic message, no links)
                await Notification.create({
                    user_id: appointment.patient_id,
                    type: 'chat_available',
                    message: `Chat has been enabled for your appointment`,
                    data: { appointment_id: appointment._id }
                });
                // optional confirmation for doctor
                if (doctor.user_id) {
                    await Notification.create({ user_id: doctor.user_id, type: 'chat_available_confirmation', message: `You enabled chat for the appointment on ${appointment.appointment_date}`, data: { appointment_id: appointment._id } });
                }
            }
            if (!appointment.chat_unlocked && prev) {
                // notify patient that chat is disabled (generic message)
                await Notification.create({
                    user_id: appointment.patient_id,
                    type: 'chat_disabled',
                    message: `Chat has been disabled for your appointment`,
                    data: { appointment_id: appointment._id }
                });
                if (doctor.user_id) {
                    await Notification.create({ user_id: doctor.user_id, type: 'chat_disabled_confirmation', message: `You disabled chat for the appointment on ${appointment.appointment_date}`, data: { appointment_id: appointment._id } });
                }
            }
        }

        if (typeof meeting_provider !== 'undefined') {
            appointment.meeting_provider = meeting_provider || '';
        }
        if (typeof meeting_time !== 'undefined') {
            appointment.meeting_time = meeting_time || null;
        }

        if (typeof video_unlocked !== 'undefined') {
            appointment.video_unlocked = !!video_unlocked;
            if (appointment.video_unlocked) {
                // set or generate a join link if not provided
                if (zoom_join_url) {
                    appointment.zoom_join_url = zoom_join_url;
                } else if (!appointment.zoom_join_url) {
                    // generate a simple placeholder join link
                    appointment.zoom_join_url = `https://zoom.${appointment.meeting_provider === 'meet' ? 'google.com' : 'us'}/j/${appointment._id.toString().slice(-8)}`;
                }

                if (auto_send) {
                    // Render localized templates and create notifications for both users
                    const localePatient = (appointment.patient_id && appointment.patient_id.locale) || 'en';
                    const localeDoctor = (doctor.user_id && doctor.user_id.locale) || 'en';

                    const { renderTemplate } = require('../utils/renderTemplate');
                    const emailService = require('../services/emailService');

                    const tplBase = path.join(__dirname, '..', 'email', 'templates', localePatient, 'video_link');
                    const msgPatientText = renderTemplate(tplBase + '.txt', { name: appointment.patient_id.full_name || appointment.patient_id.email, doctor: doctor.user_id?.full_name || 'Doctor', date: appointment.appointment_date, time: appointment.appointment_time, link: appointment.zoom_join_url });
                    const msgPatientHtml = renderTemplate(tplBase + '.html', { name: appointment.patient_id.full_name || appointment.patient_id.email, doctor: doctor.user_id?.full_name || 'Doctor', date: appointment.appointment_date, time: appointment.appointment_time, link: appointment.zoom_join_url });

                    const tplBaseDoc = path.join(__dirname, '..', 'email', 'templates', localeDoctor, 'video_link');
                    const msgDoctorText = renderTemplate(tplBaseDoc + '.txt', { name: doctor.user_id?.full_name || doctor.user_id?.email, doctor: doctor.user_id?.full_name || 'Doctor', date: appointment.appointment_date, time: appointment.appointment_time, link: appointment.zoom_join_url });
                    const msgDoctorHtml = renderTemplate(tplBaseDoc + '.html', { name: doctor.user_id?.full_name || doctor.user_id?.email, doctor: doctor.user_id?.full_name || 'Doctor', date: appointment.appointment_date, time: appointment.appointment_time, link: appointment.zoom_join_url });

                    await Notification.create({ user_id: appointment.patient_id, type: 'video_link', message: msgPatientText, data: { appointment_id: appointment._id, zoom_join_url: appointment.zoom_join_url } });
                    await Notification.create({ user_id: doctor.user_id, type: 'video_link', message: msgDoctorText, data: { appointment_id: appointment._id, zoom_join_url: appointment.zoom_join_url } });

                    // send emails via selected provider (async, don't block response)
                    (async () => {
                        try {
                            await emailService.sendEmail({ to: appointment.patient_id.email, subject: `Video Call Link for ${appointment.appointment_date}`, text: msgPatientText, html: msgPatientHtml });
                        } catch (err) {
                            console.error('Email send to patient failed', err);
                        }
                        try {
                            await emailService.sendEmail({ to: doctor.user_id.email, subject: `Video Call Enabled - ${appointment.appointment_date}`, text: msgDoctorText, html: msgDoctorHtml });
                        } catch (err) {
                            console.error('Email send to doctor failed', err);
                        }
                    })();
                }
            } else {
                appointment.zoom_join_url = null;
            }
        }

        await appointment.save();
        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
