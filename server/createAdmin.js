const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const connectDB = require('./config/db');

dotenv.config();

const createAdmin = async () => {
    try {
        await connectDB();

        const email = 'chandany91077@gmail.com';
        const password = 'Password@1';
        const fullName = 'Admin User';

        let user = await User.findOne({ email });

        if (user) {
            console.log('User found, updating to admin...');
            user.password = password; // Will be hashed by pre-save hook
            user.role = 'admin';
            user.full_name = fullName; // Optional: ensure name is set
            await user.save();
            console.log('User updated to Admin successfully');
        } else {
            console.log('Creating new admin user...');
            user = await User.create({
                full_name: fullName,
                email: email,
                password: password,
                role: 'admin'
            });
            console.log('Admin user created successfully');
        }

        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

createAdmin();
