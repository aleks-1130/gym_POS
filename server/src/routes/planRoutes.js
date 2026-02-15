const express = require('express');
const router = express.Router();
const {
    getPlans,
    createPlan,
    updatePlan,
    deletePlan,
    getClassSessionPackages,
    createClassSessionPackage,
    updateClassSessionPackage,
    deleteClassSessionPackage
} = require('../controllers/planController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/', getPlans);
router.post('/', authenticateToken, authorize(['OWNER']), createPlan);
router.put('/:id', authenticateToken, authorize(['OWNER']), updatePlan);
router.delete('/:id', authenticateToken, authorize(['OWNER']), deletePlan);

router.get('/class-session-packages', authenticateToken, getClassSessionPackages);
router.post('/class-session-packages', authenticateToken, authorize(['OWNER']), createClassSessionPackage);
router.put('/class-session-packages/:id', authenticateToken, authorize(['OWNER']), updateClassSessionPackage);
router.delete('/class-session-packages/:id', authenticateToken, authorize(['OWNER']), deleteClassSessionPackage);

module.exports = router;
