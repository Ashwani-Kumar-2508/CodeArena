/**
 * Real-Time Collaborative Interview Room Controller for CodeArena
 */
let interviewData = null;
let activeQuestionIndex = 0;
let timerInterval = null;
let serverClockOffset = 0; // Difference between server timestamp and client local clock

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const interviewId = urlParams.get('id');

  const loadingOverlay = document.getElementById('room-loading-overlay');
  const deniedOverlay = document.getElementById('room-denied-overlay');
  const deniedMessage = document.getElementById('room-denied-message');

  window.onRoomSecurityError = (msg) => {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (deniedOverlay) {
      if (deniedMessage) deniedMessage.textContent = msg;
      deniedOverlay.classList.remove('hidden');
    }
  };

  if (!interviewId) {
    window.onRoomSecurityError('No interview ID was specified in the URL.');
    return;
  }

  window.currentInterviewId = interviewId;

  // 1. Authenticate user
  const user = await Auth.requireAuth();
  if (!user) return;

  // 2. Fetch interview data and verify authorization
  try {
    const res = await API.interviews.get(interviewId);
    interviewData = res.data.interview;

    renderRoomHeader(interviewData, user);
    setupRolePermissions(interviewData, user);
    setupQuestionsNavigation();
    setupChat();
    setupEvaluationDrawer(user);

    // 3. Connect real-time socket and join room
    initRealtime(interviewId, user);

    // 4. Initialize Monaco Editor with starter code of first question
    const initialQuestion = getActiveQuestion();
    const starterCode = initialQuestion ? (initialQuestion.defaultCodeSnippet || '// Start coding your solution here...\n') : '';
    await codeEditor.init('monaco-editor-container', starterCode, initialQuestion?.language || 'javascript');

    // 5. Bind local editor changes to real-time sync
    codeEditor.onContentChange((code, changes) => {
      realtime.sendCodeChange(interviewId, code, changes);
    });

    // 6. Bind Run Code and Submit handlers
    codeEditor.onRunCallback = handleRunCode;
    document.getElementById('run-code-btn')?.addEventListener('click', handleRunCode);
    document.getElementById('submit-code-btn')?.addEventListener('click', handleSubmitCode);

    // 7. Check if interview is currently active
    if (interviewData.status === 'ACTIVE' && interviewData.startedAt) {
      startCountdown(interviewData.startedAt, interviewData.durationMinutes);
    } else if (interviewData.status === 'COMPLETED') {
      const timerEl = document.getElementById('timer-display');
      if (timerEl) timerEl.textContent = 'CONCLUDED';
    }

    // Dismiss loading overlay
    if (loadingOverlay) loadingOverlay.classList.add('hidden');

  } catch (err) {
    console.error('Failed to initialize interview room:', err);
    window.onRoomSecurityError(err.message || 'You do not have permission to access this interview room.');
  }
});

function getActiveQuestion() {
  if (!interviewData || !interviewData.questions || interviewData.questions.length === 0) return null;
  return interviewData.questions[activeQuestionIndex]?.question || null;
}

function renderRoomHeader(interview, user) {
  const titleEl = document.getElementById('room-title');
  if (titleEl) titleEl.textContent = interview.title;

  const statusBadge = document.getElementById('interview-status-badge');
  if (statusBadge) {
    statusBadge.textContent = interview.status;
    statusBadge.className = `px-2 py-0.5 text-xs font-semibold rounded ${
      interview.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse' :
      interview.status === 'COMPLETED' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
      'bg-slate-800 text-slate-300 border border-slate-700'
    }`;
  }
}

