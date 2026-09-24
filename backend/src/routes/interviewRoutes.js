const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(requireAuth);

router.get('/', interviewController.listInterviews);
router.post('/', requireRole('ADMIN', 'INTERVIEWER'), interviewController.createInterview);
router.get('/:id', interviewController.getInterview);
router.post('/:id/start', requireRole('ADMIN', 'INTERVIEWER'), interviewController.startInterview);
router.post('/:id/end', requireRole('ADMIN', 'INTERVIEWER'), interviewController.endInterview);

module.exports = router;
