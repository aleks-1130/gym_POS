const express = require('express');
const router = express.Router();
const loyaltyController = require('./loyaltyController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/rewards', authenticateToken, loyaltyController.getRewards);
router.post('/rewards', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), loyaltyController.createReward);
router.put('/rewards/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), loyaltyController.updateReward);
router.delete('/rewards/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), loyaltyController.deleteReward);

// Coupon routes
router.get('/coupons/:memberId', authenticateToken, loyaltyController.getMemberCoupons);
router.post('/coupons/validate', authenticateToken, loyaltyController.validateCoupon);

module.exports = router;

