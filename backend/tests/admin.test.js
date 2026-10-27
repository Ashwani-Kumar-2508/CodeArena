/**
 * CodeArena Test Suite — Admin Service Unit Tests
 *
 * Tests: getPlatformStats (aggregation across users, interviews, questions),
 * listAllUsers, listAllInterviews, getSystemActivity.
 */

jest.mock('../src/config/db', () => ({
  user: {
    count: jest.fn(),
    findMany: jest.fn()
  },
  interview: {
    count: jest.fn(),
    findMany: jest.fn()
  },
  question: {
    count: jest.fn()
  },
  interviewEvent: {
    findMany: jest.fn()
  }
}));

const adminService = require('../src/services/adminService');
const prisma = require('../src/config/db');

describe('Admin Service — getPlatformStats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('aggregates platform metrics correctly', async () => {
    prisma.user.count
      .mockResolvedValueOnce(50)  // totalUsers
      .mockResolvedValueOnce(35)  // totalCandidates
      .mockResolvedValueOnce(12)  // totalInterviewers
      .mockResolvedValueOnce(3);  // totalAdmins

    prisma.interview.count
      .mockResolvedValueOnce(20)  // totalInterviews
      .mockResolvedValueOnce(4)   // activeInterviews
      .mockResolvedValueOnce(14)  // completedInterviews
      .mockResolvedValueOnce(2);  // scheduledInterviews

    prisma.question.count.mockResolvedValue(25);

    const stats = await adminService.getPlatformStats();

    expect(stats.users.total).toBe(50);
    expect(stats.users.candidates).toBe(35);
    expect(stats.users.interviewers).toBe(12);
    expect(stats.users.admins).toBe(3);

    expect(stats.interviews.total).toBe(20);
    expect(stats.interviews.active).toBe(4);
    expect(stats.interviews.completed).toBe(14);
    expect(stats.interviews.scheduled).toBe(2);

    expect(stats.questions.total).toBe(25);
  });
});

describe('Admin Service — listAllUsers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns user list ordered by createdAt descending', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'User 1', email: 'u1@test.com', role: 'ADMIN' },
      { id: 'u2', name: 'User 2', email: 'u2@test.com', role: 'CANDIDATE' }
    ]);

    const users = await adminService.listAllUsers();
    expect(users).toHaveLength(2);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });
});

describe('Admin Service — getSystemActivity', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns latest activity stream up to limit', async () => {
    prisma.interviewEvent.findMany.mockResolvedValue([
      { id: 'ev1', eventType: 'INTERVIEW_STARTED' }
    ]);

    const activity = await adminService.getSystemActivity(10);
    expect(activity).toHaveLength(1);
    expect(prisma.interviewEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, orderBy: { timestamp: 'desc' } })
    );
  });
});
