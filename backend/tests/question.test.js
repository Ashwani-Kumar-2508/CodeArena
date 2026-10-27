/**
 * CodeArena Test Suite — Question Service Unit Tests
 *
 * Tests: listQuestions (role visibility, search+filter combination bug fix),
 * getQuestionById (authorization, data sanitization),
 * createQuestion, updateQuestion, deleteQuestion.
 */

jest.mock('../src/config/db', () => ({
  question: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  testCase: {
    deleteMany: jest.fn(),
    createMany: jest.fn()
  }
}));

const questionService = require('../src/services/questionService');
const prisma = require('../src/config/db');

const mockAdmin = { id: 'admin-1', role: 'ADMIN' };
const mockInterviewer = { id: 'interviewer-1', role: 'INTERVIEWER' };
const mockCandidate = { id: 'candidate-1', role: 'CANDIDATE' };

const mockQuestion = {
  id: 'q1',
  title: 'Two Sum',
  description: 'Find two numbers that add to target.',
  type: 'CODING',
  difficulty: 'EASY',
  category: 'ARRAYS',
  tags: ['Hash Map', 'Two Pointer'],
  supportedLanguages: ['javascript', 'python'],
  starterCode: {},
  rubric: { criteria: 'O(n) complexity required' },
  correctAnswer: null,
  createdById: 'interviewer-1',
  isSystem: true,
  testCases: [
    { id: 'tc1', input: '[[2,7,11,15],9]', expectedOutput: '[0,1]', isHidden: false },
    { id: 'tc2', input: '[[3,2,4],6]', expectedOutput: '[1,2]', isHidden: true }
  ],
  author: { id: 'interviewer-1', name: 'Alice', role: 'INTERVIEWER' }
};

describe('Question Service — listQuestions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('admin can list all questions', async () => {
    prisma.question.count.mockResolvedValue(1);
    prisma.question.findMany.mockResolvedValue([mockQuestion]);

    const result = await questionService.listQuestions(mockAdmin, {});
    expect(result.questions).toHaveLength(1);
    // Admin sees rubric and hidden test cases
    expect(result.questions[0].rubric).toBeTruthy();
    expect(result.questions[0].testCases).toHaveLength(2);
    expect(result.pagination.total).toBe(1);
  });

  test('candidate cannot see rubric or hidden test cases', async () => {
    prisma.question.count.mockResolvedValue(1);
    prisma.question.findMany.mockResolvedValue([mockQuestion]);

    const result = await questionService.listQuestions(mockCandidate, {});
    expect(result.questions[0].rubric).toBeUndefined();
    expect(result.questions[0].testCases).toHaveLength(1);
    expect(result.questions[0].testCases[0].isHidden).toBe(false);
    expect(result.questions[0].correctAnswer).toBeUndefined();
  });

  test('interviewer sees all test cases and rubric for their own questions', async () => {
    prisma.question.count.mockResolvedValue(1);
    prisma.question.findMany.mockResolvedValue([mockQuestion]);

    const result = await questionService.listQuestions(mockInterviewer, {});
    // Interviewer is considered canSeeInternal
    expect(result.questions[0].rubric).toBeTruthy();
    expect(result.questions[0].testCases).toHaveLength(2);
  });

  test('pagination defaults: page=1, limit=24', async () => {
    prisma.question.count.mockResolvedValue(100);
    prisma.question.findMany.mockResolvedValue([]);

    const result = await questionService.listQuestions(mockAdmin, {});
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(24);
    expect(result.pagination.totalPages).toBe(Math.ceil(100 / 24));
  });

  test('custom pagination respected', async () => {
    prisma.question.count.mockResolvedValue(50);
    prisma.question.findMany.mockResolvedValue([]);

    const result = await questionService.listQuestions(mockAdmin, { page: '2', limit: '10' });
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.totalPages).toBe(5);

    // Verify skip was correct
    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  test('search filter builds correct AND+OR query without dropping role visibility', async () => {
    prisma.question.count.mockResolvedValue(0);
    prisma.question.findMany.mockResolvedValue([]);

    await questionService.listQuestions(mockInterviewer, { search: 'sort' });

    // The where clause passed to both count and findMany should have AND structure
    const whereArg = prisma.question.count.mock.calls[0][0].where;

    // Should have AND (combining role filter + search filter)
    expect(whereArg).toHaveProperty('AND');
    expect(Array.isArray(whereArg.AND)).toBe(true);
    // Should NOT have a top-level OR that would bypass role visibility
    // The original bug caused where.OR to remain alongside where.AND
    expect(whereArg.AND.length).toBe(2); // role OR + search OR
    // The original top-level where.OR should have been deleted
    expect(whereArg.OR).toBeUndefined();
  });

  test('search-only query (no role OR) uses where.AND correctly', async () => {
    prisma.question.count.mockResolvedValue(0);
    prisma.question.findMany.mockResolvedValue([]);

    // Admin has no role-based OR filter, just search
    await questionService.listQuestions(mockAdmin, { search: 'dynamic programming' });

    const whereArg = prisma.question.count.mock.calls[0][0].where;
    // Admin has no role OR, so AND wraps just the search filter
    expect(whereArg).toHaveProperty('AND');
    expect(whereArg.AND[0]).toHaveProperty('OR'); // search is OR (title|desc|category)
  });

  test('type filter is applied', async () => {
    prisma.question.count.mockResolvedValue(0);
    prisma.question.findMany.mockResolvedValue([]);

    await questionService.listQuestions(mockAdmin, { type: 'MCQ' });
    const whereArg = prisma.question.count.mock.calls[0][0].where;
    expect(whereArg.type).toBe('MCQ');
  });

  test('difficulty filter is applied', async () => {
    prisma.question.count.mockResolvedValue(0);
    prisma.question.findMany.mockResolvedValue([]);

    await questionService.listQuestions(mockAdmin, { difficulty: 'HARD' });
    const whereArg = prisma.question.count.mock.calls[0][0].where;
    expect(whereArg.difficulty).toBe('HARD');
  });

  test('ALL value for filter is ignored (no filter applied)', async () => {
    prisma.question.count.mockResolvedValue(0);
    prisma.question.findMany.mockResolvedValue([]);

    await questionService.listQuestions(mockAdmin, { type: 'ALL', difficulty: 'ALL' });
    const whereArg = prisma.question.count.mock.calls[0][0].where;
    expect(whereArg.type).toBeUndefined();
    expect(whereArg.difficulty).toBeUndefined();
  });
});

