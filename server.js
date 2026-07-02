require('dotenv').config();
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');
const db = require('./database');
const path = require('path');
const fs = require('fs');

const rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET env var is not set. Refusing to start.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5';

const client = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  timeout: 60_000,   // 60 s — fail fast instead of hanging 10 min
  maxRetries: 0,     // no silent retries; surface errors immediately
});

app.use(cors({ origin: 'https://tintinlab.com' }));
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Cost Calculation ──────────────────────────────────────────────────────────
function calculateCost(inputTokens, outputTokens) {
  const inputPrice = parseFloat(process.env.INPUT_PRICE_PER_M || '0.80');
  const outputPrice = parseFloat(process.env.OUTPUT_PRICE_PER_M || '4.00');
  return (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
}

// ─── Email / Admin Helpers ─────────────────────────────────────────────────────
// Lazy-init so missing key doesn't crash the server on startup
let resend = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');
  return resend;
}

// Wrap any email send so it never hangs the server response
async function sendEmailSafe(sendFn) {
  try {
    await Promise.race([
      sendFn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout after 15s')), 15000))
    ]);
    console.log('Email sent successfully');
    return true;
  } catch (err) {
    console.error('EMAIL SEND FAILED:', err.message, err.code || '', err.statusCode || '');
    return false;
  }
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, name, code) {
  const { error } = await getResend().emails.send({
    from: "SSP's IELTS Writing LMS <noreply@tintinlab.com>",
    to: email,
    subject: 'Your IELTS LMS verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#4f46e5;margin-bottom:8px">SSP's IELTS Writing LMS</h2>
        <p style="color:#374151">Hi <strong>${name}</strong>, thanks for registering!</p>
        <p style="color:#374151">Your email verification code is:</p>
        <div style="font-size:2.8rem;font-weight:700;letter-spacing:0.35em;color:#4f46e5;text-align:center;padding:28px 0;background:#f5f3ff;border-radius:12px;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:14px">This code expires in <strong>30 minutes</strong>. If you didn't register, you can safely ignore this email.</p>
      </div>
    `
  });
  if (error) throw new Error(error.message);
}

async function sendPasswordResetEmail(email, name, code) {
  const { error } = await getResend().emails.send({
    from: "SSP's IELTS Writing LMS <noreply@tintinlab.com>",
    to: email,
    subject: 'Reset your IELTS LMS password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#4f46e5;margin-bottom:8px">SSP's IELTS Writing LMS</h2>
        <p style="color:#374151">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151">We received a request to reset your password. Your reset code is:</p>
        <div style="font-size:2.8rem;font-weight:700;letter-spacing:0.35em;color:#4f46e5;text-align:center;padding:28px 0;background:#f5f3ff;border-radius:12px;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:14px">This code expires in <strong>30 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `
  });
  if (error) throw new Error(error.message);
}

function adminRole(email) {
  const adminEmails = (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase()) ? 'admin' : 'student';
}

// Return list of admin email addresses from env
function getAdminEmails() {
  return (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

// Format a deadline for display in emails
function fmtDeadline(isoStr) {
  try {
    return new Date(isoStr).toLocaleString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short',
      day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  } catch { return isoStr; }
}

// Email: student receives when a homework is assigned to them
async function sendHomeworkAssignedEmail(student, assignment) {
  const typeLabel = assignment.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const deadlineStr = fmtDeadline(assignment.deadline);
  await getResend().emails.send({
    from: "SSP IELTS <noreply@tintinlab.com>",
    to: student.email,
    subject: `📚 New Homework: ${assignment.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
        <h2 style="color:#D97706;margin-bottom:4px">SSP IELTS</h2>
        <h3 style="margin-bottom:16px;color:#111827">You have a new homework assignment</h3>
        <p style="color:#374151">Hi <strong>${student.name}</strong>,</p>
        <p style="color:#374151">Your teacher has assigned you new homework:</p>
        <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;padding:16px 20px;margin:16px 0">
          <div style="font-size:1.1rem;font-weight:700;color:#111827;margin-bottom:6px">${assignment.title}</div>
          <div style="color:#6b7280;font-size:14px;margin-bottom:4px">Type: <strong>${typeLabel}</strong></div>
          ${assignment.description ? `<div style="color:#374151;font-size:14px;margin-bottom:4px">${assignment.description}</div>` : ''}
          <div style="color:#dc2626;font-weight:600;font-size:14px;margin-top:8px">⏰ Due: ${deadlineStr}</div>
        </div>
        <p style="color:#374151">Log in to <a href="https://tintinlab.com" style="color:#D97706">tintinlab.com</a> and go to <strong>Homework</strong> to complete this assignment.</p>
        <p style="color:#9ca3af;font-size:13px;margin-top:24px">SSP IELTS — Good luck! 💪</p>
      </div>
    `
  });
}

// Email: admin receives when a student submits/completes homework
async function sendHomeworkSubmittedEmail(adminEmail, student, assignment, completedAt, isLate) {
  const typeLabel = assignment.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const submittedStr = fmtDeadline(completedAt);
  const deadlineStr = fmtDeadline(assignment.deadline);
  const lateColor = isLate ? '#dc2626' : '#16a34a';
  const lateLabel = isLate ? '⚠️ LATE' : '✅ On Time';
  await getResend().emails.send({
    from: "SSP IELTS <noreply@tintinlab.com>",
    to: adminEmail,
    subject: `${isLate ? '⚠️ Late' : '✅'} Homework submitted — ${student.name}: ${assignment.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
        <h2 style="color:#D97706;margin-bottom:4px">SSP IELTS</h2>
        <h3 style="margin-bottom:16px;color:#111827">Homework Submission</h3>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:16px 0">
          <div style="font-size:1rem;font-weight:700;color:#111827;margin-bottom:10px">${assignment.title}</div>
          <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse">
            <tr><td style="padding:4px 0;width:120px;color:#6b7280">Student</td><td><strong>${student.name}</strong> (${student.email})</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Type</td><td>${typeLabel}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Submitted</td><td>${submittedStr}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Deadline</td><td>${deadlineStr}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Status</td><td><strong style="color:${lateColor}">${lateLabel}</strong></td></tr>
          </table>
        </div>
        <p style="color:#374151">View the student's work in the <a href="https://tintinlab.com" style="color:#D97706">Admin → Users → View History</a> panel.</p>
      </div>
    `
  });
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
}

// Teachers and admins can manage materials and assignments
function teacherOrAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher or admin access required' });
  }
  next();
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    // Always fetch the live role from DB — the role in the JWT may be stale
    // if an admin changed the user's role after the token was issued.
    const dbUser = db.getUserById(decoded.id);
    if (!dbUser) return res.status(401).json({ error: 'User not found' });
    const liveRole = adminRole(dbUser.email) === 'admin' ? 'admin' : (dbUser.role || 'student');
    req.user = { ...decoded, role: liveRole, name: dbUser.name };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────
// Strict: login & forgot-password — primary brute-force targets
const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' }
});

// Looser: register / verify / resend — less sensitive but still throttled
const authLooseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' }
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/register', authLooseLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const role = adminRole(email);
    const result = db.insertUser(name, email.toLowerCase(), hashed, role);
    const userId = result.lastInsertRowid;
    const code = generateCode();
    db.setVerificationCode(userId, code, new Date(Date.now() + 30 * 60 * 1000).toISOString());
    const emailSent = await sendEmailSafe(() => sendVerificationEmail(email.toLowerCase(), name, code));
    return res.json({ needsVerification: true, email: email.toLowerCase(), emailSent });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', authStrictLimiter, async (req, res) => {
  const { email, password, remember_me } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db.getUserByEmail(email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.verified) {
    const code = generateCode();
    db.setVerificationCode(user.id, code, new Date(Date.now() + 30 * 60 * 1000).toISOString());
    const sent = await sendEmailSafe(() => sendVerificationEmail(user.email, user.name, code));
    if (sent) {
      return res.json({ needsVerification: true, email: user.email });
    }
    // Email failed to send — since the user already proved their password, let them in
    // and auto-verify so they aren't locked out
    db.verifyUser(user.id);
  }
  // Admin email env var always wins; otherwise preserve the DB role (teacher/student)
  const role = adminRole(user.email) === 'admin' ? 'admin' : (user.role || 'student');
  const expiry = remember_me ? '30d' : '7d';
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role }, JWT_SECRET, { expiresIn: expiry });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
});

app.post('/api/verify-email', authLooseLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    const user = db.getUserByEmail(email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.verification_code !== code) return res.status(400).json({ error: 'Invalid code' });
    if (new Date(user.verification_expires) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    db.verifyUser(user.id);
    const role = adminRole(user.email) === 'admin' ? 'admin' : (user.role || 'student');
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/resend-verification', authLooseLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = db.getUserByEmail((email || '').toLowerCase());
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.verified) return res.status(400).json({ error: 'Email already verified' });
    const code = generateCode();
    db.setVerificationCode(user.id, code, new Date(Date.now() + 30 * 60 * 1000).toISOString());
    await sendEmailSafe(() => sendVerificationEmail(user.email, user.name, code));
    res.json({ message: 'Code resent' });
  } catch (err) {
    console.error('Resend error:', err);
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

// ─── Balance Route ────────────────────────────────────────────────────────────
app.get('/api/balance', authenticate, (req, res) => {
  const envDefault = parseFloat(process.env.STARTING_BALANCE || '4.98');
  const startingBalance = parseFloat(db.getSetting('starting_balance', envDefault));
  const totalCost = db.getTotalCost();
  const remaining = Math.max(0, startingBalance - totalCost);
  const gradedCount = db.getGradedCount();
  const avgCost = gradedCount > 0 ? totalCost / gradedCount : 0.05;
  const estimatedEssays = avgCost > 0 ? Math.floor(remaining / avgCost) : '?';

  res.json({
    total_cost: Math.round(totalCost * 10000) / 10000,
    remaining_balance: Math.round(remaining * 10000) / 10000,
    graded_count: gradedCount,
    avg_cost_per_essay: Math.round(avgCost * 10000) / 10000,
    estimated_essays_remaining: estimatedEssays
  });
});

// ─── Submission Routes ────────────────────────────────────────────────────────
app.post('/api/submissions', authenticate, async (req, res) => {
  try {
    const { task_type, prompt, essay, image_base64, image_media_type, grading_mode, paste_stats } = req.body;
    if (!task_type || !prompt || !essay) {
      return res.status(400).json({ error: 'Task type, prompt, and essay are required' });
    }
    if (!['task1', 'task2'].includes(task_type)) {
      return res.status(400).json({ error: 'Task type must be task1 or task2' });
    }
    const wordCount = essay.trim().split(/\s+/).length;
    const minWords = task_type === 'task1' ? 150 : 250;
    if (wordCount < 50) {
      return res.status(400).json({ error: 'Essay is too short to grade' });
    }

    // Validate image if provided
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const imageData = (task_type === 'task1' && image_base64 && image_media_type && validImageTypes.includes(image_media_type))
      ? { base64: image_base64, media_type: image_media_type }
      : null;

    const mode = (grading_mode === 'ai') ? 'ai' : 'teacher'; // default = teacher
    // Sanitise paste_stats — only store if it's a plain object with expected keys
    const safePasteStats = (paste_stats && typeof paste_stats === 'object' && !Array.isArray(paste_stats))
      ? { paste_count: paste_stats.paste_count || 0, total_pasted: paste_stats.total_pasted || 0,
          total_typed: paste_stats.total_typed || 0, largest_paste: paste_stats.largest_paste || 0 }
      : null;
    const result = db.insertSubmission(req.user.id, task_type, prompt, essay, wordCount, mode, safePasteStats);
    const submissionId = result.lastInsertRowid;

    if (mode === 'ai') {
      // Start AI grading asynchronously
      gradeSubmission(submissionId, req.user.id, task_type, prompt, essay, wordCount, minWords, imageData).catch(console.error);
      res.json({ id: submissionId, status: 'grading', word_count: wordCount, grading_mode: 'ai' });
    } else {
      // Teacher review mode — no AI call, sits in queue
      res.json({ id: submissionId, status: 'pending_review', word_count: wordCount, grading_mode: 'teacher' });
    }
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: 'Failed to submit essay. Please try again.' });
  }
});

app.get('/api/submissions', authenticate, (req, res) => {
  const submissions = db.getSubmissionsByUser(req.user.id);
  res.json(submissions);
});

