const prisma = require('../config/db');

async function listQuestions(user) {
  const isCandidate = user && user.role === 'CANDIDATE';

  const questions = await prisma.question.findMany({
    include: {
      testCases: true
    },
    orderBy: { createdAt: 'desc' }
  });

  if (isCandidate) {
    return questions.map(q => ({
      ...q,
      testCases: q.testCases.filter(tc => !tc.isHidden),
      rubric: undefined
    }));
  }

  return questions;
}

async function getQuestionById(id, user) {
  const isCandidate = user && user.role === 'CANDIDATE';

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      testCases: true
    }
  });

  if (!question) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  if (isCandidate) {
    question.testCases = question.testCases.filter(tc => !tc.isHidden);
    delete question.rubric;
  }

  return question;
}

async function createQuestion(data) {
  const { title, description, type = 'CODING', difficulty = 'MEDIUM', defaultCodeSnippet, language = 'javascript', options, hints, rubric, testCases = [] } = data;

  return prisma.question.create({
    data: {
      title,
      description,
      type,
      difficulty,
      defaultCodeSnippet,
      language,
      options,
      hints,
      rubric,
      testCases: {
        create: testCases.map(tc => ({
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isHidden: !!tc.isHidden,
          explanation: tc.explanation || null
        }))
      }
    },
    include: {
      testCases: true
    }
  });
}

module.exports = {
  listQuestions,
  getQuestionById,
  createQuestion
};
