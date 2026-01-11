const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
    try {
        const { appointment_id } = req.query;
        if (!appointment_id) return res.status(400).json({ message: 'Appointment ID required' });

        // Populate sender full name so frontend can display names directly
        const messages = await Message.find({ appointment_id }).sort({ createdAt: 1 }).populate('sender_id', 'full_name');
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', protect, async (req, res) => {
    try {
        const { appointment_id, sender_id, content, file_url, message_type } = req.body;
        if (!appointment_id) return res.status(400).json({ message: 'Appointment ID required' });

        // Fetch appointment and check chat permissions
        const Appointment = require('../models/Appointment');
        const appointment = await Appointment.findById(appointment_id).populate('doctor_id').populate('patient_id');
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        // If sender is patient and chat is locked, disallow sending
        const isDoctor = req.user.role === 'doctor' && (appointment.doctor_id.user_id ? req.user._id.toString() === appointment.doctor_id.user_id.toString() : true);
        const isPatient = req.user.role === 'patient' && (appointment.patient_id ? req.user._id.toString() === appointment.patient_id._id.toString() : true);

        if (isPatient && !appointment.chat_unlocked) {
            return res.status(403).json({ message: 'Chat is disabled by the doctor. You can read messages but cannot send new messages.' });
        }

        // Allow doctor to send even if chat is disabled
        const message = await Message.create({ appointment_id, sender_id: req.user._id, content, file_url, message_type });

        // Create a notification for the recipient to show new messages in inbox
        try {
            const Notification = require('../models/Notification');
            let recipientId = null;
            if (req.user.role === 'doctor') {
                recipientId = appointment.patient_id;
            } else {
                // patient -> notify doctor's user account
                recipientId = appointment.doctor_id?.user_id || null;
            }
            if (recipientId) {
                await Notification.create({ user_id: recipientId, type: 'message', message: `${req.user.full_name || 'New message'}`, data: { appointment_id, message_id: message._id } });
            }
        } catch (nerr) {
            console.error('Failed to create message notification', nerr);
        }

        // Return populated sender_id so UI can show name immediately
        const populated = await Message.findById(message._id).populate('sender_id', 'full_name');
        res.status(201).json(populated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});


// Conversations summary for dashboard / recent lists
router.get('/conversations', protect, async (req, res) => {
    try {
        const { _id, role } = req.user;
        const Appointment = require('../models/Appointment');
        const Doctor = require('../models/Doctor');
        const User = require('../models/User');

        let appts = [];
        if (role === 'patient') {
            appts = await Appointment.find({ patient_id: _id }).select('_id doctor_id patient_id video status appointment_date appointment_time').populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name' } }).populate('patient_id', 'full_name');
        } else if (role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: _id });
            if (!doctor) return res.json([]);
            appts = await Appointment.find({ doctor_id: doctor._id }).select('_id doctor_id patient_id video status appointment_date appointment_time').populate('patient_id', 'full_name').populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name' } });
        } else {
            return res.json([]);
        }

        const apptIds = appts.map(a => a._id);
        if (apptIds.length === 0) return res.json([]);

        // Group conversations by patient-doctor pairs instead of individual appointments
        const conversationGroups = new Map();

        for (const appt of appts) {
            const patientId = appt.patient_id._id.toString();
            const doctorId = appt.doctor_id._id.toString();
            const pairKey = role === 'patient' ? `${patientId}-${doctorId}` : `${doctorId}-${patientId}`;

            if (!conversationGroups.has(pairKey)) {
                conversationGroups.set(pairKey, {
                    appointments: [],
                    otherPartyName: role === 'patient' ? (appt.doctor_id?.user_id?.full_name || 'Doctor') : (appt.patient_id?.full_name || 'Patient'),
                    latestAppointment: appt
                });
            }

            conversationGroups.get(pairKey).appointments.push(appt);

            // Update latest appointment if this one is more recent
            const currentLatest = conversationGroups.get(pairKey).latestAppointment;
            const currentDate = new Date(`${currentLatest.appointment_date}T${currentLatest.appointment_time}`);
            const thisDate = new Date(`${appt.appointment_date}T${appt.appointment_time}`);

            if (thisDate > currentDate) {
                conversationGroups.get(pairKey).latestAppointment = appt;
            }
        }

        const results = [];

        for (const [pairKey, group] of conversationGroups) {
            const groupApptIds = group.appointments.map(a => a._id);

            // Get messages for all appointments in this patient-doctor pair
            const convs = await Message.aggregate([
                { $match: { appointment_id: { $in: groupApptIds } } },
                { $sort: { createdAt: -1 } },
                { $group: {
                    _id: null, // Group all messages from this patient-doctor pair
                    lastMessageId: { $first: '$_id' },
                    lastContent: { $first: '$content' },
                    lastCreatedAt: { $first: '$createdAt' },
                    sender_id: { $first: '$sender_id' },
                    unreadCount: { $sum: { $cond: [ { $and: [ { $eq: ['$is_read', false] }, { $ne: ['$sender_id', req.user._id] } ] }, 1, 0 ] } }
                }}
            ]);

            if (convs.length > 0) {
                const c = convs[0];
                const sender = await User.findById(c.sender_id).select('full_name');
                results.push({
                    appointment_id: group.latestAppointment._id, // Use latest appointment ID for routing
                    lastMessage: { _id: c.lastMessageId, content: c.lastContent, createdAt: c.lastCreatedAt, senderName: sender?.full_name || null },
                    unreadCount: c.unreadCount || 0,
                    otherPartyName: group.otherPartyName,
                    video: group.latestAppointment.video || null,
                    appointmentCount: group.appointments.length // Number of appointments in this conversation
                });
            } else {
                // No messages yet, but show the conversation anyway
                results.push({
                    appointment_id: group.latestAppointment._id,
                    lastMessage: null,
                    unreadCount: 0,
                    otherPartyName: group.otherPartyName,
                    video: group.latestAppointment.video || null,
                    appointmentCount: group.appointments.length
                });
            }
        }

        // Sort by last message time (most recent first)
        results.sort((a, b) => {
            if (!a.lastMessage && !b.lastMessage) return 0;
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return -1;
            return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get messages for a conversation (all appointments between patient and doctor)
router.get('/conversation', protect, async (req, res) => {
    try {
        const { appointment_id } = req.query;
        if (!appointment_id) return res.status(400).json({ message: 'Appointment ID required' });

        // Get the appointment to find the patient-doctor pair
        const Appointment = require('../models/Appointment');
        const appointment = await Appointment.findById(appointment_id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        // Find all appointments between this patient and doctor
        const allAppointments = await Appointment.find({
            $or: [
                { patient_id: appointment.patient_id, doctor_id: appointment.doctor_id },
                { patient_id: appointment.patient_id, doctor_id: appointment.doctor_id }
            ]
        }).select('_id');

        const appointmentIds = allAppointments.map(a => a._id);

        // Get messages from all appointments in this conversation
        const messages = await Message.find({ appointment_id: { $in: appointmentIds } })
            .sort({ createdAt: 1 })
            .populate('sender_id', 'full_name');

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark messages as read for this conversation (all appointments between patient and doctor)
router.put('/mark-read', protect, async (req, res) => {
    try {
        const { appointment_id } = req.body;
        if (!appointment_id) return res.status(400).json({ message: 'Appointment ID required' });

        // Get the appointment to find the patient-doctor pair
        const Appointment = require('../models/Appointment');
        const appointment = await Appointment.findById(appointment_id);
        if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

        // Find all appointments between this patient and doctor
        const allAppointments = await Appointment.find({
            $or: [
                { patient_id: appointment.patient_id, doctor_id: appointment.doctor_id },
                { patient_id: appointment.patient_id, doctor_id: appointment.doctor_id }
            ]
        }).select('_id');

        const appointmentIds = allAppointments.map(a => a._id);

        // Mark messages as read for all appointments in this conversation
        await Message.updateMany({
            appointment_id: { $in: appointmentIds },
            sender_id: { $ne: req.user._id },
            is_read: false
        }, { is_read: true });

        res.json({ updated: true });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
