const express = require('express');
const router = express.Router();
const MedicalRecord = require('../models/MedicalRecord');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can access medical records' });
        }

        const records = await MedicalRecord.find({ patient_id: req.user._id }).sort({ createdAt: -1 });
        res.json(records);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can upload medical records' });
        }

        const {
            file_name,
            file_url,
            mime_type = '',
            file_size = 0,
            record_type = 'Other',
            notes = '',
        } = req.body;

        if (!file_name || !file_url) {
            return res.status(400).json({ message: 'file_name and file_url are required' });
        }

        const allowedTypes = ['Lab Reports', 'Prescriptions', 'Invoices', 'Other'];
        const safeRecordType = allowedTypes.includes(record_type) ? record_type : 'Other';

        const record = await MedicalRecord.create({
            patient_id: req.user._id,
            file_name,
            file_url,
            mime_type,
            file_size,
            record_type: safeRecordType,
            notes,
        });

        res.status(201).json(record);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can delete medical records' });
        }

        const record = await MedicalRecord.findOne({ _id: req.params.id, patient_id: req.user._id });
        if (!record) {
            return res.status(404).json({ message: 'Medical record not found' });
        }

        await record.deleteOne();
        res.json({ deleted: true });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
