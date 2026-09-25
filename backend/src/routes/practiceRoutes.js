const express = require('express');
const router = express.Router();
const practiceController = require('../controllers/practiceController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/', practiceController.getPracticeDashboard);
router.post('/:questionId', practiceController.addToPractice);
router.delete('/:questionId', practiceController.removeFromPractice);
router.post('/:questionId/run', practiceController.runPracticeCode);
router.post('/:questionId/submit', practiceController.submitPracticeCode);

module.exports = router;
