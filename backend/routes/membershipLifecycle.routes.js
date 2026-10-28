const express = require('express');
const router = express.Router();

// 1. Controller import karein (Sahi path check kar lein)
const memberController = require('../controllers/membershipLifecycle.controller'); 

// 2. Auth middleware import karein
const authMiddleware = require('../middlewares/auth.middleware'); // Aapke auth middleware ka sahi path

// 3. Member Detail Endpoint
router.get('/members/:hashId', authMiddleware, memberController.getMemberById);

// Baaki sabhi routes (Freeze, Extend, Transfer, Addons)...
router.post('/freeze', authMiddleware, memberController.freezeMembership);
router.post('/extend', authMiddleware, memberController.extendMembership);
router.post('/transfer', authMiddleware, memberController.transferMembership);
router.post('/addons/create', authMiddleware, memberController.createAddon);
router.post('/addons/attach', authMiddleware, memberController.attachAddonToMembership);
router.get('/addons', authMiddleware, memberController.getAddons);

module.exports = router;