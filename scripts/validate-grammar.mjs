// Checks every generated exercise against the rules in the teacher's spec.
// Run: node scripts/validate-grammar.mjs
// Exits non-zero when anything fails, so it can gate a commit.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data', 'grammar');
const EX_DIR = join(DATA, 'exercises');
const PARA_DIR = join(DATA, 'paragraphs');

const TYPES = ['fix_error', 'translate', 'causal_link', 'paragraph'];
const GRAMMAR_FOCUS = [
  'subject_verb_agreement', 'plural_s', 'articles', 'prepositions', 'verb_tense',
  'passive_present', 'complex_sentence', 'compound_sentence', 'compound_complex',
  'relative_clause', 'participle_phrase', 'run_on_comma', 'word_form',
  'countable_uncountable', 'modal_verb',
];
const THEMES = ['education', 'technology', 'environment', 'work', 'society', 'crime',
  'media', 'transport', 'culture', 'government', 'arts'];

// The teacher's Vietnamese house style: address the learner as "ta", and no
// colons, semicolons or em dashes anywhere in the copy.
const BANNED_VI = [
  // Word boundaries have to be letter-based, not whitespace-based: "Theo bạn,"
  // slipped through a \s version of this and reached the data.
  [/(^|[^\p{L}])em(?![\p{L}])/iu, 'dùng "em"'],
  [/(^|[^\p{L}])bạn(?![\p{L}])/iu, 'dùng "bạn"'],
  [/các bạn/iu, 'dùng "các bạn"'],
  [/:/, 'dấu hai chấm'],
  [/;/, 'dấu chấm phẩy'],
  [/—|–/, 'gạch ngang dài'],
];

const errors = [];
const warn = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const words = s => String(s).trim().split(/\s+/).filter(Boolean).length;
// be + optional adverbs + past participle. Two model paragraphs shipped with
// zero passives and one with two, all while their own third constraint asked
// for exactly one, so the check belongs here rather than in a one-off script.
const PRESENT_PASSIVE = /\b(?:is|are)\s+(?:(?:\w+ly|still|not|never|always|rarely|often|already|now|then|just|only|soon|again)\s+)*(?:\w+ed|cut|kept|made|held|built|written|given|taught|driven|paid|left|dealt|spread|shown|sent|put|set|read|lost|won|told|brought|thought|found|felt)\b/i;
// Sentence split that does not break on the full stop inside "e.g." or a number.
const sentences = s => String(s)
  .replace(/\b(e\.g|i\.e|etc|Mr|Mrs|Dr)\./gi, '$1<DOT>')
  .split(/(?<=[.!?])\s+/)
  .map(x => x.replace(/<DOT>/g, '.').trim())
  .filter(Boolean);

if (!existsSync(DATA)) { console.error(`No data directory at ${DATA}`); process.exit(1); }

const topics = JSON.parse(readFileSync(join(DATA, 'topics.json'), 'utf8'));
const topicById = new Map(topics.map(t => [t.id, t]));

/* ── topics.json ─────────────────────────────────────────────────────────── */
const seenTopicIds = new Set();
for (const t of topics) {
  const f = `topics.json/${t.id}`;
  for (const k of ['id', 'prompt_en', 'thesis_en', 'truc', 'theme', 'task_type']) {
    if (t[k] === undefined || t[k] === '') fail(f, `thiếu trường ${k}`);
  }
  if (seenTopicIds.has(t.id)) fail(f, 'id trùng');
  seenTopicIds.add(t.id);
  if (!THEMES.includes(t.theme)) fail(f, `theme "${t.theme}" ngoài danh sách đóng`);
  if (/▲/.test(t.thesis_en)) fail(f, 'thesis_en còn ghi chú ▲');
  if (t.key_vocab) {
    if (t.key_vocab.length < 6 || t.key_vocab.length > 8) fail(f, `key_vocab có ${t.key_vocab.length} cặp, cần 6 tới 8`);
    for (const kv of t.key_vocab) {
      for (const k of ['basic', 'academic', 'vi']) if (!kv[k]) fail(f, `key_vocab thiếu ${k}`);
    }
  }
  if (t.prompt_vi) {
    for (const [re, label] of BANNED_VI) if (re.test(t.prompt_vi)) fail(f, `prompt_vi ${label}`);
  }
}

