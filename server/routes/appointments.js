const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const zoomService = require('../services/zoomService');

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

        // Send appointment confirmation emails
        try {
            const emailService = require('../services/emailService');
            const patient = await User.findById(patient_id);
            const doctorWithUser = await Doctor.findById(doctor_id).populate('user_id', 'full_name email');
            
            const appointmentDate = new Date(appointment_date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            // Email to patient
            await emailService.sendEmail({
                to: patient.email,
                subject: `Appointment ${appointment_type === 'emergency' ? 'Confirmed' : 'Booking Received'} - MediConnect`,
                text: `Dear ${patient.full_name},\n\nYour ${appointment_type} appointment has been ${appointment_type === 'emergency' ? 'confirmed' : 'booked'}.\n\nAppointment Details:\n- Doctor: ${doctorWithUser.user_id?.full_name || 'Doctor'}\n- Date: ${appointmentDate}\n- Time: ${appointment_time}\n- Type: ${appointment_type}\n- Amount: ₹${amount}\n\n${appointment_type === 'emergency' ? 'Your emergency appointment is confirmed and payment has been processed.' : 'Please complete the payment to confirm your appointment.'}\n\nThank you for using MediConnect.\n\nBest regards,\nThe MediConnect Team`,
                html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #10b981;">Appointment ${appointment_type === 'emergency' ? 'Confirmed' : 'Booking Received'}</h2>
                    <p>Dear ${patient.full_name},</p>
                    <p>Your ${appointment_type} appointment has been ${appointment_type === 'emergency' ? 'confirmed' : 'booked'}.</p>
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Appointment Details</h3>
                        <p><strong>Doctor:</strong> ${doctorWithUser.user_id?.full_name || 'Doctor'}</p>
                        <p><strong>Date:</strong> ${appointmentDate}</p>
                        <p><strong>Time:</strong> ${appointment_time}</p>
                        <p><strong>Type:</strong> ${appointment_type}</p>
                        <p><strong>Amount:</strong> ₹${amount}</p>
                    </div>
                    ${appointment_type === 'emergency' ? '<p style="color: #10b981; font-weight: bold;">Your emergency appointment is confirmed and payment has been processed.</p>' : '<p style="color: #f59e0b;">Please complete the payment to confirm your appointment.</p>'}
                    <p>Best regards,<br/>The MediConnect Team</p>
                </div>`
            });
            
            // Email to doctor
            if (doctorWithUser.user_id?.email) {
                await emailService.sendEmail({
                    to: doctorWithUser.user_id.email,
                    subject: `New ${appointment_type === 'emergency' ? 'Emergency ' : ''}Appointment Booking - MediConnect`,
                    text: `Dear Dr. ${doctorWithUser.user_id?.full_name},\n\nYou have a new ${appointment_type} appointment ${appointment_type === 'emergency' ? 'confirmed' : 'booking'}.\n\nAppointment Details:\n- Patient: ${patient.full_name}\n- Date: ${appointmentDate}\n- Time: ${appointment_time}\n- Type: ${appointment_type}\n- Amount: ₹${amount}\n\n${appointment_type === 'emergency' ? 'This is an emergency appointment and is already confirmed.' : 'The appointment is pending payment confirmation.'}\n\nBest regards,\nThe MediConnect Team`,
                    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #10b981;">New ${appointment_type === 'emergency' ? 'Emergency ' : ''}Appointment Booking</h2>
                        <p>Dear Dr. ${doctorWithUser.user_id?.full_name},</p>
                        <p>You have a new ${appointment_type} appointment ${appointment_type === 'emergency' ? 'confirmed' : 'booking'}.</p>
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Appointment Details</h3>
                            <p><strong>Patient:</strong> ${patient.full_name}</p>
                            <p><strong>Date:</strong> ${appointmentDate}</p>
                            <p><strong>Time:</strong> ${appointment_time}</p>
                            <p><strong>Type:</strong> ${appointment_type}</p>
                            <p><strong>Amount:</strong> ₹${amount}</p>
                        </div>
                        ${appointment_type === 'emergency' ? '<p style="color: #ef4444; font-weight: bold;">This is an emergency appointment and is already confirmed.</p>' : '<p>The appointment is pending payment confirmation.</p>'}
                        <p>Best regards,<br/>The MediConnect Team</p>
                    </div>`
                });
            }
        } catch (emailError) {
            console.error('Failed to send appointment confirmation emails:', emailError);
            // Don't fail the appointment creation if email fails
        }

        // Create Zoom meeting for the appointment
        try {
            const patient = await User.findById(patient_id);
            const doctor = await Doctor.findById(doctor_id).populate('user_id', 'full_name');
            const zoomMeeting = await zoomService.createMeeting({
                patientName: patient.full_name,
                doctorName: doctor.user_id?.full_name || 'Doctor',
                appointment_date,
                appointment_time,
            });

            appointment.video = zoomMeeting;
            await appointment.save();
        } catch (zoomError) {
            console.error('Failed to create Zoom meeting:', zoomError);
            // Don't fail the appointment creation if Zoom fails, but log it
        }

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
        const appointment = await Appointment.findById(req.params.id)
            .populate('patient_id', 'full_name email')
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } });

        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        const previousStatus = appointment.status;

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
        
        // Send email notification for status changes
        if (status && status !== previousStatus) {
            try {
                const emailService = require('../services/emailService');
                const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                if (status === 'confirmed' && req.user.role === 'doctor') {
                    // Notify patient that appointment is confirmed by doctor
                    await emailService.sendEmail({
                        to: appointment.patient_id.email,
                        subject: 'Appointment Confirmed by Doctor - MediConnect',
                        text: `Dear ${appointment.patient_id.full_name},\n\nGood news! Your appointment has been confirmed by ${appointment.doctor_id.user_id?.full_name || 'your doctor'}.\n\nAppointment Details:\n- Doctor: ${appointment.doctor_id.user_id?.full_name || 'Doctor'}\n- Date: ${appointmentDate}\n- Time: ${appointment.appointment_time}\n\nChat and video features have been enabled for this appointment.\n\nBest regards,\nThe MediConnect Team`,
                        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #10b981;">✓ Appointment Confirmed</h2>
                            <p>Dear ${appointment.patient_id.full_name},</p>
                            <p style="color: #10b981; font-weight: bold;">Good news! Your appointment has been confirmed by ${appointment.doctor_id.user_id?.full_name || 'your doctor'}.</p>
                            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0;">Appointment Details</h3>
                                <p><strong>Doctor:</strong> ${appointment.doctor_id.user_id?.full_name || 'Doctor'}</p>
                                <p><strong>Date:</strong> ${appointmentDate}</p>
                                <p><strong>Time:</strong> ${appointment.appointment_time}</p>
                            </div>
                            <p>Chat and video features have been enabled for this appointment.</p>
                            <p>Best regards,<br/>The MediConnect Team</p>
                        </div>`
                    });
                } else if (status === 'cancelled') {
                    // Notify the other party about cancellation
                    const recipient = req.user.role === 'doctor' ? appointment.patient_id : appointment.doctor_id.user_id;
                    const recipientName = req.user.role === 'doctor' ? appointment.patient_id.full_name : appointment.doctor_id.user_id?.full_name;
                    const cancelledBy = req.user.role === 'doctor' ? 'the doctor' : 'the patient';
                    
                    if (recipient?.email) {
                        await emailService.sendEmail({
                            to: recipient.email,
                            subject: 'Appointment Cancelled - MediConnect',
                            text: `Dear ${recipientName},\n\nYour appointment has been cancelled by ${cancelledBy}.\n\nAppointment Details:\n- Doctor: ${appointment.doctor_id.user_id?.full_name || 'Doctor'}\n- Patient: ${appointment.patient_id.full_name}\n- Date: ${appointmentDate}\n- Time: ${appointment.appointment_time}\n\n${notes ? `Reason: ${notes}` : ''}\n\nIf you have any questions, please contact support.\n\nBest regards,\nThe MediConnect Team`,
                            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #ef4444;">Appointment Cancelled</h2>
                                <p>Dear ${recipientName},</p>
                                <p>Your appointment has been cancelled by ${cancelledBy}.</p>
                                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h3 style="margin-top: 0;">Appointment Details</h3>
                                    <p><strong>Doctor:</strong> ${appointment.doctor_id.user_id?.full_name || 'Doctor'}</p>
                                    <p><strong>Patient:</strong> ${appointment.patient_id.full_name}</p>
                                    <p><strong>Date:</strong> ${appointmentDate}</p>
                                    <p><strong>Time:</strong> ${appointment.appointment_time}</p>
                                    ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ''}
                                </div>
                                <p>If you have any questions, please contact support.</p>
                                <p>Best regards,<br/>The MediConnect Team</p>
                            </div>`
                        });
                    }
                }
            } catch (emailError) {
                console.error('Failed to send status change email:', emailError);
            }
        }
        
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
                
                // Send email to patient
                try {
                    const emailService = require('../services/emailService');
                    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    
                    await emailService.sendEmail({
                        to: appointment.patient_id.email,
                        subject: 'Chat Enabled for Your Appointment - MediConnect',
                        text: `Dear ${appointment.patient_id.full_name},\n\nChat has been enabled for your appointment with ${appointment.doctor_id.user_id?.full_name || 'your doctor'}.\n\nYou can now message your doctor directly through the MediConnect platform.\n\nAppointment Details:\n- Date: ${appointmentDate}\n- Time: ${appointment.appointment_time}\n\nBest regards,\nThe MediConnect Team`,
                        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #10b981;">💬 Chat Enabled</h2>
                            <p>Dear ${appointment.patient_id.full_name},</p>
                            <p>Chat has been enabled for your appointment with ${appointment.doctor_id.user_id?.full_name || 'your doctor'}.</p>
                            <p style="color: #10b981; font-weight: bold;">You can now message your doctor directly through the MediConnect platform.</p>
                            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0;">Appointment Details</h3>
                                <p><strong>Date:</strong> ${appointmentDate}</p>
                                <p><strong>Time:</strong> ${appointment.appointment_time}</p>
                            </div>
                            <p>Best regards,<br/>The MediConnect Team</p>
                        </div>`
                    });
                } catch (emailError) {
                    console.error('Failed to send chat enabled email:', emailError);
                }
                
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
            // Also sync video.enabled with video_unlocked
            if (!appointment.video) {
                appointment.video = {};
            }
            appointment.video.enabled = !!video_unlocked;
            
            if (appointment.video.enabled) {
                appointment.video.enabledAt = new Date();
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
                appointment.video.enabledAt = null;
            }
        }

        await appointment.save();
        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
});

// Toggle video access for appointment (doctor/admin only)
router.patch('/:id/video-toggle', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
            .populate('patient_id', 'full_name email');

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment or admin)
        let isAuthorized = false;
        if (req.user.role === 'admin') {
            isAuthorized = true;
        } else if (req.user.role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: req.user._id });
            if (doctor && doctor._id.toString() === appointment.doctor_id._id.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to toggle video access' });
        }

        // Toggle video enabled status
        const wasEnabled = appointment.video.enabled;
        appointment.video.enabled = !appointment.video.enabled;

        if (appointment.video.enabled && !wasEnabled) {
            appointment.video.enabledAt = new Date();
        } else if (!appointment.video.enabled) {
            appointment.video.enabledAt = null;
        }

        await appointment.save();

        res.json({
            message: `Video ${appointment.video.enabled ? 'enabled' : 'disabled'} for appointment`,
            video: appointment.video
        });
    } catch (error) {
        console.error('Video toggle error:', error);
        res.status(500).json({ message: 'Failed to toggle video access' });
    }
});

router.patch('/:id/doctor-join-call', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment or admin)
        let isAuthorized = false;
        if (req.user.role === 'admin') {
            isAuthorized = true;
        } else if (req.user.role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: req.user._id });
            if (doctor && doctor._id.toString() === appointment.doctor_id.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to update call status' });
        }

        appointment.video.doctorInCall = true;
        await appointment.save();

        res.json({
            message: 'Doctor joined video call',
            video: appointment.video
        });
    } catch (error) {
        console.error('Doctor join call error:', error);
        res.status(500).json({ message: 'Failed to update call status' });
    }
});

router.patch('/:id/doctor-leave-call', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment or admin)
        let isAuthorized = false;
        if (req.user.role === 'admin') {
            isAuthorized = true;
        } else if (req.user.role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: req.user._id });
            if (doctor && doctor._id.toString() === appointment.doctor_id.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to update call status' });
        }

        appointment.video.doctorInCall = false;
        await appointment.save();

        res.json({
            message: 'Doctor left video call',
            video: appointment.video
        });
    } catch (error) {
        console.error('Doctor leave call error:', error);
        res.status(500).json({ message: 'Failed to update call status' });
    }
});

router.patch('/:id/refresh-zoom-meeting', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
            .populate('patient_id', 'full_name email');

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment or admin)
        let isAuthorized = false;
        if (req.user.role === 'admin') {
            isAuthorized = true;
        } else if (req.user.role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: req.user._id });
            if (doctor && doctor._id.toString() === appointment.doctor_id._id.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to refresh meeting' });
        }

        // Create new Zoom meeting (instant, starts immediately)
        const patient = await User.findById(appointment.patient_id);
        const doctor = await Doctor.findById(appointment.doctor_id).populate('user_id', 'full_name');
        const zoomMeeting = await zoomService.createMeeting({
            patientName: patient.full_name,
            doctorName: doctor.user_id?.full_name || 'Doctor',
            appointment_date: appointment.appointment_date,
            appointment_time: appointment.appointment_time,
        });

        appointment.video = {
            ...zoomMeeting,
            enabled: appointment.video.enabled,
            enabledAt: appointment.video.enabledAt,
            doctorInCall: appointment.video.doctorInCall,
        };
        await appointment.save();

        res.json({
            message: 'Zoom meeting refreshed successfully',
            video: appointment.video
        });
    } catch (error) {
        console.error('Refresh meeting error:', error);
        res.status(500).json({ message: 'Failed to refresh Zoom meeting' });
    }
});

// Generate video link for appointment (doctor only)
router.post('/:id/video/generate', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment)
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Only doctors can generate video links' });
        }

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor || doctor._id.toString() !== appointment.doctor_id.toString()) {
            return res.status(403).json({ message: 'Not authorized to generate link for this appointment' });
        }

        // Generate a unique video link using appointmentId
        const videoLink = `https://zoom.us/j/${appointment._id.toString().slice(-8)}`;
        appointment.zoom_join_url = videoLink;

        await appointment.save();

        res.json({
            message: 'Video link generated successfully',
            videoLink: videoLink,
            appointment: appointment
        });
    } catch (error) {
        console.error('Video generate error:', error);
        res.status(500).json({ message: 'Failed to generate video link' });
    }
});

