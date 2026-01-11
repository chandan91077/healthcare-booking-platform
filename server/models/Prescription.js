const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    appointment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
    },
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
    },
    patient_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    diagnosis: {
        type: String,
        required: true,
    },
    medications: [{
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
    }],
    instructions: {
        type: String,
        default: '',
    },
    doctor_notes: {
        type: String,
        default: '',
    },
    pdf_url: {
        type: String, // S3 URL
    },
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
