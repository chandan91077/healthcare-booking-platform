const express = require('express');
const router = express.Router();
const Availability = require('../models/Availability');
const { protect } = require('../middleware/authMiddleware');

// Get availability for a doctor
router.get('/:doctorId', async (req, res) => {
    try {
        const availability = await Availability.find({ doctor_id: req.params.doctorId }).sort('day_of_week');
        res.json(availability);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update/Create availability (Batch update or single?)
// Frontend iterates and updates/inserts individually.
// Let's support both or just stick to single for simplicity matching frontend.
// "updateSlot" -> calls update or insert.

router.post('/', protect, async (req, res) => {
    try {
        const { doctor_id, day_of_week, start_time, end_time, is_available } = req.body;

        // Only doctors can create availability and only for their own profile
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Only doctors can manage availability' });
        }

        const Doctor = require('../models/Doctor');
        const doctor = await Doctor.findOne({ user_id: req.user._id });
        if (!doctor || String(doctor._id) !== String(doctor_id)) {
            return res.status(403).json({ message: 'You can only modify availability for your own profile' });
        }

        const availability = await Availability.create({
            doctor_id,
            day_of_week,
            start_time,
            end_time,
            is_available
        });
        res.status(201).json(availability);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', protect, async (req, res) => {
    try {
        const { start_time, end_time, is_available } = req.body;
        const availability = await Availability.findById(req.params.id);

        if (!availability) {
            return res.status(404).json({ message: 'Availability not found' });
        }

        // Ensure the requesting user owns the doctor profile for this availability
        const Doctor = require('../models/Doctor');
        const doctor = await Doctor.findById(availability.doctor_id);
        if (!doctor || String(doctor.user_id) !== String(req.user._id)) {
            return res.status(403).json({ message: 'You can only modify your own availability' });
        }

        availability.start_time = start_time || availability.start_time;
        availability.end_time = end_time || availability.end_time;
        availability.is_available = is_available !== undefined ? is_available : availability.is_available;

        const updated = await availability.save();
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
