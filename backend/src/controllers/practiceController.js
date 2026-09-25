const practiceService = require('../services/practiceService');

async function getPracticeDashboard(req, res, next) {
  try {
    const data = await practiceService.getPracticeDashboard(req.user.id);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function addToPractice(req, res, next) {
  try {
    const record = await practiceService.addToPractice(req.user.id, req.params.questionId);
    res.status(201).json({
      success: true,
      message: 'Question added to practice list',
      data: { record }
    });
  } catch (error) {
    next(error);
  }
}

async function removeFromPractice(req, res, next) {
  try {
    await practiceService.removeFromPractice(req.user.id, req.params.questionId);
    res.json({
      success: true,
      message: 'Question removed from practice list'
    });
  } catch (error) {
    next(error);
  }
}

async function runPracticeCode(req, res, next) {
  try {
    const { code, language = 'javascript' } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }
    const output = await practiceService.runPracticeCode({
      userId: req.user.id,
      questionId: req.params.questionId,
      code,
      language
    });
    res.json({
      success: true,
      data: output
    });
  } catch (error) {
    next(error);
  }
}

async function submitPracticeCode(req, res, next) {
  try {
    const { code, language = 'javascript' } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }
    const output = await practiceService.submitPracticeCode({
      userId: req.user.id,
      questionId: req.params.questionId,
      code,
      language
    });
    res.json({
      success: true,
      data: output
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPracticeDashboard,
  addToPractice,
  removeFromPractice,
  runPracticeCode,
  submitPracticeCode
};
