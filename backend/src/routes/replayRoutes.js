const express = require('express');
const router = express.Router();
const replayController = require('../controllers/replayController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/:interviewId', replayController.getReplay);

module.exports = router;
