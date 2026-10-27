/**
 * CodeArena Test Suite — Evaluation Service Unit Tests
 *
 * Tests: createEvaluation (scorecard persistence and audit event logging),
 * getEvaluationByInterviewId (interviewer/admin allowed, candidate forbidden with 403).
 */

jest.mock('../src/config/db', () => ({
  interview: {
    findUnique: jest.fn()
  },
  evaluation: {
    create: jest.fn(),
    findFirst: jest.fn()
  },
  interviewEvent: {
    create: jest.fn().mockResolvedValue({})
  }
}));

const evaluationService = require('../src/services/evaluationService');
const prisma = require('../src/config/db');

describe('Evaluation Service — createEvaluation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 when interview does not exist', async () => {
    prisma.interview.findUnique.mockResolvedValue(null);

    await expect(evaluationService.createEvaluation('interviewer-1', {
      interviewId: 'nonexistent'
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('creates evaluation scorecard and logs interview event', async () => {
    prisma.interview.findUnique.mockResolvedValue({ id: 'interview-1' });
    prisma.evaluation.create.mockResolvedValue({
      id: 'eval-1',
      interviewId: 'interview-1',
      interviewerId: 'interviewer-1',
      overallScore: 4,
      recommendation: 'STRONG_HIRE'
    });

    const result = await evaluationService.createEvaluation('interviewer-1', {
      interviewId: 'interview-1',
      overallScore: 4,
      problemSolvingScore: 5,
      codeQualityScore: 4,
      communicationScore: 4,
      recommendation: 'STRONG_HIRE',
      strengths: 'Excellent problem solving',
      improvements: 'None',
      feedback: 'Ready for senior level'
    });

    expect(result.id).toBe('eval-1');
    expect(result.overallScore).toBe(4);
    expect(prisma.interviewEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          interviewId: 'interview-1',
          eventType: 'EVALUATION_SUBMITTED'
        })
      })
    );
  });
});

describe('Evaluation Service — getEvaluationByInterviewId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects candidate with 403 forbidden', async () => {
    const candidateUser = { id: 'cand-1', role: 'CANDIDATE' };

    await expect(evaluationService.getEvaluationByInterviewId('interview-1', candidateUser))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('allows interviewer to view scorecard', async () => {
    const interviewerUser = { id: 'interviewer-1', role: 'INTERVIEWER' };
    prisma.evaluation.findFirst.mockResolvedValue({
      id: 'eval-1',
      overallScore: 5,
      recommendation: 'STRONG_HIRE'
    });

    const result = await evaluationService.getEvaluationByInterviewId('interview-1', interviewerUser);
    expect(result.id).toBe('eval-1');
  });

  test('allows admin to view scorecard', async () => {
    const adminUser = { id: 'admin-1', role: 'ADMIN' };
    prisma.evaluation.findFirst.mockResolvedValue({
      id: 'eval-1',
      overallScore: 5,
      recommendation: 'STRONG_HIRE'
    });

    const result = await evaluationService.getEvaluationByInterviewId('interview-1', adminUser);
    expect(result.id).toBe('eval-1');
  });
});
