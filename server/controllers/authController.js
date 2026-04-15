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

// JWT used by client after login/register.
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
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

        const user = await User.create({
            full_name,
            email,
            password,
            role: role || 'patient',
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
                token: generateToken(user._id),
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
            res.json({
                _id: user._id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
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

        res.json({
            _id: user._id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { registerUser, authUser, googleAuth, getUserProfile, updateUserProfile };
