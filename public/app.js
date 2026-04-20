/* ─── State ──────────────────────────────────────────────────────────────── */
let token = localStorage.getItem('ielts_token');
let currentUser = JSON.parse(localStorage.getItem('ielts_user') || 'null');
let pollingInterval = null;
let selectedTopic = 'random';
let activeChart = null;       // Chart.js instance
let promptUserTyped = false;  // tracks manual paste/type in prompt
let pendingVerifyEmail = null; // email awaiting verification
let pendingResetEmail = null;  // email awaiting password reset

// Writing Timer state
let writingTimerSecs = 0;
let writingTimerInterval = null;
let writingTimerRunning = false;

// Flashcard state
let flashcards = [];
let flashcardIndex = 0;

// Draft auto-save
const DRAFT_KEY = 'ielts_essay_draft';

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
    { value: 'bar_chart',        label: '📊 Bar Chart' },
    { value: 'line_graph',       label: '📈 Line Graph' },
    { value: 'pie_chart',        label: '🥧 Pie Chart' },
    { value: 'table',            label: '📋 Table' },
    { value: 'process_diagram',  label: '⚙️ Process Diagram' },
    { value: 'map',              label: '🗺️ Map' },
  ],
};

/* ─── Init ───────────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  // Restore dark mode preference
  if (localStorage.getItem('ielts_dark_mode') === '1') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const btn = document.getElementById('dark-mode-btn');
    if (btn) btn.textContent = '☀️';
  }

  // Restore sidebar collapsed state
  if (localStorage.getItem('ielts_sidebar_collapsed') === '1') {
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');
    const showBtn = document.getElementById('sidebar-show-btn');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebar) sidebar.classList.add('sidebar-collapsed');
    if (main) main.classList.add('sidebar-collapsed');
    if (showBtn) showBtn.classList.remove('hidden');
    if (toggleBtn) toggleBtn.textContent = '›';
  }

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
  document.querySelector('.tab-bar').classList.remove('hidden');
  document.getElementById('forgot-form').classList.add('hidden');
  document.getElementById('reset-form').classList.add('hidden');
  document.getElementById('verify-form').classList.add('hidden');
}

// Show any one auth form, hiding all others
function showAuthForm(which) {
  const forms = ['login-form', 'register-form', 'forgot-form', 'reset-form', 'verify-form'];
  forms.forEach(id => document.getElementById(id).classList.add('hidden'));
  const tabBar = document.querySelector('.tab-bar');
  if (which === 'login' || which === 'register') {
    tabBar.classList.remove('hidden');
    document.getElementById(which + '-form').classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (i === 0) === (which === 'login')));
  } else {
    tabBar.classList.add('hidden');
    document.getElementById(which + '-form').classList.remove('hidden');
  }
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
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
        remember_me: document.getElementById('remember-me').checked
      })
    });
    if (data.needsVerification) { showVerifyForm(data.email); return; }
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
    if (data.needsVerification) {
      showVerifyForm(data.email);
      if (data.emailSent === false) {
        const verifyErr = document.getElementById('verify-error');
        verifyErr.textContent = "⚠️ We couldn't send the verification code. Click \"Resend Code\" to try again.";
        verifyErr.classList.remove('hidden');
      }
      return;
    }
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

function showVerifyForm(email) {
  pendingVerifyEmail = email;
  document.getElementById('verify-email-display').textContent = email;
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('verify-form').classList.remove('hidden');
  document.querySelector('.tab-bar').classList.add('hidden');
  document.getElementById('verify-code').value = '';
  document.getElementById('verify-error').classList.add('hidden');
  document.getElementById('verify-success').classList.add('hidden');
  document.getElementById('verify-code').focus();
}

async function handleVerify() {
  const errEl = document.getElementById('verify-error');
  const okEl = document.getElementById('verify-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  const code = document.getElementById('verify-code').value.trim().replace(/\s/g, '');
  if (code.length !== 6) {
    errEl.textContent = 'Please enter the 6-digit code from your email.';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    const data = await api('/api/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: pendingVerifyEmail, code })
    });
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleResendCode() {
  const errEl = document.getElementById('verify-error');
  const okEl = document.getElementById('verify-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  try {
    await api('/api/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: pendingVerifyEmail })
    });
    okEl.textContent = 'New code sent! Check your inbox (and spam folder).';
    okEl.classList.remove('hidden');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

/* ─── Forgot / Reset Password ────────────────────────────────────────────── */
function showForgotForm() {
  showAuthForm('forgot');
  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-error').classList.add('hidden');
  document.getElementById('forgot-success').classList.add('hidden');
  document.getElementById('forgot-email').focus();
}

function showResetForm(email) {
  pendingResetEmail = email;
  document.getElementById('reset-email-display').textContent = email;
  showAuthForm('reset');
  document.getElementById('reset-code').value = '';
  document.getElementById('reset-new-password').value = '';
  document.getElementById('reset-confirm-password').value = '';
  document.getElementById('reset-error').classList.add('hidden');
  document.getElementById('reset-code').focus();
}