/* ── exercises ───────────────────────────────────────────────────────────── */
const files = existsSync(EX_DIR) ? readdirSync(EX_DIR).filter(f => f.endsWith('.json')) : [];
const seenIds = new Set();
let total = 0;

for (const file of files) {
  const list = JSON.parse(readFileSync(join(EX_DIR, file), 'utf8'));
  const topicId = file.replace('.json', '');
  const topic = topicById.get(topicId);
  if (!topic) { fail(file, 'không có topic tương ứng trong topics.json'); continue; }
  const vocab = (topic.key_vocab || []).map(v => v.academic.toLowerCase());

  const byType = {};
  for (const ex of list) {
    total++;
    const f = `${file}/${ex.id || '(thiếu id)'}`;
    for (const k of ['id', 'topic_id', 'type', 'order', 'difficulty', 'instruction_vi', 'stimulus', 'model_answer', 'self_check', 'explanation_vi']) {
      if (ex[k] === undefined) fail(f, `thiếu trường ${k}`);
    }
    if (seenIds.has(ex.id)) fail(f, 'id trùng');
    seenIds.add(ex.id);
    if (ex.topic_id !== topicId) fail(f, `topic_id "${ex.topic_id}" không khớp tên file`);
    if (!TYPES.includes(ex.type)) { fail(f, `type "${ex.type}" không hợp lệ`); continue; }
    byType[ex.type] = (byType[ex.type] || 0) + 1;

    for (const g of ex.grammar_focus || []) {
      if (!GRAMMAR_FOCUS.includes(g)) fail(f, `grammar_focus "${g}" ngoài danh sách đóng`);
    }

    // Vietnamese house style
    for (const field of ['instruction_vi', 'explanation_vi']) {
      for (const [re, label] of BANNED_VI) if (re.test(ex[field] || '')) fail(f, `${field} ${label}`);
    }
    for (const line of ex.self_check || []) {
      for (const [re, label] of BANNED_VI) if (re.test(line)) fail(f, `self_check ${label}`);
    }
    if (!ex.self_check || ex.self_check.length < 2 || ex.self_check.length > 4) {
      fail(f, `self_check có ${(ex.self_check || []).length} dòng, cần 2 tới 4`);
    }
    if (sentences(ex.explanation_vi || '').length > 2) fail(f, 'explanation_vi dài quá hai câu');

    // Every English sentence stays under 25 words.
    const english = [ex.model_answer, ...(ex.accepted_variants || [])];
    if (ex.type === 'fix_error') english.push(ex.stimulus?.sentence);
    if (ex.type === 'causal_link') english.push(ex.stimulus?.cause, ex.stimulus?.result);
    for (const s of english.filter(Boolean)) {
      if (ex.type === 'paragraph') continue;   // a paragraph is checked sentence by sentence below
      if (words(s) > 25) fail(f, `câu tiếng Anh ${words(s)} từ, quá 25`);
    }

    // At least one key_vocab phrase somewhere in the exercise.
    if (vocab.length) {
      const blob = JSON.stringify(ex).toLowerCase();
      if (!vocab.some(v => blob.includes(v))) fail(f, 'không dùng cụm nào trong key_vocab của đề');
    }

    if (ex.type === 'fix_error') {
      if (!ex.stimulus?.sentence) fail(f, 'fix_error thiếu stimulus.sentence');
      if (!ex.stimulus?.error_type) fail(f, 'fix_error thiếu stimulus.error_type');
      if (ex.model_answer === ex.stimulus?.sentence) fail(f, 'model_answer trùng y hệt câu sai');
    }
    if (ex.type === 'translate') {
      if (!ex.stimulus?.vi) fail(f, 'translate thiếu stimulus.vi');
      if (!ex.stimulus?.requirement_vi) fail(f, 'translate thiếu requirement_vi');
      if (!ex.accepted_variants || ex.accepted_variants.length < 1) fail(f, 'translate thiếu accepted_variants');
      if (ex.accepted_variants && ex.accepted_variants.length > 3) fail(f, 'accepted_variants quá 3');
    }
    if (ex.type === 'causal_link') {
      if (!ex.stimulus?.cause || !ex.stimulus?.result) fail(f, 'causal_link thiếu cause hoặc result');
      if (ex.model_answer === ex.stimulus?.cause) fail(f, 'model_answer chỉ là cách nói khác của cause');
    }
    if (ex.type === 'paragraph') {
      const sents = sentences(ex.model_answer || '');
      if (sents.length !== 6) fail(f, `đoạn mẫu có ${sents.length} câu, cần đúng 6`);
      const long = sents.filter(s => words(s) > 15);
      if (long.length !== 1) fail(f, `đoạn mẫu có ${long.length} câu trên 15 từ, cần đúng 1`);
      const frame = ex.stimulus?.frame || [];
      if (frame.length !== 6) fail(f, `frame có ${frame.length} bước, cần 6`);
      const req = ex.stimulus?.required_phrases || [];
      if (req.length < 4) fail(f, `required_phrases có ${req.length}, cần ít nhất 4`);
      const used = req.filter(p => (ex.model_answer || '').toLowerCase().includes(p.toLowerCase()));
      if (used.length < 4) fail(f, `đoạn mẫu chỉ dùng ${used.length} cụm bắt buộc, cần ít nhất 4`);
      if ((ex.stimulus?.constraints || []).length !== 4) fail(f, 'constraints phải có đúng 4 dòng');
      const passives = sents.filter(x => PRESENT_PASSIVE.test(x)).length;
      if (passives !== 1) fail(f, `đoạn mẫu có ${passives} câu bị động hiện tại, constraint đòi đúng 1`);
    }
  }

  // Shape of the set, per the spec: 3 fix_error, 2 causal_link, 3 translate, 1 paragraph.
  const want = { fix_error: 3, causal_link: 2, translate: 3, paragraph: 1 };
  for (const [t, n] of Object.entries(want)) {
    if ((byType[t] || 0) !== n) fail(file, `có ${byType[t] || 0} bài ${t}, cần ${n}`);
  }
  const orders = list.map(e => e.order).sort((a, b) => a - b);
  if (orders.join(',') !== [1, 2, 3, 4, 5, 6, 7, 8, 9].join(',')) fail(file, `order không phải 1 tới 9 (${orders.join(',')})`);
}

