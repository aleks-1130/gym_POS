const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, supplierController.getAllSuppliers);
router.post('/', authenticateToken, authorize(['OWNER', 'ADMIN']), supplierController.createSupplier);
router.put('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), supplierController.updateSupplier);
router.delete('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), supplierController.deleteSupplier);

module.exports = router;
