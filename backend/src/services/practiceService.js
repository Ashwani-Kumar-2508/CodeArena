const prisma = require('../config/db');
const path = require('node:path');

let sandboxedRunner;
try {
  sandboxedRunner = require('../../../execution-worker/runner');
} catch {
  sandboxedRunner = require(path.resolve(__dirname, '../../../execution-worker/runner'));
}

async function getPracticeDashboard(userId) {
  const [savedCount, attemptedCount, solvedCount, records] = await Promise.all([
    prisma.practiceQuestion.count({ where: { userId, status: 'SAVED' } }),
    prisma.practiceQuestion.count({ where: { userId, status: 'ATTEMPTED' } }),
    prisma.practiceQuestion.count({ where: { userId, status: 'SOLVED' } }),
    prisma.practiceQuestion.findMany({
      where: { userId },
      include: {
        question: {
          include: {
            testCases: true
          }
        }
      },
      orderBy: { savedAt: 'desc' }
    })
  ]);

  // Sanitize question data for candidate
  const practiceQuestions = records.map(rec => {
    const q = rec.question;
    return {
      id: rec.id,
      questionId: rec.questionId,
      status: rec.status,
      savedAt: rec.savedAt,
      solvedAt: rec.solvedAt,
      lastAttemptedAt: rec.lastAttemptedAt,
      question: {
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.type,
        difficulty: q.difficulty,
        category: q.category,
        tags: q.tags,
        supportedLanguages: q.supportedLanguages,
        starterCode: q.starterCode,
        language: q.language,
        testCases: q.testCases.filter(tc => !tc.isHidden)
      }
    };
  });

  return {
    stats: {
      total: records.length,
      saved: savedCount,
      attempted: attemptedCount,
      solved: solvedCount
    },
    practiceQuestions
  };
}

async function addToPractice(userId, questionId) {
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const existing = await prisma.practiceQuestion.findUnique({
    where: {
      userId_questionId: { userId, questionId }
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.practiceQuestion.create({
    data: {
      userId,
      questionId,
      status: 'SAVED'
    }
  });
}

async function removeFromPractice(userId, questionId) {
  return prisma.practiceQuestion.deleteMany({
    where: { userId, questionId }
  });
}

async function runPracticeCode({ userId, questionId, code, language = 'javascript' }) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { testCases: true }
  });

  if (!question) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  // Only run visible test cases for practice runner
  const visibleCases = question.testCases.filter(tc => !tc.isHidden);
  const executionOutput = sandboxedRunner.runInSandbox(code, visibleCases, { language, timeoutMs: 4000 });

  // Update or create practice question record as ATTEMPTED if not already SOLVED
  const existing = await prisma.practiceQuestion.findUnique({
    where: { userId_questionId: { userId, questionId } }
  });

  if (existing) {
    if (existing.status !== 'SOLVED') {
      await prisma.practiceQuestion.update({
        where: { id: existing.id },
        data: { status: 'ATTEMPTED', lastAttemptedAt: new Date() }
      });
    }
  } else {
    await prisma.practiceQuestion.create({
      data: {
        userId,
        questionId,
        status: 'ATTEMPTED',
        lastAttemptedAt: new Date()
      }
    });
  }

  return executionOutput;
}

async function submitPracticeCode({ userId, questionId, code, language = 'javascript' }) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { testCases: true }
  });

  if (!question) {
    const error = new Error('Question not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  // Evaluate against all test cases
  const executionOutput = sandboxedRunner.runInSandbox(code, question.testCases, { language, timeoutMs: 4000 });
  const totalExecutionTime = executionOutput.results.reduce((acc, r) => acc + (r.executionTimeMs || 0), 0);
  const submissionStatus = executionOutput.allPassed ? 'PASSED' : 'FAILED';

  // Record practice submission (completely decoupled from interview evaluations)
  const submission = await prisma.practiceSubmission.create({
    data: {
      userId,
      questionId,
      code,
      language,
      status: submissionStatus,
      passedCount: executionOutput.passedCount,
      totalCount: executionOutput.totalCount,
      executionTimeMs: Math.round(totalExecutionTime * 100) / 100,
      testResults: executionOutput.results.map(r => ({
        testId: r.testId,
        passed: r.passed,
        executionTimeMs: r.executionTimeMs,
        error: r.error || null,
        isHidden: r.isHidden,
        input: r.isHidden ? '[Hidden Test Case]' : r.input,
        expectedOutput: r.isHidden ? '[Hidden Test Case]' : r.expectedOutput,
        actualOutput: r.isHidden ? '[Hidden Test Case]' : r.actualOutput
      }))
    }
  });

  // Update PracticeQuestion progress
  const existing = await prisma.practiceQuestion.findUnique({
    where: { userId_questionId: { userId, questionId } }
  });

  if (executionOutput.allPassed) {
    if (existing) {
      await prisma.practiceQuestion.update({
        where: { id: existing.id },
        data: { status: 'SOLVED', solvedAt: new Date(), lastAttemptedAt: new Date() }
      });
    } else {
      await prisma.practiceQuestion.create({
        data: {
          userId,
          questionId,
          status: 'SOLVED',
          solvedAt: new Date(),
          lastAttemptedAt: new Date()
        }
      });
    }
  } else {
    if (existing && existing.status !== 'SOLVED') {
      await prisma.practiceQuestion.update({
        where: { id: existing.id },
        data: { status: 'ATTEMPTED', lastAttemptedAt: new Date() }
      });
    } else if (!existing) {
      await prisma.practiceQuestion.create({
        data: {
          userId,
          questionId,
          status: 'ATTEMPTED',
          lastAttemptedAt: new Date()
        }
      });
    }
  }

  return {
    submissionId: submission.id,
    status: submissionStatus,
    practiceStatus: executionOutput.allPassed ? 'SOLVED' : 'ATTEMPTED',
    allPassed: executionOutput.allPassed,
    passedCount: executionOutput.passedCount,
    totalCount: executionOutput.totalCount,
    executionTimeMs: submission.executionTimeMs,
    results: submission.testResults
  };
}

module.exports = {
  getPracticeDashboard,
  addToPractice,
  removeFromPractice,
  runPracticeCode,
  submitPracticeCode
};
