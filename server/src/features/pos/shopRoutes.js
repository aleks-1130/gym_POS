const express = require('express');
const router = express.Router();
const shopController = require('./shopController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.post('/checkout', authenticateToken, authorize(['MEMBER', 'TRAINER']), shopController.checkout);
router.post('/claim-bundle-product', authenticateToken, authorize(['MEMBER']), shopController.claimBundleProduct);
router.get('/orders', authenticateToken, authorize(['MEMBER', 'TRAINER']), shopController.getMemberOrders);

module.exports = router;
