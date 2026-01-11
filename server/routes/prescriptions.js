const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const Doctor = require('../models/Doctor');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
    try {
        const { role, _id } = req.user;
        let query = {};

        if (role === 'patient') {
            query.patient_id = _id;
        } else if (role === 'doctor') {
            const doctor = await Doctor.findOne({ user_id: _id });
            if (doctor) query.doctor_id = doctor._id;
        }

        const prescriptions = await Prescription.find(query)
            .populate({
                path: 'doctor_id',
                populate: { path: 'user_id', select: 'full_name' }
            })
            .populate('appointment_id')
            .sort({ createdAt: -1 });

        res.json(prescriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get prescriptions for a specific patient (for doctor review)
router.get('/patient/:patientId', protect, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Only doctors can view patient medical history' });
        }

        const prescriptions = await Prescription.find({ patient_id: req.params.patientId })
            .populate({
                path: 'doctor_id',
                populate: { path: 'user_id', select: 'full_name' }
            })
            .sort({ createdAt: -1 });

        res.json(prescriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get prescriptions for a specific appointment (patient & doctor can view)
router.get('/appointment/:appointmentId', protect, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        // Ensure viewer is either the patient or the doctor related to the appointment (or admin)
        const PrescriptionList = await Prescription.find({ appointment_id: appointmentId })
            .populate({ path: 'doctor_id', populate: { path: 'user_id', select: 'full_name email' } })
            .populate('patient_id', 'full_name email')
            .sort({ createdAt: -1 });

        res.json(PrescriptionList);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a prescription
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Only doctors can create prescriptions' });
        }

        const { appointment_id, patient_id, doctor_id, diagnosis, medications, instructions, doctor_notes, pdf_url } = req.body;

        const prescription = await Prescription.create({
            appointment_id,
            patient_id,
            doctor_id,
            diagnosis,
            medications,
            instructions,
            doctor_notes,
            pdf_url
        });

        res.status(201).json(prescription);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
