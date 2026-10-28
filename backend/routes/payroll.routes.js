const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Only gym owners and general managers can view and process payroll
router.post('/generate', authorizeRoles('owner', 'manager'), payrollController.generateMonthlyPayroll);
router.post('/disburse', authorizeRoles('owner', 'manager'), payrollController.disburseStaffSalary);
router.get('/runs', authorizeRoles('owner', 'manager'), payrollController.getSalaryRuns);
router.get('/runs/:id', authorizeRoles('owner', 'manager'), payrollController.getSalaryRunDetails);

module.exports = router;