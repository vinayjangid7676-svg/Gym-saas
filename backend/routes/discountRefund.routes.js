const express = require('express');
const router = express.Router();
const discountRefundController = require('../controllers/discountRefund.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.use(authMiddleware);

// 1. Fetch Lists
router.get(
  '/promotions',
  authorizeRoles('owner', 'manager', 'receptionist'),
  discountRefundController.getOffersAndCoupons
);

router.get(
  '/refunds',
  authorizeRoles('owner', 'manager'),
  discountRefundController.getRefundHistory
);

// 2. Create Offers & Coupons
router.post(
  '/offers',
  authorizeRoles('owner', 'manager'),
  discountRefundController.createOffer
);

router.post(
  '/coupons',
  authorizeRoles('owner', 'manager'),
  discountRefundController.createCoupon
);

// 3. Apply Coupon & Process Refund
router.post(
  '/coupons/apply',
  authorizeRoles('owner', 'manager', 'receptionist'),
  discountRefundController.applyCoupon
);

router.post(
  '/refunds',
  authorizeRoles('owner', 'manager'),
  discountRefundController.processRefund
);

module.exports = router;