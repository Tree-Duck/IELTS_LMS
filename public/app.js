/* ─── State ──────────────────────────────────────────────────────────────── */
let token = localStorage.getItem('ielts_token');
let currentUser = JSON.parse(localStorage.getItem('ielts_user') || 'null');
let pollingInterval = null;
let selectedTopic = 'random';
let activeChart = null;       // Chart.js instance
let promptUserTyped = false;  // tracks manual paste/type in prompt

const TOPIC_OPTIONS = {
  task2: [
    { value: 'random',        label: '🎲 Random' },
    { value: 'Technology',    label: '💻 Technology' },
    { value: 'Environment',   label: '🌿 Environment' },
    { value: 'Education',     label: '🎓 Education' },
    { value: 'Health',        label: '🏥 Health' },
    { value: 'Society',       label: '🏙️ Society' },
    { value: 'Work & Career', label: '💼 Work & Career' },
    { value: 'Crime & Law',   label: '⚖️ Crime & Law' },
  ],
  task1: [
    { value: 'random',           label: '🎲 Random' },
    { value: 'bar chart',        label: '📊 Bar Chart' },
    { value: 'line graph',       label: '📈 Line Graph' },
    { value: 'pie chart',        label: '🥧 Pie Chart' },
    { value: 'table',            label: '📋 Table' },
    { value: 'process diagram',  label: '⚙️ Process Diagram' },
    { value: 'map',              label: '🗺️ Map' },
  ],
};

/* ─── Init ───────────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  if (token && currentUser) {
    showApp();
  } else {
    show('auth-screen');
    hide('app-screen');
  }
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers: { ...headers, ...options.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function bandColor(score) {
  if (!score) return '';
  if (score >= 8.5) return 'band-9';
  if (score >= 7.5) return 'band-8';
  if (score >= 6.5) return 'band-7';
  if (score >= 5.5) return 'band-6';
  if (score >= 4.5) return 'band-5';
  if (score >= 3.5) return 'band-4';
  return 'band-low';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusChip(status) {
  const map = { graded: 'Graded', grading: 'Grading…', pending: 'Pending', error: 'Error' };
  return `<span class="status-chip status-${status}">${map[status] || status}</span>`;
}

/* ─── Auth ───────────────────────────────────────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value })
    });
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name: document.getElementById('reg-name').value, email: document.getElementById('reg-email').value, password: document.getElementById('reg-password').value })
    });
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

function saveSession({ token: t, user }) {
  token = t;
  currentUser = user;
  localStorage.setItem('ielts_token', t);
  localStorage.setItem('ielts_user', JSON.stringify(user));
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('ielts_token');
  localStorage.removeItem('ielts_user');
  clearInterval(pollingInterval);
  hide('app-screen');
  show('auth-screen');
}

/* ─── App Shell ──────────────────────────────────────────────────────────── */
function showApp() {
  hide('auth-screen');
  show('app-screen');
  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('welcome-name').textContent = currentUser.name.split(' ')[0];
  document.getElementById('user-avatar').textContent = currentUser.name[0].toUpperCase();
  showView('dashboard');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  show(`view-${name}`);
  const navEl = document.getElementById(`nav-${name}`);
  if (navEl) navEl.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  else if (name === 'history') loadHistory();
  else if (name === 'submit') { loadBudget(); updateTopicOptions(); }
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const submissions = await api('/api/submissions');
    const graded = submissions.filter(s => s.status === 'graded' && s.overall_band != null);
    const bands = graded.map(s => s.overall_band);
    const avg = bands.length ? (bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(1) : '–';
    const best = bands.length ? Math.max(...bands).toFixed(1) : '–';

    document.getElementById('stat-total').textContent = submissions.length;
    document.getElementById('stat-graded').textContent = graded.length;
    document.getElementById('stat-avg').textContent = avg;
    document.getElementById('stat-best').textContent = best;

    const recentEl = document.getElementById('recent-list');
    const recent = submissions.slice(0, 5);
    if (recent.length === 0) {
      recentEl.innerHTML = `<div class="empty-state">No submissions yet. <a href="#" onclick="showView('submit')">Submit your first essay!</a></div>`;
    } else {
      recentEl.innerHTML = recent.map(renderSubmissionCard).join('');
    }

    // Poll if any are still grading
    if (submissions.some(s => s.status === 'grading' || s.status === 'pending')) {
      clearInterval(pollingInterval);
      pollingInterval = setInterval(() => {
        if (document.getElementById('view-dashboard') && !document.getElementById('view-dashboard').classList.contains('hidden')) {
          loadDashboard();
        }
      }, 4000);
    } else {
      clearInterval(pollingInterval);
    }
  } catch (err) {
    console.error('Dashboard load error', err);
  }
}