describe('Question Service — getQuestionById', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns full question data for admin', async () => {
    prisma.question.findUnique.mockResolvedValue(mockQuestion);

    const result = await questionService.getQuestionById('q1', mockAdmin);
    expect(result.rubric).toBeTruthy();
    expect(result.testCases).toHaveLength(2);
  });

  test('returns sanitized question for candidate (no hidden test cases, rubric, or correctAnswer)', async () => {
    prisma.question.findUnique.mockResolvedValue(mockQuestion);

    const result = await questionService.getQuestionById('q1', mockCandidate);
    expect(result.rubric).toBeUndefined();
    expect(result.correctAnswer).toBeUndefined();
    expect(result.testCases).toHaveLength(1);
    expect(result.testCases[0].isHidden).toBe(false);
  });

  test('throws 404 when question not found', async () => {
    prisma.question.findUnique.mockResolvedValue(null);
    await expect(questionService.getQuestionById('nonexistent', mockAdmin))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('Question Service — createQuestion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('admin creates system question (isSystem = true)', async () => {
    prisma.question.create.mockResolvedValue({ ...mockQuestion, isSystem: true });

    const result = await questionService.createQuestion({
      title: 'Two Sum',
      description: 'Find two numbers.',
      testCases: []
    }, mockAdmin);

    expect(prisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isSystem: true })
      })
    );
  });

  test('interviewer creates non-system question (isSystem = false)', async () => {
    prisma.question.create.mockResolvedValue({ ...mockQuestion, isSystem: false });

    await questionService.createQuestion({
      title: 'Custom Sort',
      description: 'Sort an array custom way.',
      testCases: []
    }, mockInterviewer);

    expect(prisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isSystem: false })
      })
    );
  });
});

describe('Question Service — updateQuestion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('owner (interviewer) can update their own question', async () => {
    prisma.question.findUnique.mockResolvedValue({ ...mockQuestion, createdById: 'interviewer-1' });
    prisma.question.update.mockResolvedValue({ ...mockQuestion, title: 'Updated Title' });

    const result = await questionService.updateQuestion('q1', { title: 'Updated Title' }, mockInterviewer);
    expect(result.title).toBe('Updated Title');
  });

  test('admin can update any question', async () => {
    prisma.question.findUnique.mockResolvedValue({ ...mockQuestion, createdById: 'someone-else' });
    prisma.question.update.mockResolvedValue({ ...mockQuestion, title: 'Admin Updated' });

    const result = await questionService.updateQuestion('q1', { title: 'Admin Updated' }, mockAdmin);
    expect(result.title).toBe('Admin Updated');
  });

  test('throws 403 when non-owner non-admin tries to update', async () => {
    prisma.question.findUnique.mockResolvedValue({ ...mockQuestion, createdById: 'someone-else' });

    await expect(questionService.updateQuestion('q1', { title: 'Hack' }, mockInterviewer))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('throws 404 when question not found', async () => {
    prisma.question.findUnique.mockResolvedValue(null);
    await expect(questionService.updateQuestion('nonexistent', {}, mockAdmin))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('Question Service — deleteQuestion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('owner can delete their own question', async () => {
    prisma.question.findUnique.mockResolvedValue({ ...mockQuestion, createdById: 'interviewer-1' });
    prisma.testCase.deleteMany.mockResolvedValue({});
    prisma.question.delete.mockResolvedValue({});

    await expect(questionService.deleteQuestion('q1', mockInterviewer)).resolves.not.toThrow();
    expect(prisma.testCase.deleteMany).toHaveBeenCalledWith({ where: { questionId: 'q1' } });
  });

  test('throws 403 when non-owner tries to delete', async () => {
    prisma.question.findUnique.mockResolvedValue({ ...mockQuestion, createdById: 'someone-else' });

    await expect(questionService.deleteQuestion('q1', mockInterviewer))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('throws 404 when question not found', async () => {
    prisma.question.findUnique.mockResolvedValue(null);
    await expect(questionService.deleteQuestion('nonexistent', mockAdmin))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
