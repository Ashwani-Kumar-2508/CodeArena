/**
 * WebRTC Audio & Video Manager for CodeArena
 * Handles peer-to-peer media streaming, device checks, STUN negotiation,
 * microphone/camera controls, screen sharing, and graceful fallbacks.
 */
class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.screenStream = null;
    this.socket = null;
    this.interviewId = null;
    this.remoteSocketId = null;

    this.isMuted = false;
    this.isCameraOff = false;
    this.isScreenSharing = false;
    this.isAudioOnly = false;
    this.hasRemoteVideo = false;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  /**
   * Device check utility for pre-interview testing modal
   */
  async checkDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { supported: false, hasCamera: false, hasMicrophone: false };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(d => d.kind === 'videoinput');
      const hasMicrophone = devices.some(d => d.kind === 'audioinput');
      const hasSpeaker = devices.some(d => d.kind === 'audiooutput') || true;

      return {
        supported: true,
        hasCamera,
        hasMicrophone,
        hasSpeaker
      };
    } catch (e) {
      console.warn('[WebRTC] Device enumeration error:', e);
      return { supported: true, hasCamera: false, hasMicrophone: false, hasSpeaker: true };
    }
  }

  /**
   * Starts temporary camera/mic preview for the device check modal
   */
  async startTestPreview(videoElId) {
    const videoEl = document.getElementById(videoElId);
    if (!videoEl) return null;

    try {
      let previewStream;
      try {
        previewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        console.warn('[WebRTC] Dual test preview failed, trying audio or video only:', err.name);
        try {
          previewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch {
          previewStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        }
      }

      videoEl.srcObject = previewStream;
      videoEl.muted = true;
      videoEl.play().catch(e => console.warn('Preview play error:', e));
      this.testStream = previewStream;
      return previewStream;
    } catch (err) {
      console.warn('[WebRTC] Cannot start device test preview:', err.name);
      return null;
    }
  }

  /**
   * Stops test preview stream
   */
  stopTestPreview() {
    if (this.testStream) {
      this.testStream.getTracks().forEach(track => track.stop());
      this.testStream = null;
    }
  }

  /**
   * Initialize WebRTC media session inside the interview room
   */
  async init(interviewId, socket) {
    this.interviewId = interviewId;
    this.socket = socket;
    this.updateMediaStatus('connecting', 'Connecting video...');

    // 1. Acquire Local Media with Audio-only fallback
    try {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 }
          },
          audio: true
        });
        this.isAudioOnly = false;
      } catch (mediaErr) {
        console.warn('[WebRTC] Camera unavailable or denied, falling back to audio-only:', mediaErr.message);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          this.isAudioOnly = true;
          this.isCameraOff = true;
          this.updateMediaStatus('audio', 'Audio only');
        } catch (audioErr) {
          console.warn('[WebRTC] Microphone also unavailable/denied:', audioErr.message);
          this.localStream = new MediaStream(); // Empty stream fallback so room doesn't break
          this.updateMediaStatus('unavailable', 'Video unavailable');
        }
      }

      // Attach local stream to self-preview element
      const localVideoEl = document.getElementById('local-video-element');
      if (localVideoEl && this.localStream.getVideoTracks().length > 0) {
        localVideoEl.srcObject = this.localStream;
        localVideoEl.muted = true; // Always mute self locally to prevent acoustic feedback
      } else {
        this.setLocalCameraPlaceholder(true);
      }

      this.updateLocalControlsUI();

      // 2. Setup Socket Signaling Listeners
      this.setupSignaling();

      // 3. Announce readiness to room
      this.socket.emit('webrtc_ready', { interviewId });

    } catch (err) {
      console.error('[WebRTC] Error initializing media:', err);
      this.updateMediaStatus('unavailable', 'Video unavailable');
    }
  }

  /**
   * Setup Socket.IO Signaling for WebRTC Offer/Answer/ICE
   */
  setupSignaling() {
    if (!this.socket) return;

    // Remote peer is ready -> initiate offer
    this.socket.on('webrtc_peer_ready', async ({ socketId, user }) => {
      console.log('[WebRTC] Remote peer ready:', user.name, socketId);
      this.remoteSocketId = socketId;
      this.updateRemoteParticipantUI(user);
      await this.createPeerConnection(socketId);
      await this.sendOffer(socketId);
    });

    // Received offer from peer
    this.socket.on('webrtc_offer', async ({ fromSocketId, fromUser, offer }) => {
      console.log('[WebRTC] Received offer from:', fromUser.name);
      this.remoteSocketId = fromSocketId;
      this.updateRemoteParticipantUI(fromUser);
      await this.createPeerConnection(fromSocketId);
      await this.handleOffer(fromSocketId, offer);
    });

    // Received answer from peer
    this.socket.on('webrtc_answer', async ({ fromSocketId, answer }) => {
      console.log('[WebRTC] Received answer from peer');
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Received ICE candidate
    this.socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      try {
        if (this.peerConnection && candidate) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.warn('[WebRTC] Error adding ICE candidate:', e);
      }
    });

    // Remote peer updated mic or camera state
    this.socket.on('webrtc_remote_media_state', ({ isMuted, isCameraOff, isScreenSharing }) => {
      this.updateRemoteMediaStateUI(isMuted, isCameraOff, isScreenSharing);
    });
  }

  /**
   * Creates RTCPeerConnection and attaches local tracks
   */
  async createPeerConnection(targetSocketId) {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Attach local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote tracks arrival
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Received remote stream track:', event.track.kind);
      const remoteVideoEl = document.getElementById('remote-video-element');
      if (remoteVideoEl) {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
          remoteVideoEl.srcObject = this.remoteStream;
        }
        this.remoteStream.addTrack(event.track);
        remoteVideoEl.play().catch(e => console.warn('Remote video play error:', e));

        if (event.track.kind === 'video') {
          this.hasRemoteVideo = true;
          this.setRemoteCameraPlaceholder(false);
        }

        this.updateMediaStatus('connected', 'Video connected');
      }
    };

    // ICE candidate generation
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc_ice_candidate', {
          interviewId: this.interviewId,
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('[WebRTC] Connection state changed:', state);

      if (state === 'connected') {
        this.updateMediaStatus('connected', 'Video connected');
      } else if (state === 'disconnected' || state === 'failed') {
        this.updateMediaStatus('reconnecting', 'Video reconnecting...');
      } else if (state === 'closed') {
        this.updateMediaStatus('unavailable', 'Video disconnected');
      }
    };
  }

  async sendOffer(targetSocketId) {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socket.emit('webrtc_offer', {
        interviewId: this.interviewId,
        targetSocketId,
        offer
      });
    } catch (e) {
      console.error('[WebRTC] Error creating offer:', e);
    }
  }

  async handleOffer(fromSocketId, offer) {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emit('webrtc_answer', {
        interviewId: this.interviewId,
        targetSocketId: fromSocketId,
        answer
      });
    } catch (e) {
      console.error('[WebRTC] Error answering offer:', e);
    }
  }

  /* =========================================================================
     HARDWARE CONTROLS (Mic, Camera, Screen Sharing)
     ========================================================================= */

  toggleMicrophone() {
    if (!this.localStream) return;
    const audioTracks = this.localStream.getAudioTracks();
    if (audioTracks.length === 0) return;

    this.isMuted = !this.isMuted;
    audioTracks.forEach(track => {
      track.enabled = !this.isMuted;
    });

    this.broadcastMediaState();
    this.updateLocalControlsUI();
  }

  toggleCamera() {
    if (!this.localStream || this.isAudioOnly) return;
    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    this.isCameraOff = !this.isCameraOff;
    videoTracks.forEach(track => {
      track.enabled = !this.isCameraOff;
    });

    this.setLocalCameraPlaceholder(this.isCameraOff);
    this.broadcastMediaState();
    this.updateLocalControlsUI();
  }

  async toggleScreenShare() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert('Screen sharing is not supported by your browser.');
      return;
    }

    if (this.isScreenSharing) {
      this.stopScreenSharing();
      return;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      // Replace video track in RTCPeerConnection
      if (this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }
      }

      // Update local preview to screen share
      const localVideoEl = document.getElementById('local-video-element');
      if (localVideoEl) localVideoEl.srcObject = this.screenStream;

      this.isScreenSharing = true;
      this.setLocalCameraPlaceholder(false);
      this.broadcastMediaState();
      this.updateLocalControlsUI();
      if (window.realtime) {
        window.realtime.sendScreenShareStatus(this.interviewId, true);
      }

      // Listen for browser's native "Stop Sharing" bar
      screenTrack.onended = () => {
        this.stopScreenSharing();
      };

    } catch (e) {
      console.warn('[WebRTC] Screen sharing cancelled or denied:', e.message);
    }
  }

  async stopScreenSharing() {
    if (!this.isScreenSharing) return;

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }

    // Restore webcam track
    if (this.localStream) {
      const webcamTrack = this.localStream.getVideoTracks()[0];
      if (webcamTrack && this.peerConnection) {
        const senders = this.peerConnection.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(webcamTrack);
        }
      }

      const localVideoEl = document.getElementById('local-video-element');
      if (localVideoEl && webcamTrack) {
        localVideoEl.srcObject = this.localStream;
      }
    }

    this.isScreenSharing = false;
    this.setLocalCameraPlaceholder(this.isCameraOff);
    this.broadcastMediaState();
    this.updateLocalControlsUI();
    if (window.realtime) {
      window.realtime.sendScreenShareStatus(this.interviewId, false);
    }
  }

  broadcastMediaState() {
    if (!this.socket || !this.interviewId) return;
    this.socket.emit('webrtc_media_state', {
      interviewId: this.interviewId,
      isMuted: this.isMuted,
      isCameraOff: this.isCameraOff,
      isScreenSharing: this.isScreenSharing
    });
  }

  /* =========================================================================
     UI STATUS & BADGES
     ========================================================================= */

  updateMediaStatus(state, label) {
    const pill = document.getElementById('media-status-pill');
    const text = document.getElementById('media-status-text');
    if (!pill || !text) return;

    text.textContent = label;

    if (state === 'connected') {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800';
      pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> <span>${label}</span>`;
    } else if (state === 'connecting' || state === 'reconnecting') {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800';
      pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> <span>${label}</span>`;
    } else if (state === 'audio') {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-950/80 text-blue-300 border border-blue-800';
      pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span> <span>${label}</span>`;
    } else {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700';
      pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> <span>${label}</span>`;
    }
  }

  setLocalCameraPlaceholder(isOff) {
    const placeholder = document.getElementById('local-cam-off-avatar');
    const videoEl = document.getElementById('local-video-element');
    if (placeholder) {
      if (isOff) placeholder.classList.remove('hidden');
      else placeholder.classList.add('hidden');
    }
    if (videoEl) {
      if (isOff) videoEl.classList.add('opacity-0');
      else videoEl.classList.remove('opacity-0');
    }
  }

  setRemoteCameraPlaceholder(isOff) {
    const placeholder = document.getElementById('remote-cam-off-avatar');
    const videoEl = document.getElementById('remote-video-element');
    if (placeholder) {
      if (isOff) placeholder.classList.remove('hidden');
      else placeholder.classList.add('hidden');
    }
    if (videoEl) {
      if (isOff) videoEl.classList.add('opacity-0');
      else videoEl.classList.remove('opacity-0');
    }
  }

  updateLocalControlsUI() {
    const micBtn = document.getElementById('webrtc-toggle-mic-btn');
    const camBtn = document.getElementById('webrtc-toggle-cam-btn');
    const screenBtn = document.getElementById('webrtc-toggle-screen-btn');
    const micBadge = document.getElementById('local-mic-badge');

    if (micBtn) {
      if (this.isMuted) {
        micBtn.innerHTML = `<span>🔇</span> <span>Unmute</span>`;
        micBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 transition flex items-center gap-1.5';
      } else {
        micBtn.innerHTML = `<span>🎙</span> <span>Mute</span>`;
        micBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition flex items-center gap-1.5';
      }
    }

    if (micBadge) {
      if (this.isMuted) {
        micBadge.innerHTML = '🔇 Muted';
        micBadge.className = 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800';
      } else {
        micBadge.innerHTML = '🎙 On';
        micBadge.className = 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800';
      }
    }

    if (camBtn) {
      if (this.isCameraOff) {
        camBtn.innerHTML = `<span>🚫</span> <span>Cam On</span>`;
        camBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 transition flex items-center gap-1.5';
      } else {
        camBtn.innerHTML = `<span>📷</span> <span>Cam Off</span>`;
        camBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition flex items-center gap-1.5';
      }
    }

    if (screenBtn) {
      if (this.isScreenSharing) {
        screenBtn.innerHTML = `<span>⏹</span> <span>Stop Share</span>`;
        screenBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5';
      } else {
        screenBtn.innerHTML = `<span>🖥</span> <span>Share</span>`;
        screenBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition flex items-center gap-1.5';
      }
    }
  }

  updateRemoteParticipantUI(user) {
    const nameEl = document.getElementById('remote-participant-name');
    const roleEl = document.getElementById('remote-participant-role');
    const avatarNameEl = document.getElementById('remote-avatar-name');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role;
    if (avatarNameEl) avatarNameEl.textContent = user.name;
  }

  updateRemoteMediaStateUI(isMuted, isCameraOff, isScreenSharing) {
    const micBadge = document.getElementById('remote-mic-badge');
    if (micBadge) {
      if (isMuted) {
        micBadge.innerHTML = '🔇 Muted';
        micBadge.className = 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800';
      } else {
        micBadge.innerHTML = '🎙 On';
        micBadge.className = 'text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800';
      }
    }

    this.setRemoteCameraPlaceholder(isCameraOff);
  }

  destroy() {
    this.stopTestPreview();
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

window.webrtcManager = new WebRTCManager();
