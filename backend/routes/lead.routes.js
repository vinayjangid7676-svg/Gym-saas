const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/', leadController.createLead);
router.post('/followup', leadController.addFollowup);
router.post('/convert', leadController.convertLeadToMember);

module.exports = router;