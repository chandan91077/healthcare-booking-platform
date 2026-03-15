// Appointments route:
// Handles appointment lifecycle, doctor actions, permissions, and related notifications/emails.
const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const PlatformSettings = require('../models/PlatformSettings');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const zoomService = require('../services/zoomService');
const { sendEmail } = require('../services/emailService');
const { cancelExpiredUnpaidAppointments } = require('../utils/cron-jobs');
const { renderEmailWithFallback } = require('../utils/emailTemplates');

function formatDoctorName(rawName) {
    const name = String(rawName || '').trim();
    if (!name) {
        return 'Doctor';
    }
    return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

function formatPatientName(rawName) {
    const name = String(rawName || '').trim();
    return name || 'Patient';
}

async function findDoctorProfileForUser(userId) {
    if (!userId) {
        return null;
    }

    return Doctor.findOne({ user_id: userId }).populate('user_id', 'full_name');
}

async function getCurrentPlatformFee() {
    const settings = await PlatformSettings.findOne({ key: 'global' });
    return Number(settings?.platform_fee || 0);
}

// Get appointment by ID
router.get('/:id', protect, async (req, res) => {
    try {
        await cancelExpiredUnpaidAppointments();

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
        await cancelExpiredUnpaidAppointments();

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
        await cancelExpiredUnpaidAppointments();

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
        const { doctor_id, appointment_date, appointment_time, appointment_type = 'scheduled' } = req.body;

        // Only patients can create appointments
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can create appointments' });
        }

        const patient_id = req.user._id;

        const doctor = await Doctor.findById(doctor_id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

        const doctorFee = Number(
            appointment_type === 'emergency' ? doctor.emergency_fee : doctor.consultation_fee
        );
        const platformFee = await getCurrentPlatformFee();
        const totalAmount = Number((doctorFee + platformFee).toFixed(2));

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
            amount: totalAmount,
            doctor_fee: Number(doctorFee.toFixed(2)),
            platform_fee: Number(platformFee.toFixed(2)),
            status: appointment_type === 'emergency' ? 'confirmed' : 'pending',
            payment_status: appointment_type === 'emergency' ? 'paid' : 'pending',
            chat_unlocked: appointment_type === 'emergency',
            video_unlocked: appointment_type === 'emergency',
        });

        try {
            const Notification = require('../models/Notification');
            const doctorUser = await User.findById(doctor.user_id).select(
                'full_name email locale'
            );
            const patientName = formatPatientName(req.user.full_name);
            const appointmentTypeLabel =
                appointment_type === 'emergency' ? 'emergency' : 'scheduled';

            if (doctorUser?._id) {
                await Notification.create({
                    user_id: doctorUser._id,
                    type: 'new_appointment',
                    message: `New ${appointmentTypeLabel} appointment booked by ${patientName} on ${appointment_date} at ${appointment_time}.`,
                    data: {
                        appointment_id: appointment._id,
                        appointment_type: appointmentTypeLabel,
                        appointment_date,
                        appointment_time,
                        patient_id,
                    },
                });
            }

            if (doctorUser?.email) {
                const resolved = renderEmailWithFallback({
                    locale: doctorUser.locale || 'en',
                    templateName: 'new_appointment_doctor',
                    context: {
                        doctor: doctorUser.full_name || 'Doctor',
                        patient: patientName,
                        date: appointment_date,
                        time: appointment_time,
                        type: appointmentTypeLabel,
                    },
                });

                await sendEmail({
                    to: doctorUser.email,
                    subject: `New Appointment Booked - ${appointment_date} ${appointment_time}`,
                    text: resolved.text,
                    html: resolved.html,
                });
            }
        } catch (notifyErr) {
            console.error('Failed to notify doctor for new appointment', notifyErr);
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
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        const previousStatus = appointment.status;

        if (typeof status !== 'undefined' && status !== null) {
            const nextStatus = String(status).trim().toLowerCase();

            if (req.user.role === 'doctor') {
                const doctor = await findDoctorProfileForUser(req.user._id);
                if (!doctor || doctor._id.toString() !== appointment.doctor_id.toString()) {
                    return res.status(403).json({ message: 'Not authorized to update this appointment' });
                }

                const allowedDoctorStatuses = ['confirmed', 'completed', 'cancelled'];
                if (!allowedDoctorStatuses.includes(nextStatus)) {
                    return res.status(400).json({ message: 'Invalid appointment status' });
                }

                appointment.status = nextStatus;

                if (nextStatus === 'confirmed') {
                    appointment.chat_unlocked = true;
                    appointment.video_unlocked = true;

                    if (previousStatus !== 'confirmed') {
                        const doctorName = formatDoctorName(doctor.user_id?.full_name);
                        const Notification = require('../models/Notification');
                        await Notification.create({
                            user_id: appointment.patient_id,
                            type: 'appointment_confirmed',
                            message: `${doctorName} confirmed your appointment on ${appointment.appointment_date} at ${appointment.appointment_time}.`,
                            data: {
                                appointment_id: appointment._id,
                                appointment_date: appointment.appointment_date,
                                appointment_time: appointment.appointment_time,
                            },
                        });
                    }
                }

                if (nextStatus === 'completed') {
                    appointment.video.doctorInCall = false;

                    if (previousStatus !== 'completed') {
                        const Notification = require('../models/Notification');
                        const doctorName = formatDoctorName(doctor.user_id?.full_name);
                        await Notification.create({
                            user_id: appointment.patient_id,
                            type: 'appointment_completed',
                            message: `${doctorName} marked your appointment on ${appointment.appointment_date} at ${appointment.appointment_time} as completed.`,
                            data: {
                                appointment_id: appointment._id,
                                appointment_date: appointment.appointment_date,
                                appointment_time: appointment.appointment_time,
                            },
                        });
                        await Notification.create({
                            user_id: doctor.user_id?._id || doctor.user_id,
                            type: 'appointment_completed_confirmation',
                            message: `You marked the appointment with ${formatPatientName(appointment.patient_id?.full_name)} on ${appointment.appointment_date} at ${appointment.appointment_time} as completed.`,
                            data: {
                                appointment_id: appointment._id,
                                appointment_date: appointment.appointment_date,
                                appointment_time: appointment.appointment_time,
                            },
                        });
                    }
                }
            } else if (nextStatus === 'cancelled' && req.user.role === 'patient') {
                if (appointment.patient_id.toString() !== req.user._id.toString()) {
                    return res.status(403).json({ message: 'Not authorized to cancel this appointment' });
                }
                appointment.status = nextStatus;
            } else {
                return res.status(403).json({ message: 'Not authorized to update appointment status' });
            }
        }

        if (typeof payment_status !== 'undefined') appointment.payment_status = payment_status;
        if (typeof notes !== 'undefined') appointment.notes = notes;

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
        const doctor = await Doctor.findById(appointment.doctor_id._id || appointment.doctor_id)
            .populate('user_id', 'full_name email locale');
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
        const doctorUserId = doctor.user_id?._id || doctor.user_id;
        if (req.user.role !== 'doctor' || req.user._id.toString() !== doctorUserId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const Notification = require('../models/Notification');
        const doctorName = formatDoctorName(doctor.user_id?.full_name);
        const patientName = formatPatientName(appointment.patient_id?.full_name);

        if (typeof chat_unlocked !== 'undefined') {
            const prev = appointment.chat_unlocked;
            appointment.chat_unlocked = !!chat_unlocked;
            if (appointment.chat_unlocked && !prev) {
                await Notification.create({
                    user_id: appointment.patient_id,
                    type: 'chat_available',
                    message: `${doctorName} enabled chat for your appointment.`,
                    data: { appointment_id: appointment._id }
                });
                if (doctorUserId) {
                    await Notification.create({ user_id: doctorUserId, type: 'chat_available_confirmation', message: `You enabled chat for ${patientName} on ${appointment.appointment_date}.`, data: { appointment_id: appointment._id } });
                }
            }
            if (!appointment.chat_unlocked && prev) {
                await Notification.create({
                    user_id: appointment.patient_id,
                    type: 'chat_disabled',
                    message: `${doctorName} disabled chat for your appointment.`,
                    data: { appointment_id: appointment._id }
                });
                if (doctorUserId) {
                    await Notification.create({ user_id: doctorUserId, type: 'chat_disabled_confirmation', message: `You disabled chat for ${patientName} on ${appointment.appointment_date}.`, data: { appointment_id: appointment._id } });
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
                        // Use the real Zoom URL from the auto-created meeting if available
                        if (appointment.video?.patientJoinUrl) {
                            appointment.zoom_join_url = appointment.video.patientJoinUrl;
                        } else {
                            // No pre-created meeting — try to generate a new one now
                            try {
                                const meetingPatient = await User.findById(appointment.patient_id);
                                const newMeeting = await zoomService.createMeeting({
                                    patientName: meetingPatient?.full_name || 'Patient',
                                    appointment_date: appointment.appointment_date,
                                    appointment_time: appointment.appointment_time,
                                });
                                appointment.video = {
                                    ...newMeeting,
                                    enabled: true,
                                    enabledAt: new Date(),
                                    doctorInCall: false,
                                };
                                appointment.zoom_join_url = newMeeting.patientJoinUrl;
                            } catch (zoomErr) {
                                console.error('Failed to create Zoom meeting on video unlock:', zoomErr);
                                // Leave zoom_join_url unset rather than inserting a fake link
                            }
                        }
                }

                if (auto_send) {
                    // Render localized templates and create notifications for both users
                    const localePatient = (appointment.patient_id && appointment.patient_id.locale) || 'en';
                    const localeDoctor = (doctor.user_id && doctor.user_id.locale) || 'en';

                    const patientContext = {
                        name: appointment.patient_id.full_name || appointment.patient_id.email,
                        doctor: doctor.user_id?.full_name || 'Doctor',
                        date: appointment.appointment_date,
                        time: appointment.appointment_time,
                        link: appointment.zoom_join_url,
                    };
                    // Email body: template-first with safe inline fallback.
                    const patientResolved = renderEmailWithFallback({
                        locale: localePatient,
                        templateName: 'video_link',
                        context: patientContext,
                    });

                    const doctorContext = {
                        name: doctor.user_id?.full_name || doctor.user_id?.email,
                        doctor: doctor.user_id?.full_name || 'Doctor',
                        date: appointment.appointment_date,
                        time: appointment.appointment_time,
                        link: appointment.zoom_join_url,
                    };
                    const doctorResolved = renderEmailWithFallback({
                        locale: localeDoctor,
                        templateName: 'video_link',
                        context: doctorContext,
                    });

                    await Notification.create({ user_id: appointment.patient_id, type: 'video_link', message: `${doctorName} shared your video consultation link for ${appointment.appointment_date} at ${appointment.appointment_time}.`, data: { appointment_id: appointment._id, zoom_join_url: appointment.zoom_join_url } });
                    await Notification.create({ user_id: doctorUserId, type: 'video_link', message: `You shared a video consultation link with ${patientName} for ${appointment.appointment_date} at ${appointment.appointment_time}.`, data: { appointment_id: appointment._id, zoom_join_url: appointment.zoom_join_url } });

                    // Do not block permission update on email failures.
                    await Promise.allSettled([
                        sendEmail({
                            to: appointment.patient_id.email,
                            subject: `Video Call Link for ${appointment.appointment_date}`,
                            text: patientResolved.text,
                            html: patientResolved.html,
                        }),
                        sendEmail({
                            to: doctor.user_id?.email,
                            subject: `Video Call Enabled - ${appointment.appointment_date}`,
                            text: doctorResolved.text,
                            html: doctorResolved.html,
                        }),
                    ]);
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
        const nowEnabled = !wasEnabled;

        if (nowEnabled) {
            // Create a fresh Zoom meeting on-demand when doctor enables video
            try {
                const patient = await User.findById(appointment.patient_id);
                const zoomMeeting = await zoomService.createMeeting({
                    patientName: patient?.full_name || 'Patient',
                    appointment_date: appointment.appointment_date,
                    appointment_time: appointment.appointment_time,
                });
                appointment.video = {
                    ...zoomMeeting,
                    enabled: true,
                    enabledAt: new Date(),
                    doctorInCall: false,
                };
                appointment.zoom_join_url = zoomMeeting.patientJoinUrl || null;
            } catch (zoomError) {
                console.error('Failed to create Zoom meeting on video-enable:', zoomError);
                return res.status(500).json({ message: 'Failed to create Zoom meeting. Please try again.' });
            }
        } else {
            // Disabling video: clear the meeting data
            appointment.video.enabled = false;
            appointment.video.enabledAt = null;
            appointment.video.doctorInCall = false;
            appointment.video.meetingId = null;
            appointment.video.doctorJoinUrl = null;
            appointment.video.patientJoinUrl = null;
            appointment.zoom_join_url = null;
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
        const appointment = await Appointment.findById(req.params.id)
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name' } })
            .populate('patient_id', 'full_name');

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment or admin)
        let isAuthorized = false;
        if (req.user.role === 'admin') {
            isAuthorized = true;
        } else if (req.user.role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: req.user._id });
            const appointmentDoctorId = appointment.doctor_id?._id || appointment.doctor_id;
            if (doctor && doctor._id.toString() === appointmentDoctorId.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to update call status' });
        }

        appointment.video.doctorInCall = true;
        await appointment.save();

        try {
            const Notification = require('../models/Notification');
            const doctorName = formatDoctorName(appointment.doctor_id?.user_id?.full_name);
            const patientName = formatPatientName(appointment.patient_id?.full_name);
            await Notification.create({
                user_id: appointment.patient_id._id || appointment.patient_id,
                type: 'video_call_started',
                message: `${doctorName} joined the video session.`,
                data: { appointment_id: appointment._id, zoom_join_url: appointment.zoom_join_url || null },
            });
            if (appointment.doctor_id?.user_id?._id) {
                await Notification.create({
                    user_id: appointment.doctor_id.user_id._id,
                    type: 'video_call_started_confirmation',
                    message: `You joined the video session with ${patientName}.`,
                    data: { appointment_id: appointment._id, zoom_join_url: appointment.zoom_join_url || null },
                });
            }
        } catch (notifyErr) {
            console.error('Doctor join call notification failed', notifyErr);
        }

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
        const appointment = await Appointment.findById(req.params.id)
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name' } })
            .populate('patient_id', 'full_name');

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if user is authorized (doctor who owns appointment or admin)
        let isAuthorized = false;
        if (req.user.role === 'admin') {
            isAuthorized = true;
        } else if (req.user.role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: req.user._id });
            const appointmentDoctorId = appointment.doctor_id?._id || appointment.doctor_id;
            if (doctor && doctor._id.toString() === appointmentDoctorId.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to update call status' });
        }

        appointment.video.doctorInCall = false;
        await appointment.save();

        try {
            const Notification = require('../models/Notification');
            const doctorName = formatDoctorName(appointment.doctor_id?.user_id?.full_name);
            const patientName = formatPatientName(appointment.patient_id?.full_name);
            await Notification.create({
                user_id: appointment.patient_id._id || appointment.patient_id,
                type: 'video_call_ended',
                message: `${doctorName} ended the video session.`,
                data: { appointment_id: appointment._id },
            });
            if (appointment.doctor_id?.user_id?._id) {
                await Notification.create({
                    user_id: appointment.doctor_id.user_id._id,
                    type: 'video_call_ended_confirmation',
                    message: `You ended the video session with ${patientName}.`,
                    data: { appointment_id: appointment._id },
                });
            }
        } catch (notifyErr) {
            console.error('Doctor leave call notification failed', notifyErr);
        }

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

        // Create new Zoom meeting
        const patient = await User.findById(appointment.patient_id);
        const zoomMeeting = await zoomService.createMeeting({
            patientName: patient.full_name,
            appointment_date: appointment.appointment_date,
            appointment_time: appointment.appointment_time,
        });

        appointment.video = {
            ...zoomMeeting,
            enabled: appointment.video.enabled,
            enabledAt: appointment.video.enabledAt,
            doctorInCall: appointment.video.doctorInCall,
        };
        appointment.zoom_join_url = zoomMeeting.patientJoinUrl || null;
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

module.exports = router;
