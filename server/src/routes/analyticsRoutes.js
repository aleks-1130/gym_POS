const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, authorize(['OWNER', 'ADMIN']), analyticsController.getAnalytics);

module.exports = router;