/* ── paragraph sets ──────────────────────────────────────────────────────── */
// One file per prompt for the paragraph rung. The eight steps of the v5 chain,
// each with the question to ask, a model sentence and the trap for that step.
const CHAIN_ORDER = ['F', 'A', 'B', 'C', 'D', 'D+', 'N', 'E'];
// Section 9.4: banned as the subject of B, C, D and D+. A and E are exempt.
const ABSTRACT_SUBJECTS = [
  'quality', 'standard', 'level', 'situation', 'condition', 'development',
  'aspect', 'factor', 'impact', 'effect', 'influence', 'benefit', 'problem',
  'issue', 'society', 'people', 'technology',
];
// Section 4.6: these four turn the D+ step into a long noun phrase.
const BANNED_DPLUS = ['shows up as', 'surfaces as', 'lands as', 'the effect is'];

const paraFiles = existsSync(PARA_DIR) ? readdirSync(PARA_DIR).filter(f => f.endsWith('.json')) : [];
let paraTotal = 0;

for (const file of paraFiles) {
  const set = JSON.parse(readFileSync(join(PARA_DIR, file), 'utf8'));
  const topicId = file.replace('.json', '');
  const topic = topicById.get(topicId);
  const f = 'paragraphs/' + file;
  if (!topic) { fail(f, 'không có topic tương ứng trong topics.json'); continue; }
  paraTotal++;

  for (const k of ['topic_id', 'engine', 'side_vi', 'steps', 'model_paragraph']) {
    if (set[k] === undefined || set[k] === '') fail(f, `thiếu trường ${k}`);
  }
  if (set.topic_id !== topicId) fail(f, `topic_id "${set.topic_id}" không khớp tên file`);

  const keys = (set.steps || []).map(x => x.k);
  if (keys.join(',') !== CHAIN_ORDER.join(',')) fail(f, `các bước là ${keys.join(',')}, cần ${CHAIN_ORDER.join(',')}`);

  for (const st of set.steps || []) {
    const g = `${f}/${st.k}`;
    for (const k of ['ask_vi', 'model', 'trap_vi']) {
      if (!st[k]) fail(g, `thiếu ${k}`);
    }
    for (const field of ['ask_vi', 'why_vi', 'trap_vi']) {
      for (const [re, label] of BANNED_VI) if (re.test(st[field] || '')) fail(g, `${field} ${label}`);
    }
    if (st.model && words(st.model) > 25) fail(g, `câu mẫu ${words(st.model)} từ, quá 25`);
    // The hard rule only applies to the four middle steps.
    if (['B', 'C', 'D', 'D+'].includes(st.k)) {
      const head = String(st.model || '').toLowerCase().replace(/^(the|a|an|this|these|those)\s+/, '');
      for (const w of ABSTRACT_SUBJECTS) {
        if (head.startsWith(w + ' ') || head.startsWith(w + ',')) fail(g, `chủ ngữ "${w}" nằm trong danh sách cấm ở bước này`);
      }
    }
    if (st.k === 'D+') {
      for (const bad of BANNED_DPLUS) {
        if (String(st.model || '').toLowerCase().includes(bad)) fail(g, `bước D cộng dùng cụm bị cấm "${bad}"`);
      }
    }
    if (st.k === 'F' && (!Array.isArray(st.options) || st.options.length !== 3)) {
      fail(g, 'bước F cần đúng 3 lựa chọn tiêu chí');
    }
  }
  if (set.note_vi) {
    for (const [re, label] of BANNED_VI) if (re.test(set.note_vi)) fail(f, `note_vi ${label}`);
  }
  for (const [re, label] of BANNED_VI) if (re.test(set.side_vi || '')) fail(f, `side_vi ${label}`);

  // The paragraph is the seven body steps joined, so F is not in it.
  const sents = sentences(set.model_paragraph || '');
  const bodySteps = (set.steps || []).filter(x => x.k !== 'F');
  if (sents.length !== bodySteps.length) {
    fail(f, `đoạn mẫu có ${sents.length} câu, cần ${bodySteps.length} vì đó là các bước trừ F`);
  }
  for (const st of bodySteps) {
    if (st.model && !set.model_paragraph.includes(st.model)) {
      fail(f, `đoạn mẫu không chứa nguyên văn câu mẫu của bước ${st.k}`);
    }
  }
  const lowPara = String(set.model_paragraph || '').toLowerCase();
  if (lowPara.includes('for example')) fail(f, 'đoạn mẫu dùng For example, bước B đã làm việc của một ví dụ rồi');
}

/* ── report ──────────────────────────────────────────────────────────────── */
console.log(`topics: ${topics.length}`);
console.log(`đề đã có bài tập: ${files.length}`);
console.log(`tổng bài tập: ${total}`);
console.log(`đề đã có bộ đoạn: ${paraTotal}`);
if (warn.length) { console.log(`\nlưu ý (${warn.length}):`); warn.forEach(w => console.log('  ' + w)); }
if (errors.length) {
  console.log(`\nLỖI (${errors.length}):`);
  errors.forEach(e => console.log('  ' + e));
  process.exit(1);
}
console.log('\nkhông có lỗi.');