function setupRolePermissions(interview, user) {
  const isInterviewer = user.role === 'INTERVIEWER' || user.role === 'ADMIN';
  const startBtn = document.getElementById('start-session-btn');
  const endBtn = document.getElementById('end-session-btn');
  const evalToggleBtn = document.getElementById('toggle-eval-drawer-btn');
  const interviewerNotesSection = document.getElementById('interviewer-notes-section');
  const requestHintBtn = document.getElementById('request-hint-btn');

  if (isInterviewer) {
    if (startBtn && interview.status === 'SCHEDULED') startBtn.classList.remove('hidden');
    if (endBtn && interview.status === 'ACTIVE') endBtn.classList.remove('hidden');
    if (evalToggleBtn) evalToggleBtn.classList.remove('hidden');
    if (interviewerNotesSection) interviewerNotesSection.classList.remove('hidden');
    if (requestHintBtn) requestHintBtn.classList.add('hidden');

    startBtn?.addEventListener('click', async () => {
      startBtn.disabled = true;
      try {
        await API.interviews.start(interview.id);
        realtime.startInterviewTimer(interview.id, interview.durationMinutes);
        startBtn.classList.add('hidden');
        if (endBtn) endBtn.classList.remove('hidden');
        startCountdown(new Date(), interview.durationMinutes);
      } catch (e) {
        alert(e.message);
        startBtn.disabled = false;
      }
    });

    endBtn?.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to conclude this technical interview? This will freeze code and record the final state.')) return;
      endBtn.disabled = true;
      try {
        await API.interviews.end(interview.id);
        realtime.endInterviewSession(interview.id);
        clearInterval(timerInterval);
        document.getElementById('timer-display').textContent = 'CONCLUDED';
        endBtn.classList.add('hidden');
        alert('Interview concluded. Please complete the candidate evaluation scorecard.');
        openEvaluationDrawer();
      } catch (e) {
        alert(e.message);
        endBtn.disabled = false;
      }
    });
  } else {
    // Candidate controls
    if (startBtn) startBtn.classList.add('hidden');
    if (endBtn) endBtn.classList.add('hidden');
    if (evalToggleBtn) evalToggleBtn.classList.add('hidden');
    if (interviewerNotesSection) interviewerNotesSection.classList.add('hidden');
    if (requestHintBtn) requestHintBtn.classList.remove('hidden');

    requestHintBtn?.addEventListener('click', () => {
      const q = getActiveQuestion();
      if (q) {
        realtime.requestHint(interview.id, q.id);
        requestHintBtn.textContent = 'Hint Requested';
        requestHintBtn.disabled = true;
      }
    });
  }
}