async function handleForgotPassword() {
  const errEl = document.getElementById('forgot-error');
  const okEl = document.getElementById('forgot-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { errEl.textContent = 'Please enter your email address.'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await api('/api/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (data.email) {
      showResetForm(data.email);
    } else {
      // User not found — still show success message to avoid enumeration
      okEl.textContent = 'If that email is registered, a reset code has been sent.';
      okEl.classList.remove('hidden');
    }
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleResetPassword() {
  const errEl = document.getElementById('reset-error');
  errEl.classList.add('hidden');
  const code = document.getElementById('reset-code').value.trim();
  const newPw = document.getElementById('reset-new-password').value;
  const confirmPw = document.getElementById('reset-confirm-password').value;
  if (code.length !== 6) { errEl.textContent = 'Enter the 6-digit reset code.'; errEl.classList.remove('hidden'); return; }
  if (newPw.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
  if (newPw !== confirmPw) { errEl.textContent = 'Passwords do not match.'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await api('/api/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: pendingResetEmail, code, new_password: newPw })
    });
    saveSession(data);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
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
  // Show admin-only nav group
  const adminNavGroup = document.getElementById('nav-group-admin');
  if (currentUser.role === 'admin') {
    adminNavGroup.classList.remove('hidden');
  } else {
    adminNavGroup.classList.add('hidden');
  }

  // Click-to-toggle nav groups (attach once; guard with data attribute)
  document.querySelectorAll('.nav-group-header').forEach(header => {
    if (header.dataset.toggleBound) return;
    header.dataset.toggleBound = '1';
    header.addEventListener('click', () => {
      header.closest('.nav-group').classList.toggle('open');
    });
  });

  showView('dashboard');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  show(`view-${name}`);
  const navEl = document.getElementById(`nav-${name}`);
  if (navEl) navEl.classList.add('active');

  // Test-taking view hides sidebar
  if (name === 'test-taking') {
    document.getElementById('app-screen').classList.add('test-mode');
  } else {
    document.getElementById('app-screen').classList.remove('test-mode');
  }

  if (name === 'dashboard') loadDashboard();
  else if (name === 'history') loadHistory();
  else if (name === 'submit') { updateTopicOptions(); loadDraftIfExists(); }
  else if (name === 'admin') loadAdminUsers();
  else if (name === 'admin-materials') loadAdminMaterials();
  else if (name === 'admin-assignments') loadAdminAssignments();
  else if (name === 'admin-student-history') { /* loaded by viewStudentHistory() */ }
  else if (name === 'homework') loadHomework();
  else if (name === 'test-list') loadTestList();
  else if (name === 'test-history') loadTestHistory();
  else if (name === 'change-password') {
    ['cp-current','cp-new','cp-confirm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cp-error').classList.add('hidden');
    document.getElementById('cp-success').classList.add('hidden');
  }
}

/* ─── Admin Panel ────────────────────────────────────────────────────────── */
async function loadAdminUsers() {
  loadAdminCostBreakdown(); // load cost breakdown in parallel
  const el = document.getElementById('admin-users-table');
  el.innerHTML = '<div class="loading">Loading users…</div>';
  try {
    const users = await api('/api/admin/users');
    if (!users.length) {
      el.innerHTML = '<div class="empty-state">No users registered yet.</div>';
      return;
    }
    el.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Verified</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Essays</th>
              <th>Avg Band</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.verified
                  ? '<span class="badge badge-green">✓ Verified</span>'
                  : '<span class="badge badge-red">✗ Pending</span>'}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-purple' : 'badge-gray'}">${u.role}</span></td>
                <td>${formatDate(u.created_at)}</td>
                <td>${u.submission_count}</td>
                <td>${u.avg_band !== null ? u.avg_band : '—'}</td>
                <td style="display:flex;gap:6px;flex-wrap:wrap">
                  <button class="btn btn-secondary btn-xs" onclick="viewStudentHistory(${u.id}, '${u.name.replace(/'/g, "\\'")}')">View History</button>
                  ${u.id === currentUser.id || u.role === 'admin'
                    ? ''
                    : `<button class="btn btn-danger btn-xs" onclick="confirmDeleteUser(${u.id}, '${u.name.replace(/'/g, "\\'")}')">Delete</button>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

async function viewStudentHistory(userId, userName) {
  // Switch to history view first so elements exist
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  show('view-admin-student-history');
  document.getElementById('admin-student-history-title').textContent = `${userName} — Submissions`;
  document.getElementById('admin-student-history-sub').textContent = 'Full essay history for AI/plagiarism review';
  const contentEl = document.getElementById('admin-student-history-content');
  contentEl.innerHTML = '<div class="loading">Loading submissions…</div>';

  try {
    const data = await api(`/api/admin/users/${userId}/submissions`);
    const subs = data.submissions;
    if (!subs.length) {
      contentEl.innerHTML = '<div class="empty-state">No submissions yet.</div>';
      return;
    }
    contentEl.innerHTML = subs.map(s => {
      const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
      const bandColor = s.overall_band >= 7 ? '#16a34a' : s.overall_band >= 5.5 ? '#d97706' : s.overall_band ? '#dc2626' : '#6b7280';
      return `
        <div class="student-history-card">
          <div class="student-history-header">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="submission-badge ${s.task_type === 'task1' ? 'badge-t1' : 'badge-t2'}" style="width:auto;padding:3px 10px">${taskLabel}</span>
              <span style="font-size:13px;color:var(--gray-500)">${s.word_count} words · ${formatDate(s.created_at)}</span>
              ${s.overall_band != null ? `<span style="font-weight:700;color:${bandColor}">Band ${s.overall_band}</span>` : `<span class="badge badge-gray">${s.status}</span>`}
              ${s.cost_usd ? `<span style="font-size:11px;color:var(--gray-400)">$${s.cost_usd.toFixed(4)}</span>` : ''}
            </div>
            <button class="btn btn-secondary btn-xs" onclick="this.closest('.student-history-card').querySelector('.essay-full').classList.toggle('hidden');this.textContent=this.textContent==='Show Essay'?'Hide Essay':'Show Essay'">Show Essay</button>
          </div>
          <div class="student-history-prompt"><strong>Prompt:</strong> ${escHtml(s.prompt)}</div>
          <div class="essay-full hidden">
            <div class="essay-text-box">${escHtml(s.essay)}</div>
          </div>
          ${s.detailed_feedback ? `<div class="student-history-feedback"><strong>Feedback summary:</strong> ${escHtml(s.detailed_feedback.slice(0, 300))}${s.detailed_feedback.length > 300 ? '…' : ''}</div>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    contentEl.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

async function confirmDeleteUser(userId, userName) {
  if (!confirm(`Delete user "${userName}"?\n\nThis will permanently remove their account, all submissions, and all feedback. This cannot be undone.`)) return;
  try {
    await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
    loadAdminUsers(); // refresh table
  } catch (err) {
    alert('Failed to delete user: ' + err.message);
  }
}

/* ─── Change Password ────────────────────────────────────────────────────── */
async function handleChangePassword() {
  const errEl = document.getElementById('cp-error');
  const okEl = document.getElementById('cp-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  const current = document.getElementById('cp-current').value;
  const newPw = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;
  if (!current) { errEl.textContent = 'Please enter your current password.'; errEl.classList.remove('hidden'); return; }
  if (newPw.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; errEl.classList.remove('hidden'); return; }
  if (newPw !== confirm) { errEl.textContent = 'New passwords do not match.'; errEl.classList.remove('hidden'); return; }
  try {
    await api('/api/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: newPw })
    });
    okEl.textContent = '✓ Password updated successfully!';
    okEl.classList.remove('hidden');
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-confirm').value = '';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const [submissions, profile, testAttempts] = await Promise.all([
      api('/api/submissions'),
      api('/api/user/profile').catch(() => ({ current_streak: 0, target_band: null })),
      api('/api/tests/attempts').catch(() => [])
    ]);

    const graded = submissions.filter(s => s.status === 'graded' && s.overall_band != null);
    const bands = graded.map(s => s.overall_band);
    const avg = bands.length ? (bands.reduce((a, b) => a + b, 0) / bands.length).toFixed(1) : '–';
    const best = bands.length ? Math.max(...bands).toFixed(1) : '–';

    document.getElementById('stat-total').textContent = submissions.length;
    document.getElementById('stat-graded').textContent = graded.length;
    document.getElementById('stat-avg').textContent = avg;
    document.getElementById('stat-best').textContent = best;

    // Streak
    const streak = profile.current_streak || 0;
    document.getElementById('stat-streak').textContent = streak;
    const streakCard = document.querySelector('.stat-streak-card');
    if (streakCard) streakCard.classList.toggle('streak-active', streak > 0);

    // Reading / Listening avg bands from test attempts
    const completedAttempts = (testAttempts || []).filter(a => a.status === 'completed' && a.score);
    const readingBands = completedAttempts.filter(a => a.type === 'reading').map(a => a.score.band);
    const listeningBands = completedAttempts.filter(a => a.type === 'listening').map(a => a.score.band);
    const readingAvg = readingBands.length ? (readingBands.reduce((a,b)=>a+b,0)/readingBands.length).toFixed(1) : '–';
    const listeningAvg = listeningBands.length ? (listeningBands.reduce((a,b)=>a+b,0)/listeningBands.length).toFixed(1) : '–';
    const readingAvgEl = document.getElementById('stat-reading-avg');
    const listeningAvgEl = document.getElementById('stat-listening-avg');
    if (readingAvgEl) readingAvgEl.textContent = readingAvg;
    if (listeningAvgEl) listeningAvgEl.textContent = listeningAvg;

    // Target band tracker
    renderTargetBandBars(profile.target_band, avg === '–' ? null : parseFloat(avg),
      readingAvg === '–' ? null : parseFloat(readingAvg),
      listeningAvg === '–' ? null : parseFloat(listeningAvg));

    // Populate target band select
    const sel = document.getElementById('target-band-select');
    if (sel && profile.target_band) {
      sel.value = String(profile.target_band);
    }

    // Progress chart
    renderProgressChart(graded, completedAttempts);

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

function renderTargetBandBars(targetBand, writingAvg, readingAvg, listeningAvg) {
  const section = document.getElementById('target-band-section');
  const barsEl = document.getElementById('target-band-bars');
  if (!section || !barsEl) return;

  if (!targetBand) {
    barsEl.innerHTML = '<div class="target-band-hint">Set a target band above to track your progress toward your goal.</div>';
    return;
  }

  const skills = [
    { label: 'Writing', avg: writingAvg },
    { label: 'Reading', avg: readingAvg ?? null },
    { label: 'Listening', avg: listeningAvg ?? null }
  ];

  barsEl.innerHTML = skills.map(({ label, avg }) => {
    const pct = avg !== null ? Math.min(100, Math.round((avg / targetBand) * 100)) : 0;
    const displayAvg = avg !== null ? avg.toFixed(1) : '–';
    return `
      <div class="target-bar-row">
        <span class="target-bar-label">${label}</span>
        <div class="target-bar-track">
          <div class="target-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="target-bar-meta">${displayAvg} / ${targetBand}</span>
      </div>`;
  }).join('');
}

async function handleSetTargetBand() {
  const sel = document.getElementById('target-band-select');
  if (!sel || !sel.value) return;
  try {
    await api('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ target_band: parseFloat(sel.value) })
    });
    loadDashboard();
  } catch (err) {
    alert('Failed to save target band: ' + err.message);
  }
}

function renderProgressChart(graded, testAttempts) {
  const section = document.getElementById('chart-section');
  if (!section) return;

  const completedTests = (testAttempts || []).filter(a => a.status === 'completed' && a.score);
  const readingAttempts = completedTests.filter(a => a.type === 'reading');
  const listeningAttempts = completedTests.filter(a => a.type === 'listening');

  if (graded.length < 2 && readingAttempts.length < 2 && listeningAttempts.length < 2) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  const sorted = [...graded].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Build a merged label set of all dates
  const allDates = [
    ...sorted.map(s => s.created_at.slice(0, 10)),
    ...readingAttempts.map(a => (a.submitted_at || a.started_at).slice(0, 10)),
    ...listeningAttempts.map(a => (a.submitted_at || a.started_at).slice(0, 10))
  ];
  const uniqueDates = [...new Set(allDates)].sort();
  const labels = uniqueDates.map(d => formatDate(d + 'T00:00:00.000Z'));

  const getDataForDates = (items, dateKey, valueKey) =>
    uniqueDates.map(d => {
      const item = items.find(i => (i[dateKey] || '').slice(0, 10) === d);
      return item ? (typeof valueKey === 'function' ? valueKey(item) : item[valueKey]) : null;
    });

  const datasets = [];
  if (sorted.length >= 2) {
    datasets.push({
      label: 'Writing',
      data: getDataForDates(sorted, 'created_at', 'overall_band'),
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79,70,229,0.08)',
      borderWidth: 2.5,
      pointBackgroundColor: '#4f46e5',
      pointRadius: 5,
      tension: 0.3,
      spanGaps: true
    });
  }
  if (readingAttempts.length >= 2) {
    datasets.push({
      label: 'Reading',
      data: getDataForDates(readingAttempts, 'submitted_at', a => a.score.band),
      borderColor: '#059669',
      backgroundColor: 'rgba(5,150,105,0.08)',
      borderWidth: 2.5,
      pointBackgroundColor: '#059669',
      pointRadius: 5,
      tension: 0.3,
      spanGaps: true
    });
  }
  if (listeningAttempts.length >= 2) {
    datasets.push({
      label: 'Listening',
      data: getDataForDates(listeningAttempts, 'submitted_at', a => a.score.band),
      borderColor: '#d97706',
      backgroundColor: 'rgba(217,119,6,0.08)',
      borderWidth: 2.5,
      pointBackgroundColor: '#d97706',
      pointRadius: 5,
      tension: 0.3,
      spanGaps: true
    });
  }

  const ctx = document.getElementById('progress-chart').getContext('2d');
  if (window.progressChart && typeof window.progressChart.destroy === 'function') {
    window.progressChart.destroy();
  }
  window.progressChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { callbacks: { label: ctx => `Band ${ctx.parsed.y}` } }
      },
      scales: {
        y: {
          min: 0, max: 9,
          ticks: { stepSize: 1 },
          title: { display: true, text: 'Band Score' }
        },
        x: { ticks: { maxRotation: 45 } }
      }
    }
  });
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

  if (task_type === 'task1') {
    // Task 1: fetch a random admin-uploaded topic (image + question)
    try {
      const chartType = (selectedTopic && selectedTopic !== 'random') ? selectedTopic : 'random';
      const params = chartType !== 'random' ? `?chart_type=${encodeURIComponent(chartType)}` : '';
      const topic = await api(`/api/task1-topics/random${params}`);
      promptEl.value = topic.question;
      promptUserTyped = false;
      displayTask1Topic(topic);
      btn.disabled = false;
      btnLabel.textContent = 'Generate Task';
      btnIcon.textContent = '✨';
      requestBothHints();
    } catch (err) {
      btn.disabled = false;
      btnLabel.textContent = 'Generate Task';
      btnIcon.textContent = '✨';
      promptEl.placeholder = err.message || 'No topics available. Ask your teacher to upload some.';
    }
    return;
  }

  // Task 2: AI streaming generation
  try {
    await streamSSE(
      '/api/generate-task',
      { task_type, topic: selectedTopic || 'random' },
      (chunk) => { promptEl.value += chunk; },
      async () => {
        btn.disabled = false;
        btnLabel.textContent = 'Generate Task';
        btnIcon.textContent = '✨';
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

/* ─── Display Admin-Uploaded Task 1 Topic ────────────────────────────────── */
function displayTask1Topic(topic) {
  const container = document.getElementById('chart-container');
  const imgEl = document.getElementById('chart-topic-image');
  const canvas = document.getElementById('task1-chart');
  const tableArea = document.getElementById('table-area');
  const titleEl = document.getElementById('chart-title-label');

  if (!container || !imgEl) return;

  // Destroy any existing Chart.js instance
  if (activeChart) { activeChart.destroy(); activeChart = null; }

  // Hide canvas & table, show image
  if (canvas) canvas.style.display = 'none';
  if (tableArea) { tableArea.classList.add('hidden'); tableArea.innerHTML = ''; }

  imgEl.src = `data:${topic.image_media_type};base64,${topic.image_base64}`;
  imgEl.classList.remove('hidden');

  // Update title label
  const typeLabel = {
    bar_chart: '📊 Bar Chart',
    line_graph: '📈 Line Graph',
    pie_chart: '🥧 Pie Chart',
    table: '📋 Table',
    process_diagram: '⚙️ Process Diagram',
    map: '🗺️ Map'
  }[topic.chart_type] || '📊 Chart';
  if (titleEl) titleEl.textContent = typeLabel + (topic.label ? ` — ${topic.label}` : '');

  // Show container
  container.classList.remove('hidden');

  // Auto-populate image state so it gets submitted with the essay
  task1ImageBase64 = topic.image_base64;
  task1ImageMediaType = topic.image_media_type;
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
  // Auto-save draft
  onDraftInput();
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
  const imgEl = document.getElementById('chart-topic-image');
  if (container) container.classList.add('hidden');
  if (tableArea) { tableArea.classList.add('hidden'); tableArea.innerHTML = ''; }
  if (canvas) canvas.style.display = '';
  if (imgEl) { imgEl.classList.add('hidden'); imgEl.src = ''; }
  // Clear task1 image state
  task1ImageBase64 = null;
  task1ImageMediaType = null;
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
}

async function syncAnthropicBalance() {
  const input = document.getElementById('balance-input');
  const val = parseFloat(input?.value);
  if (isNaN(val) || val < 0) { alert('Please enter a valid balance (e.g. 4.65)'); return; }
  try {
    await api('/api/admin/settings/balance', { method: 'PUT', body: JSON.stringify({ balance: val }) });
    input.value = '';
    await loadAdminCostBreakdown();
  } catch (err) {
    alert('Failed to save balance: ' + err.message);
  }
}

async function loadAdminCostBreakdown() {
  const el = document.getElementById('admin-cost-content');
  if (!el) return;
  try {
    const data = await api('/api/admin/cost-breakdown');
    const total = data.starting_balance || (data.remaining_balance + data.total_cost);
    const pct = total > 0 ? Math.round((data.remaining_balance / total) * 100) : 0;
    // Pre-fill the sync input with current starting balance as placeholder
    const balInput = document.getElementById('balance-input');
    if (balInput && !balInput.value) balInput.placeholder = `current: $${(data.starting_balance || 0).toFixed(2)}`;

    // What costs money — reference table
    const costRef = [
      { op: 'Essay Grading', who: 'Student submits essay', approx: '~$0.04–0.08' },
      { op: 'AI Writing Hints', who: 'Student clicks Generate Hints', approx: '~$0.01–0.02' },
      { op: 'Smart Rewrite', who: 'Student requests rewrite', approx: '~$0.02–0.04' },
      { op: 'Topic Generation', who: 'Admin generates task prompt', approx: '~$0.005' },
      { op: 'Chart Description AI', who: 'Task 1 image analysis', approx: '~$0.01' },
      { op: 'Test AI Explanations', who: 'Student submits Reading/Listening test', approx: '~$0.003' },
    ];

    el.innerHTML = `
      <div class="cost-summary-row">
        <div class="cost-summary-item">
          <div class="cost-val">$${data.total_cost.toFixed(4)}</div>
          <div class="cost-lbl">Total Spent</div>
        </div>
        <div class="cost-summary-item">
          <div class="cost-val" style="color:#16a34a">$${data.remaining_balance.toFixed(4)}</div>
          <div class="cost-lbl">Remaining Balance</div>
        </div>
        <div class="cost-summary-item" style="flex:2">
          <div class="cost-balance-bar">
            <div class="cost-balance-fill" style="width:${pct}%"></div>
          </div>
          <div class="cost-lbl">${pct}% remaining</div>
        </div>
      </div>

      ${data.breakdown.length ? `
        <div class="cost-tables-row">
          <div class="cost-table-wrap">
            <div class="cost-table-title">📊 Spending by Feature</div>
            <table class="cost-table">
              <thead><tr><th>Feature</th><th>Uses</th><th>Cost</th></tr></thead>
              <tbody>
                ${data.breakdown.map(b => `
                  <tr>
                    <td>${b.label}</td>
                    <td>${b.count}</td>
                    <td>$${b.cost.toFixed(4)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="cost-table-wrap">
            <div class="cost-table-title">💡 Cost Reference (per operation)</div>
            <table class="cost-table">
              <thead><tr><th>Operation</th><th>Triggered by</th><th>Approx. Cost</th></tr></thead>
              <tbody>
                ${costRef.map(r => `
                  <tr>
                    <td>${r.op}</td>
                    <td style="color:var(--gray-500);font-size:12px">${r.who}</td>
                    <td>${r.approx}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : '<div class="cost-lbl" style="padding:8px 0">No AI usage recorded yet.</div>'}
    `;
  } catch (err) {
    el.innerHTML = `<span style="color:var(--danger);font-size:13px">Failed to load: ${err.message}</span>`;
  }
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

  // Show/hide image upload for Task 1
  const imgSection = document.getElementById('task1-image-section');
  if (imgSection) imgSection.classList.toggle('hidden', taskType !== 'task1');

  // Hide chart if switching away from Task 1
  if (taskType !== 'task1') { clearChart(); removeImage(); }

  updateWordCount();
  updateTopicOptions();
}

/* ─── Task 1 Image Upload ─────────────────────────────────────────────────── */
let task1ImageBase64 = null;
let task1ImageMediaType = null;

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be under 5 MB.');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // Extract base64 and media type from data URL
    const [header, b64] = dataUrl.split(',');
    task1ImageBase64 = b64;
    task1ImageMediaType = header.match(/:(.*?);/)[1];

    // Show preview, hide placeholder
    const preview = document.getElementById('image-preview');
    const placeholder = document.getElementById('image-upload-placeholder');
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    document.getElementById('remove-image-btn').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  task1ImageBase64 = null;
  task1ImageMediaType = null;
  const input = document.getElementById('task1-image-input');
  if (input) input.value = '';
  const preview = document.getElementById('image-preview');
  if (preview) { preview.src = ''; preview.classList.add('hidden'); }
  const placeholder = document.getElementById('image-upload-placeholder');
  if (placeholder) placeholder.classList.remove('hidden');
  const btn = document.getElementById('remove-image-btn');
  if (btn) btn.classList.add('hidden');
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
    const body = { task_type, prompt, essay };
    if (task_type === 'task1' && task1ImageBase64) {
      body.image_base64 = task1ImageBase64;
      body.image_media_type = task1ImageMediaType;
    }
    const result = await api('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    successEl.innerHTML = `
      Essay submitted! (${result.word_count} words) — AI grading is in progress.<br/>
      <small>Results will appear in <a href="#" onclick="showView('history')">My Submissions</a> shortly.</small>`;
    successEl.classList.remove('hidden');

    // Reset form and clear saved draft
    document.getElementById('essay-prompt').value = '';
    document.getElementById('essay-text').value = '';
    removeImage();
    updateWordCount();
    localStorage.removeItem(DRAFT_KEY);
    const banner = document.getElementById('draft-restore-banner');
    if (banner) banner.classList.add('hidden');

    // Auto-complete linked homework assignment (if started from Homework view)
    if (window._pendingHomeworkAssignmentId) {
      try {
        await api(`/api/assignments/${window._pendingHomeworkAssignmentId}/complete`, { method: 'POST' });
      } catch (e) { /* non-fatal */ }
      window._pendingHomeworkAssignmentId = null;
    }

    // Auto-navigate to history after 2s
    setTimeout(() => showView('history'), 2000);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Submit for Grading';
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

function exportFeedbackPDF() {
  window.print();
}

function renderFeedback(s) {
  const taskLabel = s.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const badgeClass = s.task_type === 'task1' ? 'badge-t1' : 'badge-t2';
  let html = '';

  // PDF export button (only when graded)
  if (s.status === 'graded' && s.overall_band != null) {
    html += `<div class="pdf-export-bar"><button id="pdf-btn" class="btn btn-secondary btn-sm" onclick="exportFeedbackPDF()">⬇️ Download PDF</button></div>`;
  }

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
        <strong>⏳ Grading in Progress</strong>
        Your essay is being graded. This usually takes 15–30 seconds. This page will update automatically.
      </div>`;
  } else if (s.status === 'error') {
    html += `
      <div class="grading-notice" style="background:var(--danger-light);border-color:#fecaca;color:var(--danger);">
        <strong>Grading Error</strong>
        There was a problem grading this essay.
      </div>
      <div class="retry-grade-bar">
        <button class="btn btn-primary btn-sm" onclick="retryGrading(${s.id})">🔄 Retry Grading</button>
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

    // Radar chart
    html += `
      <div class="feedback-section radar-chart-section">
        <h3>📊 Skill Radar</h3>
        <div class="radar-chart-container">
          <canvas id="feedback-radar-chart" height="260"></canvas>
        </div>
      </div>`;

    // Flashcard button
    html += `
      <div class="pdf-export-bar" style="margin-bottom:0">
        <button class="btn btn-secondary btn-sm" onclick="openFlashcards(${s.id})">📚 Vocabulary Flashcards</button>
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

  // Draw radar chart after DOM update
  if (s.status === 'graded' && s.overall_band != null) {
    const radarCtx = document.getElementById('feedback-radar-chart');
    if (radarCtx && window.Chart) {
      const taLabel = s.task_type === 'task1' ? 'TA' : 'TR';
      new Chart(radarCtx, {
        type: 'radar',
        data: {
          labels: [taLabel, 'CC', 'LR', 'GRA'],
          datasets: [{
            label: 'Band Score',
            data: [s.task_achievement, s.coherence_cohesion, s.lexical_resource, s.grammatical_range],
            backgroundColor: 'rgba(245,158,11,0.2)',
            borderColor: '#F59E0B',
            pointBackgroundColor: '#F59E0B',
            borderWidth: 2,
            pointRadius: 4,
          }]
        },
        options: {
          responsive: true,
          scales: {
            r: {
              min: 0, max: 9,
              ticks: { stepSize: 1, display: false },
              grid: { color: 'rgba(0,0,0,.1)' },
              pointLabels: { font: { size: 13, weight: 'bold' } }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  }
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

  // Store original essay for diff view
  window._rewriteOriginalEssay = '';
  try {
    const sub = await api(`/api/submissions/${submissionId}`);
    window._rewriteOriginalEssay = sub.essay || '';
  } catch {}

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

    // Show diff toggle bar
    const originalEssay = (() => {
      try {
        const sub = window._rewriteOriginalEssay || '';
        return sub;
      } catch { return ''; }
    })();

    html += `<div class="feedback-section">`;
    html += `<div class="diff-toggle-bar">`;
    html += `<h3 style="margin:0">Rewritten Essay <span class="band-chip band-8">Target: Band 8+</span></h3>`;
    if (originalEssay) {
      html += `<button class="btn btn-secondary btn-sm" onclick="toggleDiffView(this)" data-mode="plain">⇔ Compare</button>`;
    }
    html += `</div>`;

    // Plain view
    html += `<div class="rewrite-essay-box" id="rewrite-plain-view">${escHtml(essayText)}</div>`;

    // Diff view (hidden initially)
    if (originalEssay) {
      const diffHtml = buildWordDiff(originalEssay, essayText);
      html += `<div class="essay-diff-container hidden" id="rewrite-diff-view">
        <div class="essay-diff-panel">
          <h4>Original</h4>
          <div class="diff-original">${diffHtml.original}</div>
        </div>
        <div class="essay-diff-panel">
          <h4>Rewritten</h4>
          <div class="diff-rewritten">${diffHtml.rewritten}</div>
        </div>
      </div>`;
    }
    html += `</div>`;

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

function toggleDiffView(btn) {
  const plain = document.getElementById('rewrite-plain-view');
  const diff = document.getElementById('rewrite-diff-view');
  if (!plain || !diff) return;
  if (btn.dataset.mode === 'plain') {
    plain.classList.add('hidden');
    diff.classList.remove('hidden');
    btn.dataset.mode = 'diff';
    btn.textContent = '📄 Plain View';
  } else {
    diff.classList.add('hidden');
    plain.classList.remove('hidden');
    btn.dataset.mode = 'plain';
    btn.textContent = '⇔ Compare';
  }
}

// Simple word-level diff — returns { original: html, rewritten: html }
function buildWordDiff(original, rewritten) {
  const origWords = original.split(/(\s+)/);
  const rewWords = rewritten.split(/(\s+)/);

  // Build a lookup of rewritten words for quick comparison
  const rewSet = new Set(rewWords.map(w => w.trim().toLowerCase()).filter(Boolean));
  const origSet = new Set(origWords.map(w => w.trim().toLowerCase()).filter(Boolean));

  const origHtml = origWords.map(w => {
    if (!w.trim()) return w; // preserve whitespace
    const lw = w.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (lw && !rewSet.has(lw)) return `<span class="diff-removed">${escHtml(w)}</span>`;
    return escHtml(w);
  }).join('');

  const rewHtml = rewWords.map(w => {
    if (!w.trim()) return w;
    const lw = w.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (lw && !origSet.has(lw)) return `<span class="diff-added">${escHtml(w)}</span>`;
    return escHtml(w);
  }).join('');

  return { original: origHtml, rewritten: rewHtml };
}

/* ─── Mock Tests — List View ─────────────────────────────────────────────── */
let currentTestTab = 'reading';

function switchTestTab(type) {
  currentTestTab = type;
  document.getElementById('test-tab-reading').classList.toggle('active', type === 'reading');
  document.getElementById('test-tab-listening').classList.toggle('active', type === 'listening');
  renderTestList();
}

let _testListCache = null;

async function loadTestList() {
  const el = document.getElementById('test-list-content');
  el.innerHTML = '<div class="loading">Loading tests…</div>';
  try {
    _testListCache = await api('/api/tests');
    renderTestList();
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderTestList() {
  const el = document.getElementById('test-list-content');
  if (!_testListCache) return;
  const filtered = _testListCache.filter(t => t.type === currentTestTab);
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state">No ${currentTestTab} tests available yet.</div>`;
    return;
  }
  el.innerHTML = filtered.map(t => {
    const timeMins = t.type === 'reading' ? 60 : 30;
    let actionBtn = '';
    if (t.user_status === 'in_progress') {
      actionBtn = `<button class="btn btn-warning btn-sm" onclick="startTest(${t.id})">▶ Resume</button>`;
    } else if (t.user_status === 'completed') {
      actionBtn = `
        <button class="btn btn-secondary btn-sm" onclick="viewTestResult(${t.latest_attempt_id})">📊 View Result</button>
        <button class="btn btn-primary btn-sm" onclick="startTest(${t.id})">Retry</button>`;
    } else {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="startTest(${t.id})">▶ Start Test</button>`;
    }
    const bandBadge = t.latest_band != null
      ? `<span class="band-badge" style="background:${bandColor(t.latest_band)};color:#fff">Band ${t.latest_band}</span>`
      : '';
    return `
      <div class="test-card">
        <div class="test-card-info">
          <div class="test-card-title">${escHtml(t.title)}</div>
          <div class="test-card-meta">${t.section_count} sections · ${t.question_count} questions · ${timeMins} min ${bandBadge}</div>
        </div>
        <div class="test-card-actions">${actionBtn}</div>
      </div>`;
  }).join('');
}

/* ─── Mock Tests — Taking ────────────────────────────────────────────────── */
let currentTestData = null;
let currentAttemptId = null;
let currentAnswers = {};
let currentTestType = null;
let testTimerInterval = null;
let testTimeRemaining = 0;
let currentSectionIndex = 0;
let autosaveInterval = null;

async function startTest(testId) {
  try {
    const data = await api(`/api/tests/${testId}/start`, { method: 'POST' });
    currentTestData = data.test;
    currentAttemptId = data.attempt_id;
    currentAnswers = data.answers || {};
    currentTestType = data.test.type;
    testTimeRemaining = data.time_remaining_secs;
    currentSectionIndex = 0;
    showView('test-taking');
    renderTestTaking();
    startTestTimer();
    startAutosave(testId);
    initTestResizer();
  } catch (err) {
    alert('Failed to start test: ' + err.message);
  }
}

function initTestResizer() {
  const resizer  = document.getElementById('test-resizer');
  const leftPanel  = document.getElementById('test-left-panel');
  const rightPanel = document.getElementById('test-right-panel');
  if (!resizer || !leftPanel || !rightPanel) return;

  // Reset any previous inline sizing so flex defaults take over fresh
  leftPanel.style.flex  = '';
  leftPanel.style.width = '';

  let startX, startLeftWidth;

  resizer.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startLeftWidth = leftPanel.getBoundingClientRect().width;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  function onMove(e) {
    const dx = e.clientX - startX;
    const newWidth = startLeftWidth + dx;
    const bodyWidth = resizer.parentElement.getBoundingClientRect().width;
    const min = 280;
    const max = bodyWidth - 280 - 6; // 6px = resizer width
    if (newWidth >= min && newWidth <= max) {
      leftPanel.style.flex  = 'none';
      leftPanel.style.width = newWidth + 'px';
    }
  }

  function onUp() {
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}

function renderTestTaking() {
  const test = currentTestData;
  document.getElementById('test-taking-title').textContent = escHtml(test.title);

  // Section tabs
  const tabsEl = document.getElementById('test-section-tabs');
  tabsEl.innerHTML = (test.sections || []).map((s, i) =>
    `<button class="section-tab-btn ${i === currentSectionIndex ? 'active' : ''}" onclick="switchTestSection(${i})">
      ${test.type === 'reading' ? 'Passage' : 'Section'} ${s.section_number}
    </button>`
  ).join('');

  renderTestSection();
  renderQNav();
}

function switchTestSection(idx) {
  currentSectionIndex = idx;
  document.querySelectorAll('.section-tab-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  renderTestSection();
  renderQNav();
}

function renderTestSection() {
  const section = currentTestData.sections[currentSectionIndex];
  const leftEl = document.getElementById('test-left-panel');
  const rightEl = document.getElementById('test-right-panel');

  // Left: passage or audio
  if (currentTestType === 'reading') {
    leftEl.innerHTML = `
      <div class="passage-title">${escHtml(section.passage_title || `Passage ${section.section_number}`)}</div>
      <div class="passage-text">${escHtml(section.passage_text || '').replace(/\n/g, '<br>')}</div>`;
  } else {
    const audioHtml = section.audio_url
      ? `<div class="audio-player-container">
           <p class="audio-label">🎧 Audio — Section ${section.section_number}</p>
           <audio controls src="${escHtml(section.audio_url)}" class="audio-player"></audio>
         </div>`
      : `<div class="audio-missing">No audio URL provided for this section.</div>`;
    const transcriptHtml = section.transcript
      ? `<details class="transcript-details"><summary>Show Transcript</summary><div class="transcript-text">${escHtml(section.transcript).replace(/\n/g,'<br>')}</div></details>`
      : '';
    leftEl.innerHTML = audioHtml + transcriptHtml;
  }

  // Right: question navigator + questions
  renderQNav();
  renderQuestions(section);
}

function renderQNav() {
  const navEl = document.getElementById('q-nav-grid');
  const section = currentTestData.sections[currentSectionIndex];
  const items = [];
  for (const q of (section.questions || [])) {
    if (q.q_type === 'matching' && q.sub_questions) {
      q.sub_questions.forEach((sq, idx) => {
        const key = `${q.q_number}_${sq.label}`;
        // Extract leading number from label if present (e.g. "3 Some description" → "3"), else fall back to q_number+idx
        const numMatch = sq.label.match(/^(\d+)/);
        const display = numMatch ? numMatch[1] : String(q.q_number + idx);
        items.push({ key, display });
      });
    } else {
      items.push({ key: String(q.q_number), display: String(q.q_number) });
    }
  }
  navEl.innerHTML = items.map(({ key, display }) =>
    `<button class="q-nav-btn ${currentAnswers[key] ? 'answered' : ''}" onclick="scrollToQuestion('${key.replace(/'/g, "\\'")}')">${display}</button>`
  ).join('');
}

function renderQuestions(section) {
  const container = document.getElementById('test-questions-container');
  const questions = section.questions || [];

  // Group consecutive questions by type so we can show group headers
  const groups = [];
  questions.forEach(q => {
    const last = groups[groups.length - 1];
    if (last && last.type === q.q_type) {
      last.questions.push(q);
    } else {
      groups.push({ type: q.q_type, questions: [q] });
    }
  });

  container.innerHTML = groups.map(g => {
    const nums = g.questions.map(q => q.q_number);
    const min = Math.min(...nums), max = Math.max(...nums);
    const rangeLabel = min === max ? `Question ${min}` : `Questions ${min}–${max}`;

    let desc = '';
    if (g.type === 'tfng') {
      desc = 'Write <strong>TRUE</strong> if the statement agrees with the information, <strong>FALSE</strong> if the statement contradicts the information, or <strong>NOT GIVEN</strong> if there is no information on this.';
    } else if (g.type === 'mcq') {
      desc = 'Choose the correct letter, <strong>A</strong>, <strong>B</strong>, <strong>C</strong> or <strong>D</strong>.';
    } else if (g.type === 'fill') {
      desc = 'Complete the sentences. Choose <strong>NO MORE THAN TWO WORDS</strong> from the passage for each answer.';
    } else if (g.type === 'matching') {
      // Use the stem of the first matching question as the group description
      desc = escHtml(g.questions[0]?.stem || '');
    }

    return `<div class="q-group">
      <div class="q-group-header">
        <div class="q-group-title">${rangeLabel}:</div>
        ${desc ? `<div class="q-group-desc">${desc}</div>` : ''}
      </div>
      <div class="q-group-body">${g.questions.map(q => renderQuestion(q, g.type)).join('')}</div>
    </div>`;
  }).join('');
}

function renderQuestion(q, groupType) {
  const saved = currentAnswers[q.q_number] || '';
  const type  = groupType || q.q_type;

  // ── TFNG: horizontal row [circle] [select] [statement] ─────────────────────
  if (type === 'tfng') {
    return `<div class="question-block tfng-block" id="qblock_${q.q_number}">
      <div class="tfng-row">
        <span class="q-num-circle">${q.q_number}</span>
        <select class="tfng-select" onchange="setAnswer('${q.q_number}',this.value)">
          <option value=""  ${!saved            ? 'selected' : ''}>—</option>
          <option value="TRUE"      ${saved === 'TRUE'      ? 'selected' : ''}>TRUE</option>
          <option value="FALSE"     ${saved === 'FALSE'     ? 'selected' : ''}>FALSE</option>
          <option value="NOT GIVEN" ${saved === 'NOT GIVEN' ? 'selected' : ''}>NOT GIVEN</option>
        </select>
        <span class="tfng-statement">${escHtml(q.stem)}</span>
      </div>
    </div>`;
  }

  // ── FILL: inline blank inside sentence ─────────────────────────────────────
  if (type === 'fill') {
    const stemWithInput = escHtml(q.stem).replace(
      /___/g,
      `<input type="text" class="q-fill-input" placeholder="…" value="${escHtml(saved)}" oninput="setAnswer('${q.q_number}',this.value)">`
    );
    return `<div class="question-block" id="qblock_${q.q_number}">
      <div class="q-stem"><span class="q-num-circle">${q.q_number}</span> ${stemWithInput}</div>
    </div>`;
  }

  // ── MATCHING ────────────────────────────────────────────────────────────────
  if (type === 'matching' && q.sub_questions) {
    const opts = Object.entries(q.options || {}).map(([k,v]) =>
      `<option value="${k}">${k}. ${escHtml(v)}</option>`
    ).join('');
    const rows = (q.sub_questions || []).map(sq => {
      const key    = `${q.q_number}_${sq.label}`;
      const sqSaved = currentAnswers[key] || '';
      const optsWithSelected = opts.replace(
        new RegExp(`value="${sqSaved.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"`),
        `value="${sqSaved}" selected`
      );
      return `<div class="matching-row">
        <span class="matching-label">${escHtml(sq.label)}</span>
        <select onchange="setAnswer('${key}',this.value)">
          <option value="">– Select –</option>${optsWithSelected}
        </select>
      </div>`;
    }).join('');
    return `<div class="question-block" id="qblock_${q.q_number}">
      ${rows}
    </div>`;
  }

  // ── MCQ (single or multi) ───────────────────────────────────────────────────
  const isMulti = (q.correct_answer && String(q.correct_answer).includes(',')) ||
                  /choose\s+(two|three|four|five|six|\d+)\s+letters/i.test(q.stem || '');
  const savedArr = saved.split(',').map(s => s.trim()).filter(Boolean);
  let inputHtml;
  if (isMulti) {
    inputHtml = Object.entries(q.options || {}).map(([k,v]) =>
      `<label class="q-option"><input type="checkbox" name="q_${q.q_number}" value="${k}" ${savedArr.includes(k)?'checked':''} onchange="setMcqMulti('${q.q_number}',this)"> <strong>${k}.</strong> ${escHtml(v)}</label>`
    ).join('');
  } else {
    inputHtml = Object.entries(q.options || {}).map(([k,v]) =>
      `<label class="q-option"><input type="radio" name="q_${q.q_number}" value="${k}" ${saved===k?'checked':''} onchange="setAnswer('${q.q_number}',this.value)"> <strong>${k}.</strong> ${escHtml(v)}</label>`
    ).join('');
  }
  return `<div class="question-block" id="qblock_${q.q_number}">
    <div class="q-stem"><span class="q-num-circle">${q.q_number}</span> ${escHtml(q.stem)}</div>
    <div class="q-inputs">${inputHtml}</div>
  </div>`;
}

function setAnswer(key, value) {
  currentAnswers[key] = value;
  // Update nav button
  const navBtn = document.querySelector(`.q-nav-btn[onclick*="'${key}'"]`);
  if (navBtn) navBtn.classList.toggle('answered', !!value);
}

function setMcqMulti(qNum, checkbox) {
  const checked = [...document.querySelectorAll(`input[name="q_${qNum}"]:checked`)]
    .map(cb => cb.value);
  setAnswer(String(qNum), checked.join(','));
}

function scrollToQuestion(key) {
  const baseKey = key.includes('_') ? key.split('_')[0] : key;
  const el = document.getElementById(`qblock_${baseKey}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function startTestTimer() {
  clearInterval(testTimerInterval);
  updateTimerDisplay();
  testTimerInterval = setInterval(() => {
    testTimeRemaining--;
    updateTimerDisplay();
    if (testTimeRemaining <= 0) {
      clearInterval(testTimerInterval);
      alert('⏰ Time is up! Your test will be submitted automatically.');
      submitTest();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('test-timer');
  if (!el) return;
  const mins = Math.floor(testTimeRemaining / 60);
  const secs = testTimeRemaining % 60;
  el.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  el.classList.toggle('timer-warning', testTimeRemaining <= 300);
}

function startAutosave(testId) {
  clearInterval(autosaveInterval);
  autosaveInterval = setInterval(async () => {
    if (!currentAttemptId) return;
    try {
      await api(`/api/tests/${testId}/attempts/${currentAttemptId}/autosave`, {
        method: 'PUT',
        body: JSON.stringify({ answers: currentAnswers, time_remaining_secs: testTimeRemaining })
      });
    } catch (e) { /* silent */ }
  }, 30000);
}

async function submitTest() {
  clearInterval(testTimerInterval);
  clearInterval(autosaveInterval);
  if (!currentAttemptId || !currentTestData) return;
  try {
    const result = await api(`/api/tests/${currentTestData.id}/attempts/${currentAttemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers: currentAnswers, time_remaining_secs: testTimeRemaining })
    });
    // Navigate to result view
    viewTestResult(result.attempt_id || currentAttemptId);
  } catch (err) {
    alert('Submit failed: ' + err.message);
  }
}

/* ─── Mock Tests — Result View ───────────────────────────────────────────── */
let resultPollingInterval = null;

async function viewTestResult(attemptId) {
  clearInterval(resultPollingInterval);
  showView('test-result');
  document.getElementById('test-result-content').innerHTML = '<div class="loading">Loading results…</div>';
  await fetchAndRenderResult(attemptId);
}

async function fetchAndRenderResult(attemptId) {
  try {
    const attempt = await api(`/api/tests/attempts/${attemptId}`);
    document.getElementById('test-result-title').textContent = attempt.test ? escHtml(attempt.test.title) : 'Test Result';
    renderTestResult(attempt);

    // Poll for AI explanations if not yet available
    if (attempt.status === 'completed' && attempt.score && !attempt.ai_explanations &&
        attempt.score.wrong_q_numbers && attempt.score.wrong_q_numbers.length > 0) {
      clearInterval(resultPollingInterval);
      resultPollingInterval = setInterval(async () => {
        const updated = await api(`/api/tests/attempts/${attemptId}`).catch(() => null);
        if (updated && updated.ai_explanations) {
          clearInterval(resultPollingInterval);
          renderTestResult(updated);
        }
      }, 4000);
    }
  } catch (err) {
    document.getElementById('test-result-content').innerHTML =
      `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderTestResult(attempt) {
  const el = document.getElementById('test-result-content');
  if (!attempt.score) {
    el.innerHTML = '<div class="loading">Scoring…</div>';
    return;
  }
  const { score } = attempt;
  const bandHtml = `
    <div class="result-score-card">
      <div class="result-band" style="color:${bandColor(score.band)}">${score.band}</div>
      <div class="result-band-label">Band Score</div>
      <div class="result-raw">${score.raw} / ${score.total} correct</div>
    </div>`;

  const sectionHtml = (score.section_scores || []).map(s =>
    `<div class="result-section-row">
      <span>${attempt.type === 'reading' ? 'Passage' : 'Section'} ${s.section_number}</span>
      <span>${s.correct} / ${s.total}</span>
    </div>`
  ).join('');

  // Full question review
  let reviewHtml = '';
  if (attempt.test) {
    for (const section of (attempt.test.sections || [])) {
      for (const q of (section.questions || [])) {
        if (q.q_type === 'matching' && q.sub_questions) {
          for (const sq of q.sub_questions) {
            const key = `${q.q_number}_${sq.label}`;
            const given = attempt.answers[key] || '(blank)';
            const correct = sq.correct_answer;
            const isCorrect = given.trim().toUpperCase() === (correct || '').trim().toUpperCase();
            const expl = attempt.ai_explanations && attempt.ai_explanations[key];
            reviewHtml += questionReviewHtml(key, `${escHtml(q.stem)} — "${escHtml(sq.label)}"`, given, correct, isCorrect, expl);
          }
        } else {
          const key = String(q.q_number);
          const given = attempt.answers[key] || '(blank)';
          const correct = q.correct_answer;
          const alts = q.accept_alternatives || [];
          const isCorrect = given.trim().toLowerCase() === (correct||'').trim().toLowerCase() ||
            alts.map(a=>a.toLowerCase()).includes(given.trim().toLowerCase());
          const expl = attempt.ai_explanations && attempt.ai_explanations[key];
          reviewHtml += questionReviewHtml(key, escHtml(q.stem), given, correct, isCorrect, expl);
        }
      }
    }
  }

  const explNote = !attempt.ai_explanations && score.wrong_q_numbers && score.wrong_q_numbers.length
    ? `<div class="expl-loading-note">⏳ Explanations are being generated… check back in a few seconds.</div>`
    : '';

  el.innerHTML = `
    ${bandHtml}
    <div class="result-sections">
      <h3>Section Breakdown</h3>
      ${sectionHtml}
    </div>
    ${reviewHtml ? `<div class="result-review"><h3>Question Review</h3>${explNote}${reviewHtml}</div>` : ''}`;
}

function questionReviewHtml(key, stemHtml, given, correct, isCorrect, explanation) {
  const cls = isCorrect ? 'correct' : 'wrong';
  const icon = isCorrect ? '✅' : '❌';
  const corrPart = !isCorrect ? `<span class="correct-answer">Correct: <strong>${escHtml(correct || '')}</strong></span>` : '';
  const explPart = explanation ? `<div class="ai-explanation-box">💡 ${escHtml(explanation)}</div>` : '';
  return `<div class="question-result ${cls}">
    <div class="q-result-header">${icon} <strong>Q${key}</strong>: ${stemHtml}</div>
    <div class="q-result-answer">Your answer: <em>${escHtml(given)}</em> ${corrPart}</div>
    ${explPart}
  </div>`;
}

/* ─── Mock Tests — History ───────────────────────────────────────────────── */
async function loadTestHistory() {
  const el = document.getElementById('test-history-content');
  el.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const attempts = await api('/api/tests/attempts');
    if (!attempts.length) {
      el.innerHTML = '<div class="empty-state">No test attempts yet. <a href="#" onclick="showView(\'test-list\')">Take a mock test!</a></div>';
      return;
    }
    el.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Test</th><th>Type</th><th>Date</th><th>Raw Score</th><th>Band</th><th></th></tr></thead>
          <tbody>
            ${attempts.map(a => `
              <tr>
                <td>${escHtml(a.test_title)}</td>
                <td><span class="badge ${a.type==='reading'?'badge-blue':'badge-orange'}">${a.type}</span></td>
                <td>${a.submitted_at ? formatDate(a.submitted_at) : formatDate(a.started_at)}</td>
                <td>${a.score ? `${a.score.raw}/${a.score.total}` : '–'}</td>
                <td>${a.score ? `<span style="color:${bandColor(a.score.band)};font-weight:700">${a.score.band}</span>` : '–'}</td>
                <td>${a.status==='completed' ? `<button class="btn btn-secondary btn-xs" onclick="viewTestResult(${a.id})">View</button>` : '<span class="badge badge-gray">In Progress</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

/* ─── Admin Materials ────────────────────────────────────────────────────── */
let currentMaterialsTab = 'reading';
let _materialsCache = null;

function switchMaterialsTab(type) {
  currentMaterialsTab = type;
  document.getElementById('materials-tab-reading').classList.toggle('active', type === 'reading');
  document.getElementById('materials-tab-listening').classList.toggle('active', type === 'listening');
  const task1TabBtn = document.getElementById('materials-tab-task1');
  if (task1TabBtn) task1TabBtn.classList.toggle('active', type === 'task1');

  // Show/hide task1 panel vs reading/listening UI
  const task1Panel = document.getElementById('task1-topics-panel');
  const listContent = document.getElementById('materials-list-content');
  const actionTabs = document.querySelector('.materials-action-tabs');
  const createPanel = document.getElementById('mat-panel-create');

  if (type === 'task1') {
    if (task1Panel) task1Panel.classList.remove('hidden');
    if (listContent) listContent.classList.add('hidden');
    if (actionTabs) actionTabs.classList.add('hidden');
    if (createPanel) createPanel.classList.add('hidden');
    loadTask1Topics();
  } else {
    if (task1Panel) task1Panel.classList.add('hidden');
    if (listContent) listContent.classList.remove('hidden');
    if (actionTabs) actionTabs.classList.remove('hidden');
    renderMaterialsList();
    // Reset create form
    if (createPanel) createPanel.classList.add('hidden');
    buildSectionsForm();
  }
}

async function loadAdminMaterials() {
  // Default to reading tab on fresh load
  if (currentMaterialsTab === 'task1') currentMaterialsTab = 'reading';
  // Ensure task1 panel is hidden on fresh load
  const task1Panel = document.getElementById('task1-topics-panel');
  if (task1Panel) task1Panel.classList.add('hidden');
  const listContent = document.getElementById('materials-list-content');
  if (listContent) listContent.classList.remove('hidden');
  const actionTabs = document.querySelector('.materials-action-tabs');
  if (actionTabs) actionTabs.classList.remove('hidden');
  // Sync tab buttons
  const tabR = document.getElementById('materials-tab-reading');
  const tabL = document.getElementById('materials-tab-listening');
  const tabT = document.getElementById('materials-tab-task1');
  if (tabR) tabR.classList.toggle('active', currentMaterialsTab === 'reading');
  if (tabL) tabL.classList.toggle('active', currentMaterialsTab === 'listening');
  if (tabT) tabT.classList.remove('active');

  const el = document.getElementById('materials-list-content');
  el.innerHTML = '<div class="loading">Loading…</div>';
  try {
    _materialsCache = await api('/api/admin/tests');
    buildSectionsForm();
    renderMaterialsList();
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderMaterialsList() {
  const el = document.getElementById('materials-list-content');
  if (!_materialsCache) return;
  const filtered = (_materialsCache || []).filter(t => t.type === currentMaterialsTab);
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state">No ${currentMaterialsTab} tests yet.</div>`;
    return;
  }
  el.innerHTML = `<div class="materials-list">` + filtered.map(t => `
    <div class="materials-item">
      <div class="materials-item-info">
        <strong>${escHtml(t.title)}</strong>
        <span class="materials-meta">${t.section_count} sections · ${t.question_count} questions</span>
      </div>
      <button class="btn btn-danger btn-xs" onclick="deleteMaterialsTest(${t.id}, '${t.title.replace(/'/g,"\\'")}')">Delete</button>
    </div>`).join('') + `</div>`;
}

async function deleteMaterialsTest(id, title) {
  if (!confirm(`Delete test "${title}" and all its student attempts?`)) return;
  try {
    await api(`/api/admin/tests/${id}`, { method: 'DELETE' });
    _materialsCache = (_materialsCache || []).filter(t => t.id !== id);
    renderMaterialsList();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

/* ─── Task 1 Topics Admin ────────────────────────────────────────────────── */

// State for admin image upload
let _t1AdminImageBase64 = null;
let _t1AdminImageMediaType = null;

function handleT1AdminImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Image too large — max 5 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // dataUrl = "data:image/jpeg;base64,/9j/..."
    const [meta, b64] = dataUrl.split(',');
    _t1AdminImageBase64 = b64;
    _t1AdminImageMediaType = meta.replace('data:', '').replace(';base64', '');
    // Show preview
    const preview = document.getElementById('t1-image-preview');
    const area = document.getElementById('t1-image-area');
    const removeBtn = document.getElementById('t1-remove-image-btn');
    if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
    if (area) area.style.borderColor = 'var(--primary)';
    if (removeBtn) removeBtn.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeT1AdminImage() {
  _t1AdminImageBase64 = null;
  _t1AdminImageMediaType = null;
  const preview = document.getElementById('t1-image-preview');
  const area = document.getElementById('t1-image-area');
  const removeBtn = document.getElementById('t1-remove-image-btn');
  const fileInput = document.getElementById('t1-image-input');
  if (preview) { preview.src = ''; preview.classList.add('hidden'); }
  if (area) area.style.borderColor = '';
  if (removeBtn) removeBtn.classList.add('hidden');
  if (fileInput) fileInput.value = '';
}

async function uploadTask1Topic() {
  const chartType = document.getElementById('t1-chart-type')?.value;
  const label = document.getElementById('t1-label')?.value.trim();
  const question = document.getElementById('t1-question')?.value.trim();
  const errEl = document.getElementById('t1-upload-error');
  const successEl = document.getElementById('t1-upload-success');
  const btn = document.querySelector('#task1-topics-panel .btn-primary');

  if (errEl) errEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');

  if (!chartType) { if (errEl) { errEl.textContent = 'Please select a chart type.'; errEl.classList.remove('hidden'); } return; }
  if (!question) { if (errEl) { errEl.textContent = 'Please paste the IELTS question.'; errEl.classList.remove('hidden'); } return; }
  if (!_t1AdminImageBase64) { if (errEl) { errEl.textContent = 'Please upload a chart image.'; errEl.classList.remove('hidden'); } return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
  try {
    await api('/api/admin/task1-topics', {
      method: 'POST',
      body: JSON.stringify({
        chart_type: chartType,
        label: label || '',
        question,
        image_base64: _t1AdminImageBase64,
        image_media_type: _t1AdminImageMediaType,
      }),
    });
    if (successEl) { successEl.textContent = '✅ Topic uploaded successfully!'; successEl.classList.remove('hidden'); }
    // Reset form
    document.getElementById('t1-label').value = '';
    document.getElementById('t1-question').value = '';
    removeT1AdminImage();
    // Reload list
    loadTask1Topics();
  } catch (err) {
    if (errEl) { errEl.textContent = '❌ ' + err.message; errEl.classList.remove('hidden'); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Upload Topic'; }
  }
}

async function loadTask1Topics() {
  const listEl = document.getElementById('task1-topics-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading">Loading topics…</div>';
  try {
    const topics = await api('/api/admin/task1-topics');
    renderTask1TopicsList(topics);
  } catch (err) {
    listEl.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderTask1TopicsList(topics) {
  const listEl = document.getElementById('task1-topics-list');
  if (!listEl) return;
  if (!topics || !topics.length) {
    listEl.innerHTML = '<div class="empty-state" style="margin-top:16px">No Task 1 topics uploaded yet.</div>';
    return;
  }

  const TYPE_LABELS = {
    bar_chart: '📊 Bar Chart',
    line_graph: '📈 Line Graph',
    pie_chart: '🥧 Pie Chart',
    table: '📋 Table',
    process_diagram: '⚙️ Process Diagram',
    map: '🗺️ Map',
  };

  // Group by chart_type
  const grouped = {};
  topics.forEach(t => {
    if (!grouped[t.chart_type]) grouped[t.chart_type] = [];
    grouped[t.chart_type].push(t);
  });

  listEl.innerHTML = Object.keys(grouped).map(type => `
    <div class="t1-group">
      <h4 class="t1-group-header">${TYPE_LABELS[type] || type} <span class="badge badge-gray">${grouped[type].length}</span></h4>
      <div class="t1-topics-grid">
        ${grouped[type].map(t => `
          <div class="t1-topic-card">
            <div class="t1-topic-meta">
              <span class="t1-topic-label">${escHtml(t.label || '(no label)')}</span>
              <span class="t1-topic-date">${formatDate(t.created_at)}</span>
            </div>
            <p class="t1-topic-preview">${escHtml(t.question_preview)}</p>
            <button class="btn btn-danger btn-xs" onclick="deleteTask1TopicAdmin(${t.id})">Delete</button>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

async function deleteTask1TopicAdmin(id) {
  if (!confirm('Delete this Task 1 topic? Students will no longer see it.')) return;
  try {
    await api(`/api/admin/task1-topics/${id}`, { method: 'DELETE' });
    loadTask1Topics();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

function toggleCreateTestForm() {
  const form = document.getElementById('mat-panel-create');
  if (!form) return;
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) buildSectionsForm();
}

function buildSectionsForm() {
  const count = currentMaterialsTab === 'reading' ? 3 : 4;
  const container = document.getElementById('sections-container');
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, (_, i) => buildSectionHtml(i + 1)).join('');
}

function buildSectionHtml(num) {
  const isReading = currentMaterialsTab === 'reading';
  const passageOrAudio = isReading
    ? `<div class="form-group">
         <label>Passage Title</label>
         <input type="text" id="sec${num}_title" placeholder="Passage title" />
       </div>
       <div class="form-group">
         <label>Passage Text</label>
         <textarea id="sec${num}_passage" rows="6" placeholder="Paste the full passage text here…"></textarea>
       </div>`
    : `<div class="form-group">
         <label>Audio URL</label>
         <input type="url" id="sec${num}_audio" placeholder="https://..." />
       </div>
       <div class="form-group">
         <label>Transcript (optional)</label>
         <textarea id="sec${num}_transcript" rows="4" placeholder="Paste transcript…"></textarea>
       </div>`;

  return `<div class="section-form-block">
    <div class="section-form-header">
      <h4>${isReading ? 'Passage' : 'Section'} ${num}</h4>
    </div>
    ${passageOrAudio}
    <div id="questions_sec${num}" class="questions-list"></div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addQuestion(${num})">+ Add Question</button>
  </div>`;
}

let questionCounters = {};

function addQuestion(sectionNum) {
  if (!questionCounters[sectionNum]) questionCounters[sectionNum] = 0;
  questionCounters[sectionNum]++;
  const qIdx = questionCounters[sectionNum];
  const container = document.getElementById(`questions_sec${sectionNum}`);
  const div = document.createElement('div');
  div.className = 'question-builder-row';
  div.id = `qbuilder_${sectionNum}_${qIdx}`;
  div.innerHTML = buildQuestionBuilderHtml(sectionNum, qIdx);
  container.appendChild(div);
}

function buildQuestionBuilderHtml(sn, qi) {
  return `<div class="qb-header">
    <span class="qb-num">Q</span>
    <input type="number" id="qnum_${sn}_${qi}" placeholder="Q#" class="qb-num-input" min="1" />
    <select id="qtype_${sn}_${qi}" onchange="updateQuestionFields(${sn},${qi})">
      <option value="mcq">Multiple Choice</option>
      <option value="tfng">True/False/Not Given</option>
      <option value="fill">Fill in Blank</option>
      <option value="matching">Matching</option>
    </select>
    <button class="btn btn-danger btn-xs" onclick="document.getElementById('qbuilder_${sn}_${qi}').remove()">✕</button>
  </div>
  <div id="qfields_${sn}_${qi}">
    ${mcqFieldsHtml(sn, qi)}
  </div>`;
}

function updateQuestionFields(sn, qi) {
  const type = document.getElementById(`qtype_${sn}_${qi}`).value;
  const container = document.getElementById(`qfields_${sn}_${qi}`);
  if (type === 'mcq') container.innerHTML = mcqFieldsHtml(sn, qi);
  else if (type === 'tfng') container.innerHTML = tfngFieldsHtml(sn, qi);
  else if (type === 'fill') container.innerHTML = fillFieldsHtml(sn, qi);
  else if (type === 'matching') container.innerHTML = matchingFieldsHtml(sn, qi);
}

function mcqFieldsHtml(sn, qi) {
  return `<div class="form-group"><label>Question Stem</label><input type="text" id="qstem_${sn}_${qi}" placeholder="According to the passage…" /></div>
    <div class="qb-options">
      ${['A','B','C','D'].map(k => `<div class="qb-opt-row"><strong>${k}.</strong><input type="text" id="qopt_${sn}_${qi}_${k}" placeholder="Option ${k}" /></div>`).join('')}
    </div>
    <div class="form-group"><label>Correct Answer</label>
      <select id="qcorrect_${sn}_${qi}"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select>
    </div>`;
}

function tfngFieldsHtml(sn, qi) {
  return `<div class="form-group"><label>Statement</label><input type="text" id="qstem_${sn}_${qi}" placeholder="The author believes that…" /></div>
    <div class="form-group"><label>Correct Answer</label>
      <select id="qcorrect_${sn}_${qi}"><option value="TRUE">TRUE</option><option value="FALSE">FALSE</option><option value="NOT GIVEN">NOT GIVEN</option></select>
    </div>`;
}

function fillFieldsHtml(sn, qi) {
  return `<div class="form-group"><label>Sentence with blank (use ___ for blank)</label><input type="text" id="qstem_${sn}_${qi}" placeholder="The river flows through ___ before reaching the sea." /></div>
    <div class="form-group"><label>Correct Answer</label><input type="text" id="qcorrect_${sn}_${qi}" placeholder="Answer" /></div>
    <div class="form-group"><label>Accepted Alternatives (comma-separated)</label><input type="text" id="qalts_${sn}_${qi}" placeholder="alt1, alt2" /></div>`;
}

function matchingFieldsHtml(sn, qi) {
  return `<div class="form-group"><label>Instruction Stem</label><input type="text" id="qstem_${sn}_${qi}" placeholder="Match each place with a feature." /></div>
    <div class="form-group"><label>Options (one per line, format: A. Description)</label><textarea id="qopts_${sn}_${qi}" rows="4" placeholder="A. Description of A&#10;B. Description of B"></textarea></div>
    <div class="form-group"><label>Sub-questions (one per line, format: Label | Correct Answer Letter)</label><textarea id="qsubs_${sn}_${qi}" rows="3" placeholder="London | A&#10;Paris | B"></textarea></div>`;
}

/* ─── Materials: Action Tab Switcher ─────────────────────────────────────── */
function switchMaterialsAction(tab) {
  const isPanelCreate = tab === 'create';
  document.getElementById('mat-action-tab-create').classList.toggle('active', isPanelCreate);
  document.getElementById('mat-action-tab-import').classList.toggle('active', !isPanelCreate);
  document.getElementById('mat-panel-create').classList.toggle('hidden', !isPanelCreate);
  document.getElementById('mat-panel-import').classList.toggle('hidden', isPanelCreate);
}

/* ─── Materials: JSON Import ─────────────────────────────────────────────── */
function validateImportJson() {
  const raw = document.getElementById('import-json-input').value.trim();
  const resultEl = document.getElementById('import-validation-result');
  resultEl.classList.remove('hidden');

  if (!raw) {
    resultEl.innerHTML = `<div class="import-validation-error">⚠️ Nothing to validate — paste your JSON first.</div>`;
    return false;
  }

  let test;
  try {
    test = JSON.parse(raw);
  } catch (e) {
    resultEl.innerHTML = `<div class="import-validation-error">❌ Invalid JSON syntax: ${escHtml(e.message)}</div>`;
    return false;
  }

  const errors = [];

  if (!test.type || !['reading', 'listening'].includes(test.type)) {
    errors.push('Missing or invalid "type" — must be "reading" or "listening".');
  }
  if (!test.title || typeof test.title !== 'string' || !test.title.trim()) {
    errors.push('Missing or empty "title".');
  }
  if (!Array.isArray(test.sections) || test.sections.length === 0) {
    errors.push('"sections" must be a non-empty array.');
  } else {
    const seenNums = new Set();
    test.sections.forEach((sec, si) => {
      if (!Array.isArray(sec.questions)) {
        errors.push(`Section ${si + 1}: "questions" must be an array.`);
        return;
      }
      sec.questions.forEach((q, qi) => {
        const loc = `Section ${si + 1}, Q${qi + 1}`;
        if (!q.q_number) errors.push(`${loc}: missing "q_number".`);
        else if (seenNums.has(q.q_number)) errors.push(`${loc}: duplicate q_number ${q.q_number}.`);
        else seenNums.add(q.q_number);

        const validTypes = ['mcq', 'tfng', 'fill', 'matching'];
        if (!validTypes.includes(q.q_type)) {
          errors.push(`${loc}: invalid q_type "${q.q_type}". Must be one of: ${validTypes.join(', ')}.`);
        }
        if (q.q_type === 'tfng' && !['TRUE', 'FALSE', 'NOT GIVEN'].includes(q.correct_answer)) {
          errors.push(`${loc}: TFNG correct_answer must be exactly TRUE, FALSE, or NOT GIVEN.`);
        }
        if (q.q_type === 'mcq') {
          if (!q.options || typeof q.options !== 'object' || !Object.keys(q.options).length) {
            errors.push(`${loc}: MCQ questions need an "options" object (e.g. {"A":"...", "B":"..."}).`);
          } else {
            // correct_answer can be a single key ("B") or comma-separated keys ("B,D,G,H")
            const optionKeys = Object.keys(q.options).map(k => k.trim().toUpperCase());
            const answerKeys = String(q.correct_answer).split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
            if (!answerKeys.length) {
              errors.push(`${loc}: MCQ correct_answer is missing.`);
            } else {
              const invalid = answerKeys.filter(k => !optionKeys.includes(k));
              if (invalid.length) {
                errors.push(`${loc}: MCQ correct_answer "${invalid.join(',')}" not found in options.`);
              }
            }
          }
        }
        if (q.q_type === 'matching' && (!Array.isArray(q.sub_questions) || q.sub_questions.length === 0)) {
          errors.push(`${loc}: matching questions must have a "sub_questions" array.`);
        }
      });
    });
  }

  if (errors.length > 0) {
    resultEl.innerHTML = `<div class="import-validation-error">
      <strong>❌ Found ${errors.length} issue${errors.length > 1 ? 's' : ''}:</strong>
      <ul>${errors.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>
    </div>`;
    return false;
  }

  // Count totals
  const totalQ = test.sections.reduce((s, sec) => s + (sec.questions || []).length, 0);
  resultEl.innerHTML = `<div class="import-validation-ok">
    ✅ Valid! <strong>${escHtml(test.title)}</strong> · ${test.type} · ${test.sections.length} sections · ${totalQ} questions
  </div>`;
  return true;
}

async function submitImportTest() {
  const raw = document.getElementById('import-json-input').value.trim();
  const errEl = document.getElementById('import-error');
  const sucEl = document.getElementById('import-success');
  const btn = document.getElementById('import-submit-btn');

  errEl.classList.add('hidden');
  sucEl.classList.add('hidden');

  if (!validateImportJson()) return; // shows its own error in validation result

  btn.disabled = true;
  btn.textContent = 'Importing…';
  try {
    const data = await api('/api/admin/tests/import', {
      method: 'POST',
      body: JSON.stringify({ json_text: raw }),
    });
    sucEl.textContent = `✅ ${data.message}`;
    sucEl.classList.remove('hidden');
    document.getElementById('import-json-input').value = '';
    document.getElementById('import-validation-result').classList.add('hidden');
    // Refresh materials list
    _materialsCache = await api('/api/admin/tests');
    renderMaterialsList();
  } catch (err) {
    errEl.textContent = '❌ ' + err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '⬆ Import Test';
  }
}

function downloadImportTemplate() {
  const isReading = currentMaterialsTab === 'reading';
  const sectionCount = isReading ? 3 : 4;
  const sectionTemplate = (num) => ({
    section_number: num,
    ...(isReading
      ? { passage_title: `Passage ${num} Title`, passage_text: 'Paste the full passage text here.' }
      : { audio_url: 'https://...', transcript: 'Optional transcript text.' }),
    questions: [
      { q_number: (num - 1) * 10 + 1, q_type: 'tfng', stem: 'Statement to evaluate.', correct_answer: 'TRUE' },
      { q_number: (num - 1) * 10 + 2, q_type: 'mcq', stem: 'According to the passage…', options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' }, correct_answer: 'A' },
      { q_number: (num - 1) * 10 + 3, q_type: 'fill', stem: 'The river flows through ___ before reaching the sea.', correct_answer: 'answer', accept_alternatives: ['alt1'] },
      { q_number: (num - 1) * 10 + 4, q_type: 'matching', stem: 'Match each item to a category.', options: { A: 'Category A', B: 'Category B' }, sub_questions: [{ label: 'Item 1', correct_answer: 'A' }, { label: 'Item 2', correct_answer: 'B' }] },
    ],
  });

  const template = {
    type: isReading ? 'reading' : 'listening',
    title: isReading ? 'Academic Reading Test 1' : 'Listening Test 1',
    sections: Array.from({ length: sectionCount }, (_, i) => sectionTemplate(i + 1)),
  };

  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.type}-test-template.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function collectSectionsData() {
  const count = currentMaterialsTab === 'reading' ? 3 : 4;
  const isReading = currentMaterialsTab === 'reading';
  const sections = [];

  for (let sn = 1; sn <= count; sn++) {
    const section = {
      section_number: sn,
      passage_title: isReading ? (document.getElementById(`sec${sn}_title`)?.value || '') : '',
      passage_text: isReading ? (document.getElementById(`sec${sn}_passage`)?.value || '') : '',
      audio_url: !isReading ? (document.getElementById(`sec${sn}_audio`)?.value || '') : '',
      transcript: !isReading ? (document.getElementById(`sec${sn}_transcript`)?.value || '') : '',
      questions: []
    };

    // Collect questions for this section
    const qContainer = document.getElementById(`questions_sec${sn}`);
    if (!qContainer) { sections.push(section); continue; }
    const qRows = qContainer.querySelectorAll('.question-builder-row');

    for (const row of qRows) {
      const rowId = row.id; // qbuilder_SN_QI
      const parts = rowId.split('_');
      const qi = parts[parts.length - 1];
      const sni = parts[parts.length - 2];
      const qnum = parseInt(document.getElementById(`qnum_${sni}_${qi}`)?.value || '0', 10);
      const qtype = document.getElementById(`qtype_${sni}_${qi}`)?.value || 'mcq';
      const stem = document.getElementById(`qstem_${sni}_${qi}`)?.value || '';

      const q = { q_number: qnum, q_type: qtype, stem };

      if (qtype === 'mcq') {
        q.options = {};
        for (const k of ['A','B','C','D']) {
          const v = document.getElementById(`qopt_${sni}_${qi}_${k}`)?.value || '';
          if (v) q.options[k] = v;
        }
        q.correct_answer = document.getElementById(`qcorrect_${sni}_${qi}`)?.value || 'A';
      } else if (qtype === 'tfng') {
        q.correct_answer = document.getElementById(`qcorrect_${sni}_${qi}`)?.value || 'TRUE';
      } else if (qtype === 'fill') {
        q.correct_answer = document.getElementById(`qcorrect_${sni}_${qi}`)?.value || '';
        const altsRaw = document.getElementById(`qalts_${sni}_${qi}`)?.value || '';
        q.accept_alternatives = altsRaw.split(',').map(s => s.trim()).filter(Boolean);
      } else if (qtype === 'matching') {
        const optsRaw = document.getElementById(`qopts_${sni}_${qi}`)?.value || '';
        q.options = {};
        for (const line of optsRaw.split('\n')) {
          const m = line.match(/^([A-Z])\.\s*(.+)/);
          if (m) q.options[m[1]] = m[2].trim();
        }
        const subsRaw = document.getElementById(`qsubs_${sni}_${qi}`)?.value || '';
        q.sub_questions = subsRaw.split('\n').filter(Boolean).map(line => {
          const [label, ans] = line.split('|').map(s => s.trim());
          return { label: label || '', correct_answer: ans || '' };
        });
      }
      if (qnum > 0) section.questions.push(q);
    }
    sections.push(section);
  }
  return sections;
}

async function submitCreateTest() {
  const errEl = document.getElementById('create-test-error');
  errEl.classList.add('hidden');
  const title = document.getElementById('new-test-title')?.value?.trim();
  if (!title) { errEl.textContent = 'Please enter a test title.'; errEl.classList.remove('hidden'); return; }
  const sections = collectSectionsData();
  const totalQ = sections.reduce((n, s) => n + s.questions.length, 0);
  if (totalQ === 0) { errEl.textContent = 'Please add at least one question.'; errEl.classList.remove('hidden'); return; }
  try {
    await api('/api/admin/tests', {
      method: 'POST',
      body: JSON.stringify({ type: currentMaterialsTab, title, sections })
    });
    // Refresh
    _materialsCache = await api('/api/admin/tests');
    renderMaterialsList();
    // Reset form
    document.getElementById('mat-panel-create').classList.add('hidden');
    document.getElementById('new-test-title').value = '';
    questionCounters = {};
    buildSectionsForm();
  } catch (err) {
    errEl.textContent = 'Failed to create test: ' + err.message;
    errEl.classList.remove('hidden');
  }
}

/* ─── Test Back / Discard / Partial Submit ────────────────────────────────── */
function handleTestBack() {
  const answeredCount = Object.values(currentAnswers).filter(v => v !== '' && v !== null && v !== undefined).length;
  const totalQuestions = currentTestData
    ? currentTestData.sections.reduce((sum, s) => sum + (s.questions ? s.questions.length : 0), 0)
    : 0;
  if (answeredCount > 0) {
    document.getElementById('discard-modal-overlay').classList.remove('hidden');
  } else {
    handleDiscardTest();
  }
}

function closeDiscardModal() {
  document.getElementById('discard-modal-overlay').classList.add('hidden');
}

function handleDiscardTest() {
  closeDiscardModal();
  if (testTimerInterval) {
    clearInterval(testTimerInterval);
    testTimerInterval = null;
  }
  currentTestData = null;
  currentAttemptId = null;
  currentAnswers = {};
  currentTestType = null;
  document.getElementById('app-screen').classList.remove('test-mode');
  showView('test-list');
}

function handlePartialSubmit() {
  closeDiscardModal();
  submitTest();
}

/* ─── Homework (Student View) ─────────────────────────────────────────────── */

async function loadHomework() {
  const el = document.getElementById('homework-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading homework…</div>';
  try {
    const assignments = await api('/api/assignments');
    if (!assignments.length) {
      el.innerHTML = '<div class="empty-state">No assignments yet. Your teacher will set homework here.</div>';
      return;
    }
    const now = new Date();
    const upcoming = assignments.filter(a => !a.completed && new Date(a.deadline) > now);
    const overdue = assignments.filter(a => !a.completed && new Date(a.deadline) <= now);
    const done = assignments.filter(a => a.completed);

    let html = '';
    if (overdue.length) {
      html += `<h3 class="hw-section-title hw-overdue-title">⚠️ Overdue (${overdue.length})</h3>`;
      html += overdue.map(a => renderHomeworkCard(a, 'overdue')).join('');
    }
    if (upcoming.length) {
      html += `<h3 class="hw-section-title">📅 Upcoming (${upcoming.length})</h3>`;
      html += upcoming.map(a => renderHomeworkCard(a, 'pending')).join('');
    }
    if (done.length) {
      html += `<h3 class="hw-section-title" style="margin-top:32px">✅ Completed (${done.length})</h3>`;
      html += done.map(a => renderHomeworkCard(a, 'done')).join('');
    }
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function renderHomeworkCard(a, status) {
  const typeLabels = {
    writing_task1: '✏️ Writing Task 1',
    writing_task2: '✏️ Writing Task 2',
    reading: '📖 Reading Test',
    listening: '🎧 Listening Test'
  };
  const typeLabel = typeLabels[a.type] || a.type;
  const deadline = new Date(a.deadline);
  const now = new Date();
  const diffMs = deadline - now;
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeStr = '';
  if (status === 'done') {
    timeStr = `Completed ${formatDate(a.completed_at)}`;
  } else if (status === 'overdue') {
    timeStr = `Overdue — was due ${formatDate(a.deadline)}`;
  } else if (diffDays >= 1) {
    timeStr = `Due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${formatDate(a.deadline)})`;
  } else if (diffHours >= 1) {
    timeStr = `Due in ${diffHours} hour${diffHours > 1 ? 's' : ''} — ${formatDate(a.deadline)}`;
  } else {
    timeStr = `Due very soon — ${formatDate(a.deadline)}`;
  }

  // Color-coded countdown badge
  let countdownBadge = '';
  if (status === 'done') {
    countdownBadge = '<span class="hw-countdown hw-countdown-done">✓ Done</span>';
  } else if (status === 'overdue') {
    countdownBadge = '<span class="hw-countdown hw-countdown-overdue">⏰ Overdue</span>';
  } else if (diffDays >= 2) {
    countdownBadge = `<span class="hw-countdown hw-countdown-safe">⏳ ${diffDays}d left</span>`;
  } else if (diffDays >= 1) {
    countdownBadge = `<span class="hw-countdown hw-countdown-warn">⚠️ ${diffDays}d left</span>`;
  } else if (diffHours >= 1) {
    countdownBadge = `<span class="hw-countdown hw-countdown-urgent">🔴 ${diffHours}h left</span>`;
  } else {
    countdownBadge = '<span class="hw-countdown hw-countdown-urgent">🔴 Due very soon</span>';
  }

  const statusBadge = {
    pending: '<span class="hw-badge hw-badge-pending">Pending</span>',
    overdue: '<span class="hw-badge hw-badge-overdue">Overdue</span>',
    done: '<span class="hw-badge hw-badge-done">✓ Done</span>'
  }[status] || '';

  let actionBtn = '';
  if (status === 'done') {
    actionBtn = '<span class="text-muted" style="font-size:0.85rem">Completed</span>';
  } else if (a.type.startsWith('writing')) {
    const taskType = a.type === 'writing_task2' ? 'task2' : 'task1';
    actionBtn = `<button class="btn btn-primary btn-sm" onclick="startHomeworkWriting(${a.id}, '${taskType}')">Start Writing</button>`;
  } else if (a.test_id) {
    actionBtn = `<button class="btn btn-primary btn-sm" onclick="startHomeworkTest(${a.id}, ${a.test_id})">Start Test</button>`;
  } else {
    actionBtn = `<button class="btn btn-secondary btn-sm" onclick="markHomeworkDone(${a.id})">Mark as Done</button>`;
  }

  return `
    <div class="hw-card ${status === 'overdue' ? 'hw-card-overdue' : status === 'done' ? 'hw-card-done' : ''}">
      <div class="hw-card-header">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="hw-type-badge">${typeLabel}</span>
          ${statusBadge}
          ${countdownBadge}
        </div>
        <div class="hw-deadline">${timeStr}</div>
      </div>
      <h4 class="hw-card-title">${a.title}</h4>
      ${a.description ? `<p class="hw-card-desc">${a.description}</p>` : ''}
      ${a.test_title ? `<p class="hw-card-test">Linked test: <strong>${a.test_title}</strong></p>` : ''}
      <div class="hw-card-actions">${actionBtn}</div>
    </div>
  `;
}

function startHomeworkWriting(assignmentId, taskType) {
  // Switch to writing view and pre-select task type, then mark done after submission
  showView('submit');
  // Set task type in the writing form if possible
  const taskTypeEl = document.getElementById('task-type');
  if (taskTypeEl) {
    taskTypeEl.value = taskType;
    taskTypeEl.dispatchEvent(new Event('change'));
  }
  // Store assignment id to mark complete after submission
  window._pendingHomeworkAssignmentId = assignmentId;
}

function startHomeworkTest(assignmentId, testId) {
  window._pendingHomeworkAssignmentId = assignmentId;
  // Navigate to the specific test directly
  // startTest() lives in the test-taking section and handles the full flow
  showView('test-list');
  // After test list loads, trigger this specific test
  setTimeout(() => startTest(testId), 400);
}

async function markHomeworkDone(assignmentId) {
  if (!confirm('Mark this assignment as completed?')) return;
  try {
    await api(`/api/assignments/${assignmentId}/complete`, { method: 'POST' });
    loadHomework();
  } catch (err) {
    alert('Failed to mark as done: ' + err.message);
  }
}

/* ─── Admin Assignments ───────────────────────────────────────────────────── */

async function loadAdminAssignments() {
  const el = document.getElementById('admin-assignments-list');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading…</div>';

  // Also populate the test selector and student list in the create form
  try {
    const [assignments, readingTests, listeningTests, usersData] = await Promise.all([
      api('/api/admin/assignments'),
      api('/api/admin/tests?type=reading').catch(() => []),
      api('/api/admin/tests?type=listening').catch(() => []),
      api('/api/admin/users').catch(() => ({ users: [] }))
    ]);

    const allTests = [...readingTests, ...listeningTests];
    const testSel = document.getElementById('assign-test-id');
    if (testSel) {
      testSel.innerHTML = '<option value="">— Select a test —</option>' +
        allTests.map(t => `<option value="${t.id}">[${t.type}] ${t.title}</option>`).join('');
    }

    // Populate student multi-select
    const studentListEl = document.getElementById('assign-students-list');
    if (studentListEl) {
      const students = (usersData.users || []).filter(u => u.role !== 'admin');
      if (students.length) {
        studentListEl.innerHTML = students.map(u => `
          <label class="assign-student-row">
            <input type="checkbox" class="assign-student-cb" value="${u.id}">
            <span>${escHtml(u.name)}</span>
            <span class="form-hint" style="margin-left:auto">${escHtml(u.email)}</span>
          </label>
        `).join('');
      } else {
        studentListEl.innerHTML = '<div class="form-hint">No students enrolled yet.</div>';
      }
    }

    if (!assignments.length) {
      el.innerHTML = '<div class="empty-state">No assignments yet. Create one above.</div>';
      return;
    }

    el.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Assigned To</th>
              <th>Deadline</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${assignments.map(a => {
              const now = new Date();
              const dl = new Date(a.deadline);
              const overdue = dl < now;
              // Who it's assigned to
              let assignedLabel;
              if (!a.assigned_to || a.assigned_to.length === 0) {
                assignedLabel = '<span class="badge badge-gray">All students</span>';
              } else if (a.assigned_to_details && a.assigned_to_details.length) {
                assignedLabel = a.assigned_to_details.map(d => `<span class="badge badge-blue" style="margin-right:2px">${escHtml(d.name)}</span>`).join('');
              } else {
                assignedLabel = `<span class="badge badge-blue">${a.assigned_to.length} student${a.assigned_to.length !== 1 ? 's' : ''}</span>`;
              }
              return `
                <tr>
                  <td><strong>${a.title}</strong>${a.description ? `<br><small class="text-muted">${a.description.slice(0,60)}${a.description.length>60?'…':''}</small>` : ''}</td>
                  <td><span class="badge badge-gray">${a.type.replace('_', ' ')}</span></td>
                  <td>${assignedLabel}</td>
                  <td class="${overdue ? 'text-danger' : ''}">${formatDate(a.deadline)}</td>
                  <td>${(() => {
                    const comps = a.completed_by || [];
                    if (!comps.length) return '<span class="badge badge-gray">0 submitted</span>';
                    return comps.map(c => {
                      const badge = c.is_late
                        ? `<span class="badge badge-late" title="Submitted ${formatDate(c.completed_at)}">⚠️ ${escHtml(c.name)} — Late</span>`
                        : `<span class="badge badge-ontime" title="Submitted ${formatDate(c.completed_at)}">✅ ${escHtml(c.name)}</span>`;
                      return badge;
                    }).join(' ');
                  })()}</td>
                  <td><button class="btn btn-danger btn-xs" onclick="confirmDeleteAssignment(${a.id}, '${a.title.replace(/'/g, "\\'")}')">Delete</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="error-msg" style="display:block">${err.message}</div>`;
  }
}

function updateAssignTestField() {
  const type = document.getElementById('assign-type').value;
  const group = document.getElementById('assign-test-group');
  if (group) group.style.display = (type === 'reading' || type === 'listening') ? 'block' : 'none';
}

async function createAssignment() {
  const errEl = document.getElementById('assign-error');
  const okEl = document.getElementById('assign-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');

  const title = document.getElementById('assign-title').value.trim();
  const type = document.getElementById('assign-type').value;
  const deadline = document.getElementById('assign-deadline').value;
  const description = document.getElementById('assign-description').value.trim();
  const testIdEl = document.getElementById('assign-test-id');
  const test_id = testIdEl && testIdEl.value ? parseInt(testIdEl.value, 10) : null;

  // Collect target students (empty array = all students)
  const allStudentsChecked = document.getElementById('assign-all-students')?.checked !== false;
  const assigned_to = allStudentsChecked
    ? []
    : [...document.querySelectorAll('.assign-student-cb:checked')].map(cb => parseInt(cb.value, 10));

  if (!title) { errEl.textContent = 'Title is required'; errEl.classList.remove('hidden'); return; }
  if (!deadline) { errEl.textContent = 'Deadline is required'; errEl.classList.remove('hidden'); return; }
  if (!allStudentsChecked && assigned_to.length === 0) {
    errEl.textContent = 'Please select at least one student, or check "All students"';
    errEl.classList.remove('hidden'); return;
  }

  const deadlineISO = new Date(deadline).toISOString();

  try {
    await api('/api/admin/assignments', {
      method: 'POST',
      body: JSON.stringify({ title, type, description, test_id, deadline: deadlineISO, assigned_to })
    });
    okEl.textContent = 'Assignment created!';
    okEl.classList.remove('hidden');
    // Clear form
    document.getElementById('assign-title').value = '';
    document.getElementById('assign-description').value = '';
    document.getElementById('assign-deadline').value = '';
    // Reset student selector to "All students"
    const allCb = document.getElementById('assign-all-students');
    if (allCb) { allCb.checked = true; toggleStudentSelect(); }
    document.querySelectorAll('.assign-student-cb').forEach(cb => cb.checked = false);
    // Reload list
    loadAdminAssignments();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function confirmDeleteAssignment(id, title) {
  if (!confirm(`Delete assignment "${title}"?\n\nThis will remove all student completion records too.`)) return;
  try {
    await api(`/api/admin/assignments/${id}`, { method: 'DELETE' });
    loadAdminAssignments();
  } catch (err) {
    alert('Failed to delete: ' + err.message);
  }
}

/* ─── Assign Students Toggle ──────────────────────────────────────────────── */

function toggleStudentSelect() {
  const allChecked = document.getElementById('assign-all-students').checked;
  const listEl = document.getElementById('assign-students-list');
  if (listEl) listEl.classList.toggle('hidden', allChecked);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR TOGGLE
   ═══════════════════════════════════════════════════════════════════════════ */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('.main-content');
  const showBtn = document.getElementById('sidebar-show-btn');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
  main.classList.toggle('sidebar-collapsed', isCollapsed);
  showBtn.classList.toggle('hidden', !isCollapsed);
  if (toggleBtn) toggleBtn.textContent = isCollapsed ? '›' : '‹';
  localStorage.setItem('ielts_sidebar_collapsed', isCollapsed ? '1' : '0');
}

/* ═══════════════════════════════════════════════════════════════════════════
   DARK MODE TOGGLE
   ═══════════════════════════════════════════════════════════════════════════ */
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('ielts_dark_mode', '0');
    document.getElementById('dark-mode-btn').textContent = '🌙';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('ielts_dark_mode', '1');
    document.getElementById('dark-mode-btn').textContent = '☀️';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESSAY DRAFT AUTO-SAVE
   ═══════════════════════════════════════════════════════════════════════════ */
let _draftSaveTimer = null;

function saveDraft() {
  const prompt = (document.getElementById('essay-prompt') || {}).value || '';
  const essay = (document.getElementById('essay-text') || {}).value || '';
  const taskType = document.querySelector('input[name="task_type"]:checked')?.value || 'task2';
  if (!prompt && !essay) return; // nothing to save
  const draft = { prompt, essay, taskType, savedAt: Date.now() };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function onDraftInput() {
  clearTimeout(_draftSaveTimer);
  _draftSaveTimer = setTimeout(saveDraft, 1200); // debounce 1.2s
}

function loadDraftIfExists() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    if (!draft.prompt && !draft.essay) return;
    const ageMin = Math.round((Date.now() - (draft.savedAt || 0)) / 60000);
    const banner = document.getElementById('draft-restore-banner');
    if (!banner) return;
    banner.innerHTML = `
      📝 You have an unsaved draft from ${ageMin < 1 ? 'just now' : ageMin + ' min ago'}.
      <button class="btn btn-primary btn-sm" onclick="restoreDraft()">Restore Draft</button>
      <button class="btn btn-secondary btn-sm" onclick="discardDraft()">Discard</button>`;
    banner.classList.remove('hidden');
  } catch {}
}

function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    // Set task type
    const radios = document.querySelectorAll('input[name="task_type"]');
    radios.forEach(r => { r.checked = r.value === draft.taskType; });
    if (draft.taskType) {
      const changeEvt = new Event('change');
      document.querySelector(`input[name="task_type"][value="${draft.taskType}"]`)?.dispatchEvent(changeEvt);
    }
    // Restore text
    const promptEl = document.getElementById('essay-prompt');
    const essayEl = document.getElementById('essay-text');
    if (promptEl) promptEl.value = draft.prompt || '';
    if (essayEl) { essayEl.value = draft.essay || ''; updateWordCount(); }
    const banner = document.getElementById('draft-restore-banner');
    if (banner) banner.classList.add('hidden');
  } catch {}
}

function discardDraft() {
  localStorage.removeItem(DRAFT_KEY);
  const banner = document.getElementById('draft-restore-banner');
  if (banner) banner.classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════════════════════
   WRITING TIMER
   ═══════════════════════════════════════════════════════════════════════════ */
function setWritingTimer(minutes) {
  writingTimerSecs = minutes * 60;
  writingTimerRunning = true;
  clearInterval(writingTimerInterval);
  // Show controls
  document.getElementById('writing-timer-controls').classList.remove('hidden');
  document.getElementById('writing-timer-toggle').textContent = '⏸ Pause';
  updateWritingTimerDisplay();
  writingTimerInterval = setInterval(() => {
    if (!writingTimerRunning) return;
    writingTimerSecs--;
    updateWritingTimerDisplay();
    if (writingTimerSecs <= 0) {
      clearInterval(writingTimerInterval);
      writingTimerRunning = false;
      const displayEl = document.getElementById('writing-timer-display');
      if (displayEl) {
        displayEl.textContent = '00:00';
        displayEl.classList.add('timer-warning');
      }
      alert('⏱ Time is up! Please submit your essay.');
    }
  }, 1000);
}

function updateWritingTimerDisplay() {
  const displayEl = document.getElementById('writing-timer-display');
  if (!displayEl) return;
  const m = Math.floor(writingTimerSecs / 60).toString().padStart(2, '0');
  const s = (writingTimerSecs % 60).toString().padStart(2, '0');
  displayEl.textContent = `${m}:${s}`;
  if (writingTimerSecs <= 300) {
    displayEl.classList.add('timer-warning');
  } else {
    displayEl.classList.remove('timer-warning');
  }
}

function toggleWritingTimer() {
  writingTimerRunning = !writingTimerRunning;
  const toggleBtn = document.getElementById('writing-timer-toggle');
  if (toggleBtn) toggleBtn.textContent = writingTimerRunning ? '⏸ Pause' : '▶ Resume';
}

function resetWritingTimer() {
  clearInterval(writingTimerInterval);
  writingTimerRunning = false;
  writingTimerSecs = 0;
  document.getElementById('writing-timer-controls').classList.add('hidden');
  const displayEl = document.getElementById('writing-timer-display');
  if (displayEl) { displayEl.textContent = '40:00'; displayEl.classList.remove('timer-warning'); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RETRY GRADING
   ═══════════════════════════════════════════════════════════════════════════ */
async function retryGrading(submissionId) {
  try {
    await api(`/api/submissions/${submissionId}/retry`, { method: 'POST' });
    // Show feedback view (will poll)
    viewFeedback(submissionId);
  } catch (err) {
    alert('Retry failed: ' + err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   VOCABULARY FLASHCARDS
   ═══════════════════════════════════════════════════════════════════════════ */
async function openFlashcards(submissionId) {
  // Show modal
  document.getElementById('flashcard-modal-overlay').classList.remove('hidden');
  document.getElementById('flashcard-loading').classList.remove('hidden');
  document.getElementById('flashcard-container').classList.add('hidden');
  document.getElementById('flashcard-error').classList.add('hidden');
  flashcards = [];
  flashcardIndex = 0;

  try {
    const data = await api(`/api/submissions/${submissionId}/flashcards`, { method: 'POST' });
    flashcards = data.cards || [];
    if (flashcards.length === 0) throw new Error('No flashcards generated');
    document.getElementById('flashcard-loading').classList.add('hidden');
    document.getElementById('flashcard-container').classList.remove('hidden');
    renderFlashcard();
  } catch (err) {
    document.getElementById('flashcard-loading').classList.add('hidden');
    const errEl = document.getElementById('flashcard-error');
    errEl.textContent = 'Could not generate flashcards: ' + err.message;
    errEl.classList.remove('hidden');
  }
}

function renderFlashcard() {
  if (!flashcards.length) return;
  const card = flashcards[flashcardIndex];
  document.getElementById('flashcard-word').textContent = card.word || '';
  document.getElementById('flashcard-definition').textContent = card.definition || '';
  document.getElementById('flashcard-example').textContent = card.example || '';
  document.getElementById('flashcard-counter').textContent = `${flashcardIndex + 1} / ${flashcards.length}`;
  // Reset flip state
  const cardEl = document.getElementById('flashcard-card');
  if (cardEl) cardEl.classList.remove('flipped');
}

function flipCard() {
  const cardEl = document.getElementById('flashcard-card');
  if (cardEl) cardEl.classList.toggle('flipped');
}

function nextCard() {
  if (flashcardIndex < flashcards.length - 1) {
    flashcardIndex++;
    renderFlashcard();
  }
}

function prevCard() {
  if (flashcardIndex > 0) {
    flashcardIndex--;
    renderFlashcard();
  }
}

function markCard(result) {
  // 'got' moves forward, 'hard' stays or moves to end
  if (result === 'got') {
    nextCard();
  } else {
    // Move card to end for review
    const card = flashcards.splice(flashcardIndex, 1)[0];
    flashcards.push(card);
    if (flashcardIndex >= flashcards.length) flashcardIndex = 0;
    renderFlashcard();
  }
}

function closeFlashcardModal(event) {
  if (event && event.target !== document.getElementById('flashcard-modal-overlay')) return;
  document.getElementById('flashcard-modal-overlay').classList.add('hidden');
}