app.get('/api/submissions/:id', authenticate, (req, res) => {
  const submission = db.getSubmissionById(parseInt(req.params.id), req.user.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  res.json(submission);
});

app.delete('/api/submissions/:id', authenticate, (req, res) => {
  const deleted = db.deleteSubmission(parseInt(req.params.id), req.user.id);
  if (!deleted) return res.status(404).json({ error: 'Submission not found' });
  res.json({ success: true });
});

// ─── AI Grading ───────────────────────────────────────────────────────────────
async function gradeSubmission(submissionId, userId, taskType, prompt, essay, wordCount, minWords, imageData) {
  db.updateSubmissionStatus(submissionId, 'grading');

  const taskLabel = taskType === 'task1' ? 'Task 1' : 'Task 2';
  const taskDescription = taskType === 'task1'
    ? 'an Academic Writing Task 1 (describing visual data such as a graph, chart, table, or diagram)'
    : 'a Writing Task 2 (an academic essay responding to a point of view, argument, or problem)';
  const taLabel = taskType === 'task1' ? 'Task Achievement' : 'Task Response';
  const minWordNote = wordCount < minWords
    ? `Note: The student wrote ${wordCount} words, which is below the recommended minimum of ${minWords} words. Apply appropriate penalty.`
    : `Word count: ${wordCount} words (meets the minimum of ${minWords}).`;

  const systemPrompt = `You are an expert IELTS examiner with 15+ years of experience grading IELTS Writing tests. You provide accurate, detailed, and constructive feedback following official IELTS band descriptors. Always respond with valid JSON only — no markdown, no code blocks, no extra text.`;

  const userPrompt = `Grade the following IELTS ${taskLabel} submission using official IELTS band descriptors (bands 0–9, in 0.5 increments).

The task is ${taskDescription}.

${minWordNote}

## Task Prompt Given to Student:
${prompt}

## Student's Essay:
${essay}

## Instructions:
Evaluate on these four criteria (score each from 0–9 in 0.5 increments):
1. ${taLabel} (TA/TR): Does the response address all parts of the task with appropriate detail?
2. Coherence & Cohesion (CC): Is the writing logically organized with clear progression and effective cohesive devices?
3. Lexical Resource (LR): Is vocabulary varied, precise, and used accurately with appropriate collocations?
4. Grammatical Range & Accuracy (GRA): Is grammar varied and accurate with a range of sentence structures?

The overall band is the average of the four criteria, rounded to the nearest 0.5.

CRITICAL RULE FOR IMPROVEMENTS: Every improvement point MUST reference a specific sentence, phrase, or pattern FROM THE STUDENT'S ESSAY. Quote or paraphrase the exact text, then explain why it loses marks and how to fix it. Do NOT write generic advice like "use more varied vocabulary" — instead write something like: 'In your opening sentence you wrote "many people think technology is good" — this is vague; replace with a precise claim such as "Technological advancement has fundamentally reshaped human communication."' Each improvement must point to something concrete in the submitted essay.

Respond ONLY with this exact JSON structure:
{
  "task_achievement": <0-9 in 0.5 steps>,
  "coherence_cohesion": <0-9>,
  "lexical_resource": <0-9>,
  "grammatical_range": <0-9>,
  "overall_band": <average rounded to nearest 0.5>,
  "criterion_details": {
    "task_achievement": {
      "band": <n>,
      "descriptor": "<explain which IELTS band descriptor applies and WHY this specific score — reference actual descriptor language>",
      "strengths": ["<specific strength quoting or referencing actual essay text>", "<specific strength>"],
      "improvements": ["<improvement that QUOTES a specific phrase from the essay and explains how to fix it>", "<second improvement quoting specific essay text>"]
    },
    "coherence_cohesion": { "band": <n>, "descriptor": "...", "strengths": ["<quote essay text>", "..."], "improvements": ["<quote essay text + fix>", "..."] },
    "lexical_resource": { "band": <n>, "descriptor": "...", "strengths": ["<quote essay text>", "..."], "improvements": ["<quote essay text + fix>", "..."] },
    "grammatical_range": { "band": <n>, "descriptor": "...", "strengths": ["<quote essay text>", "..."], "improvements": ["<quote essay text + fix>", "..."] }
  },
  "detailed_feedback": "<200-300 word comprehensive analysis that quotes specific sentences from the essay>",
  "sentence_analysis": [
    {"i": 1, "t": "simple"},
    {"i": 2, "t": "complex"}
  ],
  "overall_improvements": {
    "content": "<actionable advice quoting a specific part of this essay>",
    "organization": "<actionable advice referencing this essay's paragraph structure>",
    "vocabulary": "<actionable advice quoting specific repeated or weak words from this essay>",
    "grammar": "<actionable advice quoting a specific grammatical error from this essay>",
    "sentence_variety": "<actionable advice referencing sentence patterns observed in this essay>",
    "coherence": "<actionable advice referencing a specific transition or linking issue in this essay>"
  },
  "strengths": ["<strength quoting specific essay text>", "<strength quoting specific essay text>", "<strength quoting specific essay text>"],
  "improvements": ["<improvement quoting specific essay text + how to fix it>", "<improvement quoting specific essay text + how to fix it>", "<improvement quoting specific essay text + how to fix it>"]
}

For sentence_analysis: include one entry per sentence in order. Types are: simple, compound, complex, compound-complex, uncertain.`;

  try {
    // Build message content — include image if student uploaded one
    let messageContent;
    if (imageData) {
      messageContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: imageData.media_type, data: imageData.base64 }
        },
        { type: 'text', text: userPrompt }
      ];
    } else {
      messageContent = userPrompt;
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    });

    let jsonText = '';
    for (const block of response.content) {
      if (block.type === 'text') { jsonText = block.text.trim(); break; }
    }

    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(jsonText);

    const normalize = (v) => Math.round(parseFloat(v) * 2) / 2;
    const ta = normalize(result.task_achievement);
    const cc = normalize(result.coherence_cohesion);
    const lr = normalize(result.lexical_resource);
    const gra = normalize(result.grammatical_range);
    const overall = Math.round(((ta + cc + lr + gra) / 4) * 2) / 2;

    const parseList = (val) => {
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'string') {
        try { return JSON.stringify(JSON.parse(val)); } catch { return JSON.stringify([val]); }
      }
      return '[]';
    };

    // Track token usage and cost
    const inputTokens = response.usage ? response.usage.input_tokens : 0;
    const outputTokens = response.usage ? response.usage.output_tokens : 0;
    const totalTokens = inputTokens + outputTokens;
    const cost = calculateCost(inputTokens, outputTokens);

    const sentenceAnalysis = result.sentence_analysis ? JSON.stringify(result.sentence_analysis) : null;
    const criterionDetails = result.criterion_details ? JSON.stringify(result.criterion_details) : null;
    const overallImprovements = result.overall_improvements ? JSON.stringify(result.overall_improvements) : null;

    db.insertFeedback(
      submissionId, ta, cc, lr, gra, overall,
      result.detailed_feedback,
      parseList(result.strengths),
      parseList(result.improvements),
      sentenceAnalysis,
      criterionDetails,
      overallImprovements,
      totalTokens,
      cost
    );
    db.updateSubmissionStatus(submissionId, 'graded');
    // Update study streak for the student
    try { db.updateStreak(userId); } catch (e) { console.error('Streak update error:', e); }
  } catch (err) {
    console.error('Grading error for submission', submissionId, err);
    db.updateSubmissionStatus(submissionId, 'error');
  }
}

