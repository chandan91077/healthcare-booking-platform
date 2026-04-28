// Auth controller:
// Implements registration, login, google auth, and profile read/update behaviors.
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const {
    admin,
    isFirebaseReady,
    getFirebaseProjectId,
    getFirebaseInitError,
} = require('../config/firebase');
const { sendEmail } = require('../services/emailService');
const { renderEmailWithFallback } = require('../utils/emailTemplates');

// JWT used by client after login/register. Includes sessionId for single-device enforcement.
const generateToken = (id, sessionId = null) => {
    const payload = { id };
    if (sessionId) {
        payload.sessionId = sessionId;
    }
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// Generate a unique session ID
const generateSessionId = () => {
    return require('crypto').randomBytes(16).toString('hex');
};

const registerUser = async (req, res) => {
    const { full_name, email, password, role } = req.body;

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const sessionId = generateSessionId();
        const user = await User.create({
            full_name,
            email,
            password,
            role: role || 'patient',
            activeSession: {
                sessionId,
                deviceInfo: req.headers['user-agent'] || 'Unknown Device',
                loginTime: new Date(),
                lastActivityTime: new Date(),
            },
        });

        if (user) {
            try {
                // Account creation sends email only (no in-app welcome notification).
                const isDoctor = (role || 'patient') === 'doctor';
                const subject = isDoctor
                    ? 'Welcome to MediConnect Doctor Network'
                    : 'Welcome to MediConnect';

                // Template first, with generic fallback from helper if file is missing.
                const resolved = renderEmailWithFallback({
                    locale: user.locale || 'en',
                    templateName: isDoctor ? 'welcome_doctor' : 'welcome_patient',
                    context: { name: full_name },
                });

                await sendEmail({
                    to: user.email,
                    subject,
                    text: resolved.text,
                    html: resolved.html,
                });
            } catch (notifError) {
                console.error('Failed to send welcome email:', notifError);
            }

            res.status(201).json({
                _id: user._id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, sessionId),
                sessionId: sessionId,
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
            // Create new session and invalidate previous one on different device
            const sessionId = generateSessionId();
            user.activeSession = {
                sessionId,
                deviceInfo: req.headers['user-agent'] || 'Unknown Device',
                loginTime: new Date(),
                lastActivityTime: new Date(),
            };
            await user.save();

            res.json({
                _id: user._id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, sessionId),
                sessionId: sessionId,
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const forgotPassword = async (req, res) => {
    const email = req.body?.email?.toString().trim().toLowerCase() || '';
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    const genericMessage =
        'If an account with that email exists, a password reset link has been sent.';

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ message: genericMessage });
        }

        const resetToken = jwt.sign(
            { id: user._id, purpose: 'password_reset' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:8080')
            .split(',')[0]
            .trim();
        const resetUrl = `${frontendBase}/reset-password?token=${encodeURIComponent(resetToken)}`;

        const resolved = renderEmailWithFallback({
            locale: user.locale || 'en',
            templateName: 'password_reset',
            context: { name: user.full_name, reset_url: resetUrl },
            fallbackText: ({ name, reset_url }) =>
                `Hi ${name || 'there'},\n\nUse this link to reset your MediConnect password: ${reset_url}\n\nThis link expires in 15 minutes. If you did not request this, you can ignore this email.`,
            fallbackHtml: ({ name, reset_url }) =>
                `<p>Hi ${name || 'there'},</p><p>Use this link to reset your MediConnect password:</p><p><a href="${reset_url}">${reset_url}</a></p><p>This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>`,
        });

        await sendEmail({
            to: user.email,
            subject: 'MediConnect password reset',
            text: resolved.text,
            html: resolved.html,
        });

        return res.json({ message: genericMessage });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const resetPassword = async (req, res) => {
    const token = req.body?.token?.toString().trim() || '';
    const newPassword = req.body?.new_password?.toString() || '';

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'token and new_password are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || decoded.purpose !== 'password_reset' || !decoded.id) {
            return res.status(400).json({ message: 'Invalid reset token.' });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.password = newPassword;
        await user.save();

        return res.json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        if (error?.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Reset token has expired.' });
        }
        if (error?.name === 'JsonWebTokenError') {
            return res.status(400).json({ message: 'Invalid reset token.' });
        }
        return res.status(500).json({ message: error.message });
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
            user.locale = req.body.locale || user.locale;
            if (req.body.notification_preferences) {
                user.notification_preferences = {
                    ...user.notification_preferences,
                    ...req.body.notification_preferences,
                };
            }
            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                full_name: updatedUser.full_name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                avatar_url: updatedUser.avatar_url,
                role: updatedUser.role,
                locale: updatedUser.locale,
                notification_preferences: updatedUser.notification_preferences,
                createdAt: updatedUser.createdAt,
                token: generateToken(updatedUser._id), // Optional: Refresh token if needed
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Google Sign-In / Firebase ID Token auth.
// Accepts a Firebase ID token from the client, verifies it with Firebase Admin,
// then finds-or-creates the user in MongoDB and returns our own JWT.
const googleAuth = async (req, res) => {
    const { idToken, role } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: 'Firebase ID token is required.' });
    }

    if (!isFirebaseReady()) {
        const initError = getFirebaseInitError();
        return res.status(500).json({
            message: 'Server Firebase auth is not configured. Please contact support.',
            code: 'firebase/not-initialized',
            detail: process.env.NODE_ENV === 'production' ? undefined : (initError?.message || null),
        });
    }

    let decoded;
    try {
        decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
        console.error('Firebase token verification failed:', err);
        const firebaseCode = err?.errorInfo?.code || err?.code || 'auth/token-verification-failed';

        if (firebaseCode === 'auth/id-token-expired') {
            return res.status(401).json({
                message: 'Firebase session expired. Please continue with Google again.',
                code: firebaseCode,
            });
        }

        if (firebaseCode === 'auth/invalid-id-token' || firebaseCode === 'auth/argument-error') {
            const unsafeDecoded = jwt.decode(idToken) || {};
            const tokenProject = unsafeDecoded.aud || unsafeDecoded.project_id || null;
            const serverProject = getFirebaseProjectId();

            if (tokenProject && serverProject && tokenProject !== serverProject) {
                return res.status(401).json({
                    message: 'Firebase project mismatch between app token and backend service account.',
                    code: 'firebase/project-mismatch',
                    expectedProject: serverProject,
                    receivedProject: tokenProject,
                });
            }

            return res.status(401).json({
                message: 'Invalid Firebase token. Ensure app Firebase config and backend service account use the same project.',
                code: firebaseCode,
            });
        }

        if (firebaseCode === 'app/no-app') {
            return res.status(500).json({
                message: 'Server Firebase auth is not configured. Please contact support.',
                code: 'firebase/not-initialized',
            });
        }

        return res.status(401).json({
            message: 'Invalid or expired Firebase token.',
            code: firebaseCode,
        });
    }

    const { uid, email, name: displayName, picture: photoURL } = decoded;
    const userRole = role || 'patient';

    try {
        // Try to find by firebase_uid first (already linked), then by email (account linking).
        let user = await User.findOne({ $or: [{ firebase_uid: uid }, { email }] });

        if (user) {
            // Link firebase_uid if this user signed up with email/password before.
            if (!user.firebase_uid) {
                user.firebase_uid = uid;
                await user.save();
            }
        } else {
            // New Google user — create account.
            user = await User.create({
                email,
                full_name: displayName || email.split('@')[0],
                avatar_url: photoURL || '',
                role: userRole,
                firebase_uid: uid,
            });

            // Send welcome email (non-blocking).
            try {
                const isDoctor = userRole === 'doctor';
                const resolved = renderEmailWithFallback({
                    locale: 'en',
                    templateName: isDoctor ? 'welcome_doctor' : 'welcome_patient',
                    context: { name: user.full_name },
                });
                await sendEmail({
                    to: user.email,
                    subject: isDoctor ? 'Welcome to MediConnect Doctor Network' : 'Welcome to MediConnect',
                    text: resolved.text,
                    html: resolved.html,
                });
            } catch (_) { /* ignore email errors */ }
        }

        // Create new session and invalidate previous one
        const sessionId = generateSessionId();
        user.activeSession = {
            sessionId,
            deviceInfo: req.headers['user-agent'] || 'Unknown Device',
            loginTime: new Date(),
            lastActivityTime: new Date(),
        };
        await user.save();

        res.json({
            _id: user._id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id, sessionId),
            sessionId: sessionId,
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerUser,
    authUser,
    forgotPassword,
    resetPassword,
    googleAuth,
    getUserProfile,
    updateUserProfile,
};
