const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/health-stats', dashboardController.getHealthStats);
router.get('/dashboard/stats', authenticateToken, dashboardController.getDashboardStats);

module.exports = router;
