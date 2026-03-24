const express = require('express');
const router = express.Router();
const tenantController = require('./tenantController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

// All routes here require SUPERADMIN role
router.use(authenticateToken);
router.use(authorize(['SUPERADMIN']));

// Tenant Management
router.get('/tenants', tenantController.listTenants);
router.post('/tenants', tenantController.createTenant);
router.put('/tenants/:id', tenantController.updateTenant);
router.delete('/tenants/:id', tenantController.deleteTenant);

module.exports = router;
