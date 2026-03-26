const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboardController');
const { authenticateToken } = require('../../middleware/authMiddleware');

router.get('/health-stats', authenticateToken, dashboardController.getHealthStats);
router.get('/stats', authenticateToken, dashboardController.getDashboardStats);
// Backward-compatible route (can be removed after clients migrate)
router.get('/dashboard/stats', authenticateToken, dashboardController.getDashboardStats);

module.exports = router;
