const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'lms-data.json');

function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch {}
  return { users: [], submissions: [], feedback: [], usage_logs: [], _ids: { users: 0, submissions: 0, feedback: 0, usage_logs: 0 } };
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data));
}

const db = {
  insertUser(name, email, password, role = 'student') {
    const data = load();
    if (data.users.find(u => u.email === email)) {
      throw Object.assign(new Error('Email already exists'), { message: 'UNIQUE constraint failed' });
    }
    data._ids.users = (data._ids.users || 0) + 1;
    const user = {
      id: data._ids.users, name, email, password,
      role, verified: false, verification_code: null, verification_expires: null,
      reset_code: null, reset_expires: null,
      created_at: new Date().toISOString()
    };
    data.users.push(user);
    save(data);
    return { lastInsertRowid: user.id };
  },

  getUserByEmail(email) {
    return load().users.find(u => u.email === email) || null;
  },

  insertSubmission(user_id, task_type, prompt, essay, word_count) {
    const data = load();
    data._ids.submissions = (data._ids.submissions || 0) + 1;
    const submission = {
      id: data._ids.submissions, user_id, task_type, prompt, essay,
      word_count, status: 'pending', created_at: new Date().toISOString()
    };
    data.submissions.push(submission);
    save(data);
    return { lastInsertRowid: submission.id };
  },

  updateSubmissionStatus(id, status) {
    const data = load();
    const s = data.submissions.find(s => s.id === id);
    if (s) { s.status = status; save(data); }
  },

  getSubmissionsByUser(user_id) {
    const data = load();
    return data.submissions
      .filter(s => s.user_id === user_id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(s => {
        const f = data.feedback.find(f => f.submission_id === s.id) || {};
        return {
          id: s.id, task_type: s.task_type, prompt: s.prompt,
          word_count: s.word_count, status: s.status, created_at: s.created_at,
          overall_band: f.overall_band ?? null,
          task_achievement: f.task_achievement ?? null,
          coherence_cohesion: f.coherence_cohesion ?? null,
          lexical_resource: f.lexical_resource ?? null,
          grammatical_range: f.grammatical_range ?? null
        };
      });
  },

  getSubmissionById(id, user_id) {
    const data = load();
    const s = data.submissions.find(s => s.id === id && s.user_id === user_id);
    if (!s) return null;
    const f = data.feedback.find(f => f.submission_id === id) || {};
    return { ...s, ...f };
  },

  insertFeedback(submission_id, task_achievement, coherence_cohesion, lexical_resource, grammatical_range, overall_band, detailed_feedback, strengths, improvements, sentence_analysis, criterion_details, overall_improvements, tokens_used, cost_usd) {
    const data = load();
    data._ids.feedback = (data._ids.feedback || 0) + 1;
    data.feedback.push({
      id: data._ids.feedback, submission_id,
      task_achievement, coherence_cohesion, lexical_resource,
      grammatical_range, overall_band, detailed_feedback,
      strengths, improvements,
      sentence_analysis: sentence_analysis || null,
      criterion_details: criterion_details || null,
      overall_improvements: overall_improvements || null,
      tokens_used: tokens_used || null,
      cost_usd: cost_usd || null,
      graded_at: new Date().toISOString()
    });
    save(data);
  },

  logUsage(type, cost_usd, tokens) {
    const data = load();
    if (!data.usage_logs) data.usage_logs = [];
    if (!data._ids.usage_logs) data._ids.usage_logs = 0;
    data._ids.usage_logs += 1;
    data.usage_logs.push({
      id: data._ids.usage_logs,
      type,
      cost_usd,
      tokens,
      created_at: new Date().toISOString()
    });
    save(data);
  },

  getTotalCost() {
    const data = load();
    let total = 0;
    // Sum from feedback (grading costs)
    for (const f of (data.feedback || [])) {
      if (f.cost_usd) total += f.cost_usd;
    }
    // Sum from usage_logs (task generation and hints)
    for (const u of (data.usage_logs || [])) {
      if (u.cost_usd) total += u.cost_usd;
    }
    return Math.round(total * 100000) / 100000;
  },

  getGradedCount() {
    const data = load();
    return (data.feedback || []).length;
  },

  deleteSubmission(id, user_id) {
    const data = load();
    const idx = data.submissions.findIndex(s => s.id === id && s.user_id === user_id);
    if (idx === -1) return false;
    data.submissions.splice(idx, 1);
    // Cascade delete associated feedback
    data.feedback = (data.feedback || []).filter(f => f.submission_id !== id);
    save(data);
    return true;
  },

  setVerificationCode(userId, code, expires) {
    const data = load();
    const u = data.users.find(u => u.id === userId);
    if (u) { u.verification_code = code; u.verification_expires = expires; save(data); }
  },

  verifyUser(userId) {
    const data = load();
    const u = data.users.find(u => u.id === userId);
    if (u) { u.verified = true; u.verification_code = null; u.verification_expires = null; save(data); }
  },

  getUserById(id) {
    return load().users.find(u => u.id === id) || null;
  },

  setResetCode(userId, code, expires) {
    const data = load();
    const u = data.users.find(u => u.id === userId);
    if (u) { u.reset_code = code; u.reset_expires = expires; save(data); }
  },

  resetPassword(userId, hashedPassword) {
    const data = load();
    const u = data.users.find(u => u.id === userId);
    if (u) { u.password = hashedPassword; u.reset_code = null; u.reset_expires = null; save(data); }
  },

  updatePassword(userId, hashedPassword) {
    const data = load();
    const u = data.users.find(u => u.id === userId);
    if (u) { u.password = hashedPassword; save(data); }
  },

  getAllUsersWithStats() {
    const data = load();
    return data.users.map(u => {
      const subs = data.submissions.filter(s => s.user_id === u.id);
      const feedback = data.feedback.filter(f => subs.some(s => s.id === f.submission_id));
      const avgBand = feedback.length > 0
        ? Math.round(feedback.reduce((sum, f) => sum + f.overall_band, 0) / feedback.length * 10) / 10
        : null;
      return {
        id: u.id, name: u.name, email: u.email, role: u.role,
        verified: !!u.verified, created_at: u.created_at,
        submission_count: subs.length, graded_count: feedback.length, avg_band: avgBand,
      };
    });
  }
};

module.exports = db;
