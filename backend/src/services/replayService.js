const prisma = require('../config/db');

async function getInterviewReplay(interviewId, user) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      interviewer: { select: { id: true, name: true, email: true } },
      candidate: { select: { id: true, name: true, email: true } },
      questions: {
        include: { question: true },
        orderBy: { order: 'asc' }
      },
      codingSessions: {
        include: {
          versions: { orderBy: { timestamp: 'asc' } },
          submissions: { orderBy: { submittedAt: 'asc' } }
        }
      }
    }
  });

  if (!interview) {
    const error = new Error('Interview not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  // Only interviewer, candidate, or admin can access replay
  const isInterviewer = interview.interviewerId === user.id;
  const isCandidate = interview.candidateId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isInterviewer && !isCandidate && !isAdmin) {
    const error = new Error('Unauthorized to view this interview replay.');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  // Fetch all chronologically logged events
  const events = await prisma.interviewEvent.findMany({
    where: { interviewId },
    include: {
      user: { select: { id: true, name: true, role: true } }
    },
    orderBy: { timestamp: 'asc' }
  });

  return {
    interview: {
      id: interview.id,
      title: interview.title,
      status: interview.status,
      startedAt: interview.startedAt,
      endedAt: interview.endedAt,
      interviewer: interview.interviewer,
      candidate: interview.candidate,
      questions: interview.questions
    },
    codingSessions: interview.codingSessions,
    events
  };
}

module.exports = {
  getInterviewReplay
};
