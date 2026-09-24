const interviewService = require('../services/interviewService');
const { z } = require('zod');

const createInterviewSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  candidateId: z.string().min(1, 'Please select a valid candidate'),
  scheduledAt: z.string().optional(),
  durationMinutes: z.number().or(z.string().regex(/^\d+$/)).transform(Number).optional(),
  questionIds: z.array(z.string()).min(1, 'Please select at least one question')
});

async function getCandidates(req, res, next) {
  try {
    const candidates = await interviewService.listCandidates();
    res.json({
      success: true,
      data: { candidates }
    });
  } catch (error) {
    next(error);
  }
}

async function createInterview(req, res, next) {
  try {
    const validatedData = createInterviewSchema.parse(req.body);
    const interview = await interviewService.createInterview(req.user.id, validatedData);
    res.status(201).json({
      success: true,
      message: 'Interview created and scheduled successfully',
      data: { interview }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors.map(e => e.message).join(', ')
      });
    }
    next(error);
  }
}

async function listInterviews(req, res, next) {
  try {
    const interviews = await interviewService.listInterviewsForUser(req.user);
    res.json({
      success: true,
      data: { interviews }
    });
  } catch (error) {
    next(error);
  }
}

async function getInterview(req, res, next) {
  try {
    const interview = await interviewService.getInterviewById(req.params.id, req.user);
    res.json({
      success: true,
      data: { interview }
    });
  } catch (error) {
    next(error);
  }
}

async function startInterview(req, res, next) {
  try {
    const interview = await interviewService.startInterview(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Interview started successfully',
      data: { interview }
    });
  } catch (error) {
    next(error);
  }
}

async function endInterview(req, res, next) {
  try {
    const interview = await interviewService.endInterview(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Interview session concluded',
      data: { interview }
    });
  } catch (error) {
    next(error);
  }
}

async function cancelInterview(req, res, next) {
  try {
    const interview = await interviewService.cancelInterview(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Interview session cancelled',
      data: { interview }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCandidates,
  createInterview,
  listInterviews,
  getInterview,
  startInterview,
  endInterview,
  cancelInterview
};
