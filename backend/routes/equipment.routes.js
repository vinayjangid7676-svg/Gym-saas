'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/equipment.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

const READ = ['owner', 'manager', 'trainer', 'receptionist']; // view + report problems
const MANAGE = ['owner', 'manager'];                           // create / edit / schedule / complete
const OWNER = ['owner'];                                       // org-wide decisions

// Public identifiers only: every :id is a hash id (e.g. eqp_ab12...), never a BIGINT.
const HASH_RE = /^[a-z]{2,5}_[a-f0-9]{16,32}$/;
const guardHash = (req, res, next, value) => {
  if (!HASH_RE.test(value)) return res.status(400).json({ success: false, message: 'Invalid reference passed in URL.' });
  return next();
};
router.param('id', guardHash);
router.param('attId', guardHash);
router.param('token', (req, res, next, value) => {
  if (!/^[a-f0-9]{48}$/.test(value)) return res.status(400).json({ success: false, message: 'Invalid QR code.' });
  return next();
});

// Dashboard / lookups / export
router.get('/lookups', authorizeRoles(...READ), controller.getLookups);
router.get('/stats', authorizeRoles(...READ), controller.getEquipmentStats);
router.get('/export', authorizeRoles(...MANAGE), controller.exportEquipmentCsv);

// Categories
router.get('/categories', authorizeRoles(...READ), controller.getCategories);
router.post('/categories', authorizeRoles(...MANAGE), controller.createCategory);
router.patch('/categories/:id', authorizeRoles(...MANAGE), controller.updateCategory);
router.delete('/categories/:id', authorizeRoles(...MANAGE), controller.deleteCategory);

// Breakdown tickets
router.get('/incidents', authorizeRoles(...READ), controller.getIncidentsList);
router.post('/incidents/report', authorizeRoles(...READ), controller.reportIncident);
router.patch('/incidents/:id/status', authorizeRoles(...MANAGE), controller.updateIncidentStatus);
router.patch('/incidents/:id/resolve', authorizeRoles(...MANAGE), controller.resolveIncident);

// Maintenance work orders
router.get('/maintenance', authorizeRoles(...READ), controller.getMaintenanceList);
router.post('/maintenance/schedule', authorizeRoles(...MANAGE), controller.scheduleMaintenance);
router.post('/maintenance/run-scheduler', authorizeRoles(...OWNER), controller.runScheduler);
router.patch('/maintenance/:id/start', authorizeRoles(...MANAGE), controller.startMaintenance);
router.patch('/maintenance/:id/complete', authorizeRoles(...MANAGE), controller.completeMaintenance);
router.patch('/maintenance/:id/cancel', authorizeRoles(...MANAGE), controller.cancelMaintenance);

// Preventive maintenance plans
router.get('/plans', authorizeRoles(...READ), controller.getPlans);
router.post('/plans', authorizeRoles(...MANAGE), controller.createPlan);
router.patch('/plans/:id', authorizeRoles(...MANAGE), controller.updatePlan);
router.delete('/plans/:id', authorizeRoles(...MANAGE), controller.deletePlan);

// Spare parts
router.get('/parts', authorizeRoles(...READ), controller.getParts);
router.post('/parts', authorizeRoles(...MANAGE), controller.createPart);
router.patch('/parts/:id', authorizeRoles(...MANAGE), controller.updatePart);
router.post('/parts/:id/restock', authorizeRoles(...MANAGE), controller.restockPart);

// AMC / warranty contracts
router.get('/contracts', authorizeRoles(...MANAGE), controller.getContracts);
router.post('/contracts', authorizeRoles(...MANAGE), controller.createContract);
router.patch('/contracts/:id', authorizeRoles(...MANAGE), controller.updateContract);
router.post('/contracts/:id/assign', authorizeRoles(...MANAGE), controller.assignContract);

// Inter-branch transfers
router.get('/transfers', authorizeRoles(...MANAGE), controller.getTransfers);
router.post('/transfers', authorizeRoles(...MANAGE), controller.requestTransfer);
router.patch('/transfers/:id/decision', authorizeRoles(...OWNER), controller.decideTransfer);

// Bulk import, QR lookup, attachments
router.post('/bulk', authorizeRoles(...MANAGE), controller.bulkImportEquipment);
router.get('/qr/:token', authorizeRoles(...READ), controller.getByQr);
router.delete('/attachments/:attId', authorizeRoles(...MANAGE), controller.deleteAttachment);

// Equipment register (keep /:id routes LAST so static paths above win)
router.get('/', authorizeRoles(...READ), controller.getEquipmentList);
router.post('/', authorizeRoles(...MANAGE), controller.createEquipment);
router.get('/:id', authorizeRoles(...READ), controller.getEquipmentDetail);
router.patch('/:id', authorizeRoles(...MANAGE), controller.updateEquipment);
router.patch('/:id/status', authorizeRoles(...MANAGE), controller.updateEquipmentStatus);
router.delete('/:id', authorizeRoles(...MANAGE), controller.deleteEquipment);
router.post('/:id/inspections', authorizeRoles(...READ), controller.addInspection);
router.post('/:id/attachments', authorizeRoles(...MANAGE), controller.addAttachment);

module.exports = router;