/**
 * Socket.IO Real-Time Client for CodeArena
 */
class RealtimeClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket) return this.socket;

    this.socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[Realtime] Connected to CodeArena Socket gateway');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('[Realtime] Disconnected from server');
    });

    return this.socket;
  }

  joinRoom(interviewId) {
    if (!this.socket) this.connect();
    this.socket.emit('join_room', { interviewId });
  }

  sendCodeChange(interviewId, code, delta) {
    if (!this.socket) return;
    this.socket.emit('code_change', { interviewId, code, delta });
  }

  sendCursorMove(interviewId, position) {
    if (!this.socket) return;
    this.socket.emit('cursor_move', { interviewId, position });
  }

  sendChat(interviewId, message) {
    if (!this.socket) return;
    this.socket.emit('send_chat', { interviewId, message });
  }

  startInterviewTimer(interviewId, durationMinutes) {
    if (!this.socket) return;
    this.socket.emit('start_interview_timer', { interviewId, durationMinutes });
  }

  endInterviewSession(interviewId) {
    if (!this.socket) return;
    this.socket.emit('end_interview_session', { interviewId });
  }

  switchQuestion(interviewId, questionId, order) {
    if (!this.socket) return;
    this.socket.emit('switch_question', { interviewId, questionId, order });
  }

  requestHint(interviewId, questionId) {
    if (!this.socket) return;
    this.socket.emit('request_hint', { interviewId, questionId });
  }

  revealHint(interviewId, hint, index) {
    if (!this.socket) return;
    this.socket.emit('reveal_hint', { interviewId, hint, index });
  }
}

window.realtime = new RealtimeClient();
