/**
 * CodeArena Test Suite — Replay Service Unit Tests
 *
 * Tests: getInterviewReplay (authorization check, events stream retrieval, 404/403 guards).
 */

jest.mock('../src/config/db', () => ({
  interview: {
    findUnique: jest.fn()
  },
  interviewEvent: {
    findMany: jest.fn()
  }
}));

const replayService = require('../src/services/replayService');
const prisma = require('../src/config/db');

const mockInterview = {
  id: 'int-123',
  title: 'Backend Systems Round',
  status: 'COMPLETED',
  interviewerId: 'interviewer-1',
  candidateId: 'candidate-1',
  interviewer: { id: 'interviewer-1', name: 'Interviewer' },
  candidate: { id: 'candidate-1', name: 'Candidate' },
  questions: [],
  codingSessions: []
};

describe('Replay Service — getInterviewReplay', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 when interview not found', async () => {
    prisma.interview.findUnique.mockResolvedValue(null);

    await expect(replayService.getInterviewReplay('int-999', { id: 'interviewer-1', role: 'INTERVIEWER' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 403 when unrelated user attempts to view replay', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockInterview);
    const outsider = { id: 'outsider-1', role: 'CANDIDATE' };

    await expect(replayService.getInterviewReplay('int-123', outsider))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('allows assigned interviewer to view replay and events', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockInterview);
    prisma.interviewEvent.findMany.mockResolvedValue([
      { id: 'ev1', eventType: 'USER_JOINED' },
      { id: 'ev2', eventType: 'RUN_CODE' }
    ]);

    const result = await replayService.getInterviewReplay('int-123', { id: 'interviewer-1', role: 'INTERVIEWER' });

    expect(result.interview.id).toBe('int-123');
    expect(result.events).toHaveLength(2);
  });

  test('allows assigned candidate to view replay and events', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockInterview);
    prisma.interviewEvent.findMany.mockResolvedValue([
      { id: 'ev1', eventType: 'USER_JOINED' }
    ]);

    const result = await replayService.getInterviewReplay('int-123', { id: 'candidate-1', role: 'CANDIDATE' });

    expect(result.interview.id).toBe('int-123');
    expect(result.events).toHaveLength(1);
  });

  test('allows admin to view replay for any interview', async () => {
    prisma.interview.findUnique.mockResolvedValue(mockInterview);
    prisma.interviewEvent.findMany.mockResolvedValue([]);

    const result = await replayService.getInterviewReplay('int-123', { id: 'admin-1', role: 'ADMIN' });

    expect(result.interview.id).toBe('int-123');
  });
});
