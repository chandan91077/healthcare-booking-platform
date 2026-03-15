// Cron utilities:
// Contains scheduled/background jobs such as auto-cancel for unpaid appointments.
const cron = require('node-cron');
const Appointment = require('../models/Appointment');

const AUTO_CANCEL_MINUTES = 5;

const cancelExpiredUnpaidAppointments = async () => {
    const thresholdDate = new Date(Date.now() - AUTO_CANCEL_MINUTES * 60 * 1000);

    const appointmentsToCancel = await Appointment.find({
        status: 'pending',
        payment_status: 'pending',
        createdAt: { $lt: thresholdDate }
    });

    if (appointmentsToCancel.length > 0) {
        console.log(`[Auto-Cancel] Found ${appointmentsToCancel.length} unpaid appointments to cancel.`);

        for (const appt of appointmentsToCancel) {
            appt.status = 'cancelled';
            appt.payment_status = 'failed';
            appt.notes = `${appt.notes || ''} Auto-cancelled after ${AUTO_CANCEL_MINUTES} minutes due to pending payment.`.trim();
            await appt.save();
            console.log(`[Auto-Cancel] Cancelled appointment ${appt._id}`);
        }
    }

    return appointmentsToCancel.length;
};

const startAutoCancellationJob = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            await cancelExpiredUnpaidAppointments();
        } catch (error) {
            console.error('[Auto-Cancel] error:', error);
        }
    });

    console.log('[Cron] Auto-cancellation job scheduled.');
};

module.exports = { startAutoCancellationJob, cancelExpiredUnpaidAppointments };