// ─── Task Generation (Task 2 only — Task 1 uses admin-uploaded topics) ───────
app.post('/api/generate-task', authenticate, async (req, res) => {
  const { task_type, topic } = req.body;
  if (task_type === 'task1') {
    return res.status(400).json({ error: 'Task 1 uses admin-uploaded topics. Use GET /api/task1-topics/random instead.' });
  }
  if (task_type !== 'task2') {
    return res.status(400).json({ error: 'task_type must be task2' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  {
    const topicClause = (topic && topic !== 'random')
      ? `The essay must be specifically about: ${topic}.`
      : `Choose a topic from: technology, environment, education, health, society, work and career, or crime and law.`;
    var userPrompt = `Write one original IELTS Writing Task 2 question. ${topicClause} It must present a statement or issue and ask the student to discuss, argue, or give an opinion. End with "Give reasons for your answer and include any relevant examples from your own knowledge or experience." The task should be 50–80 words.`;
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: 'You are an expert IELTS task writer. Output only the task text with no preamble, labels, or commentary.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.text || '';
    res.write(`data: ${JSON.stringify(text)}\n\n`);

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('generate-task', cost, inputTokens + outputTokens);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Task generation error:', err.message || err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify('[ERROR] ' + (err.message || 'AI service unavailable'))}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// ─── Hints ────────────────────────────────────────────────────────────────────
app.post('/api/hint', authenticate, async (req, res) => {
  const { task_type, prompt, essay, hint_type, student_ideas, level } = req.body;
  if (!['task1', 'task2'].includes(task_type)) {
    return res.status(400).json({ error: 'Invalid task_type' });
  }
  if (!['ideas', 'vocabulary', 'phrases', 'structure', 'follow_up'].includes(hint_type)) {
    return res.status(400).json({ error: 'hint_type must be ideas, vocabulary, phrases, structure, or follow_up' });
  }
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const taskLabel = task_type === 'task1' ? 'Task 1' : 'Task 2';
  const draftSection = essay && essay.trim()
    ? `\n\nStudent's current draft:\n${essay.trim()}`
    : '\n\n(Student has not written anything yet.)';

  // Build the ideas prompt — either scaffold-guided (student's own ideas) or AI-generated
  const ideasPrompt = (() => {
    if (hint_type !== 'ideas') return null;
    if (task_type === 'task1') {
      return `IELTS Writing Task 1 prompt:\n${prompt}${draftSection}\n\nGenerate a structured body-paragraph idea plan for this topic. Use this exact format:\n\n**Key Trend 1 — [label]**\n- What to describe: ...\n- Key data point to mention: ...\n\n**Key Trend 2 — [label]**\n- What to describe: ...\n- Key data point to mention: ...\n\n**Key Trend 3 / Overall**\n- Overall pattern or comparison: ...\n- Suggested overview sentence: ...\n\nKeep each bullet to 1–2 sentences. Be specific to this exact topic.`;
    }
    // Task 2
    if (student_ideas && student_ideas.trim()) {
      return `IELTS Writing Task 2 prompt:\n${prompt}${draftSection}\n\nThe student has provided their own pre-scaffolded main ideas:\n${student_ideas.trim()}\n\nYour job is to DEVELOP these specific ideas — do NOT suggest alternative arguments. For each idea the student provided, help them expand it into a full body paragraph plan using this format:\n\n**[Restate the student's idea as a paragraph heading]**\n- Developed argument: (expand their idea into a clear, specific claim)\n- Supporting evidence or reasoning: (provide 1–2 concrete pieces of evidence or logical support)\n- Concrete example: (a specific, real-world example directly relevant to this topic)\n- Linking to thesis: (one sentence connecting this paragraph back to their stated position)\n\nIf they provided a counterargument, develop it too:\n**Counterargument & Rebuttal**\n- Opposing view: (restate and sharpen their counterargument)\n- Rebuttal: (a strong one-sentence refutation)\n\nKeep each bullet to 1–2 sentences. Be specific to this exact topic and the student's stated ideas.`;
    }
    return `IELTS Writing Task 2 prompt:\n${prompt}${draftSection}\n\nGenerate a structured body-paragraph idea plan for this topic. Use this exact format:\n\n**Body Paragraph 1 — [topic label]**\n- Main argument: ...\n- Supporting detail or evidence: ...\n- Concrete example: ...\n\n**Body Paragraph 2 — [topic label]**\n- Main argument: ...\n- Supporting detail or evidence: ...\n- Concrete example: ...\n\n**Counterargument (optional)**\n- Opposing view in one sentence: ...\n- Your rebuttal in one sentence: ...\n\nKeep each bullet to 1–2 sentences. Be specific to this exact topic.`;
  })();

  const userPrompt = hint_type === 'ideas'
    ? ideasPrompt
    : hint_type === 'vocabulary'
    ? `IELTS Writing ${taskLabel} topic:\n${prompt}\n\nList 12–15 precise vocabulary items and collocations that would demonstrate strong Lexical Resource for this topic. Format each item as:\n**word or phrase** — example sentence showing natural, academic use.\n\nInclude a mix of: topic-specific terms, academic collocations, linking expressions, and precise verbs/adjectives.`
    : hint_type === 'structure'
    ? `IELTS Writing Task 1 prompt:\n${prompt}\n\nCreate a section-by-section writing blueprint for this specific chart/diagram. For each section write: what to include, suggested sentence count, and 1 example sentence using actual details from this task.\n\n## 🔍 Overview (2–3 sentences)\n- What to mention: the most dominant trend, any notable exception or comparison\n- Do NOT describe specific figures — keep it general\n- Example overview sentence for this task:\n\n## 📊 Body Paragraph 1 — Main Trend / Largest Category\n- What to cover: describe the dominant category or trend in detail with figures\n- Suggested approach: open with a topic sentence → cite 2–3 data points → note any peak/low\n- Example opening sentence for this task:\n\n## 📊 Body Paragraph 2 — Comparison / Secondary Trend\n- What to cover: compare remaining categories, or describe a contrasting trend\n- Suggested approach: use comparison language → cite figures → note similarities or differences\n- Example comparison sentence for this task:\n\n## ✏️ Conclusion Tips (Task 1 has NO separate conclusion — fold into overview)\n- Reminder: Task 1 overview already acts as the summary. Do not add a new "In conclusion" paragraph.\n- If word count allows: end Body Paragraph 2 with a brief overall comparison statement.\n\nAll example sentences must reference the actual data, categories, or visual type in this specific task.`
    : task_type === 'task2'
    ? `IELTS Writing Task 2 topic:\n${prompt}\n\nGenerate structured writing phrases and key vocabulary for this topic in one combined reference. Every example sentence must be directly about THIS specific topic — not a generic template.\n\n## 📝 Introduction\n**General Statement starters** (2 phrases + 1 example sentence each, about this topic):\n**Thesis Statement starters** (2 phrases + 1 example sentence each, taking a clear position on this topic):\n\n## 💡 Body Paragraph — Supporting Argument\n**Topic sentence starters** (2 phrases + 1 example sentence each, for a paragraph supporting the main argument on this topic):\n**Evidence / Elaboration phrases** (2 phrases + 1 example sentence each):\n\n## ⚖️ Body Paragraph — Counter-argument / Concession\n**Concession starters** (2 phrases + 1 example sentence each, acknowledging the opposing view on this topic):\n**Refutation phrases** (2 phrases + 1 example sentence each, rebutting it):\n\n## ✅ Conclusion\n**Restatement starters** (2 phrases + 1 example sentence each, restating the position on this topic):\n**Final thought / recommendation** (1 phrase + 1 example sentence):\n\n## 📚 Key Vocabulary Bank\n**Topic-specific terms** (6 words or collocations + 1 example sentence each, directly relevant to this topic):\n**Academic linking expressions** (3 transitions with example sentences for this topic):\n\nEvery example sentence: specific to this exact topic, thesis-quality, ready to paste into an essay.`
    : `IELTS Writing Task 1 prompt:\n${prompt}\n\nGenerate structured writing phrases for THIS specific task. Every example sentence must reference what this specific chart/diagram actually shows.\n\n## 🔍 Overview Paragraph\n**Overview openers** (2 phrases + 1 example sentence each, referring to what this chart shows overall):\n**Key feature phrases** (2 phrases for highlighting the most striking trend or feature visible in this data):\n\n## 📊 Detail Paragraph 1 — describing the main trend or category\n**Opening / signposting phrases** (2 phrases + 1 example sentence each, using data from this chart):\n**Data reference phrases** (3 phrases for citing figures — e.g. "stood at", "reached a peak of", "accounted for X%"):\n\n## 📊 Detail Paragraph 2 — comparison or second trend\n**Comparison phrases** (2 phrases + 1 example sentence each, comparing two specific items from this chart):\n**Change / movement verbs** (5 precise verbs with example sentences drawn from this chart's actual data):\n\n## 🔄 Process / Map\n(Include this section ONLY if the task is a process diagram or map. If it is, provide 3 sequence/location phrases with example sentences specific to this task. Otherwise omit this section entirely.)\n\nEvery example sentence: use the actual data, figures, categories, or locations from this specific task.`;

  // ── Level-adaptive scaffolding + Socratic follow-up ──────────────────────
  const LEVEL_GUIDES = {
    basic: 'Target level: Band 5.5–6.5. Give MORE structure and simpler language. Lean on the T-E-E frame (Topic sentence → Explanation → Example) as a fillable skeleton, and prefer everyday-life or general-society examples.',
    intermediate: 'Target level: Band 6.5–7.0. Push a short cause–effect idea chain (A→B→C) and self-checking ("why? how?"). Prefer specific real-world or country examples.',
    advanced: 'Target level: Band 7.0+. Expect a full idea-progression chain (A→E), screen the reasoning for logic fallacies, and use precise collocations. Ask more, give less.',
  };
  const levelGuide = LEVEL_GUIDES[level] || LEVEL_GUIDES.basic;

  const SCAFFOLD_RULES = {
    ideas: 'Give a fillable idea FRAME plus one guiding question per slot. If the student supplied their own ideas, develop THOSE — do not replace them with different arguments. Never write finished paragraphs for the student to copy.',
    phrases: 'OVERRIDE any earlier instruction to hand over copy-ready example sentences. Instead, give a SHORT set of topic collocations and, for each, set a mini-task telling the student to write their OWN sentence using it (about this topic or their own life). At advanced level, add one "noticing" item: show a single Band 8 model sentence and ask which chunks are worth stealing.',
    vocabulary: 'Give a short set of collocations and, for each, ask the student to write their own sentence rather than handing a copy-ready one.',
    structure: 'Give a section-by-section skeleton with guiding questions, not filled-in example sentences to copy.',
  };

  const typeStep = (hint_type === 'ideas' && task_type === 'task2')
    ? '\n\nFIRST, in one short line, name the Task 2 question type (Opinion / Discuss both views + opinion / Advantages–Disadvantages / Problem–Solution / Two-part question) and the paragraph structure it needs. THEN give the guidance.'
    : '';

  let systemPrompt = 'You are an expert IELTS writing COACH. You scaffold: you give frameworks, guiding questions, and you develop the student\'s OWN ideas. You never write the essay or hand over finished ideas to copy. Write guidance in Vietnamese but keep IELTS example phrases and collocations in English. Be specific to this exact topic and concise. Do not repeat the prompt back.';
  let finalPrompt = `${userPrompt}\n\n${levelGuide}\n\n${SCAFFOLD_RULES[hint_type] || ''}${typeStep}`;

  if (hint_type === 'follow_up') {
    systemPrompt = 'You are a Socratic IELTS writing coach. Ask EXACTLY ONE short, friendly probing question in Vietnamese that pushes the student to deepen, sharpen, or fix the weakest part of what they have so far. Never give the answer. Never ask more than one question.';
    finalPrompt = `IELTS Writing ${taskLabel} prompt:\n${prompt}${draftSection}\n\nStudent's ideas / notes so far:\n${student_ideas && student_ideas.trim() ? student_ideas.trim() : '(none provided yet)'}\n\nAsk one probing question to move their thinking forward.`;
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1400,
      system: systemPrompt,
      messages: [{ role: 'user', content: finalPrompt }],
    });

    const text = response.content[0]?.text || '';
    res.write(`data: ${JSON.stringify(text)}\n\n`);

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage(`hint-${hint_type}`, cost, inputTokens + outputTokens);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Hint error:', err.message || err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify('[ERROR] ' + (err.message || 'AI service unavailable'))}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// ─── Essay Rewrite ────────────────────────────────────────────────────────────
app.post('/api/rewrite', authenticate, async (req, res) => {
  const { submission_id } = req.body;
  if (!submission_id) return res.status(400).json({ error: 'submission_id is required' });

  const submission = db.getSubmissionById(parseInt(submission_id), req.user.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (!submission.essay) {
    return res.status(400).json({ error: 'No essay found to rewrite' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const taskLabel = submission.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const bandNote = submission.overall_band != null
    ? `The student's essay scored Band ${submission.overall_band}.`
    : `The student's essay has not yet been scored.`;
  const userPrompt = `You are an expert IELTS examiner and writing coach. ${bandNote}

Rewrite it targeting Band 8.0–8.5. Keep the same core argument and structure but improve:
- Task achievement/response (fully address all parts of the task)
- Coherence and cohesion (strong topic sentences, better paragraph flow, varied linking devices)
- Lexical resource (higher-level vocabulary, precise collocations, avoid repetition)
- Grammatical range and accuracy (complex sentence structures, eliminate errors)

After the rewritten essay, add a section with this exact heading on its own line:
## What Changed

Then list 5–6 bullet points (starting with -) explaining the key improvements made.

Original prompt: ${submission.prompt}

Original essay${submission.overall_band != null ? ` (Band ${submission.overall_band})` : ''}:
${submission.essay}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: 'You are an expert IELTS writing coach. Rewrite the essay at Band 8.0–8.5 level, then explain what you changed. Output the rewritten essay first, then the "## What Changed" section.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.text || '';
    res.write(`data: ${JSON.stringify(text)}\n\n`);

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('rewrite', cost, inputTokens + outputTokens);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Rewrite error:', err.message || err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify('[ERROR] ' + (err.message || 'AI service unavailable'))}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// ─── Password Reset (unauthenticated) ────────────────────────────────────────
app.post('/api/forgot-password', authStrictLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = db.getUserByEmail(email.toLowerCase());
    // Always return success to avoid user enumeration
    if (!user) return res.json({ sent: true });
    const code = generateCode();
    db.setResetCode(user.id, code, new Date(Date.now() + 30 * 60 * 1000).toISOString());
    await sendEmailSafe(() => sendPasswordResetEmail(user.email, user.name, code));
    res.json({ sent: true, email: user.email });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

app.post('/api/reset-password', authStrictLimiter, async (req, res) => {
  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) return res.status(400).json({ error: 'Email, code, and new password are required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = db.getUserByEmail(email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.reset_code || user.reset_code !== code) return res.status(400).json({ error: 'Invalid reset code' });
    if (new Date(user.reset_expires) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    const hashed = await bcrypt.hash(new_password, 10);
    db.resetPassword(user.id, hashed);
    const role = adminRole(user.email) === 'admin' ? 'admin' : (user.role || 'student');
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ─── Change Password (authenticated) ─────────────────────────────────────────
app.post('/api/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current password and new password are required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = db.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(current_password, user.password);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(new_password, 10);
    db.updatePassword(user.id, hashed);
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── Test Email (temporary public debug endpoint) ─────────────────────────────
app.get('/api/test-email', async (req, res) => {
  const to = process.env.ADMIN_EMAIL;
  if (!process.env.RESEND_API_KEY) return res.json({ ok: false, error: 'RESEND_API_KEY not set' });
  if (!to) return res.json({ ok: false, error: 'ADMIN_EMAIL not set' });
  try {
    const { error } = await getResend().emails.send({
      from: "SSP's IELTS Writing LMS <noreply@tintinlab.com>",
      to,
      subject: 'IELTS LMS — email test ✅',
      html: '<p>Email is working correctly!</p>'
    });
    if (error) throw new Error(error.message);
    res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Test Email (admin only) ──────────────────────────────────────────────────
app.post('/api/admin/test-email', authenticate, adminOnly, async (req, res) => {
  const to = req.body.to || req.user.email;
  try {
    const { error: testErr } = await getResend().emails.send({
      from: "SSP's IELTS Writing LMS <noreply@tintinlab.com>",
      to,
      subject: 'IELTS LMS — email test',
      html: '<p>Email is working correctly! ✅</p>'
    });
    if (testErr) throw new Error(testErr.message);
    res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ ok: false, error: err.message, code: err.code, responseCode: err.responseCode });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// AI connectivity health check — admin only
app.get('/api/admin/ai-health', authenticate, adminOnly, async (req, res) => {
  try {
    const start = Date.now();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Reply "ok"' }],
    });
    res.json({ ok: true, ms: Date.now() - start, reply: response.content[0]?.text, model: MODEL });
  } catch (err) {
    res.json({ ok: false, error: err.message, type: err.constructor?.name, model: MODEL });
  }
});

// Database backup — admin only, returns full lms-data.json as download
app.get('/api/admin/backup', authenticate, adminOnly, (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'lms-data.json'), 'utf8');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lms-backup-${stamp}.json"`);
    res.send(data);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Backup failed' });
  }
});

app.get('/api/admin/users', authenticate, teacherOrAdmin, (req, res) => {
  try {
    res.json(db.getAllUsersWithStats());
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

app.delete('/api/admin/users/:id', authenticate, adminOnly, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  const ok = db.deleteUser(targetId);
  if (!ok) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

// Admin: change a user's role (student ↔ teacher)
app.put('/api/admin/users/:id/role', authenticate, adminOnly, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { role } = req.body;
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'role must be student or teacher' });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own role.' });
  }
  const ok = db.setUserRole(targetId, role);
  if (!ok) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, role });
});

// Admin: batch delete / set role
app.post('/api/admin/users/batch', authenticate, adminOnly, (req, res) => {
  const { action, ids, role } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  if (!['delete', 'set_role'].includes(action)) return res.status(400).json({ error: 'invalid action' });
  if (action === 'set_role' && !['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'role must be student or teacher' });
  }
  const results = { ok: 0, skipped: 0 };
  for (const rawId of ids) {
    const id = parseInt(rawId, 10);
    if (id === req.user.id) { results.skipped++; continue; } // never touch own account
    const user = db.getUserById(id);
    if (!user || user.role === 'admin') { results.skipped++; continue; } // skip admins
    if (action === 'delete') {
      db.deleteUser(id) ? results.ok++ : results.skipped++;
    } else {
      db.setUserRole(id, role) ? results.ok++ : results.skipped++;
    }
  }
  res.json(results);
});

// ─── User Profile ─────────────────────────────────────────────────────────────
app.get('/api/user/profile', authenticate, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    target_band: user.target_band ?? null,
    avatar: user.avatar ?? null,
    current_streak: (() => {
      if (!user.last_activity_date || !(user.current_streak > 0)) return 0;
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      return (user.last_activity_date === today || user.last_activity_date === yesterday)
        ? user.current_streak
        : 0;
    })(),
    longest_streak: user.longest_streak || 0,
    last_activity_date: user.last_activity_date || null
  });
});

app.put('/api/user/profile', authenticate, (req, res) => {
  const { target_band, avatar } = req.body;
  if (target_band !== null && target_band !== undefined) {
    const band = parseFloat(target_band);
    if (isNaN(band) || band < 4 || band > 9) {
      return res.status(400).json({ error: 'target_band must be a number between 4.0 and 9.0' });
    }
    db.updateUserProfile(req.user.id, { target_band: band });
  }
  if (avatar !== undefined) {
    // Short emoji/string only; empty string resets to initials (null)
    const av = (typeof avatar === 'string' && avatar.trim()) ? avatar.trim().slice(0, 8) : null;
    db.updateUserProfile(req.user.id, { avatar: av });
  }
  res.json({ success: true });
});

// ─── Band Score Tables ────────────────────────────────────────────────────────
function rawScoreToBand(raw, type) {
  if (type === 'reading') {
    if (raw >= 40) return 9.0;
    if (raw >= 39) return 8.5;
    if (raw >= 37) return 8.0;
    if (raw >= 35) return 7.5;
    if (raw >= 33) return 7.0;
    if (raw >= 30) return 6.5;
    if (raw >= 27) return 6.0;
    if (raw >= 23) return 5.5;
    if (raw >= 19) return 5.0;
    if (raw >= 15) return 4.5;
    if (raw >= 13) return 4.0;
    if (raw >= 10) return 3.5;
    if (raw >= 8)  return 3.0;
    if (raw >= 6)  return 2.5;
    return 2.0;
  } else { // listening
    if (raw >= 39) return 9.0;
    if (raw >= 37) return 8.5;
    if (raw >= 35) return 8.0;
    if (raw >= 32) return 7.5;
    if (raw >= 30) return 7.0;
    if (raw >= 26) return 6.5;
    if (raw >= 23) return 6.0;
    if (raw >= 18) return 5.5;
    if (raw >= 16) return 5.0;
    if (raw >= 13) return 4.5;
    if (raw >= 10) return 4.0;
    if (raw >= 8)  return 3.5;
    if (raw >= 6)  return 3.0;
    if (raw >= 4)  return 2.5;
    return 2.0;
  }
}

// Score an attempt — returns { raw, total, band, section_scores, wrong_q_numbers }
function scoreAttempt(test, answers) {
  let raw = 0;
  let total = 0;
  const section_scores = [];
  const wrong_q_numbers = [];

  for (const section of (test.sections || [])) {
    let sec_correct = 0;
    let sec_total = 0;
    for (const q of (section.questions || [])) {
      if (q.q_type === 'matching' && q.sub_questions) {
        for (const sq of q.sub_questions) {
          total++; sec_total++;
          const key = `${q.q_number}_${sq.label}`;
          const given = (answers[key] || '').trim().toUpperCase();
          const correct = (sq.correct_answer || '').trim().toUpperCase();
          if (given === correct) { raw++; sec_correct++; }
          else wrong_q_numbers.push(key);
        }
      } else {
        total++; sec_total++;
        const givenRaw = (answers[String(q.q_number)] || '').trim().toLowerCase();
        const correct = (q.correct_answer || '').trim().toLowerCase();
        const alts = (q.accept_alternatives || []).map(a => a.trim().toLowerCase());
        // Support multi-answer MCQ (comma-separated): compare sorted arrays
        let isCorrect;
        if (correct.includes(',') || givenRaw.includes(',')) {
          const givenArr = givenRaw.split(',').map(s => s.trim()).filter(Boolean).sort();
          const correctArr = correct.split(',').map(s => s.trim()).filter(Boolean).sort();
          isCorrect = givenArr.length === correctArr.length && givenArr.every((v, i) => v === correctArr[i]);
        } else {
          const given = givenRaw;
          isCorrect = given === correct || alts.includes(given);
        }
        if (isCorrect) { raw++; sec_correct++; }
        else wrong_q_numbers.push(String(q.q_number));
      }
    }
    section_scores.push({ section_number: section.section_number, correct: sec_correct, total: sec_total });
  }

  return {
    raw, total,
    band: rawScoreToBand(raw, test.type),
    section_scores,
    wrong_q_numbers: wrong_q_numbers.slice(0, 20) // cap AI explanations at 20
  };
}

// Async AI explanations for wrong answers (background — does not block submit response)
async function generateTestExplanations(attemptId, test, answers, wrongQNumbers) {
  if (!wrongQNumbers.length) return;
  try {
    // Build a compact context: only the questions that were wrong
    const wrongItems = [];
    for (const section of (test.sections || [])) {
      const passageOrTranscript = section.passage_text || section.transcript || '';
      for (const q of (section.questions || [])) {
        const qKey = String(q.q_number);
        if (q.q_type === 'matching' && q.sub_questions) {
          for (const sq of q.sub_questions) {
            const key = `${q.q_number}_${sq.label}`;
            if (wrongQNumbers.includes(key)) {
              wrongItems.push({
                key, context: passageOrTranscript.slice(0, 600),
                stem: `${q.stem} — "${sq.label}"`,
                student_answer: answers[key] || '(blank)',
                correct_answer: sq.correct_answer,
                options: q.options
              });
            }
          }
        } else if (wrongQNumbers.includes(qKey)) {
          wrongItems.push({
            key: qKey, context: passageOrTranscript.slice(0, 600),
            stem: q.stem,
            student_answer: answers[qKey] || '(blank)',
            correct_answer: q.correct_answer,
            options: q.options || null,
            accept_alternatives: q.accept_alternatives || []
          });
        }
      }
    }

    const userContent = JSON.stringify(wrongItems, null, 2);
    const systemPrompt = `You are an IELTS examiner. For each wrong answer, provide a brief explanation (1-2 sentences) of why the correct answer is right and what clue in the passage/audio supports it. Return a JSON object mapping each "key" to an explanation string. Example: {"3": "The passage states X in paragraph 2, confirming the answer is Y.", "5_London": "The audio mentions Z."}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Wrong answers:\n${userContent}` }]
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('test-explanations', cost, inputTokens + outputTokens);

    let raw = response.content[0].text.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const explanations = JSON.parse(raw);
    db.setAttemptExplanations(attemptId, explanations, inputTokens + outputTokens, cost);
  } catch (err) {
    console.error('Test explanation error:', err.message);
  }
}

// ─── Admin Test Routes ────────────────────────────────────────────────────────

app.post('/api/admin/tests', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { type, title, sections } = req.body;
    if (!type || !['reading','listening'].includes(type)) return res.status(400).json({ error: 'type must be reading or listening' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
    if (!sections || !sections.length) return res.status(400).json({ error: 'sections are required' });
    const id = db.insertTest(type, title.trim(), sections, req.user.id);
    res.json({ id });
  } catch (err) {
    console.error('Create test error:', err);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

app.get('/api/admin/tests', authenticate, teacherOrAdmin, (req, res) => {
  try {
    res.json(db.getAllTests(req.query.type));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tests' });
  }
});

app.get('/api/admin/tests/:id', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const test = db.getTestById(parseInt(req.params.id, 10));
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load test' });
  }
});

app.delete('/api/admin/tests/:id', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const ok = db.deleteTest(parseInt(req.params.id, 10));
    if (!ok) return res.status(404).json({ error: 'Test not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete test' });
  }
});

// ─── Import Test from JSON ────────────────────────────────────────────────────
app.post('/api/admin/tests/import', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { json_text } = req.body;
    if (!json_text || !json_text.trim()) return res.status(400).json({ error: 'No JSON provided.' });

    let test;
    try { test = JSON.parse(json_text); } catch (e) {
      return res.status(400).json({ error: `Invalid JSON: ${e.message}` });
    }

    // ── Validate structure ─────────────────────────────────────────────────
    if (!test.type || !['reading','listening'].includes(test.type))
      return res.status(400).json({ error: '"type" must be "reading" or "listening".' });
    if (!test.title || !test.title.trim())
      return res.status(400).json({ error: '"title" is required.' });
    if (!Array.isArray(test.sections) || !test.sections.length)
      return res.status(400).json({ error: '"sections" must be a non-empty array.' });

    const validTypes = ['mcq','tfng','fill','matching'];
    const seenQNums = new Set();

    for (const [si, sec] of test.sections.entries()) {
      const sLabel = `Section ${si + 1}`;
      if (!Array.isArray(sec.questions) || !sec.questions.length)
        return res.status(400).json({ error: `${sLabel}: "questions" must be a non-empty array.` });
      for (const [qi, q] of sec.questions.entries()) {
        const qLabel = `${sLabel} Q${qi + 1}`;
        if (q.q_number == null) return res.status(400).json({ error: `${qLabel}: missing "q_number".` });
        if (seenQNums.has(q.q_number)) return res.status(400).json({ error: `Duplicate q_number: ${q.q_number}.` });
        seenQNums.add(q.q_number);
        if (!validTypes.includes(q.q_type)) return res.status(400).json({ error: `${qLabel}: invalid q_type "${q.q_type}". Must be one of: ${validTypes.join(', ')}.` });
        if (!q.stem || !q.stem.trim()) return res.status(400).json({ error: `${qLabel}: missing "stem".` });
        if (q.q_type !== 'matching') {
          if (!q.correct_answer && q.correct_answer !== 0)
            return res.status(400).json({ error: `${qLabel}: missing "correct_answer".` });
          if (q.q_type === 'mcq' && (!q.options || typeof q.options !== 'object' || !Object.keys(q.options).length))
            return res.status(400).json({ error: `${qLabel}: MCQ questions require an "options" object (e.g. {"A":"...", "B":"..."}).` });
          if (q.q_type === 'tfng' && !['TRUE','FALSE','NOT GIVEN'].includes(String(q.correct_answer).toUpperCase()))
            return res.status(400).json({ error: `${qLabel}: tfng correct_answer must be TRUE, FALSE, or NOT GIVEN.` });
        } else {
          if (!Array.isArray(q.sub_questions) || !q.sub_questions.length)
            return res.status(400).json({ error: `${qLabel}: matching questions need a "sub_questions" array.` });
          if (!q.options) return res.status(400).json({ error: `${qLabel}: matching questions need an "options" object.` });
        }
      }
    }

    // Strip any user-supplied id — let the DB assign it
    const { id: _ignored, created_at: _ca, created_by: _cb, ...rest } = test;
    const newId = db.insertTest(rest.type, rest.title.trim(), rest.sections, req.user.id);
    const count = test.sections.reduce((n, s) => n + s.questions.length, 0);
    res.json({ id: newId, message: `Test imported successfully — ${count} questions across ${test.sections.length} sections.` });
  } catch (err) {
    console.error('Import test error:', err);
    res.status(500).json({ error: 'Server error during import.' });
  }
});

