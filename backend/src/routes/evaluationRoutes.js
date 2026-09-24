const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(requireAuth);

router.post('/', requireRole('ADMIN', 'INTERVIEWER'), evaluationController.createEvaluation);
router.get('/:interviewId', requireRole('ADMIN', 'INTERVIEWER'), evaluationController.getEvaluation);

module.exports = router;
