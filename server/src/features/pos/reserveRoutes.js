const express = require('express');
const router = express.Router();
const reserveController = require('./reserveController');
const { authenticateToken } = require('../../middleware/authMiddleware');

router.get('/:sessionId', authenticateToken, reserveController.getReservations);
router.post('/', authenticateToken, reserveController.reserveStock);
router.delete('/:sessionId/:productId', authenticateToken, reserveController.removeReservationItem);
router.delete('/:sessionId', authenticateToken, reserveController.clearSessionReservations);

module.exports = router;