// ─── Task 1 Topics (Admin Upload) ────────────────────────────────────────────

const VALID_CHART_TYPES = ['bar_chart','line_graph','pie_chart','table','process_diagram','map'];

// Admin: upload a new Task 1 topic (image + question)
app.post('/api/admin/task1-topics', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { chart_type, question, image_base64, image_media_type, label } = req.body;
    if (!VALID_CHART_TYPES.includes(chart_type)) {
      return res.status(400).json({ error: `chart_type must be one of: ${VALID_CHART_TYPES.join(', ')}` });
    }
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });
    if (!image_base64) return res.status(400).json({ error: 'image_base64 is required' });
    const validTypes = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!validTypes.includes(image_media_type)) {
      return res.status(400).json({ error: 'image_media_type must be jpeg, png, gif, or webp' });
    }
    const id = db.insertTask1Topic(chart_type, question.trim(), image_base64, image_media_type, (label || '').trim());
    res.json({ id, message: 'Topic uploaded successfully' });
  } catch (err) {
    console.error('Upload task1 topic error:', err);
    res.status(500).json({ error: 'Failed to upload topic' });
  }
});

// Admin: list all topics (no image data)
app.get('/api/admin/task1-topics', authenticate, (req, res) => {
  try {
    res.json(db.getAllTask1Topics(req.query.chart_type));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load topics' });
  }
});