// Toggle chat status for appointment (doctor only)
router.patch('/:id/chat/toggle', protect, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
            .populate('patient_id', 'full_name email');

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment)
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Only doctors can toggle chat' });
        }

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor || doctor._id.toString() !== appointment.doctor_id._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to toggle chat for this appointment' });
        }

        const Notification = require('../models/Notification');

        const previousState = appointment.chat_unlocked;
        appointment.chat_unlocked = !appointment.chat_unlocked;

        // Send notifications
        if (appointment.chat_unlocked && !previousState) {
            // Chat was just enabled
            await Notification.create({
                user_id: appointment.patient_id,
                type: 'chat_enabled',
                message: 'Chat has been enabled for your appointment',
                data: { appointment_id: appointment._id }
            });
        } else if (!appointment.chat_unlocked && previousState) {
            // Chat was just disabled
            await Notification.create({
                user_id: appointment.patient_id,
                type: 'chat_disabled',
                message: 'Chat has been disabled for your appointment',
                data: { appointment_id: appointment._id }
            });
        }

        await appointment.save();

        res.json({
            message: `Chat ${appointment.chat_unlocked ? 'enabled' : 'disabled'} successfully`,
            chat_unlocked: appointment.chat_unlocked,
            appointment: appointment
        });
    } catch (error) {
        console.error('Chat toggle error:', error);
        res.status(500).json({ message: 'Failed to toggle chat' });
    }
});

