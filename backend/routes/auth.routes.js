const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Gym Owner Self-Registration / Application Route
router.post('/register-gym', authController.registerGymOwner);

// Login Route
router.post('/login', authController.login);

module.exports = router;