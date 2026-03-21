const express = require('express');
const router = express.Router();
const adminController = require('./adminController');
const branchController = require('./branchController');
const payrollController = require('./payrollController');
const payrollConfigController = require('./payrollConfigController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/owner/audit-logs', authenticateToken, authorize(['OWNER', 'ADMIN']), adminController.getAuditLogs);
router.get('/users', authenticateToken, authorize(['OWNER', 'ADMIN']), adminController.getUsers);
router.post('/users', authenticateToken, authorize(['OWNER', 'ADMIN']), adminController.adminCreateUser);
router.put('/users/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), adminController.adminUpdateUser);
router.delete('/users/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), adminController.adminDeleteUser);
router.post('/owner/role-change', authenticateToken, authorize('OWNER'), adminController.changeUserRole);
router.post('/owner/transfer-ownership', authenticateToken, authorize('OWNER'), adminController.transferOwnership);

// Branch Management (Owner/Admin)
router.get('/branches', authenticateToken, authorize(['OWNER', 'ADMIN']), branchController.getBranches);
router.post('/branches', authenticateToken, authorize(['OWNER']), branchController.createBranch);
router.put('/branches/:id', authenticateToken, authorize(['OWNER']), branchController.updateBranch);

// Payroll Routes
router.get('/payroll/stats', authenticateToken, authorize(['OWNER', 'ADMIN']), payrollController.getStats);
router.get('/payroll/trainers', authenticateToken, authorize(['OWNER', 'ADMIN']), payrollController.getTrainers);
router.get('/payroll/staff', authenticateToken, authorize(['OWNER', 'ADMIN']), payrollController.getStaff);
router.post('/payroll/pay-commissions', authenticateToken, authorize(['OWNER', 'ADMIN']), payrollController.payCommissions);
router.post('/payroll/pay-commissions-auto', authenticateToken, authorize(['OWNER', 'ADMIN']), payrollController.payCommissionsAuto);

// Payroll Config Routes
router.get('/payroll/config', authenticateToken, authorize(['OWNER', 'ADMIN']), payrollConfigController.getPayrollConfig);
router.post('/payroll/config', authenticateToken, authorize(['OWNER', 'ADMIN']), payrollConfigController.updatePayrollConfig);

module.exports = router;
