const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'lms-data.json');

// Ensure the directory exists (important when DB_FILE points to a mounted volume path like /data)
const DB_DIR = path.dirname(DB_FILE);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch {}
  return { users: [], submissions: [], feedback: [], usage_logs: [], tests: [], test_attempts: [], task1_topics: [], _ids: { users: 0, submissions: 0, feedback: 0, usage_logs: 0, tests: 0, test_attempts: 0, task1_topics: 0 } };
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
      created_at: new Date().toISOString(),
      target_band: null,
      current_streak: 0, longest_streak: 0, last_activity_date: null
    };
    data.users.push(user);
    save(data);
    return { lastInsertRowid: user.id };
  },

  getUserByEmail(email) {
    return load().users.find(u => u.email === email) || null;
  },

  insertSubmission(user_id, task_type, prompt, essay, word_count, grading_mode = 'teacher', paste_stats = null) {
    const data = load();
    data._ids.submissions = (data._ids.submissions || 0) + 1;
    const submission = {
      id: data._ids.submissions, user_id, task_type, prompt, essay,
      word_count, grading_mode,
      status: grading_mode === 'ai' ? 'pending' : 'pending_review',
      paste_stats: paste_stats || null,
      comments: [],
      created_at: new Date().toISOString()
    };
    data.submissions.push(submission);
    save(data);
    return { lastInsertRowid: submission.id };
  },

  addSubmissionComment(submission_id, teacher_id, teacher_name, text) {
    const data = load();
    const sub = data.submissions.find(s => s.id === submission_id);
    if (!sub) return null;
    if (!sub.comments) sub.comments = [];
    if (!data._ids.comments) data._ids.comments = 0;
    data._ids.comments += 1;
    const comment = {
      id: data._ids.comments,
      teacher_id,
      teacher_name,
      text,
      created_at: new Date().toISOString()
    };
    sub.comments.push(comment);
    save(data);
    return comment;
  },

  deleteSubmissionComment(submission_id, comment_id, teacher_id) {
    const data = load();
    const sub = data.submissions.find(s => s.id === submission_id);
    if (!sub || !sub.comments) return false;
    const idx = sub.comments.findIndex(c => c.id === comment_id && c.teacher_id === teacher_id);
    if (idx === -1) return false;
    sub.comments.splice(idx, 1);
    save(data);
    return true;
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

  // Admin/teacher version — no user_id filter
  getSubmissionByIdAdmin(id) {
    const data = load();
    const s = data.submissions.find(s => s.id === id);
    if (!s) return null;
    const f = data.feedback.find(f => f.submission_id === id) || {};
    return { ...s, ...f };
  },

  getAllPendingReviewSubmissions() {
    const data = load();
    return data.submissions
      .filter(s => s.status === 'pending_review')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(s => {
        const user = data.users.find(u => u.id === s.user_id) || {};
        return { ...s, student_name: user.name || 'Unknown', student_email: user.email || '' };
      });
  },

  insertFeedback(submission_id, task_achievement, coherence_cohesion, lexical_resource, grammatical_range, overall_band, detailed_feedback, strengths, improvements, sentence_analysis, criterion_details, overall_improvements, tokens_used, cost_usd, graded_by = null) {
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
      graded_by: graded_by || null,
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

  getAllUsers() {
    return load().users || [];
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

  setUserRole(userId, role) {
    const data = load();
    const u = data.users.find(u => u.id === userId);
    if (!u) return false;
    u.role = role;
    save(data);
    return true;
  },

  updateUserProfile(userId, fields) {
    const data = load();
    const u = data.users.find(u => u.id === userId);
    if (u) {
      if ('target_band' in fields) u.target_band = fields.target_band;
      save(data);
    }
  },

  updateStreak(userId) {
    const data = load();
    const u = data.users.find(u => u.id === userId);
    if (!u) return;
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (u.last_activity_date === todayStr) {
      // Already counted today — no change
      return;
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (u.last_activity_date === yesterdayStr) {
      // Consecutive day — increment streak
      u.current_streak = (u.current_streak || 0) + 1;
    } else {
      // Streak broken or first activity
      u.current_streak = 1;
    }
    u.longest_streak = Math.max(u.longest_streak || 0, u.current_streak);
    u.last_activity_date = todayStr;
    save(data);
  },

  deleteUser(userId) {
    const data = load();
    const idx = data.users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    data.users.splice(idx, 1);
    // Cascade: remove submissions and their feedback
    const subIds = (data.submissions || []).filter(s => s.user_id === userId).map(s => s.id);
    data.submissions = (data.submissions || []).filter(s => s.user_id !== userId);
    data.feedback = (data.feedback || []).filter(f => !subIds.includes(f.submission_id));
    // Cascade: remove test attempts
    if (data.test_attempts) data.test_attempts = data.test_attempts.filter(a => a.user_id !== userId);
    // Cascade: remove assignment completions
    if (data.assignment_completions) data.assignment_completions = data.assignment_completions.filter(c => c.user_id !== userId);
    save(data);
    return true;
  },

  // ── Tests ──────────────────────────────────────────────────────────────────

  insertTest(type, title, sections, created_by) {
    const data = load();
    if (!data.tests) data.tests = [];
    if (!data._ids.tests) data._ids.tests = 0;
    data._ids.tests += 1;
    const test = {
      id: data._ids.tests, type, title,
      sections, created_by,
      created_at: new Date().toISOString()
    };
    data.tests.push(test);
    save(data);
    return test.id;
  },

  // Lightweight list — strips passage text + correct answers, just meta
  getAllTests(type) {
    const data = load();
    let tests = (data.tests || []);
    if (type) tests = tests.filter(t => t.type === type);
    return tests.map(t => ({
      id: t.id, type: t.type, title: t.title,
      created_by: t.created_by, created_at: t.created_at,
      section_count: (t.sections || []).length,
      question_count: (t.sections || []).reduce((n, s) => n + (s.questions || []).length, 0)
    }));
  },

  // Full test with correct answers — for admin only
  getTestById(id) {
    const data = load();
    return (data.tests || []).find(t => t.id === id) || null;
  },

  // Test without correct answers — for students
  getTestForStudent(id) {
    const data = load();
    const t = (data.tests || []).find(t => t.id === id);
    if (!t) return null;
    // Deep-clone and strip correct answers
    const stripped = JSON.parse(JSON.stringify(t));
    for (const section of (stripped.sections || [])) {
      for (const q of (section.questions || [])) {
        delete q.correct_answer;
        delete q.accept_alternatives;
        if (q.sub_questions) {
          for (const sq of q.sub_questions) delete sq.correct_answer;
        }
      }
    }
    return stripped;
  },

  deleteTest(id) {
    const data = load();
    const idx = (data.tests || []).findIndex(t => t.id === id);
    if (idx === -1) return false;
    data.tests.splice(idx, 1);
    // Cascade test attempts
    data.test_attempts = (data.test_attempts || []).filter(a => a.test_id !== id);
    save(data);
    return true;
  },

  // ── Test Attempts ───────────────────────────────────────────────────────────

  insertTestAttempt(test_id, user_id, type) {
    const data = load();
    if (!data.test_attempts) data.test_attempts = [];
    if (!data._ids.test_attempts) data._ids.test_attempts = 0;
    data._ids.test_attempts += 1;
    const attempt = {
      id: data._ids.test_attempts, test_id, user_id, type,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      submitted_at: null,
      time_remaining_secs: type === 'reading' ? 3600 : 1800,
      answers: {},
      score: null,
      ai_explanations: null,
      tokens_used: null,
      cost_usd: null
    };
    data.test_attempts.push(attempt);
    save(data);
    return attempt.id;
  },

  updateAttemptAnswers(attempt_id, user_id, answers, time_remaining_secs) {
    const data = load();
    const a = (data.test_attempts || []).find(a => a.id === attempt_id && a.user_id === user_id);
    if (!a || a.status !== 'in_progress') return false;
    a.answers = answers;
    if (time_remaining_secs !== undefined) a.time_remaining_secs = time_remaining_secs;
    save(data);
    return true;
  },

  completeAttempt(attempt_id, score, ai_explanations, tokens_used, cost_usd) {
    const data = load();
    const a = (data.test_attempts || []).find(a => a.id === attempt_id);
    if (!a) return false;
    a.status = 'completed';
    a.submitted_at = new Date().toISOString();
    a.score = score;
    a.ai_explanations = ai_explanations || null;
    a.tokens_used = tokens_used || null;
    a.cost_usd = cost_usd || null;
    save(data);
    return true;
  },

  setAttemptExplanations(attempt_id, ai_explanations, tokens_used, cost_usd) {
    const data = load();
    const a = (data.test_attempts || []).find(a => a.id === attempt_id);
    if (!a) return false;
    a.ai_explanations = ai_explanations;
    a.tokens_used = (a.tokens_used || 0) + (tokens_used || 0);
    a.cost_usd = (a.cost_usd || 0) + (cost_usd || 0);
    save(data);
    return true;
  },

  // Lightweight list for history view
  getAttemptsByUser(user_id) {
    const data = load();
    return (data.test_attempts || [])
      .filter(a => a.user_id === user_id)
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .map(a => {
        const t = (data.tests || []).find(t => t.id === a.test_id) || {};
        return {
          id: a.id, test_id: a.test_id, type: a.type,
          test_title: t.title || 'Deleted Test',
          status: a.status,
          started_at: a.started_at, submitted_at: a.submitted_at,
          score: a.score
        };
      });
  },

  // Full attempt including ai_explanations
  getAttemptById(attempt_id, user_id) {
    const data = load();
    const a = (data.test_attempts || []).find(
      a => a.id === attempt_id && a.user_id === user_id
    );
    if (!a) return null;
    const t = (data.tests || []).find(t => t.id === a.test_id) || null;
    return { ...a, test: t };
  },

  // For in-progress resume: returns attempt with stripped test (no answers)
  getInProgressAttempt(test_id, user_id) {
    const data = load();
    return (data.test_attempts || []).find(
      a => a.test_id === test_id && a.user_id === user_id && a.status === 'in_progress'
    ) || null;
  },

  // ── Assignments (Homework) ─────────────────────────────────────────────────

  insertAssignment(title, type, description, test_id, deadline, created_by, assigned_to, custom_prompt = null, custom_image_url = null) {
    const data = load();
    if (!data.assignments) data.assignments = [];
    if (!data._ids.assignments) data._ids.assignments = 0;
    data._ids.assignments += 1;
    const assignment = {
      id: data._ids.assignments, title, type,
      description: description || '',
      test_id: test_id || null,
      deadline, created_by,
      assigned_to: Array.isArray(assigned_to) ? assigned_to : [], // empty = all students
      custom_prompt: custom_prompt || null,
      custom_image_url: custom_image_url || null,
      created_at: new Date().toISOString()
    };
    data.assignments.push(assignment);
    save(data);
    return assignment.id;
  },

  getAllAssignments() {
    const data = load();
    const completions = data.assignment_completions || [];
    const users = data.users || [];
    return (data.assignments || [])
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .map(a => {
        const testTitle = a.test_id
          ? ((data.tests || []).find(t => t.id === a.test_id) || {}).title || null
          : null;
        const completedBy = completions.filter(c => c.assignment_id === a.id).map(c => ({
          user_id: c.user_id,
          completed_at: c.completed_at,
          is_late: c.is_late || false,
          name: (users.find(u => u.id === c.user_id) || {}).name || 'Unknown'
        }));
        const assignedTo = (a.assigned_to || []).length > 0
          ? (a.assigned_to || []).map(uid => {
              const u = users.find(u => u.id === uid);
              return u ? { id: uid, name: u.name } : { id: uid, name: 'Unknown' };
            })
          : null; // null = all students
        return { ...a, test_title: testTitle, completed_by: completedBy, assigned_to_details: assignedTo };
      });
  },

  getAssignmentsForUser(user_id) {
    const data = load();
    const completions = data.assignment_completions || [];
    return (data.assignments || [])
      .filter(a => {
        // Include if assigned_to is empty (all) or user_id is in the list
        const list = a.assigned_to || [];
        return list.length === 0 || list.includes(user_id);
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .map(a => {
        const testTitle = a.test_id
          ? ((data.tests || []).find(t => t.id === a.test_id) || {}).title || null
          : null;
        const completion = completions.find(c => c.assignment_id === a.id && c.user_id === user_id);
        return {
          id: a.id, title: a.title, type: a.type,
          description: a.description, test_id: a.test_id,
          test_title: testTitle, deadline: a.deadline,
          created_at: a.created_at,
          completed: !!completion,
          completed_at: completion ? completion.completed_at : null
        };
      });
  },

  deleteAssignment(id) {
    const data = load();
    const idx = (data.assignments || []).findIndex(a => a.id === id);
    if (idx === -1) return false;
    data.assignments.splice(idx, 1);
    data.assignment_completions = (data.assignment_completions || []).filter(c => c.assignment_id !== id);
    save(data);
    return true;
  },

  getAssignmentById(id) {
    const data = load();
    return (data.assignments || []).find(a => a.id === id) || null;
  },

  markAssignmentComplete(assignment_id, user_id) {
    const data = load();
    if (!data.assignment_completions) data.assignment_completions = [];
    if (!data._ids.assignment_completions) data._ids.assignment_completions = 0;
    // Prevent duplicate
    const already = data.assignment_completions.find(c => c.assignment_id === assignment_id && c.user_id === user_id);
    if (already) return null; // already done
    const assignment = (data.assignments || []).find(a => a.id === assignment_id);
    const completed_at = new Date().toISOString();
    const is_late = assignment ? new Date(completed_at) > new Date(assignment.deadline) : false;
    data._ids.assignment_completions += 1;
    data.assignment_completions.push({
      id: data._ids.assignment_completions,
      assignment_id, user_id,
      completed_at,
      is_late
    });
    save(data);
    return { completed_at, is_late, assignment };
  },

  // Find incomplete assignments for a user that are linked to a specific test
  getIncompleteAssignmentsForTest(user_id, test_id, type) {
    const data = load();
    const completions = data.assignment_completions || [];
    return (data.assignments || []).filter(a => {
      if (a.test_id !== test_id) return false;
      if (a.type !== type) return false;
      const list = a.assigned_to || [];
      if (list.length > 0 && !list.includes(user_id)) return false;
      const done = completions.find(c => c.assignment_id === a.id && c.user_id === user_id);
      return !done;
    });
  },

  // Full submission list with essay text — for admin inspection
  getAdminStudentSubmissions(userId) {
    const data = load();
    return data.submissions
      .filter(s => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(s => {
        const f = data.feedback.find(f => f.submission_id === s.id) || {};
        return {
          id: s.id, task_type: s.task_type, prompt: s.prompt, essay: s.essay,
          word_count: s.word_count, status: s.status, grading_mode: s.grading_mode || 'ai',
          created_at: s.created_at,
          paste_stats: s.paste_stats || null,
          comments: s.comments || [],
          overall_band: f.overall_band ?? null,
          detailed_feedback: f.detailed_feedback || null,
          cost_usd: f.cost_usd || null,
          graded_by: f.graded_by ?? null
        };
      });
  },

  // ── Task 1 Topics ──────────────────────────────────────────────────────────

  insertTask1Topic(chart_type, question, image_base64, image_media_type, label) {
    const data = load();
    if (!data.task1_topics) data.task1_topics = [];
    if (!data._ids.task1_topics) data._ids.task1_topics = 0;
    data._ids.task1_topics += 1;
    const topic = {
      id: data._ids.task1_topics,
      chart_type,         // 'bar_chart' | 'line_graph' | 'pie_chart' | 'table' | 'process_diagram' | 'map'
      question,           // IELTS task text
      label: label || '', // optional short label for admin list
      image_base64,       // base64-encoded image
      image_media_type,   // 'image/jpeg' | 'image/png' | ...
      created_at: new Date().toISOString()
    };
    data.task1_topics.push(topic);
    save(data);
    return topic.id;
  },

  // Lightweight list for admin panel (no image data — could be very large)
  getAllTask1Topics(chart_type) {
    const data = load();
    let topics = (data.task1_topics || []);
    if (chart_type && chart_type !== 'random') topics = topics.filter(t => t.chart_type === chart_type);
    return topics.map(t => ({
      id: t.id, chart_type: t.chart_type, label: t.label,
      question_preview: (t.question || '').slice(0, 120),
      created_at: t.created_at
    }));
  },

  // Returns a single random topic including image data — for student use
  getRandomTask1Topic(chart_type) {
    const data = load();
    let pool = (data.task1_topics || []);
    if (chart_type && chart_type !== 'random') pool = pool.filter(t => t.chart_type === chart_type);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  deleteTask1Topic(id) {
    const data = load();
    const idx = (data.task1_topics || []).findIndex(t => t.id === id);
    if (idx === -1) return false;
    data.task1_topics.splice(idx, 1);
    save(data);
    return true;
  },

  // Cost breakdown by operation type for admin panel
  getCostBreakdown() {
    const data = load();
    const breakdown = {};
    // Writing grading costs come from feedback table
    let gradingCost = 0, gradingCount = 0;
    for (const f of (data.feedback || [])) {
      if (f.cost_usd) { gradingCost += f.cost_usd; gradingCount++; }
    }
    if (gradingCount > 0) breakdown['Essay Grading'] = { cost: gradingCost, count: gradingCount };
    // All other costs from usage_logs
    for (const u of (data.usage_logs || [])) {
      const label = {
        'generate-task': 'Topic Generation',
        'hint-ideas': 'AI Writing Hints',
        'hint-vocabulary': 'AI Writing Hints',
        'generate-chart': 'Chart Description AI',
        'rewrite': 'Smart Rewrite',
        'test-explanations': 'Test AI Explanations',
        'topic-rater': 'Topic Quality Rater',
      }[u.type] || u.type;
      if (!breakdown[label]) breakdown[label] = { cost: 0, count: 0 };
      breakdown[label].cost += (u.cost_usd || 0);
      breakdown[label].count += 1;
    }
    return Object.entries(breakdown)
      .map(([label, d]) => ({ label, cost: Math.round(d.cost * 100000) / 100000, count: d.count }))
      .sort((a, b) => b.cost - a.cost);
  },

  // ── App Settings ──────────────────────────────────────────────────────────

  getSetting(key, defaultValue = null) {
    const data = load();
    if (!data.settings) return defaultValue;
    return key in data.settings ? data.settings[key] : defaultValue;
  },

  setSetting(key, value) {
    const data = load();
    if (!data.settings) data.settings = {};
    data.settings[key] = value;
    save(data);
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

// Migration: ensure new collections exist in existing databases
(function migrateCollections() {
  const data = load();
  let changed = false;
  if (!data.tests) { data.tests = []; changed = true; }
  if (!data.test_attempts) { data.test_attempts = []; changed = true; }
  if (!data._ids.tests) { data._ids.tests = 0; changed = true; }
  if (!data._ids.test_attempts) { data._ids.test_attempts = 0; changed = true; }
  if (!data.assignments) { data.assignments = []; changed = true; }
  if (!data.assignment_completions) { data.assignment_completions = []; changed = true; }
  if (!data._ids.assignments) { data._ids.assignments = 0; changed = true; }
  if (!data._ids.assignment_completions) { data._ids.assignment_completions = 0; changed = true; }
  if (!data.settings) { data.settings = {}; changed = true; }
  if (!data.task1_topics) { data.task1_topics = []; changed = true; }
  if (!data._ids.task1_topics) { data._ids.task1_topics = 0; changed = true; }
  if (changed) save(data);
})();

// Migration: auto-verify legacy users who registered before email verification was enforced.
// These users have verified=false but no verification_code (it was never sent to them).
(function migrateLegacyUsers() {
  const data = load();
  let changed = false;
  data.users.forEach(u => {
    if (!u.verified && !u.verification_code) {
      u.verified = true;
      changed = true;
    }
  });
  if (changed) save(data);
})();

module.exports = db;
