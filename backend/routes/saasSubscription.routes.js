const express = require('express');
const router = express.Router();
const saasController = require('../controllers/saasSubscription.controller');
const { authorizeRoles } = require('../middlewares/role.middleware');

// ================================================================
// 1. PUBLIC ENDPOINTS (Landing Page / Pricing View ke liye)
// Note: Is endpoint par koi token ya tenant guard required nahi hai
// ================================================================
router.get('/plans', saasController.getAllAvailablePlans);

// ================================================================
// 2. TENANT AUTHENTICATED ENDPOINTS (Gym Owner / Staff Access)
// ================================================================
// Current gym ka subscription aur quota usage dekhna
router.get('/current', saasController.getCurrentSubscription);

// Gym Owner Actions: Naya plan lena ya invoice pay karna
router.post('/subscribe', authorizeRoles('owner'), saasController.createSubscription);
router.post('/pay', authorizeRoles('owner'), saasController.paySaasInvoice);

// ================================================================
// 3. MASTER PLATFORM ADMIN ENDPOINTS (Strictly Super Admin Only)
// ================================================================
// Naye plans create karna normal Gym Owner ko allow NAHI hona chahiye
router.post('/plans', authorizeRoles('super_admin'), saasController.createSaasPlan);

module.exports = router;