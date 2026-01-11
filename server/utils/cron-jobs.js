const cron = require('node-cron');
const Appointment = require('../models/Appointment');

const startAutoCancellationJob = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

            // Find appointments that are still 'pending' and 'unpaid' after 10 minutes
            const appointmentsToCancel = await Appointment.find({
                status: 'pending',
                payment_status: 'pending',
                createdAt: { $lt: tenMinutesAgo }
            });

            if (appointmentsToCancel.length > 0) {
                console.log(`[Auto-Cancel] Found ${appointmentsToCancel.length} unpaid appointments to cancel.`);

                for (const appt of appointmentsToCancel) {
                    appt.status = 'cancelled';
                    await appt.save();
                    console.log(`[Auto-Cancel] Cancelled appointment ${appt._id}`);
                }
            }
        } catch (error) {
            console.error('[Auto-Cancel] error:', error);
        }
    });

    console.log('[Cron] Auto-cancellation job scheduled.');
};

module.exports = { startAutoCancellationJob };
