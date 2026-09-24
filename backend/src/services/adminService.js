const prisma = require('../config/db');

async function getPlatformStats() {
  const [
    totalUsers,
    totalCandidates,
    totalInterviewers,
    totalAdmins,
    totalInterviews,
    activeInterviews,
    completedInterviews,
    scheduledInterviews,
    totalQuestions
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'CANDIDATE' } }),
    prisma.user.count({ where: { role: 'INTERVIEWER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.interview.count(),
    prisma.interview.count({ where: { status: 'ACTIVE' } }),
    prisma.interview.count({ where: { status: 'COMPLETED' } }),
    prisma.interview.count({ where: { status: 'SCHEDULED' } }),
    prisma.question.count()
  ]);

  return {
    users: {
      total: totalUsers,
      candidates: totalCandidates,
      interviewers: totalInterviewers,
      admins: totalAdmins
    },
    interviews: {
      total: totalInterviews,
      active: activeInterviews,
      completed: completedInterviews,
      scheduled: scheduledInterviews
    },
    questions: {
      total: totalQuestions
    }
  };
}

async function listAllUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function listAllInterviews() {
  return prisma.interview.findMany({
    include: {
      interviewer: { select: { id: true, name: true, email: true } },
      candidate: { select: { id: true, name: true, email: true } },
      questions: {
        include: {
          question: { select: { id: true, title: true, type: true } }
        }
      },
      evaluations: { select: { id: true, overallScore: true, recommendation: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function getSystemActivity(limit = 20) {
  return prisma.interviewEvent.findMany({
    take: limit,
    include: {
      user: { select: { id: true, name: true, role: true } },
      interview: { select: { id: true, title: true } }
    },
    orderBy: { timestamp: 'desc' }
  });
}

module.exports = {
  getPlatformStats,
  listAllUsers,
  listAllInterviews,
  getSystemActivity
};
