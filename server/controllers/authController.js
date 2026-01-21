const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../services/emailService');

const generateToken = (id, sessionId) => {
    return jwt.sign({ id, sessionId }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const registerUser = async (req, res) => {
    const { full_name, email, password, role } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        let user = await User.create({
            full_name,
            email,
            password,
            role: role || 'patient',
        });

        if (user) {
            // Send role-specific welcome email
            try {
                if (user.role === 'doctor') {
                    // For doctors, send a basic welcome (doctor profile will be created separately)
                    await sendEmail({
                        to: user.email,
                        subject: 'Welcome to MediConnect - Doctor Registration',
                        text: `Dear ${user.full_name},\n\nWelcome to MediConnect! Your doctor account has been successfully created.\n\nNext Steps:\n- Complete your doctor profile with specialization, experience, and credentials\n- Upload required verification documents\n- Wait for admin approval (typically 1-2 business days)\n- Once approved, you can start accepting appointments\n\nYou can complete your profile by logging into your dashboard.\n\nBest regards,\nThe MediConnect Team`,
                        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #667eea;">🏥 Welcome to MediConnect!</h2>
                            <p>Dear ${user.full_name},</p>
                            <p>Your <strong>doctor account</strong> has been successfully created. We're excited to have you join our healthcare platform.</p>
                            <h3>Next Steps:</h3>
                            <ul>
                                <li>Complete your doctor profile with specialization, experience, and credentials</li>
                                <li>Upload required verification documents</li>
                                <li>Wait for admin approval (typically 1-2 business days)</li>
                                <li>Once approved, you can start accepting appointments</li>
                            </ul>
                            <p>You can complete your profile by logging into your dashboard.</p>
                            <p>Best regards,<br/><strong>The MediConnect Team</strong></p>
                        </div>`
                    });
                } else {
                    // For patients
                    await sendEmail({
                        to: user.email,
                        subject: 'Welcome to MediConnect - Your Healthcare Platform',
                        text: `Dear ${user.full_name},\n\nWelcome to MediConnect! Your account has been successfully created.\n\nYou can now:\n- Search and book appointments with verified doctors\n- Chat with your healthcare providers\n- Access your medical prescriptions\n- Manage your appointments\n\nThank you for choosing MediConnect for your healthcare needs.\n\nBest regards,\nThe MediConnect Team`,
                        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #10b981;">Welcome to MediConnect!</h2>
                            <p>Dear ${user.full_name},</p>
                            <p>Your account has been successfully created. We're excited to have you join our healthcare platform.</p>
                            <h3>What you can do now:</h3>
                            <ul>
                                <li>Search and book appointments with verified doctors</li>
                                <li>Chat with your healthcare providers</li>
                                <li>Access your medical prescriptions</li>
                                <li>Manage your appointments</li>
                            </ul>
                            <p>Thank you for choosing MediConnect for your healthcare needs.</p>
                            <p>Best regards,<br/>The MediConnect Team</p>
                        </div>`
                    });
                }
            } catch (emailError) {
                console.error('Failed to send welcome email:', emailError);
                // Don't fail registration if email fails
            }

            // Create a new session for the newly registered user
            const sessionId = crypto.randomBytes(16).toString('hex');
            user.currentSessionId = sessionId;
            user = await user.save();

            res.status(201).json({
                _id: user._id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, sessionId),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const authUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            // Create a new session and invalidate any previous one
            const sessionId = crypto.randomBytes(16).toString('hex');
            user.currentSessionId = sessionId;
            await user.save();

            res.json({
                _id: user._id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, sessionId),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.full_name = req.body.full_name || user.full_name;
            user.phone = req.body.phone || user.phone;
            user.email = req.body.email || user.email; // Usually email updates require verify, but allowing for now needed? Settings.tsx says "Email cannot be changed"
            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();
            // Do not rotate session on profile update; return token consistent with current session if needed
            res.json({
                _id: updatedUser._id,
                full_name: updatedUser.full_name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role: updatedUser.role,
                token: generateToken(updatedUser._id, updatedUser.currentSessionId),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Logout: clear current session so token becomes invalid
const logoutUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.currentSessionId = null;
        await user.save();
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = { registerUser, authUser, getUserProfile, updateUserProfile, logoutUser };
