const questionService = require('../services/questionService');
const { z } = require('zod');

const questionSchema = z.object({
  title: z.string().min(3, 'Title is required and must be at least 3 characters'),
  description: z.string().min(5, 'Description is required and must be at least 5 characters'),
  type: z.enum(['CODING', 'TECHNICAL', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'MCQ', 'FOLLOW_UP']).default('CODING'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  category: z.string().default('GENERAL'),
  tags: z.array(z.string()).optional(),
  supportedLanguages: z.array(z.string()).optional(),
  starterCode: z.record(z.string()).optional(),
  defaultCodeSnippet: z.string().optional(),
  language: z.string().default('javascript'),
  constraints: z.string().optional(),
  examples: z.any().optional(),
  options: z.any().optional(),
  correctAnswer: z.string().optional(),
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
    const result = await questionService.listQuestions(req.user, req.query);
    res.json({
      success: true,
      data: result
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
    const validatedData = questionSchema.parse(req.body);
    const question = await questionService.createQuestion(validatedData, req.user);
    res.status(201).json({
      success: true,
      message: 'Question added to bank successfully',
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

async function updateQuestion(req, res, next) {
  try {
    const question = await questionService.updateQuestion(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'Question updated successfully',
      data: { question }
    });
  } catch (error) {
    next(error);
  }
}

async function deleteQuestion(req, res, next) {
  try {
    await questionService.deleteQuestion(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion
};
