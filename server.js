require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ielts-lms-secret-key-change-in-production';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
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
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  return adminEmail && email.toLowerCase() === adminEmail ? 'admin' : 'student';
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
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

app.post('/api/login', async (req, res) => {
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
  const role = adminRole(user.email);
  const expiry = remember_me ? '30d' : '7d';
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role }, JWT_SECRET, { expiresIn: expiry });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
});

app.post('/api/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    const user = db.getUserByEmail(email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.verification_code !== code) return res.status(400).json({ error: 'Invalid code' });
    if (new Date(user.verification_expires) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
    db.verifyUser(user.id);
    const role = adminRole(user.email);
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role } });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/resend-verification', async (req, res) => {
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
  const startingBalance = parseFloat(process.env.STARTING_BALANCE || '4.98');
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
    const { task_type, prompt, essay } = req.body;
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

    const result = db.insertSubmission(req.user.id, task_type, prompt, essay, wordCount);
    const submissionId = result.lastInsertRowid;

    // Start grading asynchronously
    gradeSubmission(submissionId, req.user.id, task_type, prompt, essay, wordCount, minWords).catch(console.error);

    res.json({ id: submissionId, status: 'grading', word_count: wordCount });
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
async function gradeSubmission(submissionId, userId, taskType, prompt, essay, wordCount, minWords) {
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
      "strengths": ["<specific strength from essay>", "<specific strength>"],
      "improvements": ["<specific actionable improvement>", "<specific improvement>"]
    },
    "coherence_cohesion": { "band": <n>, "descriptor": "...", "strengths": [...], "improvements": [...] },
    "lexical_resource": { "band": <n>, "descriptor": "...", "strengths": [...], "improvements": [...] },
    "grammatical_range": { "band": <n>, "descriptor": "...", "strengths": [...], "improvements": [...] }
  },
  "detailed_feedback": "<200-300 word comprehensive analysis>",
  "sentence_analysis": [
    {"i": 1, "t": "simple"},
    {"i": 2, "t": "complex"}
  ],
  "overall_improvements": {
    "content": "<specific actionable advice tied to this essay>",
    "organization": "<specific advice>",
    "vocabulary": "<specific advice>",
    "grammar": "<specific advice>",
    "sentence_variety": "<specific advice>",
    "coherence": "<specific advice>"
  },
  "strengths": ["<s1>", "<s2>", "<s3>"],
  "improvements": ["<i1>", "<i2>", "<i3>"]
}

For sentence_analysis: include one entry per sentence in order. Types are: simple, compound, complex, compound-complex, uncertain.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
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

