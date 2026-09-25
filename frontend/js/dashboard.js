/**
 * Dashboard Controller for CodeArena
 * Renders dedicated workspaces for Admin, Interviewer, and Candidate roles.
 */
let userInterviews = [];
let currentFilter = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await Auth.requireAuth();
  if (!user) return;

  setupNavbar(user);

  if (user.role === 'ADMIN') {
    initAdminWorkspace();
  } else if (user.role === 'INTERVIEWER') {
    initInterviewerWorkspace();
  } else {
    initCandidateWorkspace();
  }
});

function setupNavbar(user) {
  const navContainer = document.getElementById('role-nav-links');
  if (!navContainer) return;

  if (user.role === 'ADMIN') {
    navContainer.innerHTML = `
      <a href="/views/dashboard.html" class="text-indigo-400 font-semibold">Overview</a>
      <a href="/views/problems.html" class="text-slate-400 hover:text-slate-200 transition">Question Catalog</a>
    `;
  } else if (user.role === 'INTERVIEWER') {
    navContainer.innerHTML = `
      <a href="/views/dashboard.html" class="text-indigo-400 font-semibold">My Interviews</a>
      <a href="/views/problems.html" class="text-slate-400 hover:text-slate-200 transition">Question Bank</a>
    `;
  } else {
    navContainer.innerHTML = `
      <a href="/views/dashboard.html" class="text-indigo-400 font-semibold">My Sessions</a>
      <a href="/views/problems.html" class="text-slate-400 hover:text-slate-200 transition">Practice Questions</a>
    `;
  }
}

/* =========================================================================
   1. ADMIN WORKSPACE LOGIC
   ========================================================================= */
