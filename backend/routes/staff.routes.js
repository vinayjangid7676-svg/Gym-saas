const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Directory viewable by staff with portal clearance
router.get('/', staffController.getStaff);

// Modifying and registering staff restricted to administrators
router.post('/', authorizeRoles('owner', 'manager'), staffController.createStaff);
router.put('/:id', authorizeRoles('owner', 'manager'), staffController.updateStaff);
router.post('/attendance', staffController.staffClockInOut);

module.exports = router;