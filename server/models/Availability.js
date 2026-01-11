const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
    },
    day_of_week: {
        type: Number,
        required: true,
        min: 0,
        max: 6,
    },
    start_time: {
        type: String,
        required: true,
    },
    end_time: {
        type: String,
        required: true,
    },
    is_available: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

// Ensure unique slot per day per doctor? 
// The frontend assumes one slot per day.
availabilitySchema.index({ doctor_id: 1, day_of_week: 1 }, { unique: true });

module.exports = mongoose.model('Availability', availabilitySchema);