async function initAdminWorkspace() {
  document.getElementById('admin-workspace-view')?.classList.remove('hidden');

  try {
    const statsRes = await API.admin.getStats();
    const stats = statsRes.data.stats;

    document.getElementById('admin-stat-users').textContent = stats.users.total;
    document.getElementById('admin-stat-user-breakdown').textContent = `${stats.users.candidates} Candidates • ${stats.users.interviewers} Interviewers • ${stats.users.admins} Admins`;
    document.getElementById('admin-stat-interviews').textContent = stats.interviews.total;
    document.getElementById('admin-stat-interview-breakdown').textContent = `${stats.interviews.active} Active • ${stats.interviews.scheduled} Scheduled`;
    document.getElementById('admin-stat-completed').textContent = stats.interviews.completed;
    document.getElementById('admin-stat-questions').textContent = stats.questions.total;

    loadAdminInterviews();
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

async function loadAdminInterviews() {
  const container = document.getElementById('admin-tab-interviews');
  if (!container) return;

  try {
    const res = await API.admin.getInterviews();
    const interviews = res.data.interviews || [];

    if (interviews.length === 0) {
      container.innerHTML = '<div class="glass-panel p-8 text-center text-slate-500 rounded-xl">No interviews recorded on the platform yet.</div>';
      return;
    }

    container.innerHTML = `
      <div class="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th class="p-3.5">Title</th>
              <th class="p-3.5">Interviewer</th>
              <th class="p-3.5">Candidate</th>
              <th class="p-3.5">Scheduled</th>
              <th class="p-3.5">Status</th>
              <th class="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 font-mono">
            ${interviews.map(i => `
              <tr class="hover:bg-slate-900/40 transition">
                <td class="p-3.5 font-sans font-semibold text-slate-200">${i.title}</td>
                <td class="p-3.5 text-slate-400">${i.interviewer?.name || 'Unassigned'}</td>
                <td class="p-3.5 text-slate-300 font-sans">${i.candidate?.name || 'No Candidate'}</td>
                <td class="p-3.5 text-slate-400">${formatDate(i.scheduledAt || i.createdAt)}</td>
                <td class="p-3.5">${renderStatusBadge(i.status)}</td>
                <td class="p-3.5 text-right font-sans">
                  ${i.status === 'COMPLETED' ? `
                    <a href="/views/replay.html?id=${i.id}" class="text-xs text-purple-400 hover:underline">Replay</a>
                  ` : `
                    <a href="/views/interview.html?id=${i.id}" class="text-xs text-indigo-400 hover:underline">Inspect Room</a>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-rose-950/40 text-rose-300 rounded-xl text-xs">${err.message}</div>`;
  }
}

async function loadAdminUsers() {
  const container = document.getElementById('admin-tab-users');
  if (!container) return;

  try {
    const res = await API.admin.getUsers();
    const users = res.data.users || [];

    container.innerHTML = `
      <div class="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th class="p-3.5">User</th>
              <th class="p-3.5">Email</th>
              <th class="p-3.5">Role</th>
              <th class="p-3.5">Joined Date</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 font-mono">
            ${users.map(u => `
              <tr class="hover:bg-slate-900/40 transition">
                <td class="p-3.5 font-sans font-semibold text-slate-200">${u.name}</td>
                <td class="p-3.5 text-slate-400">${u.email}</td>
                <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] ${u.role === 'ADMIN' ? 'bg-rose-950 text-rose-300 border border-rose-800' : u.role === 'INTERVIEWER' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-blue-950 text-blue-300 border border-blue-800'}">${u.role}</span></td>
                <td class="p-3.5 text-slate-500">${formatDate(u.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-rose-950/40 text-rose-300 rounded-xl text-xs">${err.message}</div>`;
  }
}

async function loadAdminActivity() {
  const container = document.getElementById('admin-tab-activity');
  if (!container) return;

  try {
    const res = await API.admin.getActivity();
    const activity = res.data.activity || [];

    if (activity.length === 0) {
      container.innerHTML = '<div class="glass-panel p-6 text-center text-slate-500 rounded-xl">No system events logged yet.</div>';
      return;
    }

    container.innerHTML = `
      <div class="glass-panel p-4 rounded-2xl border border-slate-800 divide-y divide-slate-800 space-y-2">
        ${activity.map(a => `
          <div class="pt-2 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[11px] text-slate-500">${new Date(a.timestamp).toLocaleTimeString()}</span>
              <span class="font-semibold text-slate-300">${a.user?.name || 'System'}</span>
              <span class="text-slate-400">performed <code class="text-indigo-300">${a.eventType}</code></span>
              ${a.interview ? `<span class="text-slate-500">in "${a.interview.title}"</span>` : ''}
            </div>
            <span class="text-[10px] text-slate-600 font-mono">${formatDate(a.timestamp)}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-rose-950/40 text-rose-300 rounded-xl text-xs">${err.message}</div>`;
  }
}

function switchAdminTab(tab) {
  const tabs = ['interviews', 'users', 'activity'];
  tabs.forEach(t => {
    const btn = document.getElementById(`admin-tab-${t}-btn`);
    const pane = document.getElementById(`admin-tab-${t}`);
    if (t === tab) {
      btn?.classList.add('bg-indigo-600', 'text-white');
      btn?.classList.remove('bg-slate-900', 'text-slate-400');
      pane?.classList.remove('hidden');
    } else {
      btn?.classList.remove('bg-indigo-600', 'text-white');
      btn?.classList.add('bg-slate-900', 'text-slate-400');
      pane?.classList.add('hidden');
    }
  });

  if (tab === 'interviews') loadAdminInterviews();
  if (tab === 'users') loadAdminUsers();
  if (tab === 'activity') loadAdminActivity();
}

window.switchAdminTab = switchAdminTab;

/* =========================================================================
   2. INTERVIEWER WORKSPACE LOGIC
   ========================================================================= */
async function initInterviewerWorkspace() {
  document.getElementById('interviewer-workspace-view')?.classList.remove('hidden');

  // Setup date picker default to today
  const dateInput = document.querySelector('input[name="scheduledDate"]');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.min = today;
  }

  loadInterviewerInterviews();
  loadCandidateSelector();
  loadQuestionLibraryModal();

  const createForm = document.getElementById('create-interview-form');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateInterview);
  }
}

async function loadInterviewerInterviews() {
  const container = document.getElementById('interviewer-interviews-list');
  if (!container) return;

  try {
    const res = await API.interviews.list();
    userInterviews = res.data.interviews || [];

    // Calculate metrics
    const scheduled = userInterviews.filter(i => i.status === 'SCHEDULED').length;
    const active = userInterviews.filter(i => i.status === 'ACTIVE').length;
    const completed = userInterviews.filter(i => i.status === 'COMPLETED').length;

    document.getElementById('interviewer-scheduled-count').textContent = scheduled;
    document.getElementById('interviewer-active-count').textContent = active;
    document.getElementById('interviewer-completed-count').textContent = completed;

    renderInterviewerCards(userInterviews);
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-rose-950/40 text-rose-300 rounded-xl text-xs">${err.message}</div>`;
  }
}

function renderInterviewerCards(interviews) {
  const container = document.getElementById('interviewer-interviews-list');
  if (!container) return;

  let filtered = interviews;
  if (currentFilter !== 'ALL') {
    filtered = interviews.filter(i => i.status === currentFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="glass-panel p-8 text-center text-slate-500 rounded-2xl">No interviews match this filter.</div>';
    return;
  }

  container.innerHTML = filtered.map(i => {
    const candidateName = i.candidate ? i.candidate.name : 'Unassigned Candidate';
    const candidateEmail = i.candidate ? i.candidate.email : '';
    const formattedDate = formatDate(i.scheduledAt || i.createdAt);

    return `
      <div class="glass-panel p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-800 hover:border-slate-700 transition">
        <div class="space-y-1.5 flex-1">
          <div class="flex items-center gap-3">
            <h3 class="text-base font-bold text-white">${i.title}</h3>
            ${renderStatusBadge(i.status)}
          </div>
          <p class="text-xs text-slate-400">${i.description || 'Live coding and technical evaluation round.'}</p>
          <div class="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
            <span><strong>Candidate:</strong> <span class="text-slate-200 font-medium">${candidateName}</span> (${candidateEmail})</span>
            <span><strong>Scheduled:</strong> <span class="font-mono text-slate-300">${formattedDate}</span></span>
            <span><strong>Duration:</strong> ${i.durationMinutes} mins</span>
            <span><strong>Questions:</strong> ${i.questions ? i.questions.length : 0} problems</span>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end md:self-center shrink-0">
          ${i.status === 'SCHEDULED' ? `
            <button onclick="cancelSession('${i.id}')" class="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-slate-800 transition">Cancel</button>
            <a href="/views/interview.html?id=${i.id}" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5">
              Enter Waiting Room
            </a>
          ` : i.status === 'ACTIVE' ? `
            <a href="/views/interview.html?id=${i.id}" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/25 transition animate-pulse flex items-center gap-1.5">
              Join Live Room
            </a>
          ` : i.status === 'COMPLETED' ? `
            <a href="/views/replay.html?id=${i.id}" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-purple-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5">
              Scorecard & Replay
            </a>
          ` : `
            <span class="text-xs text-slate-500 font-mono">Cancelled</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function filterInterviews(status) {
  currentFilter = status;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === status) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium filter-btn';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white filter-btn';
    }
  });
  renderInterviewerCards(userInterviews);
}

window.filterInterviews = filterInterviews;

async function cancelSession(id) {
  if (!confirm('Are you sure you want to cancel this scheduled interview?')) return;
  try {
    await API.interviews.cancel(id);
    loadInterviewerInterviews();
  } catch (e) {
    alert(e.message);
  }
}

window.cancelSession = cancelSession;

/* =========================================================================
   3. CANDIDATE WORKSPACE LOGIC
   ========================================================================= */
async function initCandidateWorkspace() {
  document.getElementById('candidate-workspace-view')?.classList.remove('hidden');

  await loadCandidatePracticeDashboard();
  loadCandidateInterviews();
}

async function loadCandidatePracticeDashboard() {
  const practiceContainer = document.getElementById('candidate-practice-list');
  if (!practiceContainer) return;

  try {
    const res = await API.practice.getDashboard();
    const stats = res.data.stats || { saved: 0, attempted: 0, solved: 0 };
    const list = res.data.practiceList || [];

    const savedEl = document.getElementById('candidate-stat-saved');
    const attemptedEl = document.getElementById('candidate-stat-attempted');
    const solvedEl = document.getElementById('candidate-stat-solved');

    if (savedEl) savedEl.textContent = stats.saved;
    if (attemptedEl) attemptedEl.textContent = stats.attempted;
    if (solvedEl) solvedEl.textContent = stats.solved;

    if (list.length === 0) {
      practiceContainer.innerHTML = `
        <div class="glass-panel p-6 text-center text-slate-500 rounded-xl border border-slate-800">
          No practice problems bookmarked yet. <a href="/views/problems.html" class="text-indigo-400 hover:underline">Explore the question catalog</a> to start practicing.
        </div>
      `;
      return;
    }

    practiceContainer.innerHTML = `
      <div class="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th class="p-3.5">Problem</th>
              <th class="p-3.5">Category</th>
              <th class="p-3.5">Difficulty</th>
              <th class="p-3.5">Status</th>
              <th class="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 font-mono">
            ${list.map(item => `
              <tr class="hover:bg-slate-900/40 transition">
                <td class="p-3.5 font-sans font-semibold text-slate-200">
                  <div class="flex items-center gap-2">
                    <span>${item.question.title}</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-indigo-300 font-mono">${item.question.type}</span>
                  </div>
                </td>
                <td class="p-3.5 text-slate-400 font-sans">${item.question.category || 'General'}</td>
                <td class="p-3.5">
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono ${
                    item.question.difficulty === 'EASY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    item.question.difficulty === 'MEDIUM' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                    'bg-rose-950 text-rose-400 border border-rose-800'
                  }">${item.question.difficulty}</span>
                </td>
                <td class="p-3.5">
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    item.status === 'SOLVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    item.status === 'ATTEMPTED' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                    'bg-slate-800 text-slate-300 border border-slate-700'
                  }">${item.status}</span>
                </td>
                <td class="p-3.5 text-right font-sans">
                  <a href="/views/practice.html?id=${item.question.id}" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition">
                    ${item.status === 'SOLVED' ? 'Practice Again' : 'Solve Now &rarr;'}
                  </a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.warn('Failed to load candidate practice stats:', err);
  }
}

async function loadCandidateInterviews() {
  const container = document.getElementById('candidate-interviews-list');
  if (!container) return;

  try {
    const res = await API.interviews.list();
    const interviews = res.data.interviews || [];

    if (interviews.length === 0) {
      container.innerHTML = `
        <div class="glass-panel p-8 text-center text-slate-400 rounded-2xl">
          <div class="text-xl mb-2">📋</div>
          <h3 class="font-bold text-slate-200">No scheduled technical rounds</h3>
          <p class="text-xs text-slate-500 mt-1">When an interviewer schedules a technical round with you, it will appear here with joining instructions.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = interviews.map(i => {
      const interviewerName = i.interviewer ? i.interviewer.name : 'Technical Interviewer';
      const formattedDate = formatDate(i.scheduledAt || i.createdAt);

      return `
        <div class="glass-panel p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-800 hover:border-slate-700 transition">
          <div class="space-y-1.5 flex-1">
            <div class="flex items-center gap-3">
              <h3 class="text-base font-bold text-white">${i.title}</h3>
              ${renderStatusBadge(i.status)}
            </div>
            <p class="text-xs text-slate-400">${i.description || 'Real-time collaborative technical screen.'}</p>
            <div class="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span><strong>Interviewer:</strong> <span class="text-slate-200 font-medium">${interviewerName}</span></span>
              <span><strong>Scheduled Date:</strong> <span class="font-mono text-slate-300">${formattedDate}</span></span>
              <span><strong>Duration:</strong> ${i.durationMinutes} mins</span>
              <span><strong>Questions:</strong> ${i.questions ? i.questions.length : 0} problems</span>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end md:self-center shrink-0">
            ${i.status === 'ACTIVE' ? `
              <a href="/views/interview.html?id=${i.id}" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition animate-pulse flex items-center gap-1.5">
                Join Interview Room
              </a>
            ` : i.status === 'SCHEDULED' ? `
              <div class="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2 font-mono">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Room opens when started
              </div>
            ` : `
              <span class="text-xs text-slate-500 font-mono">Assessment Completed</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-rose-950/40 text-rose-300 rounded-xl text-xs">${err.message}</div>`;
  }
}

/* =========================================================================
   MODAL & INTERVIEW CREATION HELPERS
   ========================================================================= */
let selectedQuestionsOrdered = [];

async function loadCandidateSelector() {
  const select = document.getElementById('modal-candidate-select');
  if (!select) return;

  try {
    const res = await API.interviews.getCandidates();
    const candidates = res.data.candidates || [];

    if (candidates.length === 0) {
      select.innerHTML = '<option value="">No registered candidates found</option>';
      return;
    }

    select.innerHTML = '<option value="">Select a registered candidate...</option>' +
      candidates.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('');
  } catch (e) {
    select.innerHTML = '<option value="">Failed to load candidate list</option>';
  }
}

async function loadQuestionLibraryModal() {
  const container = document.getElementById('modal-questions-list');
  const counterEl = document.getElementById('selected-questions-counter');
  if (!container) return;

  try {
    const res = await API.questions.list();
    const questions = res.data.questions || [];
    selectedQuestionsOrdered = [];

    container.innerHTML = questions.map((q, idx) => `
      <label class="flex items-start gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition" id="label-q-${q.id}">
        <input type="checkbox" name="questionIds" value="${q.id}" class="mt-1 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900 question-checkbox" />
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="question-seq-badge hidden px-1.5 py-0.2 rounded bg-indigo-600 text-white font-mono text-[10px] font-bold"></span>
            <span class="font-medium text-slate-200 text-xs">${q.title}</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-indigo-300 font-mono border border-slate-800">${q.type}</span>
            <span class="text-[10px] px-2 py-0.5 rounded font-mono ${q.difficulty === 'EASY' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}">${q.difficulty}</span>
          </div>
          <p class="text-[11px] text-slate-400 mt-1 line-clamp-1">${q.description.replace(/[#*`]/g, '')}</p>
        </div>
      </label>
    `).join('');

    // Bind checkboxes to ordered list and counter
    const checkboxes = container.querySelectorAll('.question-checkbox');
    const updateSelectionUI = () => {
      checkboxes.forEach(cb => {
        const qid = cb.value;
        const parent = document.getElementById(`label-q-${qid}`);
        const badge = parent?.querySelector('.question-seq-badge');
        const pos = selectedQuestionsOrdered.indexOf(qid);
        if (pos !== -1) {
          cb.checked = true;
          if (badge) {
            badge.textContent = `Q${pos + 1}`;
            badge.classList.remove('hidden');
          }
        } else {
          cb.checked = false;
          if (badge) badge.classList.add('hidden');
        }
      });
      if (counterEl) counterEl.textContent = `Selected: ${selectedQuestionsOrdered.length} questions`;
    };

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const qid = cb.value;
        if (cb.checked) {
          if (!selectedQuestionsOrdered.includes(qid)) {
            selectedQuestionsOrdered.push(qid);
          }
        } else {
          selectedQuestionsOrdered = selectedQuestionsOrdered.filter(id => id !== qid);
        }
        updateSelectionUI();
      });
    });

    // Default select first two questions in sequence
    if (questions.length > 0) selectedQuestionsOrdered.push(questions[0].id);
    if (questions.length > 1) selectedQuestionsOrdered.push(questions[1].id);
    updateSelectionUI();

  } catch (e) {
    container.innerHTML = '<p class="text-xs text-slate-500 p-2">Failed to load question templates.</p>';
  }
}

async function handleCreateInterview(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById('create-error');
  const submitBtn = document.getElementById('create-submit-btn');

  if (errorEl) errorEl.classList.add('hidden');

  const title = form.title.value.trim();
  const description = form.description.value.trim();
  const candidateId = form.candidateId.value;
  const durationMinutes = Number(form.durationMinutes.value || 60);
  const scheduledDate = form.scheduledDate.value;
  const scheduledTime = form.scheduledTime.value;

  const questionIds = selectedQuestionsOrdered.length > 0 ? selectedQuestionsOrdered : Array.from(form.querySelectorAll('input[name="questionIds"]:checked')).map(cb => cb.value);

  if (!candidateId) {
    showCreateError('Please select a candidate for this interview round.');
    return;
  }

  if (questionIds.length === 0) {
    showCreateError('Please select at least one question to assign.');
    return;
  }

  let scheduledAt = new Date();
  if (scheduledDate && scheduledTime) {
    scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Scheduling...';

  try {
    await API.interviews.create({
      title,
      description,
      candidateId,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
      questionIds
    });

    closeModal('create-interview-modal');
    form.reset();
    loadInterviewerInterviews();
  } catch (err) {
    showCreateError(err.message || 'Failed to schedule interview.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Schedule Session';
  }
}

function showCreateError(msg) {
  const errorEl = document.getElementById('create-error');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  }
}

function renderStatusBadge(status) {
  const map = {
    DRAFT: 'bg-slate-800 text-slate-300 border-slate-700',
    SCHEDULED: 'bg-blue-950 text-blue-400 border-blue-800',
    ACTIVE: 'bg-emerald-950 text-emerald-400 border-emerald-800 animate-pulse',
    COMPLETED: 'bg-purple-950 text-purple-400 border-purple-800',
    CANCELLED: 'bg-rose-950 text-rose-400 border-rose-800'
  };
  return `<span class="px-2 py-0.5 text-[11px] font-semibold rounded border ${map[status] || 'bg-slate-800 text-slate-300'}">${status}</span>`;
}

function formatDate(isoStr) {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

window.openModal = openModal;
window.closeModal = closeModal;