// ─── Task Generation ──────────────────────────────────────────────────────────
app.post('/api/generate-task', authenticate, async (req, res) => {
  const { task_type, topic } = req.body;
  if (!['task1', 'task2'].includes(task_type)) {
    return res.status(400).json({ error: 'task_type must be task1 or task2' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let userPrompt;
  if (task_type === 'task1') {
    const chartClause = (topic && topic !== 'random')
      ? `The visual must be a ${topic}.`
      : `Choose one visual type: bar chart, line graph, pie chart, table, process diagram, or map.`;
    userPrompt = `Write one realistic IELTS Academic Writing Task 1 question. ${chartClause} Include specific approximate data values so the student can write about trends and comparisons. Begin directly with "The chart/graph/table/diagram below shows..." and end with "Summarise the information by selecting and reporting the main features, and make comparisons where relevant." The task should be 60–100 words.`;
  } else {
    const topicClause = (topic && topic !== 'random')
      ? `The essay must be specifically about: ${topic}.`
      : `Choose a topic from: technology, environment, education, health, society, work and career, or crime and law.`;
    userPrompt = `Write one original IELTS Writing Task 2 question. ${topicClause} It must present a statement or issue and ask the student to discuss, argue, or give an opinion. End with "Give reasons for your answer and include any relevant examples from your own knowledge or experience." The task should be 50–80 words.`;
  }

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 300,
      system: 'You are an expert IELTS task writer. Output only the task text with no preamble, labels, or commentary.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    stream.on('text', (text) => res.write(`data: ${JSON.stringify(text)}\n\n`));
    const finalMsg = await stream.finalMessage();

    // Track usage
    const inputTokens = finalMsg.usage ? finalMsg.usage.input_tokens : 0;
    const outputTokens = finalMsg.usage ? finalMsg.usage.output_tokens : 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('generate-task', cost, inputTokens + outputTokens);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Task generation error:', err);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ─── Hints ────────────────────────────────────────────────────────────────────
app.post('/api/hint', authenticate, async (req, res) => {
  const { task_type, prompt, essay, hint_type } = req.body;
  if (!['task1', 'task2'].includes(task_type)) {
    return res.status(400).json({ error: 'Invalid task_type' });
  }
  if (!['ideas', 'vocabulary'].includes(hint_type)) {
    return res.status(400).json({ error: 'hint_type must be ideas or vocabulary' });
  }
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const taskLabel = task_type === 'task1' ? 'Task 1' : 'Task 2';
  const draftSection = essay && essay.trim()
    ? `\n\nStudent's current draft:\n${essay.trim()}`
    : '\n\n(Student has not written anything yet.)';

  const userPrompt = hint_type === 'ideas'
    ? `IELTS Writing ${taskLabel} prompt:\n${prompt}${draftSection}\n\nSuggest 4–5 specific ideas, arguments, or examples the student could use or develop in their response. For Task 1, focus on what data trends or comparisons to highlight. For Task 2, focus on arguments, counterarguments, or real-world examples. Keep each point to 1–2 sentences. Number each point.`
    : `IELTS Writing ${taskLabel} topic:\n${prompt}\n\nList 12–15 precise vocabulary items and collocations that would demonstrate strong Lexical Resource for this topic. Format each item as:\n**word or phrase** — example sentence showing natural, academic use.\n\nInclude a mix of: topic-specific terms, academic collocations, linking expressions, and precise verbs/adjectives.`;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 800,
      system: 'You are an expert IELTS writing coach. Be practical, specific, and concise. Do not repeat the prompt back.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    stream.on('text', (text) => res.write(`data: ${JSON.stringify(text)}\n\n`));
    const finalMsg = await stream.finalMessage();

    // Track usage
    const inputTokens = finalMsg.usage ? finalMsg.usage.input_tokens : 0;
    const outputTokens = finalMsg.usage ? finalMsg.usage.output_tokens : 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage(`hint-${hint_type}`, cost, inputTokens + outputTokens);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Hint error:', err);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ─── Chart Data Generation ────────────────────────────────────────────────────
app.post('/api/generate-chart', authenticate, async (req, res) => {
  const { task_text } = req.body;
  if (!task_text) return res.status(400).json({ error: 'task_text is required' });

  const systemPrompt = `You are a data extraction assistant for IELTS Task 1 charts. Extract chart data from a task description and return ONLY valid JSON — no markdown, no code blocks, no commentary.`;

  const userPrompt = `Read this IELTS Writing Task 1 question and extract the chart/table data described in it.

Task: ${task_text}

Return ONLY a JSON object using one of these schemas:

For a BAR or LINE chart:
{"type":"bar","title":"...","xlabel":"...","ylabel":"...","labels":["A","B","C"],"datasets":[{"label":"Series name","data":[10,20,30]},{"label":"Series 2","data":[5,15,25]}]}

For a PIE chart:
{"type":"pie","title":"...","labels":["A","B","C"],"datasets":[{"data":[30,45,25]}]}

For a TABLE:
{"type":"table","title":"...","headers":["Column1","Column2","Column3"],"rows":[["val","val","val"],["val","val","val"]]}

Rules:
- Use "line" as the type for line graphs
- All numeric data must be actual numbers, not strings
- Include 1–3 datasets for bar/line charts if the task mentions multiple categories or time periods
- Keep labels concise (max 4 words each)
- If the task mentions a map or process diagram, return: {"type":"unsupported","message":"No chart preview for this type"}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const inputTokens = response.usage ? response.usage.input_tokens : 0;
    const outputTokens = response.usage ? response.usage.output_tokens : 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('generate-chart', cost, inputTokens + outputTokens);

    let raw = response.content[0].text.trim();
    // Strip markdown code fences if AI ignored instructions
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    const chartData = JSON.parse(raw);
    res.json(chartData);
  } catch (err) {
    console.error('Chart generation error:', err);
    res.status(500).json({ error: 'Chart generation failed', details: err.message });
  }
});

// ─── Essay Rewrite ────────────────────────────────────────────────────────────
app.post('/api/rewrite', authenticate, async (req, res) => {
  const { submission_id } = req.body;
  if (!submission_id) return res.status(400).json({ error: 'submission_id is required' });

  const submission = db.getSubmissionById(parseInt(submission_id), req.user.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (submission.status !== 'graded') {
    return res.status(400).json({ error: 'Essay must be graded before rewriting' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const taskLabel = submission.task_type === 'task1' ? 'Task 1' : 'Task 2';
  const userPrompt = `You are an expert IELTS examiner and writing coach. The student's ${taskLabel} essay scored Band ${submission.overall_band}.

Rewrite it targeting Band 8.0–8.5. Keep the same core argument and structure but improve:
- Task achievement/response (fully address all parts of the task)
- Coherence and cohesion (strong topic sentences, better paragraph flow, varied linking devices)
- Lexical resource (higher-level vocabulary, precise collocations, avoid repetition)
- Grammatical range and accuracy (complex sentence structures, eliminate errors)

After the rewritten essay, add a section with this exact heading on its own line:
## What Changed

Then list 5–6 bullet points (starting with -) explaining the key improvements made.

Original prompt: ${submission.prompt}

Original essay (Band ${submission.overall_band}):
${submission.essay}`;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1500,
      system: 'You are an expert IELTS writing coach. Rewrite the essay at Band 8.0–8.5 level, then explain what you changed. Output the rewritten essay first, then the "## What Changed" section.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    stream.on('text', (text) => res.write(`data: ${JSON.stringify(text)}\n\n`));
    const finalMsg = await stream.finalMessage();

    const inputTokens = finalMsg.usage ? finalMsg.usage.input_tokens : 0;
    const outputTokens = finalMsg.usage ? finalMsg.usage.output_tokens : 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('rewrite', cost, inputTokens + outputTokens);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Rewrite error:', err);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ─── Password Reset (unauthenticated) ────────────────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
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

app.post('/api/reset-password', async (req, res) => {
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
    const role = adminRole(user.email);
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
app.get('/api/admin/users', authenticate, adminOnly, (req, res) => {
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

// ─── User Profile ─────────────────────────────────────────────────────────────
app.get('/api/user/profile', authenticate, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    target_band: user.target_band ?? null,
    current_streak: user.current_streak || 0,
    longest_streak: user.longest_streak || 0,
    last_activity_date: user.last_activity_date || null
  });
});

app.put('/api/user/profile', authenticate, (req, res) => {
  const { target_band } = req.body;
  if (target_band !== null && target_band !== undefined) {
    const band = parseFloat(target_band);
    if (isNaN(band) || band < 4 || band > 9) {
      return res.status(400).json({ error: 'target_band must be a number between 4.0 and 9.0' });
    }
    db.updateUserProfile(req.user.id, { target_band: band });
  }
  res.json({ success: true });
});

// ─── Topic Rater ───────────────────────────────────────────────────────────────
app.post('/api/rate-topic', authenticate, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const systemPrompt = `You are an expert IELTS Task 1 examiner and test designer. Evaluate the given Task 1 prompt and return ONLY valid JSON with no markdown, no code fences, no extra text.`;

  const userPrompt = `Rate this IELTS Academic Writing Task 1 prompt across four criteria.

Prompt:
"""
${prompt.trim()}
"""

Return ONLY this JSON structure:
{
  "authenticity": { "score": <0-10>, "comment": "<is it a realistic, exam-style question?>" },
  "difficulty": { "band": "<e.g. 5.5-6.5>", "comment": "<what band level does this target?>" },
  "visual_type": "<bar chart | line graph | pie chart | table | process diagram | map | mixed | unclear>",
  "quality": { "score": <0-10>, "comment": "<clarity, completeness, sufficient data for a good response>" },
  "overall": "<2-3 sentence summary judgment>",
  "improvements": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"]
}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const inputTokens = response.usage ? response.usage.input_tokens : 0;
    const outputTokens = response.usage ? response.usage.output_tokens : 0;
    const cost = calculateCost(inputTokens, outputTokens);
    db.logUsage('topic-rater', cost, inputTokens + outputTokens);

    let raw = response.content[0].text.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(raw);
    res.json(result);
  } catch (err) {
    console.error('Topic rater error:', err);
    res.status(500).json({ error: 'Failed to rate topic. Please try again.' });
  }
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
        const given = (answers[String(q.q_number)] || '').trim().toLowerCase();
        const correct = (q.correct_answer || '').trim().toLowerCase();
        const alts = (q.accept_alternatives || []).map(a => a.trim().toLowerCase());
        const isCorrect = given === correct || alts.includes(given);
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

app.post('/api/admin/tests', authenticate, adminOnly, (req, res) => {
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

app.get('/api/admin/tests', authenticate, adminOnly, (req, res) => {
  try {
    res.json(db.getAllTests(req.query.type));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load tests' });
  }
});

app.get('/api/admin/tests/:id', authenticate, adminOnly, (req, res) => {
  try {
    const test = db.getTestById(parseInt(req.params.id, 10));
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load test' });
  }
});

app.delete('/api/admin/tests/:id', authenticate, adminOnly, (req, res) => {
  try {
    const ok = db.deleteTest(parseInt(req.params.id, 10));
    if (!ok) return res.status(404).json({ error: 'Test not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete test' });
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

// ─── Serve SPA ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`IELTS LMS running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set. AI features will fail.');
  }
});
