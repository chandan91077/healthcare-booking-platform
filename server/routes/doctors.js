const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// Register a doctor
router.post('/', protect, async (req, res) => {
    try {
        const doctor = await Doctor.create(req.body);
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
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

        // if (doctor.user_id.toString() !== req.user._id.toString()) {
        //    return res.status(401).json({ message: 'Not authorized' });
        // }

        const updatedDoctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedDoctor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
