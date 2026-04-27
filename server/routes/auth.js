// Auth route:
// Exposes register/login and authenticated profile endpoints.
const express = require('express');
const router = express.Router();
const {
	registerUser,
	authUser,
	forgotPassword,
	resetPassword,
	googleAuth,
	getUserProfile,
	updateUserProfile,
} = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google', googleAuth);
router.get('/profile', require('../middleware/authMiddleware').protect, getUserProfile);
router.put('/profile', require('../middleware/authMiddleware').protect, updateUserProfile);

module.exports = router;
