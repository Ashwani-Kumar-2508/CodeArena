const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(requireAuth);

// Candidate selector for interviewers/admins
router.get('/candidates', requireRole('ADMIN', 'INTERVIEWER'), interviewController.getCandidates);

router.get('/', interviewController.listInterviews);
router.post('/', requireRole('ADMIN', 'INTERVIEWER'), interviewController.createInterview);
router.get('/:id', interviewController.getInterview);
router.post('/:id/start', requireRole('ADMIN', 'INTERVIEWER'), interviewController.startInterview);
router.post('/:id/end', requireRole('ADMIN', 'INTERVIEWER'), interviewController.endInterview);
router.post('/:id/cancel', requireRole('ADMIN', 'INTERVIEWER'), interviewController.cancelInterview);

module.exports = router;