function initRealtime(interviewId, user) {
  const socket = realtime.connect();
  if (!socket) return;

  realtime.joinRoom(interviewId);

  // Synchronize server clock
  socket.on('session_init', ({ serverTime, startedAt, durationMinutes, status }) => {
    if (serverTime) {
      serverClockOffset = serverTime - Date.now();
    }
    if (status === 'ACTIVE' && startedAt) {
      startCountdown(startedAt, durationMinutes);
    }
  });

  // Presence updates
  socket.on('participants_update', (participants) => {
    const listEl = document.getElementById('participants-list');
    if (!listEl) return;
    listEl.innerHTML = participants.map(p => `
      <div class="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-slate-900/60 border border-slate-800">
        <span class="flex items-center gap-2 text-slate-300">
          <span class="w-2 h-2 rounded-full ${p.role === 'INTERVIEWER' ? 'bg-purple-400' : p.role === 'ADMIN' ? 'bg-rose-400' : 'bg-emerald-400'}"></span>
          ${p.name}
        </span>
        <span class="text-[10px] text-slate-500 font-mono">${p.role}</span>
      </div>
    `).join('');
  });

  // Remote code updates
  socket.on('code_update', ({ code }) => {
    codeEditor.setCode(code);
  });

  socket.on('code_sync', ({ code }) => {
    if (code) codeEditor.setCode(code);
  });

  // Remote cursor
  socket.on('remote_cursor', ({ position, userName, userRole }) => {
    codeEditor.setRemoteCursor(position, userName, userRole);
  });

  // Session lifecycle events
  socket.on('interview_started', ({ startedAt, durationMinutes, serverTime }) => {
    if (serverTime) serverClockOffset = serverTime - Date.now();
    startCountdown(startedAt, durationMinutes);
    const badge = document.getElementById('interview-status-badge');
    if (badge) {
      badge.textContent = 'ACTIVE';
      badge.className = 'px-2 py-0.5 text-xs font-semibold rounded bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse';
    }
    const startBtn = document.getElementById('start-session-btn');
    const endBtn = document.getElementById('end-session-btn');
    if (startBtn) startBtn.classList.add('hidden');
    if (endBtn && (user.role === 'INTERVIEWER' || user.role === 'ADMIN')) endBtn.classList.remove('hidden');
  });

  socket.on('interview_ended', () => {
    clearInterval(timerInterval);
    const timerEl = document.getElementById('timer-display');
    if (timerEl) timerEl.textContent = 'CONCLUDED';
    const badge = document.getElementById('interview-status-badge');
    if (badge) {
      badge.textContent = 'COMPLETED';
      badge.className = 'px-2 py-0.5 text-xs font-semibold rounded bg-purple-950 text-purple-300 border border-purple-800';
    }
    const endBtn = document.getElementById('end-session-btn');
    if (endBtn) endBtn.classList.add('hidden');
  });

  // Question switched by interviewer
  socket.on('question_switched', ({ questionId, order }) => {
    const targetIdx = interviewData.questions.findIndex(iq => iq.question.id === questionId);
    if (targetIdx !== -1) {
      activeQuestionIndex = targetIdx;
      renderActiveQuestion();
      setupQuestionsNavigation();
    }
  });

  // Hints
  socket.on('hint_requested', ({ candidateName }) => {
    if (user.role === 'INTERVIEWER' || user.role === 'ADMIN') {
      const q = getActiveQuestion();
      if (q && q.hints && q.hints.length > 0) {
        if (confirm(`${candidateName} requested a hint. Would you like to reveal hint 1?`)) {
          realtime.revealHint(interviewId, q.hints[0], 0);
        }
      }
    }
  });

  socket.on('hint_revealed', ({ hint }) => {
    const hintBox = document.getElementById('revealed-hints-box');
    if (hintBox) {
      hintBox.classList.remove('hidden');
      hintBox.innerHTML += `<div class="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded text-xs text-amber-200 mt-2">💡 <strong>Interviewer Hint:</strong> ${hint}</div>`;
    }
  });

  // Chat messages
  socket.on('new_chat', (chatData) => {
    appendChatMessage(chatData);
  });
}

function startCountdown(startedAt, durationMinutes) {
  if (timerInterval) clearInterval(timerInterval);
  const startTime = new Date(startedAt).getTime();
  const totalMs = durationMinutes * 60 * 1000;

  function update() {
    // Current time synchronized with server clock offset
    const currentServerTime = Date.now() + serverClockOffset;
    const elapsed = currentServerTime - startTime;
    const remaining = totalMs - elapsed;

    if (remaining <= 0) {
      clearInterval(timerInterval);
      document.getElementById('timer-display').textContent = '00:00 (Time Up)';
      return;
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const timerEl = document.getElementById('timer-display');
    if (timerEl) {
      timerEl.textContent = display;
      if (mins < 5) {
        timerEl.className = 'font-mono font-bold text-rose-400 animate-pulse';
      }
    }
  }

  update();
  timerInterval = setInterval(update, 1000);
}

function setupQuestionsNavigation() {
  const tabsContainer = document.getElementById('question-tabs');
  if (!tabsContainer || !interviewData.questions) return;

  tabsContainer.innerHTML = interviewData.questions.map((iq, idx) => `
    <button class="px-2.5 py-1 text-xs font-medium rounded-lg transition ${idx === activeQuestionIndex ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}" data-index="${idx}">
      Q${idx + 1}: ${iq.question.title}
    </button>
  `).join('');

  tabsContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      activeQuestionIndex = idx;
      renderActiveQuestion();
      setupQuestionsNavigation();

      // If interviewer, synchronize question view across room
      if (window.currentUser.role === 'INTERVIEWER' || window.currentUser.role === 'ADMIN') {
        const q = getActiveQuestion();
        if (q) realtime.switchQuestion(interviewData.id, q.id, idx + 1);
      }
    });
  });

  renderActiveQuestion();
}

