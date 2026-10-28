const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/products', inventoryController.createProduct);
router.post('/purchases', inventoryController.receivePurchase);
router.post('/purchases/settle-payment', inventoryController.recordVendorPayment);

// Purchase Return / Debit Note Endpoints
router.post('/purchases/return', inventoryController.recordPurchaseReturn);
router.get('/purchases/returns', inventoryController.getPurchaseReturns);
router.get('/vendors/:vendor_id/credits', inventoryController.getVendorCredits);

router.post('/pos-sale', inventoryController.posSale);
router.get('/stock', inventoryController.getProductStock);
router.get('/purchases', inventoryController.getPurchases);

module.exports = router;