/* ─── History ────────────────────────────────────────────────────────────── */
async function loadHistory() {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '<div class="loading">Loading submissions…</div>';
  try {
    const submissions = await api('/api/submissions');
    if (submissions.length === 0) {
      listEl.innerHTML = `<div class="empty-state">No submissions yet. <a href="#" onclick="showView('submit')">Submit your first essay!</a></div>`;
      return;
    }
    listEl.innerHTML = submissions.map(renderSubmissionCard).join('');

    // Poll if pending
    if (submissions.some(s => s.status === 'grading' || s.status === 'pending')) {
      clearInterval(pollingInterval);
      pollingInterval = setInterval(() => {
        if (!document.getElementById('view-history').classList.contains('hidden')) {
          loadHistory();
        }
      }, 4000);
    } else {
      clearInterval(pollingInterval);
    }
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state">Failed to load submissions.</div>';
  }
}

function renderSubmissionCard(s) {
  const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const badgeClass = s.task_type === 'task1' ? 'badge-t1' : 'badge-t2';
  const scoreHtml = s.status === 'graded' && s.overall_band != null
    ? `<div class="band-score ${bandColor(s.overall_band)}">${s.overall_band}</div><div class="band-label">Band Score</div>`
    : statusChip(s.status);

  return `
    <div class="submission-card" onclick="viewFeedback(${s.id})">
      <div class="submission-badge ${badgeClass}">${taskLabel}</div>
      <div class="submission-info">
        <div class="submission-prompt">${escHtml(s.prompt)}</div>
        <div class="submission-meta">${s.word_count} words · ${formatDate(s.created_at)}</div>
      </div>
      <div class="submission-score">${scoreHtml}</div>
      <button class="btn-delete-submission" onclick="deleteSubmission(${s.id}, event)" title="Delete submission">🗑</button>
    </div>`;
}

async function deleteSubmission(id, event) {
  event.stopPropagation();
  if (!confirm('Delete this submission? This cannot be undone.')) return;
  try {
    await api(`/api/submissions/${id}`, { method: 'DELETE' });
    loadHistory();
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
}

/* ─── SSE Streaming Helper ───────────────────────────────────────────────── */
async function streamSSE(url, body, onChunk, onDone) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { onDone(); return; }
        try { onChunk(JSON.parse(payload)); } catch { /* skip malformed */ }
      }
    }
  }
  onDone();
}

/* ─── Topic Selector ─────────────────────────────────────────────────────── */
function updateTopicOptions() {
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const options = TOPIC_OPTIONS[taskType] || TOPIC_OPTIONS.task2;
  selectedTopic = 'random';

  const container = document.getElementById('topic-chips');
  if (!container) return;
  container.innerHTML = options.map(opt => `
    <button type="button"
      class="topic-chip${opt.value === 'random' ? ' active' : ''}"
      data-value="${opt.value}"
      onclick="selectTopic(this, '${opt.value}')">
      ${opt.label}
    </button>
  `).join('');
}

