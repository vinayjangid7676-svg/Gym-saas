const express = require('express');
const router = express.Router();
const lockerController = require('../controllers/locker.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// TODO: if your auth.middleware exposes a role-check helper
// (e.g. requireRole('admin','owner')), wrap the two pricing routes
// below with it. Front-desk / trainer roles should be able to VIEW
// pricing but not change it — only allocate lockers at whatever
// price is already configured.
// Example once available:
//   router.put('/pricing', authMiddleware, requireRole('admin','owner'), lockerController.setBranchLockerPricing);

router.use(authMiddleware);

// Locker inventory
router.post('/', lockerController.createLocker);
router.get('/', lockerController.getLockersList);

// Allocation lifecycle
// router.post('/allocate', lockerController.allocateLocker);
router.post('/vacate', lockerController.vacateLocker);

// Branch-level default pricing (source of truth the frontend now reads from)
router.get('/pricing', lockerController.getBranchLockerPricing);
router.put('/pricing', lockerController.setBranchLockerPricing);

module.exports = router;