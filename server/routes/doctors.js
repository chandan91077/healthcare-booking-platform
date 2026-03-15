// Doctors route:
// Handles doctor profiles, admin verification workflow, and doctor status communication.
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const Notification = require('../models/Notification');
const { sendEmail } = require('../services/emailService');
const { renderEmailWithFallback } = require('../utils/emailTemplates');
const { protect } = require('../middleware/authMiddleware');

// Register a doctor
router.post('/', protect, async (req, res) => {
    try {
        const doctor = await Doctor.create(req.body);

        try {
            // Doctor profile submission acknowledgment is email-only.
            const doctorName = req.user?.full_name || 'Doctor';
            const doctorEmail = req.user?.email || '';
            if (doctorEmail) {
                // Use localized template; helper provides generic fallback if missing.
                const resolved = renderEmailWithFallback({
                    locale: req.user?.locale || 'en',
                    templateName: 'doctor_submission_received',
                    context: { name: doctorName },
                });
                await sendEmail({
                    to: doctorEmail,
                    subject: 'MediConnect: Doctor Profile Submission Received',
                    text: resolved.text,
                    html: resolved.html,
                });
            }
        } catch (notifError) {
            console.error('Failed to send doctor profile submission email:', notifError);
        }

        res.status(201).json(doctor);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get all verified doctors (for patients)
// Note: support optional query parameter `state` for filtering by doctor.state
// Keeping / as verified only for safety default
router.get('/', async (req, res) => {
    try {
        const { state } = req.query;
        const filter = { is_verified: true };
        if (state) {
            // Case-insensitive partial match for state
            filter.state = new RegExp(state, 'i');
        }
        const doctors = await Doctor.find(filter).populate('user_id', 'full_name email avatar_url');
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get doctor by doctor id (public)
router.get('/:id', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id).populate('user_id', 'full_name email avatar_url');
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
        res.json(doctor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Get all doctors (pending, approved, rejected)
router.get('/admin/all', protect, async (req, res) => {
    // Check if admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized as admin' });
    }

    try {
        const doctors = await Doctor.find({}).populate('user_id', 'full_name email phone avatar_url');
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Delete doctor
router.delete('/:id', protect, async (req, res) => {
    // Check if admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized as admin' });
    }

    try {
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        // Optionally delete the user account too?
        // For now, just delete doctor profile.
        await doctor.deleteOne();
        res.json({ message: 'Doctor removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get doctor by user ID
router.get('/user/:userId', protect, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ user_id: req.params.userId });
        if (doctor) {
            res.json(doctor);
        } else {
            res.status(404).json({ message: 'Doctor not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update doctor profile (e.g. image)
router.put('/:id', protect, async (req, res) => {
    try {
        const rawDoctorId = String(req.params.id || '').trim();

        let doctor = null;
        if (rawDoctorId && rawDoctorId !== 'undefined' && mongoose.isValidObjectId(rawDoctorId)) {
            doctor = await Doctor.findById(rawDoctorId);
        }

        if (!doctor) {
            doctor = await Doctor.findOne({ user_id: req.user._id });
        }

        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        // if (doctor.user_id.toString() !== req.user._id.toString()) {
        //    return res.status(401).json({ message: 'Not authorized' });
        // }

        const previousVerificationStatus = doctor.verification_status;
        const previousIsVerified = doctor.is_verified;
        const updatedDoctor = await Doctor.findByIdAndUpdate(doctor._id, req.body, { new: true })
            .populate('user_id', 'full_name email');

        try {
            // Detect verification transition so email/notification is sent once per change.
            const updatedStatus = updatedDoctor?.verification_status;
            const becameVerified =
                updatedStatus === 'verified' &&
                (previousVerificationStatus !== 'verified' || previousIsVerified !== true);
            const becameRejected =
                updatedStatus === 'rejected' && previousVerificationStatus !== 'rejected';

            const targetUser = updatedDoctor?.user_id;
            const doctorName =
                (targetUser && targetUser.full_name) ? targetUser.full_name : 'Doctor';
            const doctorEmail =
                (targetUser && targetUser.email) ? targetUser.email : '';

            if (doctorEmail && (becameVerified || becameRejected)) {
                if (becameVerified) {
                    // Keep in-app notification for status change events.
                    await Notification.create({
                        user_id: updatedDoctor.user_id._id || updatedDoctor.user_id,
                        type: 'doctor_verified',
                        message: 'Your doctor profile has been verified. You can now accept patients.',
                        data: { doctor_id: updatedDoctor._id },
                    });

                    const resolved = renderEmailWithFallback({
                        locale: targetUser?.locale || 'en',
                        templateName: 'doctor_verified',
                        context: { name: doctorName },
                    });
                    await sendEmail({
                        to: doctorEmail,
                        subject: 'MediConnect: Doctor Profile Verified',
                        text: resolved.text,
                        html: resolved.html,
                    });
                }

                if (becameRejected) {
                    const rejectionReason = (updatedDoctor.rejection_reason || '').toString().trim();
                    const reasonHtml = rejectionReason
                        ? `<p><b>Reason:</b> ${rejectionReason}</p>`
                        : '';

                    const resolved = renderEmailWithFallback({
                        locale: targetUser?.locale || 'en',
                        templateName: 'doctor_rejected',
                        context: {
                            name: doctorName,
                            rejection_reason_block: rejectionReason
                                ? `Reason: ${rejectionReason}\n`
                                : '',
                            rejection_reason_html: reasonHtml,
                        },
                    });

                    await Notification.create({
                        user_id: updatedDoctor.user_id._id || updatedDoctor.user_id,
                        type: 'doctor_rejected',
                        message: 'Your doctor profile verification was not approved. Please review and resubmit.',
                        data: { doctor_id: updatedDoctor._id, rejection_reason: rejectionReason },
                    });

                    await sendEmail({
                        to: doctorEmail,
                        subject: 'MediConnect: Doctor Profile Not Approved',
                        text: resolved.text,
                        html: resolved.html,
                    });
                }
            }
        } catch (notifyError) {
            console.error('Failed to send doctor verification status email/notification:', notifyError);
        }

        res.json(updatedDoctor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