// Mark appointment as completed/done (doctor only) - sends completion email with prescription
router.post('/:id/mark-done', protect, async (req, res) => {
    try {
        const appointmentId = req.params.id;
        
        let appointment = await Appointment.findById(appointmentId)
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
            .populate('patient_id', 'full_name email locale');

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment)
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Only doctors can mark appointments as done' });
        }

        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor) {
            return res.status(403).json({ message: 'Doctor profile not found' });
        }

        // Ensure doctor_id is properly extracted
        const apptDoctorId = appointment.doctor_id._id || appointment.doctor_id;
        const userDoctorId = doctor._id;

        if (apptDoctorId.toString() !== userDoctorId.toString()) {
            return res.status(403).json({ message: 'Not authorized to complete this appointment' });
        }

        // Update appointment status to completed
        appointment.status = 'completed';
        appointment.payment_status = 'paid'; // Use 'paid' instead of 'completed'
        appointment.chat_unlocked = false; // Lock chat after completion
        
        await appointment.save();

        // Fetch prescription for this appointment (if exists)
        let prescription = null;
        try {
            const Prescription = require('../models/Prescription');
            prescription = await Prescription.findOne({ 
                appointment_id: appointmentId 
            }).sort({ createdAt: -1 }).limit(1);
        } catch (prescErr) {
            console.log('Note: Could not fetch prescription:', prescErr.message);
        }

        // Prepare email data
        const { renderTemplate } = require('../utils/renderTemplate');
        const emailService = require('../services/emailService');
        
        const patientLocale = (appointment.patient_id && appointment.patient_id.locale) || 'en';
        const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard`;
        
        const doctorName = doctor.user_id?.full_name || 'Doctor';
        const patientName = appointment.patient_id?.full_name || 'Patient';
        const patientEmail = appointment.patient_id?.email;

        if (!patientEmail) {
            console.warn('Patient email not found, skipping email send');
        }

        const templateData = {
            patientName: patientName,
            doctorName: doctorName,
            doctorSpecialization: doctor.specialization || 'Physician',
            appointmentDate: appointment.appointment_date,
            appointmentTime: appointment.appointment_time,
            dashboardUrl: dashboardUrl,
            hasPrescription: !!prescription,
            diagnosis: prescription?.diagnosis || '',
            medications: prescription?.medications || [],
            instructions: prescription?.instructions || '',
            doctorNotes: prescription?.doctor_notes || '',
            prescriptionPdfUrl: prescription?.pdf_url || ''
        };

        const tplBasePath = path.join(__dirname, '..', 'email', 'templates', patientLocale, 'consultation_completed');
        
        // Render email templates
        let emailText = '', emailHtml = '';
        try {
            emailText = renderTemplate(tplBasePath + '.txt', templateData);
            emailHtml = renderTemplate(tplBasePath + '.html', templateData);
        } catch (err) {
            console.error('Template rendering error:', err.message);
            // Fallback to simple text email
            emailText = `Dear ${templateData.patientName},\n\nThank you for your consultation with Dr. ${templateData.doctorName} on ${templateData.appointmentDate} at ${templateData.appointmentTime}.\n\nYour consultation has been completed. Please visit your dashboard at ${dashboardUrl} to view details.\n\nBest regards,\nThe MediConnect Team`;
            emailHtml = emailText.replace(/\n/g, '<br>');
        }

        // Send email notification
        const Notification = require('../models/Notification');
        try {
            await Notification.create({
                user_id: appointment.patient_id._id || appointment.patient_id,
                type: 'appointment_completed',
                message: `Your consultation with Dr. ${doctorName} has been completed. Check your email for details and prescription.`,
                data: { 
                    appointment_id: appointment._id,
                    prescription_id: prescription?._id
                }
            });
        } catch (notifErr) {
            console.error('Failed to create notification:', notifErr.message);
        }

        // Send email synchronously (wait for it to complete)
        let emailSent = false;
        if (patientEmail) {
            try {
                await emailService.sendEmail({
                    to: patientEmail,
                    subject: `Consultation Completed - Thank You for Choosing MediConnect`,
                    text: emailText,
                    html: emailHtml
                });
                emailSent = true;
                console.log('Consultation completion email sent successfully to:', patientEmail);
            } catch (emailErr) {
                console.error('Failed to send completion email:', emailErr.message);
            }
        }

        res.json({
            message: 'Appointment marked as completed successfully',
            appointment: appointment,
            emailSent: emailSent
        });
    } catch (error) {
        console.error('Mark done error:', error);
        res.status(500).json({ message: 'Failed to mark appointment as done', error: error.message });
    }
});

module.exports = router;
