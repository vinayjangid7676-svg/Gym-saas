const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branch.controller');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { checkBranchLimit } = require('../middlewares/subscription.middleware');

// 1. Read Operations: Sabhi authenticated gym staff ke liye accessible
router.get('/', branchController.getBranches);
router.get('/:id', branchController.getBranchById);

// 2. High-Privilege Write Operations: Sirf Owner aur Manager ke liye
// checkBranchLimit middleware check karega ki plan ka branch quota exhaust to nahi hua
router.post(
  '/',
  authorizeRoles('owner', 'manager'),
  checkBranchLimit,
  branchController.createBranch
);

router.put(
  '/:id',
  authorizeRoles('owner', 'manager'),
  branchController.updateBranch
);

router.delete(
  '/:id',
  authorizeRoles('owner', 'manager'),
  branchController.deleteBranch
);

// ✅ YEH LINE COMPULSORY HAI: Directly router export hona chahiye, koi object wrapper nahi
module.exports = router;