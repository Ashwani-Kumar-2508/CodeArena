const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// All admin routes strictly require authenticated ADMIN role
router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/interviews', adminController.getInterviews);
router.get('/activity', adminController.getActivity);

module.exports = router;
