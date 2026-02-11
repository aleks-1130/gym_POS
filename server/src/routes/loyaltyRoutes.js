const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/rewards', authenticateToken, loyaltyController.getRewards);
router.post('/rewards', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), loyaltyController.createReward);
router.put('/rewards/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), loyaltyController.updateReward);
router.delete('/rewards/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), loyaltyController.deleteReward);

// In server.js, this was mounted at /api/members/:id/points. 
// I should probably keep it there or in memberRoutes.
// But logic is loyalty related.
// If I mount this router at /api/loyalty, then I can't easily handle /api/members/:id/points.
// Unless I add it here and mount it separately in server.js?
// Or put it in memberRoutes.js?
// Original: app.post('/api/members/:id/points', ...)
// I'll put it in memberRoutes.js or just export the controller function and use it in memberRoutes.
// For now, I'll put it here but I might need to mount this router at /api/members too? No.
// I'll leave it as a todo. I'll put it in memberRoutes if I can find it.
// memberRoutes.js handles /api/members.
// So I should add `managePoints` finding to `memberRoutes.js`.

module.exports = router;
