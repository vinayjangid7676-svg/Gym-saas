const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// ─── GET ENDPOINTS ───
router.get('/', authorizeRoles('owner', 'manager'), expenseController.getExpenses);
router.get('/master-data', authorizeRoles('owner', 'manager'), expenseController.getExpenseMasterData);
router.get('/vendors', authorizeRoles('owner', 'manager', 'receptionist'), expenseController.getVendors); // 👈 YEH ROUTE ADD KAREIN
router.get('/registers/active', authorizeRoles('owner', 'manager', 'receptionist'), expenseController.getActiveCashRegister);

// ─── CASH REGISTER OPERATIONS ───
router.post('/registers/open', authorizeRoles('owner', 'manager', 'receptionist'), expenseController.openCashRegister);
router.post('/registers/transaction', authorizeRoles('owner', 'manager', 'receptionist'), expenseController.addCashTransaction);
router.post('/registers/close', authorizeRoles('owner', 'manager', 'receptionist'), expenseController.closeCashRegister);

// ─── EXPENSES & VENDOR MANAGEMENT ───
router.post('/categories', authorizeRoles('owner', 'manager'), expenseController.createExpenseCategory);
router.post('/vendors', authorizeRoles('owner', 'manager'), expenseController.createVendor);
router.post('/', authorizeRoles('owner', 'manager'), expenseController.recordExpense);

module.exports = router;