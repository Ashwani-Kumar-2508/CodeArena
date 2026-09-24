const express = require('express');
const router = express.Router();
const codeController = require('../controllers/codeController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { codeExecutionLimiter } = require('../middlewares/rateLimitMiddleware');

router.use(requireAuth);

router.post('/run', codeExecutionLimiter, codeController.runCode);
router.post('/submit', codeExecutionLimiter, codeController.submitCode);

module.exports = router;
