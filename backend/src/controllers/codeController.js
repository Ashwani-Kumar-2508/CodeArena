const executionService = require('../services/executionService');
const { z } = require('zod');

const runCodeSchema = z.object({
  interviewId: z.string().optional(),
  questionId: z.string().min(1, 'Question ID is required'),
  code: z.string().min(1, 'Code snippet is required'),
  language: z.string().default('javascript')
});

async function runCode(req, res, next) {
  try {
    const validatedData = runCodeSchema.parse(req.body);
    const result = await executionService.runCode({
      ...validatedData,
      user: req.user
    });

    res.json({
      success: true,
      data: result
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

async function submitCode(req, res, next) {
  try {
    const validatedData = runCodeSchema.parse(req.body);
    const result = await executionService.submitCode({
      ...validatedData,
      user: req.user
    });

    res.json({
      success: true,
      message: 'Code submitted and evaluated against full test suite',
      data: result
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

module.exports = {
  runCode,
  submitCode
};
