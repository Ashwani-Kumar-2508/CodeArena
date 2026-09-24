const prisma = require('../config/db');

async function listCandidates() {
  return prisma.user.findMany({
    where: { role: 'CANDIDATE' },
    select: {
      id: true,
      name: true,
      email: true
    },
    orderBy: { name: 'asc' }
  });
}

async function createInterview(interviewerId, data) {
  const {
    title,
    description = '',
    candidateId,
    scheduledAt,
    durationMinutes = 60,
    questionIds = []
  } = data;

  // 1. Verify title
  if (!title || title.trim().length < 3) {
    const error = new Error('Interview title is required and must be at least 3 characters.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  // 2. Verify candidate exists and has CANDIDATE role
  if (!candidateId) {
    const error = new Error('A valid candidate must be selected.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const candidate = await prisma.user.findUnique({
    where: { id: candidateId }
  });

  if (!candidate || candidate.role !== 'CANDIDATE') {
    const error = new Error('Selected candidate was not found or does not have candidate role.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  // 3. Verify questions
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    const error = new Error('At least one interview question must be assigned.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  // Verify that all questionIds actually exist in database
  const validQuestions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true }
  });

  if (validQuestions.length !== questionIds.length) {
    const error = new Error('One or more selected questions do not exist in the question catalog.');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  // 4. Parse scheduled date/time
  let parsedScheduledAt = null;
  if (scheduledAt) {
    parsedScheduledAt = new Date(scheduledAt);
    if (isNaN(parsedScheduledAt.getTime())) {
      const error = new Error('Invalid scheduled date/time provided.');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }
  } else {
    parsedScheduledAt = new Date(); // Defaults to now if immediate
  }

  const interview = await prisma.interview.create({
    data: {
      title: title.trim(),
      description: description ? description.trim() : null,
      scheduledAt: parsedScheduledAt,
      durationMinutes: Math.max(15, Math.min(180, Number(durationMinutes) || 60)),
      interviewerId,
      candidateId: candidate.id,
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
      payload: {
        title: interview.title,
        durationMinutes: interview.durationMinutes,
        scheduledAt: interview.scheduledAt
      }
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

  // Strict Authorization check
  const isInterviewer = interview.interviewerId === user.id;
  const isCandidate = interview.candidateId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isInterviewer && !isCandidate && !isAdmin) {
    const error = new Error('You do not have permission to access this interview session.');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  // Strip confidential hidden test cases, notes, and rubrics for candidate
  if (user.role === 'CANDIDATE') {
    interview.questions = interview.questions.map(iq => {
      const q = { ...iq.question };
      if (q.testCases) {
        q.testCases = q.testCases.filter(tc => !tc.isHidden);
      }
      delete q.rubric;
      return {
        ...iq,
        interviewerNotes: undefined,
        question: q
      };
    });
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

  if (interview.status === 'COMPLETED' || interview.status === 'CANCELLED') {
    const error = new Error(`Cannot start an interview that is already ${interview.status.toLowerCase()}`);
    error.statusCode = 400;
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

  if (interview.status !== 'ACTIVE') {
    const error = new Error('Only active interviews can be concluded');
    error.statusCode = 400;
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

async function cancelInterview(interviewId, user) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview) {
    const error = new Error('Interview not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  if (interview.interviewerId !== user.id && user.role !== 'ADMIN') {
    const error = new Error('Only the assigned interviewer can cancel this session');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  if (interview.status === 'COMPLETED' || interview.status === 'ACTIVE') {
    const error = new Error('Cannot cancel an interview that is already in progress or completed');
    error.statusCode = 400;
    error.isOperational = true;
    throw error;
  }

  const updated = await prisma.interview.update({
    where: { id: interviewId },
    data: { status: 'CANCELLED' }
  });

  await prisma.interviewEvent.create({
    data: {
      interviewId,
      userId: user.id,
      eventType: 'INTERVIEW_CANCELLED',
      payload: { cancelledAt: new Date() }
    }
  });

  return updated;
}

module.exports = {
  listCandidates,
  createInterview,
  listInterviewsForUser,
  getInterviewById,
  startInterview,
  endInterview,
  cancelInterview
};
