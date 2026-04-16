require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');
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
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000,
});

// Wrap any email send so it never hangs the server response
async function sendEmailSafe(sendFn) {
  try {
    await Promise.race([
      sendFn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000))
    ]);
    return true;
  } catch (err) {
    console.error('Email send failed (non-fatal):', err.message);
    return false;
  }
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, name, code) {
  await transporter.sendMail({
    from: `"IELTS Writing LMS" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your IELTS LMS verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#4f46e5;margin-bottom:8px">IELTS Writing LMS</h2>
        <p style="color:#374151">Hi <strong>${name}</strong>, thanks for registering!</p>
        <p style="color:#374151">Your email verification code is:</p>
        <div style="font-size:2.8rem;font-weight:700;letter-spacing:0.35em;color:#4f46e5;text-align:center;padding:28px 0;background:#f5f3ff;border-radius:12px;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:14px">This code expires in <strong>30 minutes</strong>. If you didn't register, you can safely ignore this email.</p>
      </div>
    `
  });
}

async function sendPasswordResetEmail(email, name, code) {
  await transporter.sendMail({
    from: `"IELTS Writing LMS" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Reset your IELTS LMS password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#4f46e5;margin-bottom:8px">IELTS Writing LMS</h2>
        <p style="color:#374151">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151">We received a request to reset your password. Your reset code is:</p>
        <div style="font-size:2.8rem;font-weight:700;letter-spacing:0.35em;color:#4f46e5;text-align:center;padding:28px 0;background:#f5f3ff;border-radius:12px;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:14px">This code expires in <strong>30 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `
  });
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
    if (process.env.GMAIL_USER) {
      const code = generateCode();
      db.setVerificationCode(userId, code, new Date(Date.now() + 30 * 60 * 1000).toISOString());
      await sendEmailSafe(() => sendVerificationEmail(email.toLowerCase(), name, code));
      return res.json({ needsVerification: true, email: email.toLowerCase() });
    }
    const token = jwt.sign({ id: userId, name, email: email.toLowerCase(), role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, name, email: email.toLowerCase(), role } });
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
  if (process.env.GMAIL_USER && !user.verified) {
    const code = generateCode();
    db.setVerificationCode(user.id, code, new Date(Date.now() + 30 * 60 * 1000).toISOString());
    await sendEmailSafe(() => sendVerificationEmail(user.email, user.name, code));
    return res.json({ needsVerification: true, email: user.email });
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
    gradeSubmission(submissionId, task_type, prompt, essay, wordCount, minWords).catch(console.error);

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
async function gradeSubmission(submissionId, taskType, prompt, essay, wordCount, minWords) {
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
    if (process.env.GMAIL_USER) {
      await sendEmailSafe(() => sendPasswordResetEmail(user.email, user.name, code));
    }
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
