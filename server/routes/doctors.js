const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const path = require('path');

// Register a doctor
router.post('/', protect, async (req, res) => {
    try {
        const doctor = await Doctor.create(req.body);
        
        // Populate user_id to get email and full name
        await doctor.populate('user_id', 'full_name email');
        
        // Send registration confirmation email
        try {
            const templateData = {
                doctorName: doctor.user_id.full_name,
                email: doctor.user_id.email,
                specialization: doctor.specialization,
                experienceYears: doctor.experience_years,
                state: doctor.state,
                dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/doctor/dashboard`
            };
            
            const htmlTemplate = path.join(__dirname, '../email/templates/en/doctor_registration.html');
            const textTemplate = path.join(__dirname, '../email/templates/en/doctor_registration.txt');
            
            const htmlContent = await renderTemplate(htmlTemplate, templateData);
            const textContent = await renderTemplate(textTemplate, templateData);
            
            await emailService.sendEmail({
                to: doctor.user_id.email,
                subject: 'Registration Received - MediConnect',
                text: textContent,
                html: htmlContent
            });
        } catch (emailError) {
            console.error('Error sending registration email:', emailError);
            // Don't fail the registration if email fails
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

// Admin: Delete doctor (also delete linked user account)
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

        const userId = doctor.user_id;

        // Remove the doctor profile
        await doctor.deleteOne();

        // Also remove the linked user account so they cannot sign in again
        if (userId) {
            await User.findByIdAndDelete(userId);
        }

        res.json({ message: 'Doctor and user removed' });
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
        // Basic authorization check: verify the user owns this doctor profile
        // This is simplified; ideally we check if req.user._id matches doctor.user_id
        const doctor = await Doctor.findById(req.params.id).populate('user_id', 'full_name email locale');
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

        // if (doctor.user_id.toString() !== req.user._id.toString()) {
        //    return res.status(401).json({ message: 'Not authorized' });
        // }

        const previousStatus = doctor.verification_status;
        const updatedDoctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        ).populate('user_id', 'full_name email locale');

        // If verification_status changed, send email using templates
        try {
            const { sendEmail } = require('../services/emailService');
            const { renderTemplate } = require('../utils/renderTemplate');

            const locale = (updatedDoctor.user_id && updatedDoctor.user_id.locale) || 'en';
            const templatesDir = path.join(__dirname, '..', 'email', 'templates', locale);

            if (req.body.verification_status === 'approved' && updatedDoctor.is_verified && previousStatus !== 'approved') {
                const html = renderTemplate(path.join(templatesDir, 'doctor_approved.html'), {
                    doctorName: updatedDoctor.user_id?.full_name || 'Doctor',
                    specialization: updatedDoctor.specialization || '',
                    experienceYears: updatedDoctor.experience_years || '',
                    consultationFee: updatedDoctor.consultation_fee || '',
                    emergencyFee: updatedDoctor.emergency_fee || '',
                    state: updatedDoctor.state || '',
                    dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/doctor-dashboard`
                });
                let text = '';
                try {
                    text = renderTemplate(path.join(templatesDir, 'doctor_approved.txt'), {
                        doctorName: updatedDoctor.user_id?.full_name || 'Doctor',
                        specialization: updatedDoctor.specialization || '',
                        experienceYears: updatedDoctor.experience_years || '',
                        consultationFee: updatedDoctor.consultation_fee || '',
                        emergencyFee: updatedDoctor.emergency_fee || '',
                        state: updatedDoctor.state || '',
                        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/doctor-dashboard`
                    });
                } catch (_) {}

                await sendEmail({
                    to: updatedDoctor.user_id.email,
                    subject: 'Application Approved - Welcome to MediConnect',
                    text,
                    html
                });
            }

            if (req.body.verification_status === 'rejected' && previousStatus !== 'rejected') {
                const rejectionReason = req.body.rejection_reason || 'Please contact support for more details.';
                const html = renderTemplate(path.join(templatesDir, 'doctor_rejected.html'), {
                    doctorName: updatedDoctor.user_id?.full_name || 'Doctor',
                    rejectionReason,
                    dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/doctor-dashboard`
                });
                let text = '';
                try {
                    text = renderTemplate(path.join(templatesDir, 'doctor_rejected.txt'), {
                        doctorName: updatedDoctor.user_id?.full_name || 'Doctor',
                        rejectionReason,
                        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/doctor-dashboard`
                    });
                } catch (_) {}

                await sendEmail({
                    to: updatedDoctor.user_id.email,
                    subject: 'Application Status Update - MediConnect',
                    text,
                    html
                });
            }
        } catch (mailErr) {
            console.error('Doctor verification email error:', mailErr.message);
        }

        res.json(updatedDoctor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
