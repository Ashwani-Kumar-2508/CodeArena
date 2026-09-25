const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(requireAuth);

router.get('/', questionController.listQuestions);
router.get('/:id', questionController.getQuestion);
router.post('/', requireRole('ADMIN', 'INTERVIEWER'), questionController.createQuestion);
router.patch('/:id', requireRole('ADMIN', 'INTERVIEWER'), questionController.updateQuestion);
router.delete('/:id', requireRole('ADMIN', 'INTERVIEWER'), questionController.deleteQuestion);

module.exports = router;
