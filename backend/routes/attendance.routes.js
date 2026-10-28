const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Hardware machine entry endpoint (No user JWT required)
router.post('/checkin', attendanceController.processCheckIn);

// Protected Admin/Staff endpoint
router.post('/devices', authMiddleware, attendanceController.registerDevice);

module.exports = router;