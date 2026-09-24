const prisma = require('../config/db');
const { verifyToken } = require('../config/jwt');
const cookie = require('cookie');

// In-memory room state: room -> Set of active participants
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

      // Check handshake auth or query
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
        return next(new Error('User not found'));
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

    // Join Interview Room
    socket.on('join_room', async ({ interviewId }) => {
      if (!interviewId) return;

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

      // Send initial code state if exists
      if (roomCodeState.has(interviewId)) {
        socket.emit('code_sync', {
          code: roomCodeState.get(interviewId),
          origin: 'server_init'
        });
      }

      // Log USER_JOINED event
      try {
        await prisma.interviewEvent.create({
          data: {
            interviewId,
            userId: user.id,
            eventType: 'USER_JOINED',
            payload: { name: user.name, role: user.role }
          }
        });
      } catch (e) {
        console.error('Error logging USER_JOINED event:', e);
      }

      console.log(`[Socket] ${user.name} joined room: ${interviewId}`);
    });

    // Real-Time Code Sync (Yjs / Text Deltas)
    socket.on('code_change', async ({ interviewId, code, delta }) => {
      if (!interviewId) return;
      roomCodeState.set(interviewId, code);

      // Broadcast to other participants in the room
      socket.to(interviewId).emit('code_update', {
        code,
        delta,
        userId: user.id,
        senderSocketId: socket.id
      });
    });

    // Cursor Movement
    socket.on('cursor_move', ({ interviewId, position }) => {
      if (!interviewId) return;
      socket.to(interviewId).emit('remote_cursor', {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        position
      });
    });

    // Interview Lifecycle Controls (Interviewer / Admin only)
    socket.on('start_interview_timer', async ({ interviewId, durationMinutes }) => {
      if (user.role === 'CANDIDATE') return;
      const startedAt = new Date();

      try {
        await prisma.interview.update({
          where: { id: interviewId },
          data: { status: 'ACTIVE', startedAt }
        });
      } catch (err) {
        console.error('Error updating interview to active:', err);
      }

      io.to(interviewId).emit('interview_started', {
        startedAt,
        durationMinutes
      });
    });

    socket.on('end_interview_session', async ({ interviewId }) => {
      if (user.role === 'CANDIDATE') return;
      const endedAt = new Date();

      try {
        await prisma.interview.update({
          where: { id: interviewId },
          data: { status: 'COMPLETED', endedAt }
        });
      } catch (err) {
        console.error('Error updating interview to completed:', err);
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

    // Real-Time Chat
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

    // Disconnect
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