// Admin: get single topic (full, with image)
app.get('/api/admin/task1-topics/:id', authenticate, (req, res) => {
  try {
    const topic = db.getTask1TopicById(parseInt(req.params.id, 10));
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json(topic);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load topic' });
  }
});

// Admin: update a topic
app.put('/api/admin/task1-topics/:id', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { chart_type, question, label, image_base64, image_media_type } = req.body;
    if (chart_type && !VALID_CHART_TYPES.includes(chart_type)) {
      return res.status(400).json({ error: `chart_type must be one of: ${VALID_CHART_TYPES.join(', ')}` });
    }
    if (question !== undefined && !question.trim()) {
      return res.status(400).json({ error: 'question cannot be empty' });
    }
    if (image_base64 && image_media_type) {
      const validTypes = ['image/jpeg','image/png','image/gif','image/webp'];
      if (!validTypes.includes(image_media_type)) {
        return res.status(400).json({ error: 'image_media_type must be jpeg, png, gif, or webp' });
      }
    }
    const ok = db.updateTask1Topic(id, {
      chart_type, question: question ? question.trim() : undefined,
      label: label !== undefined ? label.trim() : undefined,
      image_base64, image_media_type
    });
    if (!ok) return res.status(404).json({ error: 'Topic not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Update task1 topic error:', err);
    res.status(500).json({ error: 'Failed to update topic' });
  }
});