function selectTopic(el, value) {
  selectedTopic = value;
  document.querySelectorAll('.topic-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

/* ─── Task Generation ────────────────────────────────────────────────────── */
async function generateTask() {
  const task_type = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const promptEl = document.getElementById('essay-prompt');
  const btn = document.getElementById('generate-btn');
  const btnLabel = document.getElementById('generate-btn-label');
  const btnIcon = document.getElementById('generate-btn-icon');

  btn.disabled = true;
  btnLabel.textContent = 'Generating…';
  btnIcon.textContent = '⏳';
  promptEl.value = '';
  promptUserTyped = false;
  hidePasteNudge();
  clearChart();

  try {
    await streamSSE(
      '/api/generate-task',
      { task_type, topic: selectedTopic || 'random' },
      (chunk) => { promptEl.value += chunk; },
      async () => {
        btn.disabled = false;
        btnLabel.textContent = 'Generate Task';
        btnIcon.textContent = '✨';
        // For Task 1: generate chart
        if (task_type === 'task1') {
          generateChart(promptEl.value);
        }
        // Auto-generate hints
        requestBothHints();
      }
    );
  } catch (err) {
    btn.disabled = false;
    btnLabel.textContent = 'Generate Task';
    btnIcon.textContent = '✨';
    promptEl.placeholder = 'Generation failed. Please try again.';
  }
}

/* ─── Paste / Type Detection ─────────────────────────────────────────────── */
function onPromptInput() {
  const val = document.getElementById('essay-prompt').value.trim();
  promptUserTyped = true;
  if (val.length > 20) {
    showPasteNudge();
  } else {
    hidePasteNudge();
  }
  // Hide chart when user manually edits the prompt
  clearChart();
}

function showPasteNudge() {
  const el = document.getElementById('paste-hint-nudge');
  if (el) el.classList.remove('hidden');
}

function hidePasteNudge() {
  const el = document.getElementById('paste-hint-nudge');
  if (el) el.classList.add('hidden');
}

/* ─── Chart Generation & Rendering ──────────────────────────────────────── */
function clearChart() {
  if (activeChart) { activeChart.destroy(); activeChart = null; }
  const container = document.getElementById('chart-container');
  const tableArea = document.getElementById('table-area');
  const canvas = document.getElementById('task1-chart');
  if (container) container.classList.add('hidden');
  if (tableArea) { tableArea.classList.add('hidden'); tableArea.innerHTML = ''; }
  if (canvas) canvas.style.display = '';
}

async function generateChart(taskText) {
  const container = document.getElementById('chart-container');
  const statusEl = document.getElementById('chart-status');
  if (!container) return;

  clearChart();
  container.classList.remove('hidden');
  if (statusEl) { statusEl.textContent = '⏳ Generating chart…'; statusEl.className = 'chart-status loading'; }

  try {
    const res = await fetch('/api/generate-chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ task_text: taskText }),
    });
    if (!res.ok) throw new Error('Chart request failed');
    const data = await res.json();

    if (data.type === 'unsupported') {
      if (statusEl) { statusEl.textContent = data.message || 'No preview for this chart type'; statusEl.className = 'chart-status'; }
      container.classList.add('hidden');
      return;
    }

    renderChart(data);
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'chart-status'; }
  } catch (err) {
    if (statusEl) { statusEl.textContent = 'Chart preview unavailable'; statusEl.className = 'chart-status'; }
    console.error('Chart error:', err);
  }
}

const CHART_COLORS = [
  'rgba(99,102,241,0.8)',   // indigo
  'rgba(16,185,129,0.8)',   // emerald
  'rgba(245,158,11,0.8)',   // amber
  'rgba(239,68,68,0.8)',    // red
  'rgba(59,130,246,0.8)',   // blue
  'rgba(168,85,247,0.8)',   // purple
  'rgba(20,184,166,0.8)',   // teal
  'rgba(251,146,60,0.8)',   // orange
];
const CHART_BORDERS = CHART_COLORS.map(c => c.replace('0.8', '1'));

