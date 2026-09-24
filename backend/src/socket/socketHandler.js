const prisma = require('../config/db');
const { verifyToken } = require('../config/jwt');
const cookie = require('cookie');

// In-memory room state: room -> Map of socketId -> participant
const roomParticipants = new Map();
// In-memory room code buffers for fast sync
const roomCodeState = new Map();

function initSocket(io) {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      let token = null;

      // Check cookies
      if (socket.handshake.headers.cookie) {
        const parsedCookies = cookie.parse(socket.handshake.headers.cookie);
        token = parsedCookies.token;
      }

      // Check handshake auth
      if (!token && socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }

      if (!token) {
        return next(new Error('Authentication required for socket connection'));
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true, role: true }
      });

      if (!user) {
        return next(new Error('User account not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Unauthorized socket connection'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[Socket] Connected: ${user.name} (${user.role}) - Socket ID: ${socket.id}`);

    // Join Interview Room with Strict Authorization
    socket.on('join_room', async ({ interviewId }) => {
      if (!interviewId) return;

      try {
        const interview = await prisma.interview.findUnique({
          where: { id: interviewId },
          select: {
            id: true,
            status: true,
            startedAt: true,
            durationMinutes: true,
            interviewerId: true,
            candidateId: true
          }
        });

        if (!interview) {
          return socket.emit('room_error', { message: 'Interview session does not exist' });
        }

        // Strict authorization check: Only assigned interviewer, assigned candidate, or admin can join
        const isInterviewer = interview.interviewerId === user.id;
        const isCandidate = interview.candidateId === user.id;
        const isAdmin = user.role === 'ADMIN';

        if (!isInterviewer && !isCandidate && !isAdmin) {
          return socket.emit('room_error', { message: 'Access denied: You are not an authorized participant in this interview.' });
        }

        socket.join(interviewId);
        socket.interviewId = interviewId;

        // Track participant
        if (!roomParticipants.has(interviewId)) {
          roomParticipants.set(interviewId, new Map());
        }
        const participants = roomParticipants.get(interviewId);
        participants.set(socket.id, {
          userId: user.id,
          name: user.name,
          role: user.role,
          socketId: socket.id
        });

        // Broadcast updated participant list to room
        const activeList = Array.from(participants.values());
        io.to(interviewId).emit('participants_update', activeList);

        // Notify client about server time and session state
        socket.emit('session_init', {
          serverTime: Date.now(),
          status: interview.status,
          startedAt: interview.startedAt,
          durationMinutes: interview.durationMinutes
        });

        // Send initial code state if exists
        if (roomCodeState.has(interviewId)) {
          socket.emit('code_sync', {
            code: roomCodeState.get(interviewId),
            origin: 'server_init'
          });
        }

        // Log USER_JOINED event
        await prisma.interviewEvent.create({
          data: {
            interviewId,
            userId: user.id,
            eventType: 'USER_JOINED',
            payload: { name: user.name, role: user.role }
          }
        });

        console.log(`[Socket] Authorized join: ${user.name} (${user.role}) in room ${interviewId}`);
      } catch (err) {
        console.error('Error handling join_room:', err);
        socket.emit('room_error', { message: 'Internal error joining interview room' });
      }
    });

    // Real-Time Code Sync (Text & Deltas)
    socket.on('code_change', async ({ interviewId, code, delta }) => {
      if (!interviewId || !socket.interviewId || socket.interviewId !== interviewId) return;
      roomCodeState.set(interviewId, code);

      // Broadcast to other participants in the room
      socket.to(interviewId).emit('code_update', {
        code,
        delta,
        userId: user.id,
        senderSocketId: socket.id
      });
    });

    // Remote Cursor Movement
    socket.on('cursor_move', ({ interviewId, position }) => {
      if (!interviewId || !socket.interviewId || socket.interviewId !== interviewId) return;
      socket.to(interviewId).emit('remote_cursor', {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        position
      });
    });

    // Interview Lifecycle: Start (Interviewer / Admin only)
    socket.on('start_interview_timer', async ({ interviewId, durationMinutes }) => {
      if (user.role === 'CANDIDATE') return;
      const startedAt = new Date();

      try {
        await prisma.interview.update({
          where: { id: interviewId },
          data: { status: 'ACTIVE', startedAt }
        });

        await prisma.interviewEvent.create({
          data: {
            interviewId,
            userId: user.id,
            eventType: 'INTERVIEW_STARTED',
            payload: { startedAt, durationMinutes }
          }
        });
      } catch (err) {
        console.error('Error starting interview timer:', err);
      }

      io.to(interviewId).emit('interview_started', {
        startedAt,
        durationMinutes,
        serverTime: Date.now()
      });
    });

    // Interview Lifecycle: End (Interviewer / Admin only)
    socket.on('end_interview_session', async ({ interviewId }) => {
      if (user.role === 'CANDIDATE') return;
      const endedAt = new Date();

      try {
        await prisma.interview.update({
          where: { id: interviewId },
          data: { status: 'COMPLETED', endedAt }
        });

        await prisma.interviewEvent.create({
          data: {
            interviewId,
            userId: user.id,
            eventType: 'INTERVIEW_ENDED',
            payload: { endedAt }
          }
        });
      } catch (err) {
        console.error('Error concluding interview:', err);
      }

      io.to(interviewId).emit('interview_ended', { endedAt });
    });

    // Question Navigation (Interviewer switches question)
    socket.on('switch_question', async ({ interviewId, questionId, order }) => {
      if (user.role === 'CANDIDATE') return;

      try {
        await prisma.interviewEvent.create({
          data: {
            interviewId,
            userId: user.id,
            eventType: 'QUESTION_CHANGED',
            payload: { questionId, order }
          }
        });
      } catch (e) {
        console.error('Error logging question change event:', e);
      }

      io.to(interviewId).emit('question_switched', { questionId, order });
    });

    // Real-Time In-Room Chat
    socket.on('send_chat', async ({ interviewId, message }) => {
      if (!interviewId || !message || !message.trim()) return;

      const chatData = {
        id: 'msg_' + Date.now(),
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        message: message.trim(),
        timestamp: new Date().toISOString()
      };

      try {
        await prisma.interviewEvent.create({
          data: {
            interviewId,
            userId: user.id,
            eventType: 'CHAT_MESSAGE',
            payload: chatData
          }
        });
      } catch (e) {
        console.error('Error logging chat message event:', e);
      }

      io.to(interviewId).emit('new_chat', chatData);
    });

    // Hints
    socket.on('request_hint', async ({ interviewId, questionId }) => {
      io.to(interviewId).emit('hint_requested', {
        candidateName: user.name,
        questionId
      });
    });

    socket.on('reveal_hint', async ({ interviewId, hint, index }) => {
      if (user.role === 'CANDIDATE') return;
      io.to(interviewId).emit('hint_revealed', { hint, index });
    });

    // Disconnect & Cleanup
    socket.on('disconnect', async () => {
      const interviewId = socket.interviewId;
      if (interviewId && roomParticipants.has(interviewId)) {
        const participants = roomParticipants.get(interviewId);
        participants.delete(socket.id);

        if (participants.size === 0) {
          roomParticipants.delete(interviewId);
        } else {
          io.to(interviewId).emit('participants_update', Array.from(participants.values()));
        }

        try {
          await prisma.interviewEvent.create({
            data: {
              interviewId,
              userId: user.id,
              eventType: 'USER_LEFT',
              payload: { name: user.name, role: user.role }
            }
          });
        } catch (e) {
          // ignore cleanup errors
        }
      }
      console.log(`[Socket] Disconnected: ${user.name}`);
    });
  });
}

module.exports = { initSocket };
