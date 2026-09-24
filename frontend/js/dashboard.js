/**
 * Dashboard Controller for CodeArena
 */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Auth.requireAuth();
  if (!user) return;

  renderDashboardHeader(user);
  loadInterviews();
  loadQuestionLibraryModal();

  // Bind Create Interview Form
  const createForm = document.getElementById('create-interview-form');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateInterview);
  }
});

function renderDashboardHeader(user) {
  const titleEl = document.getElementById('dashboard-title');
  const subtitleEl = document.getElementById('dashboard-subtitle');
  const actionBtn = document.getElementById('new-interview-btn');

  if (user.role === 'INTERVIEWER' || user.role === 'ADMIN') {
    if (titleEl) titleEl.textContent = `Interviewer Workspace — ${user.name}`;
    if (subtitleEl) subtitleEl.textContent = 'Manage candidate sessions, review past evaluations, and launch active rooms.';
    if (actionBtn) actionBtn.classList.remove('hidden');
  } else {
    if (titleEl) titleEl.textContent = `Candidate Portal — ${user.name}`;
    if (subtitleEl) subtitleEl.textContent = 'Join your scheduled technical interviews and practice your coding rounds.';
    if (actionBtn) actionBtn.classList.add('hidden');
  }
}

async function loadInterviews() {
  const container = document.getElementById('interviews-list');
  const emptyState = document.getElementById('interviews-empty');
  if (!container) return;

  try {
    const res = await API.interviews.list();
    const interviews = res.data.interviews || [];

    if (interviews.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    container.innerHTML = interviews.map(i => renderInterviewCard(i, window.currentUser)).join('');
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded">Failed to load interviews: ${err.message}</div>`;
  }
}

function renderInterviewCard(interview, currentUser) {
  const isInterviewer = currentUser.role === 'INTERVIEWER' || currentUser.role === 'ADMIN';
  const otherParty = isInterviewer
    ? (interview.candidate ? interview.candidate.name : 'No candidate assigned')
    : (interview.interviewer ? interview.interviewer.name : 'Interviewer');

  const statusColors = {
    DRAFT: 'bg-slate-800 text-slate-300 border-slate-700',
    SCHEDULED: 'bg-blue-950 text-blue-400 border-blue-800',
    ACTIVE: 'bg-emerald-950 text-emerald-400 border-emerald-800 animate-pulse',
    COMPLETED: 'bg-purple-950 text-purple-400 border-purple-800',
    CANCELLED: 'bg-rose-950 text-rose-400 border-rose-800'
  };

  const statusBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full border ${statusColors[interview.status] || 'bg-slate-800 text-slate-300'}">${interview.status}</span>`;

  return `
    <div class="glass-panel p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-500/50 transition">
      <div class="space-y-1.5">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-bold text-slate-100">${interview.title}</h3>
          ${statusBadge}
        </div>
        <p class="text-sm text-slate-400">${interview.description || 'Live coding and technical assessment'}</p>
        <div class="flex items-center gap-4 text-xs text-slate-400 pt-1">
          <span><strong>${isInterviewer ? 'Candidate' : 'Interviewer'}:</strong> ${otherParty}</span>
          <span><strong>Duration:</strong> ${interview.durationMinutes} mins</span>
          <span><strong>Questions:</strong> ${interview.questions ? interview.questions.length : 0}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end md:self-center">
        ${interview.status !== 'COMPLETED' ? `
          <a href="/views/interview.html?id=${interview.id}" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-600/20 flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Enter Room
          </a>
        ` : `
          <a href="/views/replay.html?id=${interview.id}" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium transition flex items-center gap-1.5">
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Interview Replay
          </a>
        `}
      </div>
    </div>
  `;
}

async function loadQuestionLibraryModal() {
  const container = document.getElementById('modal-questions-list');
  if (!container) return;

  try {
    const res = await API.questions.list();
    const questions = res.data.questions || [];

    container.innerHTML = questions.map(q => `
      <label class="flex items-start gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
        <input type="checkbox" name="questionIds" value="${q.id}" class="mt-1 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800" checked />
        <div>
          <div class="flex items-center gap-2">
            <span class="font-medium text-slate-200 text-sm">${q.title}</span>
            <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">${q.type}</span>
            <span class="text-xs px-2 py-0.5 rounded ${q.difficulty === 'EASY' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}">${q.difficulty}</span>
          </div>
          <p class="text-xs text-slate-400 mt-1 line-clamp-1">${q.description.replace(/[#*`]/g, '')}</p>
        </div>
      </label>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p class="text-xs text-slate-500">Failed to load question templates.</p>';
  }
}

async function handleCreateInterview(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById('create-error');
  if (errorEl) errorEl.classList.add('hidden');

  const title = form.title.value;
  const description = form.description.value;
  const candidateEmail = form.candidateEmail.value;
  const durationMinutes = Number(form.durationMinutes.value || 60);

  const checkboxes = form.querySelectorAll('input[name="questionIds"]:checked');
  const questionIds = Array.from(checkboxes).map(cb => cb.value);

  try {
    await API.interviews.create({
      title,
      description,
      candidateEmail,
      durationMinutes,
      questionIds
    });

    closeModal('create-interview-modal');
    form.reset();
    loadInterviews();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  }
}

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

window.openModal = openModal;
window.closeModal = closeModal;
