const replayService = require('../services/replayService');

async function getReplay(req, res, next) {
  try {
    const replayData = await replayService.getInterviewReplay(req.params.interviewId, req.user);
    res.json({
      success: true,
      data: replayData
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getReplay
};