// Admin: delete a topic
app.delete('/api/admin/task1-topics/:id', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const ok = db.deleteTask1Topic(parseInt(req.params.id, 10));
    if (!ok) return res.status(404).json({ error: 'Topic not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// Student: get a random Task 1 topic (with image) — ?chart_type=bar_chart or omit for random
app.get('/api/task1-topics/random', authenticate, (req, res) => {
  try {
    const chart_type = req.query.chart_type || 'random';
    const topic = db.getRandomTask1Topic(chart_type);
    if (!topic) {
      return res.status(404).json({
        error: chart_type === 'random'
          ? 'No Task 1 topics have been uploaded yet. Ask your teacher to add some.'
          : `No topics found for chart type: ${chart_type}. Try a different type or ask your teacher.`
      });
    }
    res.json(topic);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load topic' });
  }
});

// ─── Student Test Routes ──────────────────────────────────────────────────────

// List tests with user's attempt status
app.get('/api/tests', authenticate, (req, res) => {
  try {
    const tests = db.getAllTests(req.query.type);
    const attempts = db.getAttemptsByUser(req.user.id);
    const result = tests.map(t => {
      const userAttempts = attempts.filter(a => a.test_id === t.id);
      const inProgress = userAttempts.find(a => a.status === 'in_progress');
      const completed = userAttempts.filter(a => a.status === 'completed').sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];
      return {
        ...t,
        user_status: inProgress ? 'in_progress' : completed ? 'completed' : 'not_started',
        in_progress_attempt_id: inProgress ? inProgress.id : null,
        latest_attempt_id: completed ? completed.id : null,
        latest_band: completed ? (completed.score ? completed.score.band : null) : null
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tests' });
  }
});

// Start a new attempt (or resume in-progress)
app.post('/api/tests/:id/start', authenticate, (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const test = db.getTestForStudent(testId);
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Resume in-progress if exists
    const existing = db.getInProgressAttempt(testId, req.user.id);
    if (existing) {
      return res.json({ attempt_id: existing.id, test, answers: existing.answers, time_remaining_secs: existing.time_remaining_secs, resumed: true });
    }

    const attemptId = db.insertTestAttempt(testId, req.user.id, test.type);
    res.json({ attempt_id: attemptId, test, answers: {}, time_remaining_secs: test.type === 'reading' ? 3600 : 1800, resumed: false });
  } catch (err) {
    console.error('Start test error:', err);
    res.status(500).json({ error: 'Failed to start test' });
  }
});

// Autosave answers mid-test
app.put('/api/tests/:id/attempts/:aid/autosave', authenticate, (req, res) => {
  try {
    const attemptId = parseInt(req.params.aid, 10);
    const { answers, time_remaining_secs } = req.body;
    const ok = db.updateAttemptAnswers(attemptId, req.user.id, answers || {}, time_remaining_secs);
    if (!ok) return res.status(400).json({ error: 'Attempt not found or already completed' });
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save answers' });
  }
});

// Submit attempt — score it, kick off AI explanations async
app.post('/api/tests/:id/attempts/:aid/submit', authenticate, async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const attemptId = parseInt(req.params.aid, 10);
    const { answers, time_remaining_secs } = req.body;

    // Verify ownership and status
    const attempt = db.getAttemptById(attemptId, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.status === 'completed') return res.status(409).json({ error: 'Attempt already submitted' });

    // Load full test with answers for scoring
    const test = db.getTestById(testId);
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Save final answers
    db.updateAttemptAnswers(attemptId, req.user.id, answers || {}, time_remaining_secs || 0);

    // Score
    const score = scoreAttempt(test, answers || {});
    db.completeAttempt(attemptId, score, null, null, null);

    // Update streak
    try { db.updateStreak(req.user.id); } catch (e) { console.error('Streak error:', e); }

    // Auto-complete any homework assignments linked to this test
    try {
      const linkedAssignments = db.getIncompleteAssignmentsForTest(req.user.id, testId, test.type);
      if (linkedAssignments.length > 0) {
        const student = db.getUserById(req.user.id);
        for (const assignment of linkedAssignments) {
          const result = db.markAssignmentComplete(assignment.id, req.user.id);
          if (result) {
            sendEmailSafe(async () => {
              const adminEmails = getAdminEmails();
              await Promise.all(adminEmails.map(email =>
                sendHomeworkSubmittedEmail(email, student, assignment, result.completed_at, result.is_late)
              ));
            });
          }
        }
      }
    } catch (e) { console.error('Auto-complete assignment error:', e); }

    // Fire AI explanations in background
    if (score.wrong_q_numbers.length > 0) {
      generateTestExplanations(attemptId, test, answers || {}, score.wrong_q_numbers).catch(console.error);
    }

    res.json({ attempt_id: attemptId, score });
  } catch (err) {
    console.error('Submit test error:', err);
    res.status(500).json({ error: 'Failed to submit test' });
  }
});

// Attempt history list
app.get('/api/tests/attempts', authenticate, (req, res) => {
  try {
    res.json(db.getAttemptsByUser(req.user.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load attempts' });
  }
});

// Single attempt detail (poll for AI explanations)
app.get('/api/tests/attempts/:aid', authenticate, (req, res) => {
  try {
    const attemptId = parseInt(req.params.aid, 10);
    const attempt = db.getAttemptById(attemptId, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    // Strip correct answers from test before sending to student
    if (attempt.test) {
      attempt.test = JSON.parse(JSON.stringify(attempt.test));
      for (const section of (attempt.test.sections || [])) {
        for (const q of (section.questions || [])) {
          // Keep correct_answer here so the result view can show it
          // (the attempt is already completed — student already submitted)
        }
      }
    }
    res.json(attempt);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load attempt' });
  }
});

// ─── Admin Cost Breakdown ─────────────────────────────────────────────────────
app.get('/api/admin/cost-breakdown', authenticate, adminOnly, (req, res) => {
  try {
    // DB setting takes priority; fall back to env var, then 4.98 default
    const envDefault = parseFloat(process.env.STARTING_BALANCE || '4.98');
    const startingBalance = parseFloat(db.getSetting('starting_balance', envDefault));
    const totalCost = db.getTotalCost();
    const remaining = Math.max(0, startingBalance - totalCost);
    const breakdown = db.getCostBreakdown();
    res.json({
      total_cost: Math.round(totalCost * 10000) / 10000,
      remaining_balance: Math.round(remaining * 10000) / 10000,
      starting_balance: Math.round(startingBalance * 10000) / 10000,
      breakdown
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load cost breakdown' });
  }
});

// Admin: update the Anthropic credit balance snapshot
app.put('/api/admin/settings/balance', authenticate, adminOnly, (req, res) => {
  try {
    const { balance } = req.body;
    const val = parseFloat(balance);
    if (isNaN(val) || val < 0) return res.status(400).json({ error: 'Invalid balance value' });
    db.setSetting('starting_balance', val);
    res.json({ message: 'Balance updated', starting_balance: val });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Admin/Teacher: view a student's full submission history (with essay text)
app.get('/api/admin/users/:id/submissions', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = db.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const submissions = db.getAdminStudentSubmissions(userId);
    res.json({ user: { id: user.id, name: user.name, email: user.email }, submissions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load submissions' });
  }
});

// ─── Grade Queue (Teacher/Admin Manual Grading) ───────────────────────────────

// Get all graded submissions archive
app.get('/api/admin/submissions/archive', authenticate, teacherOrAdmin, (req, res) => {
  try {
    res.json(db.getAllGradedSubmissions());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load submissions archive' });
  }
});

// Get all pending_review submissions (queue)
app.get('/api/admin/submissions/pending', authenticate, teacherOrAdmin, (req, res) => {
  try {
    res.json(db.getAllPendingReviewSubmissions());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load grade queue' });
  }
});

// Teacher/admin manually grades a submission
app.post('/api/admin/submissions/:id/grade', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const subId = parseInt(req.params.id, 10);
    const { task_achievement, coherence_cohesion, lexical_resource, grammatical_range,
            detailed_feedback, strengths, improvements, annotations } = req.body;

    // Validate band scores
    const vals = [task_achievement, coherence_cohesion, lexical_resource, grammatical_range];
    if (vals.some(v => v === undefined || v === null || isNaN(parseFloat(v)))) {
      return res.status(400).json({ error: 'All four band scores are required' });
    }

    const sub = db.getSubmissionByIdAdmin(subId);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    if (!['pending_review', 'error'].includes(sub.status)) {
      return res.status(409).json({ error: 'Submission is already graded or being graded' });
    }

    const normalize = v => Math.round(parseFloat(v) * 2) / 2;
    const ta = normalize(task_achievement);
    const cc = normalize(coherence_cohesion);
    const lr = normalize(lexical_resource);
    const gra = normalize(grammatical_range);
    const overall = Math.round(((ta + cc + lr + gra) / 4) * 2) / 2;

    const parseList = arr => Array.isArray(arr) ? JSON.stringify(arr) : JSON.stringify([]);

    db.insertFeedback(
      subId, ta, cc, lr, gra, overall,
      detailed_feedback || '',
      parseList(strengths),
      parseList(improvements),
      null, null, null,   // sentence_analysis, criterion_details, overall_improvements
      null, null,         // tokens_used, cost_usd
      req.user.id,        // graded_by (teacher/admin user ID)
      annotations || null // inline essay annotations
    );
    db.updateSubmissionStatus(subId, 'graded');
    try { db.updateStreak(sub.user_id); } catch (e) { console.error('Streak error:', e); }

    res.json({ success: true, overall_band: overall });
  } catch (err) {
    console.error('Manual grade error:', err);
    res.status(500).json({ error: 'Failed to submit grade' });
  }
});

// Teacher/admin saves inline essay annotations (can be called independently)
app.put('/api/admin/submissions/:id/annotations', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const subId = parseInt(req.params.id, 10);
    const { annotations } = req.body;
    if (!Array.isArray(annotations)) return res.status(400).json({ error: 'annotations must be array' });
    const sub = db.getSubmissionByIdAdmin(subId);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    db.updateAnnotations(subId, annotations);
    res.json({ success: true });
  } catch (err) {
    console.error('Annotations update error:', err);
    res.status(500).json({ error: 'Failed to save annotations' });
  }
});

// Teacher/admin delegates a pending_review submission to AI grading
app.post('/api/admin/submissions/:id/grade-ai', authenticate, teacherOrAdmin, async (req, res) => {
  try {
    const subId = parseInt(req.params.id, 10);
    const sub = db.getSubmissionByIdAdmin(subId);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    if (!['pending_review', 'error'].includes(sub.status)) {
      return res.status(409).json({ error: 'Submission is already graded or being graded' });
    }
    const minWords = sub.task_type === 'task1' ? 150 : 250;
    gradeSubmission(subId, sub.user_id, sub.task_type, sub.prompt, sub.essay, sub.word_count, minWords, null).catch(console.error);
    res.json({ status: 'grading' });
  } catch (err) {
    console.error('Grade-AI delegation error:', err);
    res.status(500).json({ error: 'Failed to start AI grading' });
  }
});

// Teacher/admin gets AI-suggested band scores for a submission
app.post('/api/admin/submissions/:id/ai-suggest', authenticate, teacherOrAdmin, async (req, res) => {
  try {
    const subId = parseInt(req.params.id, 10);
    const sub = db.getSubmissionByIdAdmin(subId);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    const taskLabel = sub.task_type === 'task1' ? 'Task 1' : 'Task 2';
    const systemPrompt = `You are an expert IELTS examiner. Evaluate essays and return ONLY valid JSON. No markdown.`;
    const userPrompt = `Evaluate this IELTS Writing ${taskLabel} essay and return ONLY a JSON object with band scores and rationale.

Topic/Prompt:
${(sub.prompt || '').slice(0, 500)}

Essay:
${(sub.essay || '').slice(0, 2000)}

Return this exact JSON structure (band scores must be 0–9 in 0.5 steps):
{
  "task_achievement": 6.5,
  "coherence_cohesion": 6.0,
  "lexical_resource": 6.5,
  "grammatical_range": 6.0,
  "rationale": "Brief 2–3 sentence explanation of the scores, noting key strengths and weaknesses."
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const inputTokens = response.usage ? response.usage.input_tokens : 0;
    const outputTokens = response.usage ? response.usage.output_tokens : 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('teacher-ai-assist', cost, inputTokens + outputTokens);

    let raw = response.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    console.error('AI suggest error:', err);
    res.status(500).json({ error: 'Failed to get AI suggestion' });
  }
});

// ─── Submission Comments ───────────────────────────────────────────────────────

// Teacher/admin adds a comment to a submission
app.post('/api/admin/submissions/:id/comments', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const subId = parseInt(req.params.id, 10);
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text is required' });
    const comment = db.addSubmissionComment(subId, req.user.id, req.user.name, text.trim());
    if (!comment) return res.status(404).json({ error: 'Submission not found' });
    res.json(comment);
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Teacher/admin deletes their own comment
app.delete('/api/admin/submissions/:id/comments/:commentId', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const subId = parseInt(req.params.id, 10);
    const commentId = parseInt(req.params.commentId, 10);
    const ok = db.deleteSubmissionComment(subId, commentId, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Comment not found or not yours' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ─── Assignments (Homework) ────────────────────────────────────────────────────

// Admin/Teacher: create assignment
app.post('/api/admin/assignments', authenticate, teacherOrAdmin, async (req, res) => {
  try {
    const { title, type, description, test_id, deadline, assigned_to, custom_prompt, custom_image_url } = req.body;
    if (!title || !type || !deadline) {
      return res.status(400).json({ error: 'title, type, and deadline are required' });
    }
    const validTypes = ['writing_task1', 'writing_task2', 'reading', 'listening'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be: ' + validTypes.join(', ') });
    }
    const assignedTo = Array.isArray(assigned_to) ? assigned_to.map(Number).filter(Boolean) : [];
    const id = db.insertAssignment(title, type, description, test_id || null, deadline, req.user.id, assignedTo, custom_prompt || null, custom_image_url || null);
    const assignment = db.getAssignmentById(id);

    // Fire email notifications to targeted students (non-blocking)
    sendEmailSafe(async () => {
      const allUsers = db.getAllUsers ? db.getAllUsers() : [];
      const students = allUsers.filter(u => u.role === 'student' && u.verified);
      const targets = assignedTo.length > 0
        ? students.filter(u => assignedTo.includes(u.id))
        : students; // all students
      await Promise.all(targets.map(s => sendHomeworkAssignedEmail(s, assignment)));
    });

    res.json({ id, message: 'Assignment created' });
  } catch (err) {
    console.error('Create assignment error:', err);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Admin/Teacher: list all assignments
app.get('/api/admin/assignments', authenticate, teacherOrAdmin, (req, res) => {
  try {
    res.json(db.getAllAssignments());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load assignments' });
  }
});

// Admin/Teacher: delete assignment
app.delete('/api/admin/assignments/:id', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = db.deleteAssignment(id);
    if (!ok) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// Student: list assignments with completion status
app.get('/api/assignments', authenticate, (req, res) => {
  try {
    res.json(db.getAssignmentsForUser(req.user.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load assignments' });
  }
});

// Student: mark assignment complete
app.post('/api/assignments/:id/complete', authenticate, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const result = db.markAssignmentComplete(assignmentId, req.user.id);
    if (!result) return res.json({ message: 'Already marked as complete' });

    // Email admins (non-blocking)
    const { completed_at, is_late, assignment } = result;
    if (assignment) {
      const student = db.getUserById(req.user.id);
      sendEmailSafe(async () => {
        const adminEmails = getAdminEmails();
        await Promise.all(adminEmails.map(email =>
          sendHomeworkSubmittedEmail(email, student, assignment, completed_at, is_late)
        ));
      });
    }

    res.json({ message: 'Marked as complete' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark complete' });
  }
});

// ─── Retry Grading ────────────────────────────────────────────────────────────
app.post('/api/submissions/:id/retry', authenticate, async (req, res) => {
  const submissionId = parseInt(req.params.id);
  const submission = db.getSubmissionById(submissionId, req.user.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.status !== 'error') {
    return res.status(400).json({ error: 'Only error-status submissions can be retried' });
  }

  const wordCount = submission.essay ? submission.essay.trim().split(/\s+/).length : 0;
  const minWords = submission.task_type === 'task1' ? 150 : 250;

  // Kick off grading again (async, same function)
  gradeSubmission(submissionId, req.user.id, submission.task_type, submission.prompt, submission.essay, wordCount, minWords, null).catch(console.error);

  res.json({ id: submissionId, status: 'grading' });
});

// ─── Vocabulary Flashcards ─────────────────────────────────────────────────────
app.post('/api/submissions/:id/flashcards', authenticate, async (req, res) => {
  const submissionId = parseInt(req.params.id);
  const submission = db.getSubmissionById(submissionId, req.user.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.status !== 'graded') {
    return res.status(400).json({ error: 'Essay must be graded to generate flashcards' });
  }

  const essayText = submission.essay || '';
  const feedbackText = submission.detailed_feedback || '';
  const improvements = (() => {
    try {
      const obj = typeof submission.overall_improvements === 'string'
        ? JSON.parse(submission.overall_improvements)
        : (submission.overall_improvements || {});
      return Object.values(obj).join(' ');
    } catch { return ''; }
  })();

  const userPrompt = `You are an IELTS vocabulary coach. Analyze this student essay and its feedback to create a rich set of study flashcards including vocabulary, useful phrases, and collocations.

Essay:
${essayText.slice(0, 1500)}

Feedback summary:
${(feedbackText + ' ' + improvements).slice(0, 800)}

Return ONLY a valid JSON array (no markdown, no code fences) with exactly 13 items:
- 5 vocabulary words (type: "vocabulary")
- 4 useful phrases / sentence starters (type: "phrase")
- 4 collocations / word pairs (type: "collocation")

Format:
[
  {
    "type": "vocabulary",
    "word": "meticulous",
    "definition": "Showing great attention to detail; very careful and precise",
    "example": "The report provided a meticulous analysis of urban migration trends."
  },
  {
    "type": "phrase",
    "word": "It is widely acknowledged that",
    "definition": "Used to introduce a broadly accepted fact or opinion",
    "example": "It is widely acknowledged that climate change poses a significant threat."
  },
  {
    "type": "collocation",
    "word": "pose a threat",
    "definition": "To present or represent a danger or risk",
    "example": "Rising sea levels pose a significant threat to coastal communities."
  }
]

Rules:
- vocabulary: single advanced words relevant to the essay topic or feedback
- phrase: sentence starters, transitions, or discourse markers useful for IELTS writing
- collocation: natural verb+noun or adjective+noun pairs common in academic English
- Keep definitions concise (under 15 words)
- Example sentences must be IELTS-appropriate (not copied from the student's essay)`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1800,
      system: 'You are an IELTS vocabulary coach. Return ONLY valid JSON arrays. No markdown.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const inputTokens = response.usage ? response.usage.input_tokens : 0;
    const outputTokens = response.usage ? response.usage.output_tokens : 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('flashcards', cost, inputTokens + outputTokens);

    let raw = response.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const cards = JSON.parse(raw);
    res.json({ cards });
  } catch (err) {
    console.error('Flashcard error:', err);
    res.status(500).json({ error: 'Failed to generate flashcards' });
  }
});

// ─── Classes & Attendance ─────────────────────────────────────────────────────

// Create class
app.post('/api/classes', authenticate, teacherOrAdmin, (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Class name required' });
  const id = db.insertClass(name.trim(), description || '', req.user.id);
  res.json({ id });
});

// List classes — teacher sees own, admin sees all, student sees enrolled
app.get('/api/classes', authenticate, (req, res) => {
  const { role, id: userId } = req.user;
  if (role === 'admin') {
    const classes = db.getAllClasses();
    return res.json(classes.map(c => {
      const students = db.getClassStudents(c.id);
      const teacher = db.getUserById(c.teacher_id);
      return { ...c, student_count: students.length, teacher_name: teacher ? teacher.name : 'Unknown' };
    }));
  }
  if (role === 'teacher') {
    const classes = db.getClassesByTeacher(userId);
    return res.json(classes.map(c => {
      const students = db.getClassStudents(c.id);
      const teacher = db.getUserById(c.teacher_id);
      return { ...c, student_count: students.length, teacher_name: teacher ? teacher.name : 'Unknown' };
    }));
  }
  // student
  return res.json(db.getStudentClasses(userId));
});

// Get class detail + roster
app.get('/api/classes/:id', authenticate, (req, res) => {
  const classId = parseInt(req.params.id);
  const cls = db.getClassById(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  // Students can only view classes they're enrolled in
  if (req.user.role === 'student') {
    const enrolled = db.getStudentClasses(req.user.id);
    if (!enrolled.find(c => c.class_id === classId)) return res.status(403).json({ error: 'Not enrolled' });
  }
  const students = db.getClassStudents(classId);
  const sessions = db.getSessionsByClass(classId);
  res.json({ ...cls, students, sessions });
});

// Update class
app.put('/api/classes/:id', authenticate, teacherOrAdmin, (req, res) => {
  const classId = parseInt(req.params.id);
  const cls = db.getClassById(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  if (req.user.role !== 'admin' && cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your class' });
  db.updateClass(classId, req.body);
  res.json({ ok: true });
});

// Delete class
app.delete('/api/classes/:id', authenticate, teacherOrAdmin, (req, res) => {
  const classId = parseInt(req.params.id);
  const cls = db.getClassById(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  if (req.user.role !== 'admin' && cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your class' });
  db.deleteClass(classId);
  res.json({ ok: true });
});

// Enroll student
app.post('/api/classes/:id/enroll', authenticate, teacherOrAdmin, (req, res) => {
  const classId = parseInt(req.params.id);
  const cls = db.getClassById(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  if (req.user.role !== 'admin' && cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your class' });
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const result = db.enrollStudent(classId, parseInt(user_id));
  if (result === null) return res.status(409).json({ error: 'Already enrolled' });
  res.json({ ok: true });
});

// Unenroll student
app.delete('/api/classes/:id/enroll/:userId', authenticate, teacherOrAdmin, (req, res) => {
  const classId = parseInt(req.params.id);
  const cls = db.getClassById(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  if (req.user.role !== 'admin' && cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your class' });
  db.unenrollStudent(classId, parseInt(req.params.userId));
  res.json({ ok: true });
});

// Create or get session for a date (idempotent)
app.post('/api/classes/:id/sessions', authenticate, teacherOrAdmin, (req, res) => {
  const classId = parseInt(req.params.id);
  const cls = db.getClassById(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  if (req.user.role !== 'admin' && cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your class' });
  const { session_date } = req.body;
  if (!session_date || !/^\d{4}-\d{2}-\d{2}$/.test(session_date)) return res.status(400).json({ error: 'session_date required (YYYY-MM-DD)' });
  const id = db.insertSession(classId, session_date, req.user.id);
  res.json({ id, session_date });
});

// List sessions for a class
app.get('/api/classes/:id/sessions', authenticate, (req, res) => {
  const classId = parseInt(req.params.id);
  const cls = db.getClassById(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  res.json(db.getSessionsByClass(classId));
});

// Delete a session
app.delete('/api/sessions/:sessionId', authenticate, teacherOrAdmin, (req, res) => {
  const session = db.getSessionById(parseInt(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const cls = db.getClassById(session.class_id);
  if (req.user.role !== 'admin' && cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your class' });
  db.deleteSession(session.id);
  res.json({ ok: true });
});

// Bulk mark attendance for a session
app.post('/api/sessions/:sessionId/attendance', authenticate, teacherOrAdmin, (req, res) => {
  const sessionId = parseInt(req.params.sessionId);
  const session = db.getSessionById(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const cls = db.getClassById(session.class_id);
  if (req.user.role !== 'admin' && cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your class' });
  const records = req.body.records; // [{user_id, status, notes}]
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records array required' });
  const validStatuses = ['present', 'absent', 'late', 'excused'];
  for (const r of records) {
    if (!r.user_id || !validStatuses.includes(r.status)) continue;
    db.upsertAttendanceRecord(sessionId, session.class_id, parseInt(r.user_id), r.status, r.notes || null, req.user.id);
  }
  res.json({ ok: true });
});

// Get attendance sheet for a session
app.get('/api/sessions/:sessionId/attendance', authenticate, (req, res) => {
  const sessionId = parseInt(req.params.sessionId);
  const session = db.getSessionById(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  // Students can only see their own record
  if (req.user.role === 'student') {
    const all = db.getAttendanceBySession(sessionId);
    const mine = all.find(r => r.user_id === req.user.id);
    return res.json(mine ? [mine] : []);
  }
  res.json(db.getAttendanceBySession(sessionId));
});

// Student: own attendance for a class
app.get('/api/classes/:id/attendance/me', authenticate, (req, res) => {
  const classId = parseInt(req.params.id);
  const records = db.getAttendanceByStudent(req.user.id, classId);
  const sessions = db.getSessionsByClass(classId);
  const result = records.map(r => {
    const s = sessions.find(s => s.id === r.session_id) || {};
    return { ...r, session_date: s.session_date };
  });
  res.json(result);
});

// Attendance stats per student for a class
app.get('/api/classes/:id/stats', authenticate, teacherOrAdmin, (req, res) => {
  const classId = parseInt(req.params.id);
  const cls = db.getClassById(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  if (req.user.role !== 'admin' && cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your class' });
  res.json(db.getAttendanceStats(classId));
});

// Get all students (for teacher to add to class roster)
app.get('/api/students', authenticate, teacherOrAdmin, (req, res) => {
  const users = db.getAllUsers().filter(u => u.role === 'student');
  res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email })));
});

// ─── Notifications ────────────────────────────────────────────────────────────
app.get('/api/user/notifications', authenticate, (req, res) => {
  try {
    res.json(db.getNotificationCount(req.user.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

app.post('/api/user/notifications/read', authenticate, (req, res) => {
  try {
    db.markNotificationsRead(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// ─── Saved Words ──────────────────────────────────────────────────────────────
app.get('/api/saved-words', authenticate, (req, res) => {
  try {
    res.json(db.getSavedWords(req.user.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get saved words' });
  }
});

app.post('/api/saved-words', authenticate, (req, res) => {
  try {
    const { word, definition, example, source } = req.body;
    if (!word) return res.status(400).json({ error: 'word is required' });
    const entry = db.addSavedWord(req.user.id, { word, definition, example, source });
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save word' });
  }
});

app.delete('/api/saved-words/:id', authenticate, (req, res) => {
  try {
    db.deleteSavedWord(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete saved word' });
  }
});

// ─── Custom Speaking Bank (admin CRUD + public read) ─────────────────────────
app.get('/api/speaking-bank-custom', (req, res) => {
  try { res.json(db.getSpeakingBankCustom()); }
  catch (err) { res.status(500).json({ error: 'Failed to load speaking bank' }); }
});

app.get('/api/admin/speaking-topics', authenticate, teacherOrAdmin, (req, res) => {
  try { res.json(db.getSpeakingBankCustom()); }
  catch (err) { res.status(500).json({ error: 'Failed to load speaking topics' }); }
});

app.post('/api/admin/speaking-topics', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { bank, part, cat, difficulty, q } = req.body;
    if (!q || !q.trim()) return res.status(400).json({ error: 'Question text is required' });
    const item = db.addSpeakingTopic({ bank: bank || 'ielts', part: part || '1', cat: cat || 'General', difficulty: difficulty || 'medium', q: q.trim() });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add speaking topic' });
  }
});

app.delete('/api/admin/speaking-topics/:id', authenticate, teacherOrAdmin, (req, res) => {
  try {
    db.deleteSpeakingTopic(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete speaking topic' });
  }
});

// ─── Custom Task 2 Prompts (admin CRUD + public read) ────────────────────────
app.get('/api/task2-prompts-custom', (req, res) => {
  try { res.json(db.getTask2PromptsCustom()); }
  catch (err) { res.status(500).json({ error: 'Failed to load task2 prompts' }); }
});

app.get('/api/admin/task2-prompts', authenticate, (req, res) => {
  try { res.json(db.getTask2PromptsCustom()); }
  catch (err) { res.status(500).json({ error: 'Failed to load task2 prompts' }); }
});

app.post('/api/admin/task2-prompts', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { difficulty, q, question_type } = req.body;
    if (!q || !q.trim()) return res.status(400).json({ error: 'Prompt text is required' });
    const item = db.addTask2Prompt({ difficulty: difficulty || 'medium', q: q.trim(), question_type: question_type || undefined });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add Task 2 prompt' });
  }
});

app.put('/api/admin/task2-prompts/:id', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { question_type, difficulty, q } = req.body;
    const ok = db.updateTask2Prompt(req.params.id, { question_type, difficulty, q: q ? q.trim() : undefined });
    if (!ok) return res.status(404).json({ error: 'Prompt not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update Task 2 prompt' });
  }
});

app.delete('/api/admin/task2-prompts/:id', authenticate, teacherOrAdmin, (req, res) => {
  try {
    db.deleteTask2Prompt(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete Task 2 prompt' });
  }
});

// ── Model Essays (band 8-9 samples) ────────────────────────────────────────
app.get('/api/model-essays', (req, res) => {
  try { res.json(db.getModelEssays(req.query.task_type || null, req.query.topic || null)); }
  catch (err) { res.status(500).json({ error: 'Failed to load model essays' }); }
});
app.get('/api/admin/model-essays', authenticate, teacherOrAdmin, (req, res) => {
  try { res.json(db.getModelEssays(null, null)); }
  catch (err) { res.status(500).json({ error: 'Failed to load model essays' }); }
});
app.post('/api/admin/model-essays', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { task_type, topic_category, chart_type, prompt, essay, band_estimate, model_strengths } = req.body;
    if (!task_type || !['task1', 'task2'].includes(task_type)) return res.status(400).json({ error: 'task_type must be task1 or task2' });
    if (!prompt || !prompt.trim() || !essay || !essay.trim()) return res.status(400).json({ error: 'Prompt and essay are required' });
    const word_count = essay.trim().split(/\s+/).length;
    const strengths = Array.isArray(model_strengths)
      ? model_strengths
      : (typeof model_strengths === 'string' ? model_strengths.split(',').map(s => s.trim()).filter(Boolean) : []);
    const item = db.addModelEssay({
      task_type, topic_category: (topic_category || '').trim(), chart_type: chart_type || null,
      prompt: prompt.trim(), essay: essay.trim(), word_count,
      band_estimate: parseInt(band_estimate) || 8, model_strengths: strengths
    });
    res.json({ ok: true, item });
  } catch (err) { res.status(500).json({ error: 'Failed to add model essay' }); }
});
app.delete('/api/admin/model-essays/:id', authenticate, teacherOrAdmin, (req, res) => {
  try { db.deleteModelEssay(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete model essay' }); }
});

// ── Collocation Sets ────────────────────────────────────────────────────────
app.get('/api/collocation-sets', (req, res) => {
  try { res.json(db.getCollocationSets(req.query.topic || null, req.query.level || null)); }
  catch (err) { res.status(500).json({ error: 'Failed to load collocations' }); }
});
app.get('/api/admin/collocation-sets', authenticate, teacherOrAdmin, (req, res) => {
  try { res.json(db.getCollocationSets(null, null)); }
  catch (err) { res.status(500).json({ error: 'Failed to load collocations' }); }
});
app.post('/api/admin/collocation-sets', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { topic, level } = req.body;
    let { collocations } = req.body;
    if (typeof collocations === 'string') {
      try { collocations = JSON.parse(collocations); } catch { return res.status(400).json({ error: 'Collocations must be a valid JSON array' }); }
    }
    if (!topic || !topic.trim() || !level || !Array.isArray(collocations) || !collocations.length) {
      return res.status(400).json({ error: 'Topic, level and a non-empty collocations array are required' });
    }
    const item = db.addCollocationSet({ topic: topic.trim(), level, collocations });
    res.json({ ok: true, item });
  } catch (err) { res.status(500).json({ error: 'Failed to add collocation set' }); }
});
app.delete('/api/admin/collocation-sets/:id', authenticate, teacherOrAdmin, (req, res) => {
  try { db.deleteCollocationSet(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete collocation set' }); }
});

// ── Speaking Model Answers ──────────────────────────────────────────────────
app.get('/api/speaking-model-answers', (req, res) => {
  try { res.json(db.getSpeakingModelAnswers(req.query.part || null, req.query.category || null)); }
  catch (err) { res.status(500).json({ error: 'Failed to load speaking answers' }); }
});
app.get('/api/admin/speaking-model-answers', authenticate, teacherOrAdmin, (req, res) => {
  try { res.json(db.getSpeakingModelAnswers(null, null)); }
  catch (err) { res.status(500).json({ error: 'Failed to load speaking answers' }); }
});
app.post('/api/admin/speaking-model-answers', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { part, category, question, model_answer, band_estimate, key_phrases } = req.body;
    if (!part || !['1', '2', '3', 1, 2, 3].includes(part)) return res.status(400).json({ error: 'part must be 1, 2 or 3' });
    if (!question || !question.trim() || !model_answer || !model_answer.trim()) return res.status(400).json({ error: 'Question and model answer are required' });
    const phrases = Array.isArray(key_phrases)
      ? key_phrases
      : (typeof key_phrases === 'string' ? key_phrases.split(',').map(s => s.trim()).filter(Boolean) : []);
    const item = db.addSpeakingModelAnswer({
      part: parseInt(part), category: (category || 'General').trim(),
      question: question.trim(), model_answer: model_answer.trim(),
      band_estimate: parseInt(band_estimate) || 8, key_phrases: phrases
    });
    res.json({ ok: true, item });
  } catch (err) { res.status(500).json({ error: 'Failed to add speaking answer' }); }
});
app.delete('/api/admin/speaking-model-answers/:id', authenticate, teacherOrAdmin, (req, res) => {
  try { db.deleteSpeakingModelAnswer(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete speaking answer' }); }
});

// ─── Translation Sentences ────────────────────────────────────────────────────
app.get('/api/admin/translation-sentences', authenticate, teacherOrAdmin, (req, res) => {
  try { res.json(db.getTranslationSentences()); }
  catch (err) { res.status(500).json({ error: 'Failed to load translation sentences' }); }
});

app.post('/api/admin/translation-sentences', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { vi, en, hints } = req.body;
    if (!vi || !vi.trim()) return res.status(400).json({ error: 'Vietnamese sentence required' });
    if (!en || !en.trim()) return res.status(400).json({ error: 'English translation required' });
    const hintsArr = Array.isArray(hints) ? hints : (hints || '').split(',').map(s => s.trim()).filter(Boolean);
    const item = db.addTranslationSentence({ vi: vi.trim(), en: en.trim(), hints: hintsArr });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add translation sentence' });
  }
});

app.delete('/api/admin/translation-sentences/:id', authenticate, teacherOrAdmin, (req, res) => {
  try { db.deleteTranslationSentence(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete translation sentence' }); }
});

// Public endpoint for app (no admin required)
app.get('/api/translation-sentences', authenticate, (req, res) => {
  try { res.json(db.getTranslationSentences()); }
  catch (err) { res.status(500).json({ error: 'Failed to load translation sentences' }); }
});

// ─── Grammar Exercises ────────────────────────────────────────────────────────
app.get('/api/admin/grammar-exercises', authenticate, teacherOrAdmin, (req, res) => {
  try { res.json(db.getGrammarExercises()); }
  catch (err) { res.status(500).json({ error: 'Failed to load grammar exercises' }); }
});

app.post('/api/admin/grammar-exercises', authenticate, teacherOrAdmin, (req, res) => {
  try {
    const { topic, question, options, answer, explanation } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: 'Question required' });
    if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'At least 2 options required' });
    const ansIdx = parseInt(answer);
    if (isNaN(ansIdx) || ansIdx < 0 || ansIdx >= options.length) return res.status(400).json({ error: 'Valid answer index required' });
    const item = db.addGrammarExercise({
      topic: (topic || 'General').trim(),
      type: 'mcq',
      question: question.trim(),
      options: options.map(o => o.trim()),
      answer: ansIdx,
      explanation: (explanation || '').trim(),
    });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add grammar exercise' });
  }
});

app.delete('/api/admin/grammar-exercises/:id', authenticate, teacherOrAdmin, (req, res) => {
  try { db.deleteGrammarExercise(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete grammar exercise' }); }
});

// Public endpoint for app
app.get('/api/grammar-exercises', authenticate, (req, res) => {
  try { res.json(db.getGrammarExercises()); }
  catch (err) { res.status(500).json({ error: 'Failed to load grammar exercises' }); }
});

// ─── Essay Drafts ─────────────────────────────────────────────────────────────
app.get('/api/drafts', authenticate, (req, res) => {
  try {
    const drafts = db.getDrafts(req.user.id);
    res.json(drafts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load drafts' });
  }
});

app.post('/api/drafts', authenticate, (req, res) => {
  try {
    const { title, prompt, essay, taskType, wordCount } = req.body;
    const draft = db.createDraft(req.user.id, { title, prompt, essay, taskType, wordCount });
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

app.put('/api/drafts/:id', authenticate, (req, res) => {
  try {
    const { title, prompt, essay, taskType, wordCount } = req.body;
    const draft = db.updateDraft(req.params.id, req.user.id, { title, prompt, essay, taskType, wordCount });
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

app.delete('/api/drafts/:id', authenticate, (req, res) => {
  try {
    const ok = db.deleteDraft(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Draft not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

// ─── Practice: Paragraph Feedback ────────────────────────────────────────────
app.post('/api/practice/paragraph-feedback', authenticate, async (req, res) => {
  try {
    const { paragraph, topic, starter } = req.body;
    if (!paragraph || paragraph.trim().length < 20) {
      return res.status(400).json({ error: 'Paragraph too short.' });
    }
    const prompt = `You are an IELTS writing coach. A student wrote this paragraph on the topic: "${topic || 'general'}".
${starter ? `The paragraph starter was: "${starter}"\n` : ''}
Student's paragraph:
"""
${paragraph.trim().slice(0, 800)}
"""

Give brief, specific, encouraging feedback. Return ONLY this JSON:
{
  "vocabulary": "1-2 sentences on word choice — highlight 1 strong word they used or suggest a better word for a weak one",
  "sentences": "1 sentence on sentence variety and structure",
  "coherence": "1 sentence on how logically the ideas flow",
  "tip": "1 actionable tip to improve this paragraph for IELTS Band 6+"
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    db.logUsage('practice-paragraph', calculateCost(inputTokens, outputTokens), inputTokens + outputTokens);

    let raw = response.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('Paragraph feedback error:', err);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

// ─── Game: Para Lab (Pixel RPG Paragraph Battle) ─────────────────────────────
app.post('/api/game/para-lab', async (req, res) => {
  try {
    const { stage, sentence, question, thesis, previousSentences = [], currentBand = 5, targetBand = 6.5 } = req.body;
    if (!sentence || sentence.trim().length < 5) {
      return res.status(400).json({ error: 'Sentence too short.' });
    }

    const stageDescriptions = {
      topic_sentence: "TOPIC SENTENCE (Point) — a clear claim that answers the question and states the paragraph's main idea",
      evidence:       'EVIDENCE sentence — a specific example, statistic, or real-world case that supports the topic sentence (must be new information, not a restatement)',
      analysis:       'ANALYSIS sentence — explains WHY the evidence proves the topic sentence; must add new reasoning, not restate the evidence',
      link:           'LINKING sentence — connects back to the essay question and thesis without simply repeating them',
    };

    const stageGuide = stageDescriptions[stage] || 'body paragraph sentence';
    const prevContext = previousSentences.length
      ? `Previously accepted sentences:\n${previousSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`
      : '';

    const bandGap = targetBand - currentBand;
    const strictnessNote = bandGap >= 2
      ? `The student is targeting Band ${targetBand} from Band ${currentBand} — apply strict Band ${targetBand} standards. Penalise vague language, weak analysis, and simple vocabulary heavily.`
      : bandGap >= 1
      ? `The student is targeting Band ${targetBand} from Band ${currentBand} — apply Band ${targetBand} standards with constructive encouragement.`
      : `The student is targeting Band ${targetBand} from Band ${currentBand} — be supportive and focus on one key improvement.`;

    const prompt = `You are an IELTS Band 9 examiner evaluating a single sentence from a student's body paragraph.

Essay question: "${question}"
Thesis/position: "${thesis}"
${prevContext}The student is now writing their ${stageGuide}.
Student's sentence: "${sentence.trim()}"

${strictnessNote}

Evaluate strictly for role and quality. Check:
1. Does it correctly fulfil the role of a ${stage.replace(/_/g, ' ')}?
2. Is it tautological — does it restate what was already said without adding new meaning?
3. What is the PRIMARY flaw (if any)? Choose exactly one: tautology | vague | baby_words | circular | none
   - tautology: repeats evidence or prior sentence content as if it were new reasoning
   - vague: too general, missing specific details or concrete reasoning
   - baby_words: uses simple/weak vocabulary (good, bad, big, nice, very, a lot, etc.)
   - circular: the link/conclusion restates the topic sentence verbatim
   - none: sentence is acceptable quality for the target band

Return ONLY valid JSON, no markdown:
{
  "score": <integer 1-5>,
  "flaw": "tautology" | "vague" | "baby_words" | "circular" | "none",
  "tautological": <boolean>,
  "roleMatch": <boolean>,
  "feedback": "<1 sentence: what this sentence does well or its main problem>",
  "suggestion": "<1 concrete rewrite tip or example phrase>"
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }],
    });

    const inputTokens  = response.usage?.input_tokens  || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    db.logUsage('game-para-lab', calculateCost(inputTokens, outputTokens), inputTokens + outputTokens);

    let raw = response.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('Para Lab error:', err);
    res.status(500).json({ error: 'Failed to grade sentence.' });
  }
});

// ─── Speaking practice: AI score a spoken answer (from its transcript) ──────────
app.post('/api/speaking/score', authenticate, async (req, res) => {
  try {
    const { part, question, transcript, durationSec } = req.body;
    if (!transcript || !transcript.trim()) return res.status(400).json({ error: 'Transcript is empty.' });
    if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI service unavailable' });
    const partNum = parseInt(part) || 1;
    const dur = Math.round(Number(durationSec) || 0);
    const expected = partNum === 2 ? 'about 90–120 seconds of continuous speech' : 'about 20–50 seconds per answer';
    const prompt = `You are an experienced IELTS Speaking examiner. A student answered an IELTS Speaking Part ${partNum} question. You are given the QUESTION and an automatic TRANSCRIPT of what they said (speech-to-text — ignore minor transcription typos and missing punctuation). They spoke for roughly ${dur} seconds (expected: ${expected}).

QUESTION: ${question || '(not provided)'}
TRANSCRIPT: ${transcript.trim()}

Assess on the four IELTS Speaking criteria (0-9, half-bands allowed): Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.
IMPORTANT: pronunciation CANNOT be reliably judged from a text transcript — give a cautious, tentative estimate from coherence and language control, and keep it moderate. Use the spoken duration to inform fluency (a very short answer = limited fluency).

Reply with ONLY a JSON object — no markdown, no extra text — in exactly this shape:
{"band": <overall 0-9, half-steps>, "fluency": <0-9>, "lexical": <0-9>, "grammar": <0-9>, "pronunciation": <0-9>, "strengths": ["<vi>","<vi>"], "improvements": ["<vi>","<vi>"], "better_phrases": ["<English phrase> — <nghĩa tiếng Việt>","..."], "comment": "<2-3 câu nhận xét tiếng Việt>"}
All of strengths, improvements and comment must be in Vietnamese; better_phrases give 2-3 natural English upgrades each with a short Vietnamese gloss. Be encouraging but honest.`;
    const response = await client.messages.create({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    db.logUsage('speaking-score', calculateCost(inputTokens, outputTokens), inputTokens + outputTokens);
    let raw = (response.content?.[0]?.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let data;
    try { data = JSON.parse(raw); } catch { return res.status(500).json({ error: 'Không đọc được kết quả chấm. Vui lòng thử lại.' }); }
    res.json(data);
  } catch (err) {
    console.error('Speaking score error:', err);
    res.status(500).json({ error: 'Failed to score speaking answer.' });
  }
});

// ─── Serve SPA ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: 'https://tintinlab.com', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ room }) => {
    if (currentRoom) socket.leave(currentRoom);
    currentRoom = room;
    socket.join(room);
    const size = io.sockets.adapter.rooms.get(room)?.size || 1;
    io.to(room).emit('peer-count', { count: size });
  });

  socket.on('canvas-update', ({ room, objects, tabId }) => {
    socket.to(room).emit('canvas-update', { objects, tabId });
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      setTimeout(() => {
        const size = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
        io.to(currentRoom).emit('peer-count', { count: size });
      }, 100);
    }
  });
});

// ── AI: Grade Writing Essay ────────────────────────────────────────────────
app.post('/api/ai/grade-writing', authenticate, async (req, res) => {
  const { prompt, essay, type } = req.body;
  if (!prompt || !essay) return res.status(400).json({ error: 'Missing prompt or essay' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI service unavailable' });

  const taskLabel = type === 'task1' ? 'Task 1 (Report)' : 'Task 2 (Essay)';
  const system = `You are an expert IELTS examiner. Grade the student's IELTS Writing ${taskLabel} submission.
Provide feedback in Vietnamese, covering:
1. **Band score estimate** (overall and brief note on TA/CC/LR/GRA)
2. **Điểm mạnh** — 2-3 things done well
3. **Điểm cần cải thiện** — 2-3 specific issues with examples from their essay
4. **Gợi ý từ vựng / cấu trúc** — suggest 2-3 better phrases or sentence structures

Be encouraging but honest. Keep total response under 350 words.`;

  const userMsg = `IELTS Writing ${taskLabel} Prompt:\n${prompt}\n\nStudent Essay:\n${essay}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    const feedback = response.content?.[0]?.text || '';
    res.json({ feedback });
  } catch (e) {
    console.error('grade-writing AI error:', e.message);
    res.status(500).json({ error: 'AI error', detail: e.message });
  }
});

// Rewrite the student's OWN essay up to a Band 8+ standard (model improvement)
app.post('/api/ai/improve-writing', authenticate, async (req, res) => {
  const { prompt, essay, type } = req.body;
  if (!prompt || !essay) return res.status(400).json({ error: 'Missing prompt or essay' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI service unavailable' });

  const taskLabel = type === 'task1' ? 'Task 1 (Report)' : 'Task 2 (Essay)';
  const system = `You are an expert IELTS writing tutor. Rewrite the student's IELTS Writing ${taskLabel} so it would score around Band 8.0–8.5.
RULES:
- Keep the student's own ideas, opinion and overall structure — upgrade their writing, do not replace the content with a different argument.
- Improve lexical resource (precise words, natural collocations), grammatical range & accuracy, cohesion, and task response.
- Keep a realistic length (Task 1 ~170–190 words; Task 2 ~270–300 words). Do not pad.
- Output ONLY the improved essay in English: clean paragraphs, no preamble, no commentary, no markdown headings.`;
  const userMsg = `IELTS Writing ${taskLabel} Prompt:\n${prompt}\n\nStudent Essay:\n${essay}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    db.logUsage('improve-writing', calculateCost(inputTokens, outputTokens), inputTokens + outputTokens);
    const improved = response.content?.[0]?.text?.trim() || '';
    res.json({ improved });
  } catch (e) {
    console.error('improve-writing AI error:', e.message);
    res.status(500).json({ error: 'AI error', detail: e.message });
  }
});

app.post('/api/ai/grade-paragraph', authenticate, async (req, res) => {
  const { vi, modelEn, userEn, topic } = req.body;
  if (!vi || !userEn) return res.status(400).json({ error: 'Missing fields' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI service unavailable' });

  const system = `Bạn là giáo viên IELTS. Hãy nhận xét bản dịch tiếng Anh của học viên (dịch từ tiếng Việt sang tiếng Anh).
Nhận xét bằng tiếng Việt, ngắn gọn (dưới 200 từ), bao gồm:
1. **Điểm mạnh** — 1-2 điểm tốt trong bản dịch
2. **Điểm cần sửa** — 1-2 lỗi cụ thể (sai từ vựng, ngữ pháp, hay biểu đạt không tự nhiên) với gợi ý sửa
3. **Từ vựng học thuật** — gợi ý 1-2 từ/cụm từ học thuật tốt hơn nếu có
Giọng điệu khích lệ nhưng thẳng thắn.`;

  const userMsg = `Chủ đề: ${topic || 'IELTS'}
Đoạn gốc (tiếng Việt): ${vi}
Bản dịch mẫu: ${modelEn}
Bản dịch của học viên: ${userEn}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    const feedback = response.content?.[0]?.text || '';
    res.json({ feedback });
  } catch (e) {
    console.error('grade-paragraph AI error:', e.message);
    res.status(500).json({ error: 'AI error', detail: e.message });
  }
});

httpServer.listen(PORT, () => {
  console.log(`IELTS LMS running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set. AI features will fail.');
  }
});
