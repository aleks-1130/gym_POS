const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, authorize(['OWNER']), seedController.seedDatabase);

module.exports = router;