function renderChart(data) {
  if (data.type === 'table') {
    renderTable(data);
    return;
  }

  const canvas = document.getElementById('task1-chart');
  if (!canvas) return;
  canvas.style.display = '';

  if (activeChart) { activeChart.destroy(); activeChart = null; }

  const titleEl = document.getElementById('chart-title-label');
  if (titleEl && data.title) titleEl.textContent = '📊 ' + data.title;

  const datasets = (data.datasets || []).map((ds, i) => ({
    label: ds.label || '',
    data: ds.data,
    backgroundColor: data.type === 'pie'
      ? CHART_COLORS.slice(0, (ds.data || []).length)
      : CHART_COLORS[i % CHART_COLORS.length],
    borderColor: data.type === 'pie'
      ? CHART_BORDERS.slice(0, (ds.data || []).length)
      : CHART_BORDERS[i % CHART_BORDERS.length],
    borderWidth: data.type === 'pie' ? 2 : 1.5,
    fill: data.type === 'line' ? false : undefined,
    tension: data.type === 'line' ? 0.3 : undefined,
    pointRadius: data.type === 'line' ? 4 : undefined,
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: data.type === 'pie' || datasets.length > 1,
        position: 'bottom',
        labels: { font: { size: 12 }, padding: 12 },
      },
      title: { display: false },
    },
    scales: data.type === 'pie' ? {} : {
      x: {
        title: { display: !!data.xlabel, text: data.xlabel || '', font: { size: 12 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      y: {
        title: { display: !!data.ylabel, text: data.ylabel || '', font: { size: 12 } },
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
    },
  };

  activeChart = new Chart(canvas, {
    type: data.type,
    data: { labels: data.labels || [], datasets },
    options,
  });
}

function renderTable(data) {
  const canvas = document.getElementById('task1-chart');
  const tableArea = document.getElementById('table-area');
  if (!tableArea) return;
  if (canvas) canvas.style.display = 'none';

  const titleEl = document.getElementById('chart-title-label');
  if (titleEl && data.title) titleEl.textContent = '📋 ' + data.title;

  const headers = (data.headers || []).map(h => `<th>${escHtml(String(h))}</th>`).join('');
  const rows = (data.rows || []).map(row =>
    `<tr>${row.map(cell => `<td>${escHtml(String(cell))}</td>`).join('')}</tr>`
  ).join('');

  tableArea.innerHTML = `
    <table class="chart-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  tableArea.classList.remove('hidden');
}

/* ─── Hints ──────────────────────────────────────────────────────────────── */
// Legacy function kept for backward compatibility
function closeHintPanel() {
  const panel = document.getElementById('hint-panel');
  if (panel) panel.classList.add('hidden');
}

async function requestHint(hint_type) {
  const task_type = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const prompt = document.getElementById('essay-prompt').value.trim();
  const essay = document.getElementById('essay-text').value.trim();

  const panel = document.getElementById('hint-panel');
  const panelTitle = document.getElementById('hint-panel-title');
  const panelBody = document.getElementById('hint-panel-body');

  if (!panel) return; // Legacy panel may not exist

  panelTitle.textContent = hint_type === 'ideas' ? '💡 Idea Hints' : '📚 Vocabulary & Collocations';
  panelBody.innerHTML = '<span class="hint-thinking">Thinking…</span>';
  panel.classList.remove('hidden');

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  let raw = '';
  try {
    await streamSSE(
      '/api/hint',
      { task_type, prompt, essay, hint_type },
      (chunk) => {
        raw += chunk;
        panelBody.innerHTML = renderHintMarkdown(raw);
      },
      () => {
        panelBody.innerHTML = renderHintMarkdown(raw);
      }
    );
  } catch (err) {
    panelBody.innerHTML = `<span style="color:var(--danger)">Failed to load hints. ${escHtml(err.message)}</span>`;
  }
}

async function requestBothHints() {
  const task_type = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const prompt = document.getElementById('essay-prompt').value.trim();
  const essay = document.getElementById('essay-text').value.trim();

  const ideasBody = document.getElementById('ideas-body');
  const vocabBody = document.getElementById('vocab-body');
  const btn = document.getElementById('refresh-hints-btn');

  ideasBody.innerHTML = '<span class="hint-thinking">Generating ideas…</span>';
  vocabBody.innerHTML = '<span class="hint-thinking">Generating vocabulary…</span>';
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  let ideasRaw = '';
  let vocabRaw = '';

  const ideasPromise = streamSSE(
    '/api/hint',
    { task_type, prompt, essay, hint_type: 'ideas' },
    (chunk) => { ideasRaw += chunk; ideasBody.innerHTML = renderHintMarkdown(ideasRaw); },
    () => { ideasBody.innerHTML = renderHintMarkdown(ideasRaw); }
  ).catch(err => { ideasBody.innerHTML = `<span style="color:var(--danger)">Failed: ${escHtml(err.message)}</span>`; });

  const vocabPromise = streamSSE(
    '/api/hint',
    { task_type, prompt, essay, hint_type: 'vocabulary' },
    (chunk) => { vocabRaw += chunk; vocabBody.innerHTML = renderHintMarkdown(vocabRaw); },
    () => { vocabBody.innerHTML = renderHintMarkdown(vocabRaw); }
  ).catch(err => { vocabBody.innerHTML = `<span style="color:var(--danger)">Failed: ${escHtml(err.message)}</span>`; });

  await Promise.all([ideasPromise, vocabPromise]);
  btn.disabled = false;
  btn.textContent = '✨ Generate Both Hints';
  hidePasteNudge();
  loadBudget();
}

async function loadBudget() {
  try {
    const data = await api('/api/balance');
    document.getElementById('budget-remaining').textContent = `💰 Balance: $${data.remaining_balance}`;
    const essays = data.estimated_essays_remaining;
    document.getElementById('budget-essays').textContent = essays !== '?' ? `~${essays} essays remaining` : '';
  } catch {}
}

function renderHintMarkdown(text) {
  // Bold **text**
  let html = escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  return html;
}

/* ─── Submit ─────────────────────────────────────────────────────────────── */
function updateWordCount() {
  const text = document.getElementById('essay-text').value;
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const min = taskType === 'task1' ? 150 : 250;
  const badge = document.getElementById('word-count-badge');
  badge.textContent = `${count} words`;
  badge.className = 'word-count-badge' + (count >= min ? ' ok' : count > 0 ? ' warn' : '');
}

function updateTaskInfo() {
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  const label = taskType === 'task1' ? 'Task 1 requires a minimum of 150 words.' : 'Task 2 requires a minimum of 250 words.';
  document.getElementById('word-count-info').textContent = label;

  // Update card styling
  document.querySelectorAll('.task-option-card').forEach(c => c.classList.remove('active'));
  const checked = document.querySelector('input[name="task_type"]:checked');
  if (checked) checked.nextElementSibling.classList.add('active');

  // Hide chart if switching away from Task 1
  if (taskType !== 'task1') clearChart();

  updateWordCount();
  updateTopicOptions();
}

async function handleSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('submit-error');
  const successEl = document.getElementById('submit-success');
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');

  const task_type = document.querySelector('input[name="task_type"]:checked')?.value;
  const prompt = document.getElementById('essay-prompt').value.trim();
  const essay = document.getElementById('essay-text').value.trim();

  if (!task_type) { errEl.textContent = 'Please select a task type.'; errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  try {
    const result = await api('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({ task_type, prompt, essay })
    });

    successEl.innerHTML = `
      Essay submitted! (${result.word_count} words) — AI grading is in progress.<br/>
      <small>Results will appear in <a href="#" onclick="showView('history')">My Submissions</a> shortly.</small>`;
    successEl.classList.remove('hidden');

    // Reset form
    document.getElementById('essay-prompt').value = '';
    document.getElementById('essay-text').value = '';
    updateWordCount();

    // Auto-navigate to history after 2s
    setTimeout(() => showView('history'), 2000);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Submit for AI Grading';
  }
}

/* ─── Feedback ───────────────────────────────────────────────────────────── */
async function viewFeedback(id) {
  showView('feedback');
  document.getElementById('nav-history').classList.add('active');
  document.getElementById('feedback-content').innerHTML = '<div class="loading">Loading feedback…</div>';

  try {
    const s = await api(`/api/submissions/${id}`);
    renderFeedback(s);

    // Poll if still grading
    if (s.status === 'grading' || s.status === 'pending') {
      clearInterval(pollingInterval);
      pollingInterval = setInterval(async () => {
        if (document.getElementById('view-feedback').classList.contains('hidden')) {
          clearInterval(pollingInterval); return;
        }
        const updated = await api(`/api/submissions/${id}`);
        if (updated.status === 'graded' || updated.status === 'error') {
          clearInterval(pollingInterval);
          renderFeedback(updated);
        }
      }, 4000);
    }
  } catch (err) {
    document.getElementById('feedback-content').innerHTML = '<div class="empty-state">Failed to load feedback.</div>';
  }
}

function renderFeedback(s) {
  const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const badgeClass = s.task_type === 'task1' ? 'badge-t1' : 'badge-t2';
  let html = '';

  // Header card
  html += `
    <div class="feedback-header">
      <div class="feedback-task-info">
        <span class="submission-badge ${badgeClass}" style="width:auto;padding:4px 12px;">${taskLabel}</span>
        <span style="color:var(--gray-500);font-size:13px;">${s.word_count} words · Submitted ${formatDate(s.created_at)}</span>
      </div>
      <div style="font-weight:600;color:var(--gray-700);margin-bottom:8px;">Prompt:</div>
      <div style="font-size:14px;color:var(--gray-600);line-height:1.6;">${escHtml(s.prompt)}</div>
    </div>`;

  if (s.status === 'grading' || s.status === 'pending') {
    html += `
      <div class="grading-notice">
        <strong>⏳ AI Grading in Progress</strong>
        Your essay is being graded by AI. This usually takes 15–30 seconds. This page will update automatically.
      </div>`;
  } else if (s.status === 'error') {
    html += `
      <div class="grading-notice" style="background:var(--danger-light);border-color:#fecaca;color:var(--danger);">
        <strong>Grading Error</strong>
        There was a problem grading this essay. Please try submitting again.
      </div>`;
  } else if (s.status === 'graded' && s.overall_band != null) {
    // Overall band
    html += `
      <div class="overall-band-display">
        <div class="overall-number">${s.overall_band}</div>
        <div class="overall-label">Overall Band Score</div>
      </div>`;

    // Band breakdown
    const taLabel = s.task_type === 'task1' ? 'Task Achievement' : 'Task Response';
    html += `
      <div class="feedback-section">
        <h3>Score Breakdown</h3>
        <div class="band-breakdown">
          ${bandItem(s.task_achievement, taLabel)}
          ${bandItem(s.coherence_cohesion, 'Coherence &amp; Cohesion')}
          ${bandItem(s.lexical_resource, 'Lexical Resource')}
          ${bandItem(s.grammatical_range, 'Grammatical Range &amp; Accuracy')}
        </div>
      </div>`;

    // Criterion details cards
    let criterionData = null;
    if (s.criterion_details) {
      try {
        criterionData = typeof s.criterion_details === 'string' ? JSON.parse(s.criterion_details) : s.criterion_details;
      } catch {}
    }

    if (criterionData) {
      const criterionLabels = {
        task_achievement: s.task_type === 'task1' ? 'Task Achievement' : 'Task Response',
        coherence_cohesion: 'Coherence & Cohesion',
        lexical_resource: 'Lexical Resource',
        grammatical_range: 'Grammatical Range & Accuracy'
      };

      html += `<div class="feedback-section"><h3>Criterion Analysis</h3><div class="criterion-grid">`;

      for (const key of ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammatical_range']) {
        const cd = criterionData[key];
        if (!cd) continue;
        const band = cd.band;
        const strengthsList = Array.isArray(cd.strengths) ? cd.strengths.map(i => `<li>${escHtml(i)}</li>`).join('') : '';
        const improvList = Array.isArray(cd.improvements) ? cd.improvements.map(i => `<li>${escHtml(i)}</li>`).join('') : '';
        html += `
          <div class="criterion-card">
            <div class="criterion-card-header">
              <span class="criterion-name">${escHtml(criterionLabels[key])}</span>
              <span class="criterion-band ${bandColor(band)}">${band != null ? band : '–'}</span>
            </div>
            ${cd.descriptor ? `<div class="criterion-descriptor">${escHtml(cd.descriptor)}</div>` : ''}
            ${strengthsList ? `<div class="criterion-strengths"><h5>Strengths</h5><ul>${strengthsList}</ul></div>` : ''}
            ${improvList ? `<div class="criterion-improvements"><h5>Improvements</h5><ul>${improvList}</ul></div>` : ''}
          </div>`;
      }

      html += `</div></div>`;
    }

    // Sentence analysis
    let sentenceData = null;
    if (s.sentence_analysis) {
      try {
        sentenceData = typeof s.sentence_analysis === 'string' ? JSON.parse(s.sentence_analysis) : s.sentence_analysis;
      } catch {}
    }

    if (sentenceData && Array.isArray(sentenceData) && sentenceData.length > 0) {
      // Count by type
      const counts = { simple: 0, compound: 0, complex: 0, 'compound-complex': 0, uncertain: 0 };
      for (const entry of sentenceData) {
        if (counts[entry.t] !== undefined) counts[entry.t]++;
        else counts.uncertain++;
      }

      const typeColors = {
        simple: 'rgba(59,130,246,0.15)',
        compound: 'rgba(16,185,129,0.15)',
        complex: 'rgba(245,158,11,0.15)',
        'compound-complex': 'rgba(139,92,246,0.15)',
        uncertain: 'rgba(156,163,175,0.2)'
      };
      const typeLabels = {
        simple: 'Simple',
        compound: 'Compound',
        complex: 'Complex',
        'compound-complex': 'Compound-Complex',
        uncertain: 'Uncertain'
      };
      const dotColors = {
        simple: '#3b82f6',
        compound: '#10b981',
        complex: '#f59e0b',
        'compound-complex': '#8b5cf6',
        uncertain: '#9ca3af'
      };
      const badgeBgColors = {
        simple: '#dbeafe',
        compound: '#d1fae5',
        complex: '#fef3c7',
        'compound-complex': '#ede9fe',
        uncertain: '#f3f4f6'
      };
      const badgeTextColors = {
        simple: '#1d4ed8',
        compound: '#065f46',
        complex: '#92400e',
        'compound-complex': '#5b21b6',
        uncertain: '#6b7280'
      };

      let legendHtml = '<div class="sentence-legend">';
      for (const type of Object.keys(typeLabels)) {
        legendHtml += `<div class="legend-item"><div class="legend-dot" style="background:${dotColors[type]}"></div>${typeLabels[type]}</div>`;
      }
      legendHtml += '</div>';

      let countsHtml = '<div class="sentence-counts">';
      for (const type of Object.keys(typeLabels)) {
        if (counts[type] > 0) {
          countsHtml += `<span class="count-badge" style="background:${badgeBgColors[type]};color:${badgeTextColors[type]}">${typeLabels[type]}: ${counts[type]}</span>`;
        }
      }
      countsHtml += '</div>';

      const highlightedEssay = highlightSentences(s.essay, sentenceData);

      html += `
        <div class="feedback-section sentence-analysis-section">
          <h3>Sentence Structure Analysis</h3>
          ${legendHtml}
          ${countsHtml}
          <div class="highlighted-essay">${highlightedEssay}</div>
        </div>`;
    }

    // Overall improvements section
    let overallImprovData = null;
    if (s.overall_improvements) {
      try {
        overallImprovData = typeof s.overall_improvements === 'string' ? JSON.parse(s.overall_improvements) : s.overall_improvements;
      } catch {}
    }

    if (overallImprovData) {
      const improvKeys = [
        { key: 'content', label: 'Content' },
        { key: 'organization', label: 'Organization' },
        { key: 'vocabulary', label: 'Vocabulary' },
        { key: 'grammar', label: 'Grammar' },
        { key: 'sentence_variety', label: 'Sentence Variety' },
        { key: 'coherence', label: 'Coherence' }
      ];

      html += `<div class="feedback-section overall-improvements-section"><h3>Areas for Improvement</h3><div class="improvements-grid">`;
      for (const { key, label } of improvKeys) {
        if (overallImprovData[key]) {
          html += `
            <div class="improvement-card">
              <div class="improvement-card-title">${label}</div>
              <div class="improvement-card-text">${escHtml(overallImprovData[key])}</div>
            </div>`;
        }
      }
      html += `</div></div>`;
    }

    // Detailed feedback
    if (s.detailed_feedback) {
      html += `
        <div class="feedback-section">
          <h3>Detailed Feedback</h3>
          <div class="feedback-text">${escHtml(s.detailed_feedback)}</div>
        </div>`;
    }

    // Strengths
    const strengths = parseList(s.strengths);
    if (strengths.length) {
      html += `
        <div class="feedback-section">
          <h3>Strengths</h3>
          <ul class="list-items strengths-list">${strengths.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>
        </div>`;
    }

    // Improvements (simple list — old style)
    const improvements = parseList(s.improvements);
    if (improvements.length && !overallImprovData) {
      html += `
        <div class="feedback-section">
          <h3>Areas for Improvement</h3>
          <ul class="list-items improvements-list">${improvements.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul>
        </div>`;
    }
  }

  // Original essay
  html += `
    <div class="feedback-section">
      <h3>Your Essay</h3>
      <div class="essay-box">${escHtml(s.essay)}</div>
    </div>`;

  // Rewrite button (only for graded essays)
  if (s.status === 'graded' && s.overall_band != null) {
    html += `
      <div class="rewrite-cta">
        <div class="rewrite-cta-text">
          <strong>✨ Want to see a Band 8+ version?</strong>
          <span>AI will rewrite your essay with higher vocabulary, better structure, and improved grammar — plus explain every change.</span>
        </div>
        <button class="btn btn-rewrite" onclick="viewRewrite(${s.id})">🔄 AI Rewrite at Band 8+</button>
      </div>`;
  }

  document.getElementById('feedback-content').innerHTML = html;
}

function highlightSentences(essayText, sentenceAnalysis) {
  const parsed = typeof sentenceAnalysis === 'string' ? JSON.parse(sentenceAnalysis) : (sentenceAnalysis || []);
  if (!parsed.length) return escHtml(essayText);
  // Split essay into sentences
  const sentenceRegex = /[^.!?]*[.!?]+["']?/g;
  const sentences = essayText.match(sentenceRegex) || [essayText];
  return sentences.map((sentence, idx) => {
    const analysis = parsed.find(a => a.i === idx + 1);
    const type = analysis ? analysis.t : 'uncertain';
    return `<span class="sent-${type}" title="${type}">${escHtml(sentence)}</span>`;
  }).join('');
}

function bandItem(score, label) {
  return `
    <div class="band-item">
      <div class="band-item-score ${bandColor(score)}">${score != null ? score : '–'}</div>
      <div class="band-item-label">${label}</div>
    </div>`;
}

function parseList(val) {
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [String(p)]; } catch { return [val]; }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Rewrite ─────────────────────────────────────────────────────────────── */
let currentRewriteSubmissionId = null;

async function viewRewrite(submissionId) {
  currentRewriteSubmissionId = submissionId;
  showView('rewrite');
  // Keep history nav active so back button is intuitive
  document.getElementById('nav-history').classList.add('active');

  const contentEl = document.getElementById('rewrite-content');
  contentEl.innerHTML = '<div class="loading">✍ AI is rewriting your essay at Band 8+… This may take 15–20 seconds.</div>';

  let raw = '';
  try {
    await streamSSE(
      '/api/rewrite',
      { submission_id: submissionId },
      (chunk) => {
        raw += chunk;
        contentEl.innerHTML = renderRewriteMarkdown(raw);
      },
      () => {
        contentEl.innerHTML = renderRewriteMarkdown(raw);
        loadBudget();
      }
    );
  } catch (err) {
    contentEl.innerHTML = `<div class="empty-state">Rewrite failed: ${escHtml(err.message)}</div>`;
  }
}

function renderRewriteMarkdown(text) {
  // Split at "## What Changed" boundary
  const parts = text.split(/^## What Changed\s*$/m);
  let html = '';

  if (parts.length >= 2) {
    // Essay part
    const essayText = parts[0].trim();
    html += `<div class="feedback-section"><h3>Rewritten Essay <span class="band-chip band-8">Target: Band 8+</span></h3>`;
    html += `<div class="rewrite-essay-box">${escHtml(essayText)}</div></div>`;

    // What Changed part
    const changesText = parts[1].trim();
    const changesHtml = escHtml(changesText)
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html += `<div class="feedback-section what-changed-section">`;
    html += `<h3>📝 What Changed</h3>`;
    html += `<ul class="what-changed-list">${changesHtml}</ul>`;
    html += `</div>`;
  } else {
    // Still streaming — show essay text as-is
    const safeText = escHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html += `<div class="feedback-section"><h3>Rewritten Essay <span class="band-chip band-8">Target: Band 8+</span></h3>`;
    html += `<div class="rewrite-essay-box">${safeText}</div></div>`;
  }

  return html;
}
