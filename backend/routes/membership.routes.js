const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membership.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/assign', membershipController.assignMembership);

module.exports = router;