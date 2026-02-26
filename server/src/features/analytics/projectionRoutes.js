const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../../middleware/authMiddleware');
const { getSnapshot } = require('./projectionController');

router.get('/snapshot', authenticateToken, authorize(['OWNER']), getSnapshot);

module.exports = router;
