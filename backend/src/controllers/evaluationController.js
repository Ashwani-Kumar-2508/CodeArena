const evaluationService = require('../services/evaluationService');
const { z } = require('zod');

const createEvaluationSchema = z.object({
  interviewId: z.string().min(1, 'Interview ID is required'),
  overallScore: z.number().min(1).max(5).default(3),
  problemSolvingScore: z.number().min(1).max(5).default(3),
  codeQualityScore: z.number().min(1).max(5).default(3),
  communicationScore: z.number().min(1).max(5).default(3),
  recommendation: z.enum(['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE']).default('HIRE'),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  feedback: z.string().optional()
});

async function createEvaluation(req, res, next) {
  try {
    const validatedData = createEvaluationSchema.parse(req.body);
    const evaluation = await evaluationService.createEvaluation(req.user.id, validatedData);
    res.status(201).json({
      success: true,
      message: 'Evaluation scorecard submitted successfully',
      data: { evaluation }
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

async function getEvaluation(req, res, next) {
  try {
    const evaluation = await evaluationService.getEvaluationByInterviewId(req.params.interviewId, req.user);
    res.json({
      success: true,
      data: { evaluation }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEvaluation,
  getEvaluation
};
