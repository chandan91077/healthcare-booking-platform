// MedicalRecord model:
// Stores patient-uploaded documents and metadata for record sharing workflows.
const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema(
    {
        patient_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        file_name: {
            type: String,
            required: true,
            trim: true,
        },
        file_url: {
            type: String,
            required: true,
            trim: true,
        },
        mime_type: {
            type: String,
            default: '',
            trim: true,
        },
        file_size: {
            type: Number,
            default: 0,
        },
        record_type: {
            type: String,
            enum: ['Lab Reports', 'Prescriptions', 'Invoices', 'Other'],
            default: 'Other',
        },
        notes: {
            type: String,
            default: '',
            trim: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
