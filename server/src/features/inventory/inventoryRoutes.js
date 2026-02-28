const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');
const categoryController = require('./categoryController');
const stockOrderController = require('./stockOrderController');

router.get('/categories', authenticateToken, categoryController.getCategories);
router.post('/categories', authenticateToken, authorize(['ADMIN', 'STAFF']), categoryController.createCategory);
router.put('/categories/:id', authenticateToken, authorize(['ADMIN', 'STAFF']), categoryController.updateCategory);
router.delete('/categories/:id', authenticateToken, authorize(['OWNER', 'ADMIN']), categoryController.deleteCategory);

router.get('/stock-orders', authenticateToken, stockOrderController.listStockOrders);
router.get('/stock-orders/:id', authenticateToken, stockOrderController.getStockOrderById);
router.post('/stock-orders', authenticateToken, authorize(['ADMIN', 'STAFF']), stockOrderController.createStockOrder);
router.put('/stock-orders/:id', authenticateToken, authorize(['OWNER', 'ADMIN', 'STAFF']), stockOrderController.updateStockOrder);
router.put('/stock-orders/:id/receive', authenticateToken, authorize(['OWNER', 'ADMIN']), stockOrderController.markStockOrderReceived);
router.put('/stock-orders/:id/cancel', authenticateToken, authorize(['OWNER', 'ADMIN']), stockOrderController.cancelStockOrder);

module.exports = router;
