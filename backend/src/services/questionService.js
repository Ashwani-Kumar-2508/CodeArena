const prisma = require('../config/db');

async function listQuestions(user, query = {}) {
  const isCandidate = user && user.role === 'CANDIDATE';
  const isInterviewer = user && user.role === 'INTERVIEWER';
  const isAdmin = user && user.role === 'ADMIN';

  const {
    search,
    type,
    difficulty,
    category,
    language,
    tag,
    page = 1,
    limit = 24
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  // Role visibility:
  // Admin: all questions
  // Interviewer: platform questions + their own questions
  // Candidate: platform questions + public questions
  if (isInterviewer) {
    where.OR = [
      { isSystem: true },
      { createdById: user.id }
    ];
  } else if (isCandidate) {
    where.OR = [
      { isSystem: true },
      { createdById: null }
    ];
  }

  // Filters
  if (search && search.trim()) {
    const s = search.trim();
    const searchFilter = [
      { title: { contains: s, mode: 'insensitive' } },
      { description: { contains: s, mode: 'insensitive' } },
      { category: { contains: s, mode: 'insensitive' } }
    ];
    if (where.OR) {
      where.AND = [{ OR: searchFilter }];
    } else {
      where.OR = searchFilter;
    }
  }

  if (type && type !== 'ALL') {
    where.type = type;
  }

  if (difficulty && difficulty !== 'ALL') {
    where.difficulty = difficulty;
  }

  if (category && category !== 'ALL') {
    where.category = { equals: category, mode: 'insensitive' };
  }

  if (language && language !== 'ALL') {
    where.language = language;
  }

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: {
        testCases: true,
        author: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum
    })
  ]);

  // Candidate sanitization: NEVER reveal hidden test cases, rubrics, or MCQ correct answers to candidate
  const sanitizedQuestions = questions.map(q => {
    const isOwner = user && q.createdById === user.id;
    const canSeeInternal = isAdmin || isOwner || (user && user.role === 'INTERVIEWER');

    return {
      ...q,
      testCases: canSeeInternal ? q.testCases : q.testCases.filter(tc => !tc.isHidden),
      rubric: canSeeInternal ? q.rubric : undefined,
      correctAnswer: canSeeInternal ? q.correctAnswer : undefined,
      isOwnedByMe: isOwner
    };
  });

  return {
    questions: sanitizedQuestions,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

async function getQuestionById(id, user) {
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      testCases: true,
      author: { select: { id: true, name: true, role: true } }
    }
  });

  if (!question) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const isCandidate = user && user.role === 'CANDIDATE';
  const isAdmin = user && user.role === 'ADMIN';
  const isOwner = user && question.createdById === user.id;
  const canSeeInternal = isAdmin || isOwner;

  if (isCandidate) {
    question.testCases = question.testCases.filter(tc => !tc.isHidden);
    delete question.rubric;
    delete question.correctAnswer;
  }

  return {
    ...question,
    isOwnedByMe: isOwner
  };
}

async function createQuestion(data, user) {
  const {
    title,
    description,
    type = 'CODING',
    difficulty = 'MEDIUM',
    category = 'GENERAL',
    tags = [],
    supportedLanguages = ['javascript', 'python', 'java'],
    starterCode = {},
    defaultCodeSnippet = '',
    language = 'javascript',
    constraints = '',
    examples = [],
    options = [],
    correctAnswer = null,
    hints = [],
    rubric = {},
    testCases = []
  } = data;

  const isSystem = user.role === 'ADMIN';

  return prisma.question.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      type,
      difficulty,
      category: category.trim().toUpperCase(),
      tags,
      supportedLanguages,
      starterCode,
      defaultCodeSnippet,
      language,
      constraints,
      examples,
      options,
      correctAnswer,
      hints,
      rubric,
      createdById: user.id,
      isSystem,
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
      testCases: true,
      author: { select: { id: true, name: true, role: true } }
    }
  });
}

async function updateQuestion(id, data, user) {
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const isAdmin = user.role === 'ADMIN';
  const isOwner = existing.createdById === user.id;

  if (!isAdmin && !isOwner) {
    const error = new Error('Access denied. You can only edit questions you created.');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  const {
    title,
    description,
    type,
    difficulty,
    category,
    tags,
    supportedLanguages,
    starterCode,
    defaultCodeSnippet,
    language,
    constraints,
    examples,
    options,
    correctAnswer,
    hints,
    rubric,
    testCases
  } = data;

  // If test cases provided, update them
  if (Array.isArray(testCases)) {
    await prisma.testCase.deleteMany({ where: { questionId: id } });
    if (testCases.length > 0) {
      await prisma.testCase.createMany({
        data: testCases.map(tc => ({
          questionId: id,
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isHidden: !!tc.isHidden,
          explanation: tc.explanation || null
        }))
      });
    }
  }

  return prisma.question.update({
    where: { id },
    data: {
      title: title !== undefined ? title.trim() : undefined,
      description: description !== undefined ? description.trim() : undefined,
      type: type || undefined,
      difficulty: difficulty || undefined,
      category: category !== undefined ? category.trim().toUpperCase() : undefined,
      tags: tags !== undefined ? tags : undefined,
      supportedLanguages: supportedLanguages !== undefined ? supportedLanguages : undefined,
      starterCode: starterCode !== undefined ? starterCode : undefined,
      defaultCodeSnippet: defaultCodeSnippet !== undefined ? defaultCodeSnippet : undefined,
      language: language || undefined,
      constraints: constraints !== undefined ? constraints : undefined,
      examples: examples !== undefined ? examples : undefined,
      options: options !== undefined ? options : undefined,
      correctAnswer: correctAnswer !== undefined ? correctAnswer : undefined,
      hints: hints !== undefined ? hints : undefined,
      rubric: rubric !== undefined ? rubric : undefined
    },
    include: {
      testCases: true,
      author: { select: { id: true, name: true, role: true } }
    }
  });
}

async function deleteQuestion(id, user) {
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const isAdmin = user.role === 'ADMIN';
  const isOwner = existing.createdById === user.id;

  if (!isAdmin && !isOwner) {
    const error = new Error('Access denied. You can only delete questions you created.');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  await prisma.testCase.deleteMany({ where: { questionId: id } });
  return prisma.question.delete({ where: { id } });
}

module.exports = {
  listQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion
};
