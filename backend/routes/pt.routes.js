const express = require('express');
const router = express.Router();
const ptController = require('../controllers/pt.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// GET Routes
router.get('/plans', ptController.getPTPlans);
router.get('/enrollments', ptController.getEnrollments);
router.get('/enrollments/:enrollmentId/sessions', ptController.getSessionLogs);

// 1. PT Packages Create (Owner & Manager Only)
router.post(
  '/plans',
  authorizeRoles('owner', 'manager'),
  ptController.createPTPlan
);

// 2. Member ko PT Package me Enroll Karna (Owner, Manager, Receptionist)
router.post(
  '/enroll',
  authorizeRoles('owner', 'manager', 'receptionist'),
  ptController.enrollMemberPT
);

// 3. PT Session Log Karna (Trainer, Manager, Owner)
router.post(
  '/sessions',
  authorizeRoles('trainer', 'manager', 'owner'),
  ptController.logPTSession
);

module.exports = router;