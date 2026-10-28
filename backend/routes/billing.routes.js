const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);
router.use(authorizeRoles('owner', 'manager', 'receptionist'));

router.post('/invoices', billingController.createInvoice);
router.post('/payments', billingController.recordPayment);
router.get('/invoices', billingController.getInvoices);
router.get('/payments', billingController.getPaymentHistory);
router.get('/invoices/:id', billingController.getInvoiceById);
router.get('/members/:memberId/ledger', billingController.getMemberLedger);

module.exports = router;