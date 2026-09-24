/**
 * Interview Replay Player Controller for CodeArena
 */
let replayData = null;
let currentEventIndex = 0;
let isPlaying = false;
let playbackSpeed = 1;
let playInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const interviewId = urlParams.get('id');

  if (!interviewId) {
    alert('No interview ID specified.');
    window.location.href = '/views/dashboard.html';
    return;
  }

  const user = await Auth.requireAuth();
  if (!user) return;

  try {
    const res = await API.replay.get(interviewId);
    replayData = res.data;

    renderReplayHeader(replayData);
    await initReplayEditor();
    renderTimeline(replayData.events);
    setupControls();

    if (replayData.events.length > 0) {
      applyEvent(0);
    }
  } catch (err) {
    alert(`Failed to load replay data: ${err.message}`);
    window.location.href = '/views/dashboard.html';
  }
});

function renderReplayHeader(data) {
  document.getElementById('replay-title').textContent = data.interview.title;
  document.getElementById('replay-candidate').textContent = data.interview.candidate ? data.interview.candidate.name : 'Unknown Candidate';
  document.getElementById('replay-interviewer').textContent = data.interview.interviewer ? data.interview.interviewer.name : 'Interviewer';
  document.getElementById('total-events-count').textContent = data.events.length;
}

async function initReplayEditor() {
  await codeEditor.init('replay-editor-container', '// Code will replay here...\n', 'javascript');
}

function renderTimeline(events) {
  const container = document.getElementById('events-stream');
  const slider = document.getElementById('replay-slider');

  if (slider) {
    slider.max = Math.max(0, events.length - 1);
    slider.value = 0;
  }

  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = '<div class="p-4 text-xs text-slate-500">No events logged for this session.</div>';
    return;
  }

  container.innerHTML = events.map((ev, idx) => {
    const timeStr = new Date(ev.timestamp).toLocaleTimeString();
    const eventBadge = getEventBadge(ev.eventType);

    return `
      <div id="event-row-${idx}" class="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 cursor-pointer hover:border-slate-700 transition event-item" onclick="jumpToEvent(${idx})">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-mono text-slate-400">${timeStr}</span>
          ${eventBadge}
        </div>
        <div class="text-xs text-slate-300 font-medium">
          ${ev.user ? ev.user.name : 'System'}: <span class="text-slate-400 font-normal">${formatEventSummary(ev)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function getEventBadge(type) {
  const map = {
    USER_JOINED: 'bg-blue-950 text-blue-400 border-blue-800',
    RUN_CODE: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    SUBMISSION: 'bg-purple-950 text-purple-400 border-purple-800 font-bold',
    CHAT_MESSAGE: 'bg-slate-800 text-slate-300 border-slate-700',
    QUESTION_CHANGED: 'bg-amber-950 text-amber-400 border-amber-800',
    EVALUATION_SUBMITTED: 'bg-rose-950 text-rose-400 border-rose-800'
  };
  return `<span class="px-1.5 py-0.5 text-[10px] rounded border ${map[type] || 'bg-slate-800 text-slate-300'}">${type}</span>`;
}

function formatEventSummary(ev) {
  if (ev.eventType === 'RUN_CODE') {
    return `Ran tests (${ev.payload?.passedCount || 0}/${ev.payload?.totalCount || 0} passed)`;
  }
  if (ev.eventType === 'SUBMISSION') {
    return `Submitted solution (${ev.payload?.status || 'SUBMITTED'})`;
  }
  if (ev.eventType === 'CHAT_MESSAGE') {
    return `"${ev.payload?.message || ''}"`;
  }
  if (ev.eventType === 'QUESTION_CHANGED') {
    return `Switched to question ${ev.payload?.order || ''}`;
  }
  return ev.eventType.replace(/_/g, ' ');
}

function applyEvent(index) {
  if (!replayData || !replayData.events || index < 0 || index >= replayData.events.length) return;
  currentEventIndex = index;

  // Highlight active event in list
  document.querySelectorAll('.event-item').forEach(el => el.classList.remove('border-indigo-500', 'bg-indigo-950/30'));
  const activeEl = document.getElementById(`event-row-${index}`);
  if (activeEl) {
    activeEl.classList.add('border-indigo-500', 'bg-indigo-950/30');
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Update slider
  const slider = document.getElementById('replay-slider');
  if (slider) slider.value = index;

  const currentEvent = replayData.events[index];
  document.getElementById('current-step-display').textContent = `Event ${index + 1} of ${replayData.events.length}`;

  // Find nearest code state
  // Check if session code versions exist
  if (replayData.codingSessions && replayData.codingSessions.length > 0) {
    const session = replayData.codingSessions[0];
    const eventTime = new Date(currentEvent.timestamp).getTime();

    // Look for a version at or prior to this event
    const versions = session.versions || [];
    let bestVersion = null;
    for (const v of versions) {
      if (new Date(v.timestamp).getTime() <= eventTime) {
        bestVersion = v;
      }
    }

    if (bestVersion) {
      codeEditor.setCode(bestVersion.code);
    } else if (session.currentCode) {
      codeEditor.setCode(session.currentCode);
    }
  }
}

function setupControls() {
  const playBtn = document.getElementById('play-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const slider = document.getElementById('replay-slider');
  const speedSelect = document.getElementById('speed-select');

  playBtn?.addEventListener('click', togglePlay);
  prevBtn?.addEventListener('click', () => {
    pause();
    applyEvent(Math.max(0, currentEventIndex - 1));
  });
  nextBtn?.addEventListener('click', () => {
    pause();
    applyEvent(Math.min(replayData.events.length - 1, currentEventIndex + 1));
  });

  slider?.addEventListener('input', (e) => {
    pause();
    applyEvent(Number(e.target.value));
  });

  speedSelect?.addEventListener('change', (e) => {
    playbackSpeed = Number(e.target.value);
    if (isPlaying) {
      pause();
      play();
    }
  });
}

function togglePlay() {
  if (isPlaying) {
    pause();
  } else {
    play();
  }
}

function play() {
  if (!replayData || replayData.events.length === 0) return;
  isPlaying = true;
  document.getElementById('play-icon').textContent = '⏸';

  const intervalTime = 1500 / playbackSpeed;
  playInterval = setInterval(() => {
    if (currentEventIndex >= replayData.events.length - 1) {
      pause();
      return;
    }
    applyEvent(currentEventIndex + 1);
  }, intervalTime);
}

function pause() {
  isPlaying = false;
  if (playInterval) clearInterval(playInterval);
  const icon = document.getElementById('play-icon');
  if (icon) icon.textContent = '▶';
}

function jumpToEvent(index) {
  pause();
  applyEvent(index);
}

window.jumpToEvent = jumpToEvent;