function renderActiveQuestion() {
  const q = getActiveQuestion();
  if (!q) return;

  document.getElementById('question-title').textContent = q.title;
  document.getElementById('question-badge-type').textContent = q.type;
  document.getElementById('question-badge-diff').textContent = q.difficulty;
  document.getElementById('question-description').innerHTML = formatMarkdown(q.description);

  // Set editor starter snippet if editor is empty or at default
  const currentCode = codeEditor.getCode().trim();
  if (!currentCode || currentCode.startsWith('// Start coding') || currentCode.startsWith('/**')) {
    if (q.defaultCodeSnippet) {
      codeEditor.setCode(q.defaultCodeSnippet);
    }
  }
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-slate-200 mt-3 mb-1">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-xs font-semibold text-slate-300 mt-2 mb-1">$1</h4>')
    .replace(/```javascript([\s\S]*?)```/gim, '<pre class="bg-slate-900 border border-slate-800 rounded p-2.5 text-xs font-mono text-emerald-400 overflow-x-auto my-2">$1</pre>')
    .replace(/```([\s\S]*?)```/gim, '<pre class="bg-slate-900 border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-300 overflow-x-auto my-2">$1</pre>')
    .replace(/`([^`]+)`/gim, '<code class="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[11px]">$1</code>')
    .replace(/\n/gim, '<br/>');
}

async function handleRunCode() {
  const q = getActiveQuestion();
  if (!q) return;

  const runBtn = document.getElementById('run-code-btn');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = `<span class="animate-spin inline-block mr-1">↻</span> Running...`;
  }

  const resultsPanel = document.getElementById('test-results-container');
  resultsPanel.innerHTML = '<div class="text-xs text-slate-400 p-3">Executing visible test cases in isolated sandbox...</div>';

  try {
    const code = codeEditor.getCode();
    const res = await API.code.run({
      interviewId: interviewData.id,
      questionId: q.id,
      code,
      language: q.language || 'javascript'
    });

    renderTestResults(res.data);
  } catch (err) {
    resultsPanel.innerHTML = `<div class="p-3 text-xs text-rose-400 bg-rose-950/30 border border-rose-800 rounded">Execution error: ${err.message}</div>`;
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = `<span>▶</span> Run Tests`;
    }
  }
}

async function handleSubmitCode() {
  const q = getActiveQuestion();
  if (!q) return;

  if (!confirm('Are you ready to submit your solution? This evaluates your code against the complete test suite including hidden test cases.')) return;

  const submitBtn = document.getElementById('submit-code-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="animate-spin inline-block mr-1">↻</span> Submitting...`;
  }

  const resultsPanel = document.getElementById('test-results-container');
  resultsPanel.innerHTML = '<div class="text-xs text-slate-400 p-3">Evaluating full test suite...</div>';

  try {
    const code = codeEditor.getCode();
    const res = await API.code.submit({
      interviewId: interviewData.id,
      questionId: q.id,
      code,
      language: q.language || 'javascript'
    });

    renderTestResults(res.data, true);
  } catch (err) {
    resultsPanel.innerHTML = `<div class="p-3 text-xs text-rose-400 bg-rose-950/30 border border-rose-800 rounded">Submission error: ${err.message}</div>`;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>✔</span> Submit Solution`;
    }
  }
}

function renderTestResults(data, isSubmission = false) {
  const container = document.getElementById('test-results-container');
  const summaryEl = document.getElementById('test-summary-badge');

  if (summaryEl) {
    summaryEl.textContent = `${data.passedCount}/${data.totalCount} Passed`;
    summaryEl.className = `text-xs px-2 py-0.5 rounded font-mono font-semibold ${
      data.passedCount === data.totalCount && data.totalCount > 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
    }`;
  }

  const testList = data.results || [];
  if (testList.length === 0) {
    container.innerHTML = `<div class="p-3 text-xs text-slate-400">No test cases configured for this problem.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="space-y-2">
      ${testList.map((t, idx) => `
        <div class="p-2.5 rounded border ${t.passed ? 'bg-emerald-950/20 border-emerald-900/60' : 'bg-rose-950/20 border-rose-900/60'}">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="font-medium text-slate-300 flex items-center gap-1.5">
              ${t.passed ? '✅' : '❌'} Case ${idx + 1} ${t.isHidden ? '<span class="text-[10px] text-amber-400 font-mono">[Hidden Verification Test]</span>' : ''}
            </span>
            <span class="font-mono text-[11px] text-slate-500">${t.executionTimeMs}ms</span>
          </div>
          ${t.error ? `<div class="text-xs font-mono text-rose-400 mt-1">${t.error}</div>` : ''}
          ${!t.isHidden || window.currentUser.role !== 'CANDIDATE' ? `
            <div class="grid grid-cols-2 gap-2 text-[11px] font-mono mt-1 text-slate-400">
              <div>Input: <span class="text-slate-200">${t.input}</span></div>
              <div>Expected: <span class="text-slate-200">${t.expectedOutput}</span></div>
              <div>Actual: <span class="${t.passed ? 'text-emerald-400' : 'text-rose-400'}">${t.actualOutput}</span></div>
            </div>
          ` : `
            <div class="text-[11px] text-slate-500 italic mt-1">Hidden test case inputs and expected outputs are confidential.</div>
          `}
        </div>
      `).join('')}
    </div>
  `;
}

function setupChat() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    realtime.sendChat(interviewData.id, msg);
    input.value = '';
  });
}

function appendChatMessage(data) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const isMe = data.userId === window.currentUser.id;
  const el = document.createElement('div');
  el.className = `flex flex-col text-xs mb-2 ${isMe ? 'items-end' : 'items-start'}`;
  el.innerHTML = `
    <span class="text-[10px] text-slate-500 mb-0.5">${data.userName} (${data.userRole})</span>
    <div class="px-3 py-1.5 rounded-lg max-w-[85%] ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}">
      ${data.message}
    </div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function setupEvaluationDrawer(user) {
  const drawer = document.getElementById('evaluation-drawer');
  const toggleBtn = document.getElementById('toggle-eval-drawer-btn');
  const closeBtn = document.getElementById('close-eval-drawer-btn');
  const form = document.getElementById('evaluation-form');

  toggleBtn?.addEventListener('click', () => drawer?.classList.toggle('translate-x-full'));
  closeBtn?.addEventListener('click', () => drawer?.classList.add('translate-x-full'));

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      interviewId: interviewData.id,
      overallScore: Number(form.overallScore.value),
      problemSolvingScore: Number(form.problemSolvingScore.value),
      codeQualityScore: Number(form.codeQualityScore.value),
      communicationScore: Number(form.communicationScore.value),
      recommendation: form.recommendation.value,
      strengths: form.strengths.value,
      improvements: form.improvements.value,
      feedback: form.feedback.value
    };

    try {
      await API.evaluations.create(payload);
      alert('Candidate evaluation scorecard submitted successfully!');
      drawer?.classList.add('translate-x-full');
    } catch (err) {
      alert(`Failed to submit evaluation: ${err.message}`);
    }
  });
}

function openEvaluationDrawer() {
  document.getElementById('evaluation-drawer')?.classList.remove('translate-x-full');
}
