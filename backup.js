/* ─── Sao lưu lms-data.json ────────────────────────────────────────────────
   The content bank lives in git and survives anything. The student data does
   not: accounts, submissions, marks and attendance sit in one JSON file on one
   Railway volume, and nothing has ever copied it off that volume.

   Two layers, because they fail differently.
     Local snapshots  guard against a bad write or a corrupted file. Same disk,
                      so they die with the volume.
     Off-site copy    guards against losing the volume or the project. Sent by
                      email, because Resend is already wired up and needs no
                      new credential.

   Everything here is defensive: a backup that throws must never take the
   server down with it. */

const fs = require('fs');
const path = require('path');

const KEEP = 14;                     // rotating local snapshots
const DAY_MS = 24 * 60 * 60 * 1000;

function snapshotDir(dbFile) {
  return path.join(path.dirname(dbFile), 'backups');
}

// One local snapshot, oldest pruned. Returns the path, or null if it could not
// be written; the caller keeps going either way.
function writeSnapshot(dbFile) {
  try {
    if (!fs.existsSync(dbFile)) return null;
    const dir = snapshotDir(dbFile);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const out = path.join(dir, `lms-data-${stamp}.json`);
    fs.copyFileSync(dbFile, out);

    const olds = fs.readdirSync(dir)
      .filter(f => f.startsWith('lms-data-') && f.endsWith('.json'))
      .sort();
    for (const f of olds.slice(0, Math.max(0, olds.length - KEEP))) {
      try { fs.unlinkSync(path.join(dir, f)); } catch (e) {}
    }
    return out;
  } catch (err) {
    console.error('[backup] snapshot failed:', err.message);
    return null;
  }
}

function listSnapshots(dbFile) {
  try {
    const dir = snapshotDir(dbFile);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.startsWith('lms-data-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => {
        const p = path.join(dir, f);
        const s = fs.statSync(p);
        return { name: f, size: s.size, at: s.mtime.toISOString() };
      });
  } catch (err) {
    return [];
  }
}

// A short readable summary, so the email says what is inside without anyone
// having to open the attachment.
function summarise(raw) {
  try {
    const d = JSON.parse(raw);
    const n = k => Array.isArray(d[k]) ? d[k].length : 0;
    return [
      `Tài khoản: ${n('users')}`,
      `Bài nộp: ${n('submissions')}`,
      `Bài tập về nhà: ${n('assignments')}`,
      `Lớp: ${n('classes')}`,
      `Buổi điểm danh: ${n('attendance_sessions')}`,
      `Bài nháp: ${n('drafts')}`,
    ].join(' · ');
  } catch (err) {
    return 'Không đọc được nội dung để tóm tắt.';
  }
}

// Off-site copy. Anything that fails here is logged and swallowed: a backup
// that cannot be sent must not stop the one on disk, and must not crash boot.
async function emailBackup(dbFile, { getResend, to, from }) {
  if (!process.env.RESEND_API_KEY) { console.warn('[backup] no RESEND_API_KEY, bỏ qua bản gửi đi'); return false; }
  if (!to) { console.warn('[backup] no ADMIN_EMAIL, bỏ qua bản gửi đi'); return false; }
  // ADMIN_EMAIL may hold several addresses separated by commas. Resend wants an
  // array, and rejects the raw string outright.
  const rcpt = String(to).split(",").map(x => x.trim()).filter(Boolean);
  if (!rcpt.length) { console.warn("[backup] ADMIN_EMAIL rỗng, bỏ qua bản gửi đi"); return false; }
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    const mb = Buffer.byteLength(raw) / (1024 * 1024);
    // Resend caps a message at 40MB. Well before that the file has outgrown
    // email as a transport and wants object storage instead.
    if (mb > 15) {
      console.warn(`[backup] DB ${mb.toFixed(1)}MB, quá to để gửi mail, cần chuyển sang lưu trữ đối tượng`);
      return false;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const { error } = await getResend().emails.send({
      from,
      to: rcpt,
      subject: `Sao lưu SSP IELTS ${stamp}`,
      text:
        `Bản sao lms-data.json ngày ${stamp}.\n\n` +
        `${summarise(raw)}\n` +
        `Kích thước: ${(mb * 1024).toFixed(0)} KB\n\n` +
        `File này chứa dữ liệu học viên và mã băm mật khẩu. Giữ hộp thư kín.\n` +
        `Khôi phục: chép file này đè lên lms-data.json rồi khởi động lại.\n`,
      attachments: [{ filename: `lms-data-${stamp}.json`, content: Buffer.from(raw).toString('base64') }],
    });
    if (error) { console.error('[backup] gửi mail hỏng:', error.message || error); return false; }
    console.log(`[backup] đã gửi bản sao ${(mb * 1024).toFixed(0)} KB tới ${to}`);
    return true;
  } catch (err) {
    console.error('[backup] gửi mail hỏng:', err.message);
    return false;
  }
}

// Snapshot now, then once a day. The timer is unref'd so it never holds the
// process open on its own.
function startSchedule(dbFile, mailer) {
  const run = async (why) => {
    const snap = writeSnapshot(dbFile);
    console.log(`[backup] ${why}: ${snap ? 'đã lưu ' + path.basename(snap) : 'không lưu được'}`);
    await emailBackup(dbFile, mailer);
  };
  // Boot one is delayed a little so it never competes with startup.
  setTimeout(() => run('lúc khởi động'), 30_000).unref?.();
  setInterval(() => run('theo lịch ngày'), DAY_MS).unref?.();
}

module.exports = { writeSnapshot, listSnapshots, emailBackup, startSchedule, snapshotDir, summarise };
