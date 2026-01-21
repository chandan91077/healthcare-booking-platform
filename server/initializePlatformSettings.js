const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PlatformSettings = require('./models/PlatformSettings');
const connectDB = require('./config/db');

dotenv.config();

const initializePlatformSettings = async () => {
    try {
        await connectDB();

        console.log('Initializing Platform Settings...');

        // Check if platform_fees settings already exist
        let settings = await PlatformSettings.findOne({ key: 'platform_fees' });

        if (settings) {
            console.log('Platform settings found, updating...');
            settings.enabled = true;
            settings.percentage = 2.5; // 2.5% of consultation fee
            settings.fixed = 0; // No fixed fee
            settings.minFee = 0; // No minimum
            settings.maxFee = 0; // No maximum cap
            settings.notes = 'Updated via initialization script';
            await settings.save();
            console.log('Platform settings updated successfully');
        } else {
            console.log('Creating new platform settings...');
            settings = await PlatformSettings.create({
                key: 'platform_fees',
                enabled: true,
                percentage: 2.5, // 2.5% of consultation fee
                fixed: 0, // No fixed fee
                minFee: 0, // No minimum
                maxFee: 0, // No maximum cap
                notes: 'Initialized via script'
            });
            console.log('Platform settings created successfully');
        }

        console.log('\n✅ Platform Settings Configuration:');
        console.log(`   - Enabled: ${settings.enabled}`);
        console.log(`   - Percentage: ${settings.percentage}%`);
        console.log(`   - Fixed Fee: ₹${settings.fixed}`);
        console.log(`   - Min Fee: ₹${settings.minFee}`);
        console.log(`   - Max Fee: ₹${settings.maxFee}`);
        console.log(`\n   Example: For ₹500 consultation fee, platform fee will be: ₹${Math.round((500 * settings.percentage) / 100 + settings.fixed)}`);
        console.log(`   Total amount: ₹${500 + Math.round((500 * settings.percentage) / 100 + settings.fixed)}`);

        process.exit(0);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

initializePlatformSettings();
