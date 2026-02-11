const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/owner/audit-logs', authenticateToken, authorize('OWNER'), adminController.getAuditLogs);
router.get('/users', authenticateToken, authorize(['OWNER', 'ADMIN']), adminController.getUsers);
router.post('/owner/role-change', authenticateToken, authorize('OWNER'), adminController.changeUserRole);
router.post('/owner/transfer-ownership', authenticateToken, authorize('OWNER'), adminController.transferOwnership);

module.exports = router;
