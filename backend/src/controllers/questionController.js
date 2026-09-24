const questionService = require('../services/questionService');
const { z } = require('zod');

const createQuestionSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(5, 'Description is required'),
  type: z.enum(['CODING', 'TECHNICAL', 'BEHAVIORAL', 'MCQ', 'FOLLOW_UP']).default('CODING'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  defaultCodeSnippet: z.string().optional(),
  language: z.string().default('javascript'),
  options: z.any().optional(),
  hints: z.any().optional(),
  rubric: z.any().optional(),
  testCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    isHidden: z.boolean().default(false),
    explanation: z.string().optional()
  })).optional()
});

async function listQuestions(req, res, next) {
  try {
    const questions = await questionService.listQuestions(req.user);
    res.json({
      success: true,
      data: { questions }
    });
  } catch (error) {
    next(error);
  }
}

async function getQuestion(req, res, next) {
  try {
    const question = await questionService.getQuestionById(req.params.id, req.user);
    res.json({
      success: true,
      data: { question }
    });
  } catch (error) {
    next(error);
  }
}

async function createQuestion(req, res, next) {
  try {
    const validatedData = createQuestionSchema.parse(req.body);
    const question = await questionService.createQuestion(validatedData);
    res.status(201).json({
      success: true,
      message: 'Question added to bank',
      data: { question }
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
  listQuestions,
  getQuestion,
  createQuestion
};
