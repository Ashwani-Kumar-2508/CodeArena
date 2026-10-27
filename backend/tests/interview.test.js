/**
 * CodeArena Test Suite — Interview Service Unit Tests
 *
 * Tests: interview creation validation, lifecycle (start/end/cancel),
 * authorization, and candidate/interviewer visibility.
 */

jest.mock('../src/config/db', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn()
  },
  interview: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  },
  question: {
    findMany: jest.fn()
  },
  interviewEvent: {
    create: jest.fn().mockResolvedValue({})
  }
}));

const interviewService = require('../src/services/interviewService');
const prisma = require('../src/config/db');

const mockInterviewer = { id: 'interviewer-1', role: 'INTERVIEWER', name: 'Alice' };
const mockCandidate = { id: 'candidate-1', role: 'CANDIDATE', name: 'Bob' };
const mockAdmin = { id: 'admin-1', role: 'ADMIN', name: 'Admin' };

const baseInterviewData = {
  title: 'Frontend Technical Interview',
  description: 'Coding test for frontend role',
  candidateId: 'candidate-1',
  scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  durationMinutes: 60,
  questionIds: ['q1', 'q2']
};

describe('Interview Service — createInterview', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates an interview successfully with valid data', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'candidate-1', role: 'CANDIDATE', name: 'Bob' });
    prisma.question.findMany.mockResolvedValue([{ id: 'q1' }, { id: 'q2' }]);
    prisma.interview.create.mockResolvedValue({
      id: 'interview-1',
      title: 'Frontend Technical Interview',
      status: 'SCHEDULED',
      interviewerId: 'interviewer-1',
      candidateId: 'candidate-1',
      questions: [],
      interviewer: mockInterviewer,
      candidate: mockCandidate
    });

    const result = await interviewService.createInterview('interviewer-1', baseInterviewData);
    expect(result).toHaveProperty('id', 'interview-1');
    expect(result.status).toBe('SCHEDULED');
  });

  test('throws 400 when title is missing', async () => {
    await expect(interviewService.createInterview('interviewer-1', {
      ...baseInterviewData, title: ''
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when title is too short (< 3 chars)', async () => {
    await expect(interviewService.createInterview('interviewer-1', {
      ...baseInterviewData, title: 'AB'
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when candidateId is missing', async () => {
    await expect(interviewService.createInterview('interviewer-1', {
      ...baseInterviewData, candidateId: null
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when candidate does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(interviewService.createInterview('interviewer-1', baseInterviewData))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when user is not a CANDIDATE role', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'interviewer-2', role: 'INTERVIEWER', name: 'Charlie' });
    await expect(interviewService.createInterview('interviewer-1', {
      ...baseInterviewData, candidateId: 'interviewer-2'
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when no questions selected', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'candidate-1', role: 'CANDIDATE' });
    await expect(interviewService.createInterview('interviewer-1', {
      ...baseInterviewData, questionIds: []
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when some question IDs do not exist', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'candidate-1', role: 'CANDIDATE' });
    prisma.question.findMany.mockResolvedValue([{ id: 'q1' }]); // Only 1 of 2 exists
    await expect(interviewService.createInterview('interviewer-1', baseInterviewData))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Interview Service — startInterview', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockInterview = {
    id: 'interview-1',
    status: 'SCHEDULED',
    interviewerId: 'interviewer-1',
    candidateId: 'candidate-1',
    startedAt: null
  };

  test('allows interviewer to start their interview', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockInterview);
    prisma.interview.update.mockResolvedValue({ ...mockInterview, status: 'ACTIVE', startedAt: new Date() });

    const result = await interviewService.startInterview('interview-1', mockInterviewer);
    expect(result.status).toBe('ACTIVE');
  });

  test('allows admin to start any interview', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockInterview);
    prisma.interview.update.mockResolvedValue({ ...mockInterview, status: 'ACTIVE', startedAt: new Date() });

    const result = await interviewService.startInterview('interview-1', mockAdmin);
    expect(result.status).toBe('ACTIVE');
  });

  test('throws 403 when candidate tries to start interview', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockInterview);
    await expect(interviewService.startInterview('interview-1', mockCandidate))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('throws 403 when different interviewer tries to start interview', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockInterview);
    const otherInterviewer = { id: 'interviewer-99', role: 'INTERVIEWER' };
    await expect(interviewService.startInterview('interview-1', otherInterviewer))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('throws 400 when interview is already COMPLETED', async () => {
    prisma.interview.findUnique.mockResolvedValue({ ...mockInterview, status: 'COMPLETED' });
    await expect(interviewService.startInterview('interview-1', mockInterviewer))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when interview is already CANCELLED', async () => {
    prisma.interview.findUnique.mockResolvedValue({ ...mockInterview, status: 'CANCELLED' });
    await expect(interviewService.startInterview('interview-1', mockInterviewer))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 404 when interview not found', async () => {
    prisma.interview.findUnique.mockResolvedValue(null);
    await expect(interviewService.startInterview('nonexistent', mockInterviewer))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('Interview Service — endInterview', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows interviewer to end their ACTIVE interview', async () => {
    prisma.interview.findUnique.mockResolvedValue({
      id: 'interview-1', status: 'ACTIVE', interviewerId: 'interviewer-1'
    });
    prisma.interview.update.mockResolvedValue({ id: 'interview-1', status: 'COMPLETED', endedAt: new Date() });

    const result = await interviewService.endInterview('interview-1', mockInterviewer);
    expect(result.status).toBe('COMPLETED');
  });

  test('throws 400 when interview is not ACTIVE', async () => {
    prisma.interview.findUnique.mockResolvedValue({
      id: 'interview-1', status: 'SCHEDULED', interviewerId: 'interviewer-1'
    });
    await expect(interviewService.endInterview('interview-1', mockInterviewer))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Interview Service — cancelInterview', () => {
  beforeEach(() => jest.clearAllMocks());

  test('allows interviewer to cancel SCHEDULED interview', async () => {
    prisma.interview.findUnique.mockResolvedValue({
      id: 'interview-1', status: 'SCHEDULED', interviewerId: 'interviewer-1'
    });
    prisma.interview.update.mockResolvedValue({ id: 'interview-1', status: 'CANCELLED' });

    const result = await interviewService.cancelInterview('interview-1', mockInterviewer);
    expect(result.status).toBe('CANCELLED');
  });

  test('throws 400 when interview is ACTIVE (cannot cancel in-progress)', async () => {
    prisma.interview.findUnique.mockResolvedValue({
      id: 'interview-1', status: 'ACTIVE', interviewerId: 'interviewer-1'
    });
    await expect(interviewService.cancelInterview('interview-1', mockInterviewer))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when interview is already COMPLETED', async () => {
    prisma.interview.findUnique.mockResolvedValue({
      id: 'interview-1', status: 'COMPLETED', interviewerId: 'interviewer-1'
    });
    await expect(interviewService.cancelInterview('interview-1', mockInterviewer))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Interview Service — getInterviewById', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockFullInterview = {
    id: 'interview-1',
    title: 'Test Interview',
    status: 'ACTIVE',
    startedAt: null,
    endedAt: null,
    interviewerId: 'interviewer-1',
    candidateId: 'candidate-1',
    interviewer: mockInterviewer,
    candidate: mockCandidate,
    questions: [
      {
        id: 'iq-1',
        order: 1,
        interviewerNotes: 'Candidate was nervous',
        question: {
          id: 'q1',
          title: 'Two Sum',
          rubric: { criteria: 'Must be O(n)' },
          testCases: [
            { id: 'tc1', input: '[[2,7],9]', expectedOutput: '[0,1]', isHidden: false },
            { id: 'tc2', input: '[[3,2,4],6]', expectedOutput: '[1,2]', isHidden: true }
          ]
        }
      }
    ],
    evaluations: [{ id: 'eval-1', overallScore: 4 }]
  };

  test('interviewer gets full data including rubrics and hidden test cases', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockFullInterview);
    const result = await interviewService.getInterviewById('interview-1', mockInterviewer);
    expect(result.questions[0].question.rubric).toBeTruthy();
    expect(result.questions[0].question.testCases).toHaveLength(2); // Both visible and hidden
    expect(result.evaluations).toHaveLength(1);
  });

  test('candidate only gets visible test cases and no rubric or evaluations', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockFullInterview);
    const result = await interviewService.getInterviewById('interview-1', mockCandidate);
    // Only visible test cases
    expect(result.questions[0].question.testCases).toHaveLength(1);
    expect(result.questions[0].question.testCases[0].isHidden).toBe(false);
    // Rubric stripped
    expect(result.questions[0].question.rubric).toBeUndefined();
    // Evaluations hidden
    expect(result.evaluations).toHaveLength(0);
  });

  test('throws 403 when unrelated user tries to access interview', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockFullInterview);
    const stranger = { id: 'stranger-1', role: 'CANDIDATE' };
    await expect(interviewService.getInterviewById('interview-1', stranger))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('throws 404 when interview not found', async () => {
    prisma.interview.findUnique.mockResolvedValue(null);
    await expect(interviewService.getInterviewById('nonexistent', mockInterviewer))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
