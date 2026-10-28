const express = require('express');
const router = express.Router();

// Controller aur Middleware import karein
const posMasterController = require('../controllers/posMaster.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// In sabhi routes ko secure karne ke liye Auth Middleware apply karein
router.use(authMiddleware);

// ─── POS MASTER API ENDPOINTS ───

// GET /api/v1/lockers (Available lockers fetch karne ke liye)
router.get('/lockers', posMasterController.getLockers);

// GET /api/v1/pt-plans (Personal Training plans fetch karne ke liye)
router.get('/pt-plans', posMasterController.getPtPlans);

// GET /api/v1/addons (Membership Add-ons fetch karne ke liye)
router.get('/addons', posMasterController.getAddons);

module.exports = router;