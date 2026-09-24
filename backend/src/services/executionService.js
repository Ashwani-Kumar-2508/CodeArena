const prisma = require('../config/db');
const path = require('node:path');

// Import the sandboxed execution runner
let sandboxedRunner;
try {
  sandboxedRunner = require('../../../execution-worker/runner');
} catch (e) {
  console.warn('Direct execution-worker import not found, attempting local path');
  sandboxedRunner = require(path.resolve(__dirname, '../../../execution-worker/runner'));
}

async function runCode({ interviewId, questionId, code, language = 'javascript', user }) {
  // Fetch test cases for this question
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

  // If candidate is running, ONLY run visible test cases!
  // Interviewers or admins can run all test cases.
  let targetTestCases = question.testCases;
  if (user.role === 'CANDIDATE') {
    targetTestCases = question.testCases.filter(tc => !tc.isHidden);
  }

  const executionOutput = sandboxedRunner.runInSandbox(code, targetTestCases, { timeoutMs: 3000 });

  // Record an InterviewEvent for replay timeline
  if (interviewId) {
    await prisma.interviewEvent.create({
      data: {
        interviewId,
        userId: user.id,
        eventType: 'RUN_CODE',
        payload: {
          questionId,
          language,
          passedCount: executionOutput.passedCount,
          totalCount: executionOutput.totalCount,
          allPassed: executionOutput.allPassed
        }
      }
    });

    // Save or update CodingSession snapshot
    let session = await prisma.codingSession.findFirst({
      where: { interviewId, questionId }
    });

    if (!session) {
      session = await prisma.codingSession.create({
        data: {
          interviewId,
          questionId,
          currentCode: code,
          language,
          status: 'ACTIVE'
        }
      });
    } else {
      await prisma.codingSession.update({
        where: { id: session.id },
        data: { currentCode: code }
      });
    }

    // Save a CodeVersion snapshot
    await prisma.codeVersion.create({
      data: {
        codingSessionId: session.id,
        code,
        trigger: 'RUN_TESTS'
      }
    });
  }

  return executionOutput;
}

async function submitCode({ interviewId, questionId, code, language = 'javascript', user }) {
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

  // Submissions evaluate against ALL test cases (both visible and hidden)!
  const executionOutput = sandboxedRunner.runInSandbox(code, question.testCases, { timeoutMs: 3000 });

  // Calculate execution benchmarks
  const totalExecutionTime = executionOutput.results.reduce((acc, r) => acc + (r.executionTimeMs || 0), 0);

  // Upsert CodingSession
  let session = await prisma.codingSession.findFirst({
    where: { interviewId, questionId }
  });

  if (!session) {
    session = await prisma.codingSession.create({
      data: {
        interviewId,
        questionId,
        currentCode: code,
        language,
        status: 'SUBMITTED',
        submittedAt: new Date()
      }
    });
  } else {
    session = await prisma.codingSession.update({
      where: { id: session.id },
      data: {
        currentCode: code,
        status: 'SUBMITTED',
        submittedAt: new Date()
      }
    });
  }

  // Create CodeVersion snapshot
  await prisma.codeVersion.create({
    data: {
      codingSessionId: session.id,
      code,
      trigger: 'SUBMISSION'
    }
  });

  // Create Submission record
  const submissionStatus = executionOutput.allPassed ? 'PASSED' : 'FAILED';
  const submission = await prisma.submission.create({
    data: {
      codingSessionId: session.id,
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
        // If candidate, sanitize hidden test specifics from the returned result
        isHidden: r.isHidden,
        input: (user.role === 'CANDIDATE' && r.isHidden) ? '[Hidden]' : r.input,
        expectedOutput: (user.role === 'CANDIDATE' && r.isHidden) ? '[Hidden]' : r.expectedOutput,
        actualOutput: (user.role === 'CANDIDATE' && r.isHidden) ? '[Hidden]' : r.actualOutput
      }))
    }
  });

  // Log submission event for replay
  await prisma.interviewEvent.create({
    data: {
      interviewId,
      userId: user.id,
      eventType: 'SUBMISSION',
      payload: {
        submissionId: submission.id,
        questionId,
        status: submissionStatus,
        passedCount: executionOutput.passedCount,
        totalCount: executionOutput.totalCount
      }
    }
  });

  return {
    submissionId: submission.id,
    status: submissionStatus,
    passedCount: executionOutput.passedCount,
    totalCount: executionOutput.totalCount,
    executionTimeMs: submission.executionTimeMs,
    results: submission.testResults
  };
}

module.exports = {
  runCode,
  submitCode
};
