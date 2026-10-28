const express = require('express');
const router = express.Router();
const configController = require('../controllers/systemConfig.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Public Webhook Ingestion (No user JWT token needed, verified via signature/payload)
router.post('/webhooks', configController.handleWebhook);

// Protected Admin Endpoints
router.use(authMiddleware);

// Section 19: API Keys & Audit
router.post('/api-keys', configController.generateApiKey);
router.post('/audit-logs', configController.recordAuditLog);
router.post('/backup-logs', configController.logBackup);

// Section 20: Tenant & Branch Settings
router.get('/settings', configController.getConfig);
router.post('/settings/organization', configController.saveOrgSettings);
router.post('/settings/branch', configController.saveBranchSettings);

module.exports = router;