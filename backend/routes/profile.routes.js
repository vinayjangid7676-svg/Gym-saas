const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');

// Sahi path: 'middlewares' (with 's') aur direct function import
const authMiddleware = require('../middlewares/auth.middleware');
const tenantGuard = require('../middlewares/tenant.middleware');

// Sabhi profile routes authenticated aur tenant-protected hain
router.use(authMiddleware);
router.use(tenantGuard);

router.get('/me', profileController.getMyProfile);
router.put('/update-owner', profileController.updateOwnerProfile);
router.put('/update-trainer', profileController.updateTrainerProfile);
router.post('/change-password', profileController.changePassword);

module.exports = router;