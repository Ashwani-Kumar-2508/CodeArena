const prisma = require('../config/db');

async function createInterview(interviewerId, data) {
  const { title, description, candidateEmail, durationMinutes = 60, questionIds = [] } = data;

  let candidateId = null;
  if (candidateEmail) {
    const candidate = await prisma.user.findUnique({ where: { email: candidateEmail } });
    if (candidate) {
      candidateId = candidate.id;
    }
  }

  const interview = await prisma.interview.create({
    data: {
      title,
      description,
      durationMinutes: Number(durationMinutes),
      interviewerId,
      candidateId,
      status: 'SCHEDULED',
      questions: {
        create: questionIds.map((qId, idx) => ({
          questionId: qId,
          order: idx + 1
        }))
      }
    },
    include: {
      interviewer: { select: { id: true, name: true, email: true } },
      candidate: { select: { id: true, name: true, email: true } },
      questions: {
        include: {
          question: true
        },
        orderBy: { order: 'asc' }
      }
    }
  });

  // Log creation event
  await prisma.interviewEvent.create({
    data: {
      interviewId: interview.id,
      userId: interviewerId,
      eventType: 'INTERVIEW_CREATED',
      payload: { title, durationMinutes }
    }
  });

  return interview;
}

async function listInterviewsForUser(user) {
  const where = {};
  if (user.role === 'INTERVIEWER') {
    where.interviewerId = user.id;
  } else if (user.role === 'CANDIDATE') {
    where.candidateId = user.id;
  }
  // ADMIN can view all interviews

  return prisma.interview.findMany({
    where,
    include: {
      interviewer: { select: { id: true, name: true, email: true } },
      candidate: { select: { id: true, name: true, email: true } },
      questions: {
        include: {
          question: {
            select: { id: true, title: true, type: true, difficulty: true }
          }
        },
        orderBy: { order: 'asc' }
      },
      evaluations: {
        select: { id: true, overallScore: true, recommendation: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function getInterviewById(interviewId, user) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      interviewer: { select: { id: true, name: true, email: true, role: true } },
      candidate: { select: { id: true, name: true, email: true, role: true } },
      questions: {
        include: {
          question: {
            include: {
              testCases: true
            }
          }
        },
        orderBy: { order: 'asc' }
      },
      evaluations: true
    }
  });

  if (!interview) {
    const error = new Error('Interview not found.');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  // Authorization check
  const isInterviewer = interview.interviewerId === user.id;
  const isCandidate = interview.candidateId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isInterviewer && !isCandidate && !isAdmin) {
    const error = new Error('You do not have permission to access this interview session.');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  // Strip hidden test cases and private rubrics if the user is a Candidate!
  if (user.role === 'CANDIDATE') {
    interview.questions = interview.questions.map(iq => {
      const q = { ...iq.question };
      if (q.testCases) {
        q.testCases = q.testCases.filter(tc => !tc.isHidden);
      }
      delete q.rubric; // Candidate cannot see grading rubric
      return {
        ...iq,
        interviewerNotes: undefined, // Candidate cannot see private interviewer notes
        question: q
      };
    });
    // Candidate cannot see pending evaluations
    interview.evaluations = [];
  }

  return interview;
}

async function startInterview(interviewId, user) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview) {
    const error = new Error('Interview not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  if (interview.interviewerId !== user.id && user.role !== 'ADMIN') {
    const error = new Error('Only the assigned interviewer can start this session');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  const updated = await prisma.interview.update({
    where: { id: interviewId },
    data: {
      status: 'ACTIVE',
      startedAt: interview.startedAt || new Date()
    }
  });

  await prisma.interviewEvent.create({
    data: {
      interviewId,
      userId: user.id,
      eventType: 'INTERVIEW_STARTED',
      payload: { startedAt: updated.startedAt }
    }
  });

  return updated;
}

async function endInterview(interviewId, user) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview) {
    const error = new Error('Interview not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  if (interview.interviewerId !== user.id && user.role !== 'ADMIN') {
    const error = new Error('Only the assigned interviewer can conclude this session');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  const updated = await prisma.interview.update({
    where: { id: interviewId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date()
    }
  });

  await prisma.interviewEvent.create({
    data: {
      interviewId,
      userId: user.id,
      eventType: 'INTERVIEW_ENDED',
      payload: { endedAt: updated.endedAt }
    }
  });

  return updated;
}

module.exports = {
  createInterview,
  listInterviewsForUser,
  getInterviewById,
  startInterview,
  endInterview
};
