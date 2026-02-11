const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.post('/checkout', authenticateToken, authorize(['MEMBER']), shopController.checkout);
router.get('/orders', authenticateToken, authorize(['MEMBER']), shopController.getMemberOrders);

module.exports = router;
