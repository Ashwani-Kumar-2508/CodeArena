/**
 * CodeArena Test Suite — Practice Service Unit Tests
 *
 * Tests: getPracticeDashboard (stats and list formatting),
 * addToPractice (idempotent addition),
 * removeFromPractice,
 * runPracticeCode (visible test cases only, updates lastAttemptedAt),
 * submitPracticeCode (full test suite, updates status to SOLVED or ATTEMPTED).
 */

jest.mock('../src/config/db', () => ({
  practiceQuestion: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn()
  },
  question: {
    findUnique: jest.fn()
  },
  practiceSubmission: {
    create: jest.fn()
  }
}));

jest.mock('../../execution-worker/runner', () => ({
  runInSandbox: jest.fn()
}));

const practiceService = require('../src/services/practiceService');
const prisma = require('../src/config/db');
const sandboxedRunner = require('../../execution-worker/runner');

const mockQuestion = {
  id: 'q-algo-1',
  title: 'Binary Search',
  description: 'Search for target in sorted array.',
  type: 'CODING',
  difficulty: 'EASY',
  category: 'Algorithms',
  tags: ['Binary Search', 'Arrays'],
  supportedLanguages: ['javascript', 'python'],
  starterCode: { javascript: 'function search() {}' },
  language: 'javascript',
  testCases: [
    { id: 'tc1', input: '[[-1,0,3,5,9,12], 9]', expectedOutput: '4', isHidden: false },
    { id: 'tc2', input: '[[-1,0,3,5,9,12], 2]', expectedOutput: '-1', isHidden: true }
  ]
};

describe('Practice Service — getPracticeDashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns stats and practice questions list', async () => {
    prisma.practiceQuestion.count
      .mockResolvedValueOnce(3) // saved
      .mockResolvedValueOnce(2) // attempted
      .mockResolvedValueOnce(1); // solved

    prisma.practiceQuestion.findMany.mockResolvedValue([
      {
        id: 'pq-1',
        userId: 'user-1',
        questionId: 'q-algo-1',
        status: 'SOLVED',
        savedAt: new Date(),
        solvedAt: new Date(),
        lastAttemptedAt: new Date(),
        question: mockQuestion
      }
    ]);

    const result = await practiceService.getPracticeDashboard('user-1');

    expect(result.stats.saved).toBe(3);
    expect(result.stats.attempted).toBe(2);
    expect(result.stats.solved).toBe(1);
    expect(result.practiceQuestions).toHaveLength(1);
    // Hidden test cases should be stripped from question payload
    expect(result.practiceQuestions[0].question.testCases).toHaveLength(1);
    expect(result.practiceQuestions[0].question.testCases[0].isHidden).toBe(false);
    // Both practiceQuestions and practiceList aliases should be present
    expect(result.practiceList).toBe(result.practiceQuestions);
  });
});

describe('Practice Service — addToPractice', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 when question does not exist', async () => {
    prisma.question.findUnique.mockResolvedValue(null);

    await expect(practiceService.addToPractice('user-1', 'nonexistent'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('returns existing record if already in practice list', async () => {
    prisma.question.findUnique.mockResolvedValue(mockQuestion);
    prisma.practiceQuestion.findUnique.mockResolvedValue({ id: 'pq-1', status: 'SAVED' });

    const result = await practiceService.addToPractice('user-1', 'q-algo-1');
    expect(result.id).toBe('pq-1');
    expect(prisma.practiceQuestion.create).not.toHaveBeenCalled();
  });

  test('creates new practice bookmark when not already saved', async () => {
    prisma.question.findUnique.mockResolvedValue(mockQuestion);
    prisma.practiceQuestion.findUnique.mockResolvedValue(null);
    prisma.practiceQuestion.create.mockResolvedValue({ id: 'pq-new', status: 'SAVED' });

    const result = await practiceService.addToPractice('user-1', 'q-algo-1');
    expect(result.status).toBe('SAVED');
    expect(prisma.practiceQuestion.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', questionId: 'q-algo-1', status: 'SAVED' }
    });
  });
});

describe('Practice Service — removeFromPractice', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes record for user and question', async () => {
    prisma.practiceQuestion.deleteMany.mockResolvedValue({ count: 1 });

    await practiceService.removeFromPractice('user-1', 'q-algo-1');
    expect(prisma.practiceQuestion.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', questionId: 'q-algo-1' }
    });
  });
});

describe('Practice Service — runPracticeCode', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 if question does not exist', async () => {
    prisma.question.findUnique.mockResolvedValue(null);

    await expect(practiceService.runPracticeCode({
      userId: 'user-1', questionId: 'nonexistent', code: 'test'
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('runs ONLY visible test cases in sandbox and marks ATTEMPTED', async () => {
    prisma.question.findUnique.mockResolvedValue(mockQuestion);
    prisma.practiceQuestion.findUnique.mockResolvedValue({ id: 'pq-1', status: 'SAVED' });
    prisma.practiceQuestion.update.mockResolvedValue({});
    sandboxedRunner.runInSandbox.mockReturnValue({
      passedCount: 1,
      totalCount: 1,
      allPassed: true,
      results: []
    });

    const result = await practiceService.runPracticeCode({
      userId: 'user-1',
      questionId: 'q-algo-1',
      code: 'function search() { return 4; }',
      language: 'javascript'
    });

    // Check sandbox only received visible test case
    expect(sandboxedRunner.runInSandbox).toHaveBeenCalledWith(
      'function search() { return 4; }',
      [expect.objectContaining({ id: 'tc1', isHidden: false })],
      expect.objectContaining({ language: 'javascript' })
    );

    // Should update status to ATTEMPTED
    expect(prisma.practiceQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ATTEMPTED' })
      })
    );

    expect(result.allPassed).toBe(true);
  });
});

describe('Practice Service — submitPracticeCode', () => {
  beforeEach(() => jest.clearAllMocks());

  test('evaluates against ALL test cases and updates status to SOLVED when all pass', async () => {
    prisma.question.findUnique.mockResolvedValue(mockQuestion);
    prisma.practiceSubmission.create.mockResolvedValue({
      id: 'sub-1',
      executionTimeMs: 12.5,
      testResults: []
    });
    prisma.practiceQuestion.findUnique.mockResolvedValue({ id: 'pq-1', status: 'ATTEMPTED' });
    prisma.practiceQuestion.update.mockResolvedValue({});

    sandboxedRunner.runInSandbox.mockReturnValue({
      passedCount: 2,
      totalCount: 2,
      allPassed: true,
      results: [
        { testId: 'tc1', passed: true, executionTimeMs: 5, input: '1', expectedOutput: '1', actualOutput: '1', isHidden: false },
        { testId: 'tc2', passed: true, executionTimeMs: 7.5, input: '2', expectedOutput: '2', actualOutput: '2', isHidden: true }
      ]
    });

    const result = await practiceService.submitPracticeCode({
      userId: 'user-1',
      questionId: 'q-algo-1',
      code: 'function search() {}',
      language: 'javascript'
    });

    // Submits against BOTH test cases (length 2)
    expect(sandboxedRunner.runInSandbox).toHaveBeenCalledWith(
      'function search() {}',
      mockQuestion.testCases,
      expect.objectContaining({ language: 'javascript' })
    );

    expect(result.status).toBe('PASSED');
    expect(result.practiceStatus).toBe('SOLVED');
    expect(prisma.practiceQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SOLVED' })
      })
    );
  });
});
