// Auth middleware:
// Validates JWT bearer token and attaches authenticated user to request context.
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            // Single-device login: validate sessionId if present in token
            if (decoded.sessionId && req.user.activeSession) {
                if (decoded.sessionId !== req.user.activeSession.sessionId) {
                    return res.status(403).json({
                        message: 'Your session has been invalidated. You have logged in on another device.',
                        code: 'SESSION_INVALIDATED',
                    });
                }
                // Update last activity time
                req.user.activeSession.lastActivityTime = new Date();
                await req.user.save();
            }

            return next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };
