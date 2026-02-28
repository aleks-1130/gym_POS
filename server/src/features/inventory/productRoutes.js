const express = require('express');
const router = express.Router();
const productController = require('./productController');
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');

router.get('/', authenticateToken, productController.getAllProducts);
router.get('/:id', authenticateToken, productController.getProductById);
router.post('/', authenticateToken, authorize(['ADMIN', 'STAFF']), productController.createProduct);
router.put('/:id', authenticateToken, authorize(['ADMIN', 'STAFF']), productController.updateProduct);
router.delete('/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), productController.deleteProduct);

// Inventory Management
router.post('/restock', authenticateToken, authorize(['OWNER', 'ADMIN']), productController.restockProduct);

module.exports = router;
