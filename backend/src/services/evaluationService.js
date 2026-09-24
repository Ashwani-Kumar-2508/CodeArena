const prisma = require('../config/db');

async function createEvaluation(interviewerId, data) {
  const {
    interviewId,
    overallScore = 3,
    problemSolvingScore = 3,
    codeQualityScore = 3,
    communicationScore = 3,
    recommendation = 'HIRE',
    strengths,
    improvements,
    feedback
  } = data;

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId }
  });

  if (!interview) {
    const error = new Error('Interview not found');
    error.statusCode = 404;
    error.isOperational = true;
    throw error;
  }

  const evaluation = await prisma.evaluation.create({
    data: {
      interviewId,
      interviewerId,
      overallScore: Number(overallScore),
      problemSolvingScore: Number(problemSolvingScore),
      codeQualityScore: Number(codeQualityScore),
      communicationScore: Number(communicationScore),
      recommendation,
      strengths,
      improvements,
      feedback
    },
    include: {
      interviewer: { select: { id: true, name: true, email: true } }
    }
  });

  // Log evaluation event
  await prisma.interviewEvent.create({
    data: {
      interviewId,
      userId: interviewerId,
      eventType: 'EVALUATION_SUBMITTED',
      payload: {
        evaluationId: evaluation.id,
        overallScore,
        recommendation
      }
    }
  });

  return evaluation;
}

async function getEvaluationByInterviewId(interviewId, user) {
  // Only interviewer or admin can see evaluation details
  if (user.role === 'CANDIDATE') {
    const error = new Error('Candidates are not authorized to view interviewer evaluation scorecards.');
    error.statusCode = 403;
    error.isOperational = true;
    throw error;
  }

  return prisma.evaluation.findFirst({
    where: { interviewId },
    include: {
      interviewer: { select: { id: true, name: true, email: true } },
      interview: {
        include: {
          candidate: { select: { id: true, name: true, email: true } }
        }
      }
    },
    orderBy: { submittedAt: 'desc' }
  });
}

module.exports = {
  createEvaluation,
  getEvaluationByInterviewId
};
