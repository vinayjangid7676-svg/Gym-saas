const express = require('express');
const router = express.Router();
const classController = require('../controllers/class.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// ================================================================
// 1. READ OPERATIONS (Owner, Manager, Receptionist, Trainer)
// ================================================================
router.get('/', classController.getClasses);
router.get('/schedules', classController.getSchedules);
router.get('/member/:memberId', classController.getMemberClasses);

// ================================================================
// 2. MASTER CLASS CREATION (Owner & Manager Only)
// ================================================================
router.post(
  '/',
  authorizeRoles('owner', 'manager'),
  classController.createClass
);

// ================================================================
// 3. SCHEDULE BATCH SLOTS (Owner, Manager, Receptionist)
// ================================================================
router.post(
  '/schedule',
  authorizeRoles('owner', 'manager', 'receptionist'),
  classController.scheduleClass
);

// ================================================================
// 4. BOOK MEMBER INTO SLOT (Owner, Manager, Receptionist)
// ================================================================
router.post(
  '/book',
  authorizeRoles('owner', 'manager', 'receptionist'),
  classController.bookClass
);

// ================================================================
// 5. CANCEL BOOKING & AUTO-FIFO WAITLIST (Owner, Manager, Receptionist)
// ================================================================
router.post(
  '/cancel',
  authorizeRoles('owner', 'manager', 'receptionist'),
  classController.cancelBooking
);

module.exports = router;