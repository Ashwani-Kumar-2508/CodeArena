const adminService = require('../services/adminService');

async function getStats(req, res, next) {
  try {
    const stats = await adminService.getPlatformStats();
    res.json({ success: true, data: { stats } });
  } catch (error) {
    next(error);
  }
}

async function getUsers(req, res, next) {
  try {
    const users = await adminService.listAllUsers();
    res.json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
}

async function getInterviews(req, res, next) {
  try {
    const interviews = await adminService.listAllInterviews();
    res.json({ success: true, data: { interviews } });
  } catch (error) {
    next(error);
  }
}

async function getActivity(req, res, next) {
  try {
    const activity = await adminService.getSystemActivity();
    res.json({ success: true, data: { activity } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStats,
  getUsers,
  getInterviews,
  getActivity
};
