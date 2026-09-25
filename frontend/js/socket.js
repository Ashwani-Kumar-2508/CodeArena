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

    if (typeof io === 'undefined') {
      console.error('[Realtime] Socket.IO client library (io) is not loaded.');
      this.updateConnectionStatus('error', 'Socket client missing');
      return null;
    }

    try {
      this.updateConnectionStatus('connecting', 'Connecting...');
      this.socket = io({
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.updateConnectionStatus('connected', 'Connected');
        console.log('[Realtime] Connected to CodeArena Socket gateway');
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        this.updateConnectionStatus('disconnected', 'Disconnected');
        console.warn('[Realtime] Disconnected from server:', reason);
      });

      this.socket.on('connect_error', (error) => {
        this.connected = false;
        this.updateConnectionStatus('reconnecting', 'Reconnecting...');
        console.warn('[Realtime] Connection error:', error.message);
      });

      this.socket.on('room_error', ({ message }) => {
        console.error('[Realtime Room Error]', message);
        if (window.onRoomSecurityError) {
          window.onRoomSecurityError(message);
        } else {
          alert(`Access Denied: ${message}`);
          window.location.href = '/views/dashboard.html';
        }
      });

      this.socket.on('permission_denied', ({ message }) => {
        console.warn('[Realtime Permission Denied]', message);
        // Show subtle notification banner if present
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-2 rounded-xl bg-amber-950/90 border border-amber-800 text-amber-200 text-xs shadow-xl backdrop-blur animate-fade-in';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      });

      return this.socket;
    } catch (err) {
      console.error('[Realtime] Failed to initialize socket:', err);
      this.updateConnectionStatus('error', 'Connection failed');
      return null;
    }
  }

  updateConnectionStatus(state, label) {
    const pill = document.getElementById('connection-status-pill');
    const text = document.getElementById('connection-status-text');
    if (!pill || !text) return;

    text.textContent = label;

    if (state === 'connected') {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800';
      pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> <span>${label}</span>`;
    } else if (state === 'connecting' || state === 'reconnecting') {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800';
      pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> <span>${label}</span>`;
    } else {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800';
      pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> <span>${label}</span>`;
    }
  }

  joinRoom(interviewId) {
    if (!this.socket) this.connect();
    if (this.socket) {
      this.socket.emit('join_room', { interviewId });
    }
  }

  sendCodeChange(interviewId, questionId, code, language, delta) {
    if (!this.socket || !this.connected) return;
    // Overload: if second argument is code string and third is delta
    if (typeof questionId === 'string' && typeof code !== 'string') {
      delta = code;
      code = questionId;
      questionId = 'default';
      language = 'javascript';
    }
    this.socket.emit('code_change', { interviewId, questionId, code, language, delta });
  }

  sendLanguageChange(interviewId, questionId, language) {
    if (!this.socket || !this.connected) return;
    this.socket.emit('language_change', { interviewId, questionId, language });
  }

  sendScreenShareStatus(interviewId, isSharing) {
    if (!this.socket || !this.connected) return;
    this.socket.emit('screen_share_status', { interviewId, isSharing });
  }

  sendCursorMove(interviewId, position) {
    if (!this.socket || !this.connected) return;
    this.socket.emit('cursor_move', { interviewId, position });
  }

  sendChat(interviewId, message) {
    if (!this.socket || !this.connected) return;
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
