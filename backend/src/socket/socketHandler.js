const prisma = require('../config/db');
const { verifyToken } = require('../config/jwt');
const cookie = require('cookie');

// In-memory room state: room -> Map of socketId -> participant
const roomParticipants = new Map();
// In-memory room code buffers: room -> Map<questionId, { code: string, language: string, updatedAt: number }>
const roomCodeState = new Map();

function getRoomQuestionState(interviewId, questionId = 'default') {
  if (!roomCodeState.has(interviewId)) {
    roomCodeState.set(interviewId, new Map());
  }
  const qMap = roomCodeState.get(interviewId);
  return qMap.get(questionId) || null;
}

function setRoomQuestionState(interviewId, questionId = 'default', code, language) {
  if (!roomCodeState.has(interviewId)) {
    roomCodeState.set(interviewId, new Map());
  }
  const qMap = roomCodeState.get(interviewId);
  const existing = qMap.get(questionId) || {};
  const updated = {
    code: code !== undefined ? code : existing.code || '',
    language: language || existing.language || 'javascript',
    updatedAt: Date.now()
  };
  qMap.set(questionId, updated);
  return updated;
}

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

        // Send all cached per-question code states if exists
        if (roomCodeState.has(interviewId)) {
          const qMap = roomCodeState.get(interviewId);
          const cachedMap = {};
          for (const [qid, state] of qMap.entries()) {
            cachedMap[qid] = state;
          }
          socket.emit('code_sync_all', { cachedQuestions: cachedMap });

          // Also emit legacy single code_sync for first/default question
          const defaultState = qMap.get('default') || Array.from(qMap.values())[0];
          if (defaultState) {
            socket.emit('code_sync', {
              code: defaultState.code,
              language: defaultState.language,
              origin: 'server_init'
            });
          }
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

    // Real-Time Code Sync: Strictly Candidate only!
    socket.on('code_change', async ({ interviewId, questionId = 'default', code, language, delta }) => {
      if (!interviewId || !socket.interviewId || socket.interviewId !== interviewId) return;

      // Strict role check: Observer/Interviewer cannot modify candidate code
      if (user.role !== 'CANDIDATE') {
        socket.emit('permission_denied', { message: 'Interviewer is in Observer Mode. Only the candidate can write code.' });
        return;
      }

      setRoomQuestionState(interviewId, questionId, code, language);

      // Broadcast to other participants in the room
      socket.to(interviewId).emit('code_update', {
        questionId,
        code,
        language,
        delta,
        userId: user.id,
        senderSocketId: socket.id
      });
    });

    // Real-Time Language Change: Candidate only
    socket.on('language_change', async ({ interviewId, questionId = 'default', language }) => {
      if (!interviewId || !socket.interviewId || socket.interviewId !== interviewId) return;

      if (user.role !== 'CANDIDATE') {
        socket.emit('permission_denied', { message: 'Only candidate can change editor language' });
        return;
      }

      setRoomQuestionState(interviewId, questionId, undefined, language);

      io.to(interviewId).emit('language_updated', {
        questionId,
        language,
        userId: user.id
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

    // Screen Share Notification
    socket.on('screen_share_status', ({ interviewId, isSharing }) => {
      if (!interviewId || socket.interviewId !== interviewId) return;
      io.to(interviewId).emit('screen_share_updated', {
        socketId: socket.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        isSharing: !!isSharing
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

      const existingState = getRoomQuestionState(interviewId, questionId);
      io.to(interviewId).emit('question_switched', {
        questionId,
        order,
        savedCode: existingState ? existingState.code : null,
        savedLanguage: existingState ? existingState.language : null
      });
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

    // WebRTC Peer-to-Peer Audio & Video Signaling
    socket.on('webrtc_ready', ({ interviewId }) => {
      if (!interviewId || socket.interviewId !== interviewId) return;
      socket.to(interviewId).emit('webrtc_peer_ready', {
        socketId: socket.id,
        user: { id: user.id, name: user.name, role: user.role }
      });
    });

    socket.on('webrtc_offer', ({ interviewId, targetSocketId, offer }) => {
      if (!interviewId || socket.interviewId !== interviewId) return;
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_offer', {
          fromSocketId: socket.id,
          fromUser: { id: user.id, name: user.name, role: user.role },
          offer
        });
      } else {
        socket.to(interviewId).emit('webrtc_offer', {
          fromSocketId: socket.id,
          fromUser: { id: user.id, name: user.name, role: user.role },
          offer
        });
      }
    });

    socket.on('webrtc_answer', ({ interviewId, targetSocketId, answer }) => {
      if (!interviewId || socket.interviewId !== interviewId) return;
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_answer', {
          fromSocketId: socket.id,
          fromUser: { id: user.id, name: user.name, role: user.role },
          answer
        });
      } else {
        socket.to(interviewId).emit('webrtc_answer', {
          fromSocketId: socket.id,
          fromUser: { id: user.id, name: user.name, role: user.role },
          answer
        });
      }
    });

    socket.on('webrtc_ice_candidate', ({ interviewId, targetSocketId, candidate }) => {
      if (!interviewId || socket.interviewId !== interviewId) return;
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_ice_candidate', {
          fromSocketId: socket.id,
          candidate
        });
      } else {
        socket.to(interviewId).emit('webrtc_ice_candidate', {
          fromSocketId: socket.id,
          candidate
        });
      }
    });

    socket.on('webrtc_media_state', ({ interviewId, isMuted, isCameraOff, isScreenSharing }) => {
      if (!interviewId || socket.interviewId !== interviewId) return;
      socket.to(interviewId).emit('webrtc_remote_media_state', {
        socketId: socket.id,
        userId: user.id,
        isMuted: !!isMuted,
        isCameraOff: !!isCameraOff,
        isScreenSharing: !!isScreenSharing
      });
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
