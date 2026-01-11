const express = require('express');
const router = express.Router();
const { registerUser, authUser, getUserProfile, updateUserProfile } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', authUser);
router.get('/profile', require('../middleware/authMiddleware').protect, getUserProfile);
router.put('/profile', require('../middleware/authMiddleware').protect, updateUserProfile);

module.exports = router;
