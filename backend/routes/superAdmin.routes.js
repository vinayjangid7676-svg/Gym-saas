const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdmin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const superAdminMiddleware = require('../middlewares/superAdmin.middleware');

// 1. PUBLIC ROUTE: Dedicated Master Login
router.post('/login', superAdminController.superAdminLogin);

// 2. PROTECTED ROUTES: Strictly Super Admin Only
router.use(authMiddleware);
router.use(superAdminMiddleware);

router.get('/dashboard', superAdminController.getPlatformDashboard);
router.get('/gyms', superAdminController.getAllGyms);
router.patch('/gyms/status', superAdminController.toggleGymStatus);
router.post('/gyms/extend-trial', superAdminController.extendTrial);
router.post('/impersonate', superAdminController.impersonateTenant);
router.get('/announcements', superAdminController.getAnnouncements);
router.post('/announcements', superAdminController.createAnnouncement);
router.patch('/announcements/:id/toggle', superAdminController.toggleAnnouncementStatus);
router.get('/settings', superAdminController.getPlatformSettings);
router.put('/settings', superAdminController.updatePlatformSettings);
// ✅ YEH ROUTES MISSING THE (JISKI WAJAH SE 404 AAYA THA):
router.get('/pending-approvals', superAdminController.getPendingSubscriptions);
router.post('/process-approval', superAdminController.processSubscriptionApproval);
module.exports = router;