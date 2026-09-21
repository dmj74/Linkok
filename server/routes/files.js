'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, getSetting, isOn, logAction } = require('../db');
const { randomCode, hashPassword, parseDateInput, formatBytes, pageParams, toCsv, toLatinDigits, now } = require('../util');
const { requireAuth, limitsFor, usageOf, baseUrl, rateLimit } = require('../auth');
const { UPLOAD_DIR } = require('../config');

const router = express.Router();

const SAFE_EXT = /^[a-z0-9]{1,8}$/i;
function safeExt(name = '') {
  const ext = path.extname(String(name)).replace('.', '').toLowerCase();
  return SAFE_EXT.test(ext) ? ext : '';
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const shard = new Date().toISOString().slice(0, 7); // 2026-09
    const dir = path.join(UPLOAD_DIR, shard);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, `${Date.now().toString(36)}-${randomCode(16)}${safeExt(file.originalname) ? '.' + safeExt(file.originalname) : ''}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024, files: 25 },
  fileFilter(req, file, cb) {
    if (safeExt(file.originalname) === 'php' || /\.(php\d?|phtml|exe|sh|bat|cmd|js|mjs|html?)$/i.test(file.originalname)) {
      return cb(new Error('این نوع فایل به دلایل امنیتی قابل آپلود نیست.'));
    }
    return cb(null, true);
  },
});

function fileRow(row, req) {
  return {
    ...row,
    is_active: !!row.is_active,
    has_password: !!row.password_hash,
    password_hash: undefined,
    expired: row.expires_at ? row.expires_at < now() : false,
    size_label: formatBytes(row.size),
    url: `/f/${row.code}`,
    download_url: `/f/${row.code}/download`,
    full_url: `${baseUrl(req)}/f/${row.code}`,
    thumb: /^image\//.test(row.mime || '') || /^video\//.test(row.mime || '') ? `/f/${row.code}/download` : null,
  };
}

/** آپلود فایل و تبدیل خودکار به لینک کوتاه */
router.post('/upload', (req, res) => {
  const settings = { maxMb: Number(getSetting('max_upload_mb', '50')) || 50 };
  const plan = req.user ? limitsFor(req.user.plan) : { maxUploadMb: 0, files: 0 };
  if (!req.user && !isOn('allow_anonymous_files')) {
    return res.status(401).json({ ok: false, error: 'برای آپلود فایل باید وارد حساب خود شوید.' });
  }
  if (req.user) {
    const usage = usageOf(req.user.id);
    if (usage.files >= plan.files) return res.status(403).json({ ok: false, error: 'سهمیه فایل‌های شما تکمیل شده است. پلن خود را ارتقا دهید.' });
  }
  const maxMb = req.user ? Math.min(settings.maxMb, plan.maxUploadMb || settings.maxMb) : Math.min(settings.maxMb, 10);
  req.maxUploadBytes = maxMb * 1024 * 1024;

  upload.array('files', 25)(req, res, (err) => {
    if (err) {
      const code = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(code).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? `حجم فایل بیش از حد مجاز است (حداکثر ${maxMb} مگابایت).` : err.message });
    }
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ ok: false, error: 'فایلی ارسال نشده است.' });
    const tooBig = files.find((f) => f.size > req.maxUploadBytes);
    if (tooBig) {
      files.forEach((f) => { try { fs.unlinkSync(f.path); } catch { /* ignore */ } });
      return res.status(413).json({ ok: false, error: `حجم «${tooBig.originalname}» بیش از حد مجاز (${maxMb} مگابایت) است.` });
    }
    const password = String(req.body.password || '');
    const expiresAt = req.body.expires_at ? parseDateInput(req.body.expires_at) : null;
    const isPublic = req.body.is_public === undefined ? 1 : (String(req.body.is_public) === '1' || req.body.is_public === true ? 1 : 0);
    const insert = db.prepare(`INSERT INTO files (user_id, code, orig_name, stored_name, mime, ext, size, password_hash, expires_at, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const created = files.map((f) => {
      let code = randomCode(7);
      while (db.prepare('SELECT 1 FROM files WHERE code = ?').get(code)) code = randomCode(7);
      const info = insert.run(req.user ? req.user.id : null, code, f.originalname, path.relative(UPLOAD_DIR, f.path),
        f.mimetype, safeExt(f.originalname), f.size, password ? hashPassword(password) : null, expiresAt, isPublic);
      return fileRow(db.prepare('SELECT * FROM files WHERE id = ?').get(info.lastInsertRowid), req);
    });
    logAction({ actorId: req.user ? req.user.id : null, actorName: req.user ? req.user.username : null, action: 'file.upload', entity: 'file', meta: { count: created.length, bytes: created.reduce((s, f) => s + f.size, 0) } });
    res.status(201).json({ ok: true, items: created, message: created.length > 1 ? `${created.length} فایل آپلود شد و لینک آن‌ها ساخته شد.` : 'فایل آپلود شد و لینک دانلود آماده است.' });
  });
});

/** آپلود از طریق کلید API / بدون مرورگر (base64 یا فرم دیتا) */
router.post('/upload-json', requireAuth, (req, res) => {
  const { filename, content_base64: b64 } = req.body || {};
  if (!filename || !b64) return res.status(400).json({ ok: false, error: 'filename و content_base64 الزامی است.' });
  const buf = Buffer.from(String(b64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  const maxMb = Math.min(Number(getSetting('max_upload_mb', '50')) || 50, limitsFor(req.user.plan).maxUploadMb);
  if (buf.length > maxMb * 1024 * 1024) return res.status(413).json({ ok: false, error: `حجم فایل بیش از ${maxMb} مگابایت است.` });
  const shard = new Date().toISOString().slice(0, 7);
  const dir = path.join(UPLOAD_DIR, shard);
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${Date.now().toString(36)}-${randomCode(16)}${safeExt(filename) ? '.' + safeExt(filename) : ''}`;
  fs.writeFileSync(path.join(dir, stored), buf);
  let code = randomCode(7);
  while (db.prepare('SELECT 1 FROM files WHERE code = ?').get(code)) code = randomCode(7);
  const info = db.prepare(`INSERT INTO files (user_id, code, orig_name, stored_name, mime, ext, size) VALUES (?,?,?,?,?,?,?)`)
    .run(req.user.id, code, filename, path.join(shard, stored), 'application/octet-stream', safeExt(filename), buf.length);
  res.status(201).json({ ok: true, item: fileRow(db.prepare('SELECT * FROM files WHERE id = ?').get(info.lastInsertRowid), req) });
});

/* ------------------------------ لیست ------------------------------- */
router.get('/', requireAuth, (req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const q = String(req.query.q || '').trim();
  const where = ['user_id = ?'];
  const args = [req.user.id];
  if (q) { where.push('(orig_name LIKE ? OR code LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (req.query.type && ['image', 'video', 'audio', 'application', 'text', 'pdf'].includes(String(req.query.type))) {
    if (req.query.type === 'pdf') { where.push("mime LIKE '%pdf%'"); } else { where.push('mime LIKE ?'); args.push(`${req.query.type}/%`); }
  }
  const clause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM files WHERE ${clause}`).get(...args).c;
  const rows = db.prepare(`SELECT * FROM files WHERE ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, perPage, offset);
  const summary = db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(size),0) AS bytes, COALESCE(SUM(downloads),0) AS downloads FROM files WHERE ${clause}`).get(...args);
  res.json({ ok: true, items: rows.map((r) => fileRow(r, req)), total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)),
    summary: { ...summary, bytes_label: formatBytes(summary.bytes) } });
});

const ownFile = (req, res, next) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(Number(req.params.id));
  if (!file) return res.status(404).json({ ok: false, error: 'فایل یافت نشد.' });
  if (file.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'این فایل به حساب شما تعلق ندارد.' });
  req.file = file;
  return next();
};

router.get('/export/csv', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const csv = toCsv(rows.map((r) => fileRow(r, req)), [
    { key: 'code', label: 'code' }, { key: 'orig_name', label: 'name' }, { key: 'size', label: 'size' },
    { key: 'mime', label: 'mime' }, { key: 'downloads', label: 'downloads' }, { key: 'created_at', label: 'created_at' },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="linkok-files.csv"');
  res.send(csv);
});

router.get('/:id', requireAuth, ownFile, (req, res) => res.json({ ok: true, item: fileRow(req.file, req) }));

router.patch('/:id', requireAuth, ownFile, (req, res) => {
  const fields = [];
  const values = [];
  if (req.body.orig_name !== undefined) { fields.push('orig_name = ?'); values.push(String(req.body.orig_name).trim().slice(0, 180) || req.file.orig_name); }
  if (req.body.is_active !== undefined) { fields.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
  if (req.body.expires_at !== undefined) { fields.push('expires_at = ?'); values.push(req.body.expires_at ? parseDateInput(req.body.expires_at) : null); }
  if (req.body.password !== undefined) { fields.push('password_hash = ?'); values.push(req.body.password ? hashPassword(String(req.body.password)) : null); }
  if (req.body.code !== undefined && String(req.body.code).trim() !== req.file.code) {
    const code = String(req.body.code).trim();
    if (!/^[a-zA-Z0-9_-]{4,40}$/.test(code)) return res.status(400).json({ ok: false, error: 'کد لینک فایل معتبر نیست.' });
    if (db.prepare('SELECT 1 FROM files WHERE code = ?').get(code)) return res.status(409).json({ ok: false, error: 'این کد قبلاً استفاده شده است.' });
    fields.push('code = ?'); values.push(code);
  }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  values.push(req.file.id);
  db.prepare(`UPDATE files SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true, item: fileRow(db.prepare('SELECT * FROM files WHERE id = ?').get(req.file.id), req), message: 'فایل به‌روزرسانی شد.' });
});

router.delete('/:id', requireAuth, ownFile, (req, res) => {
  try { fs.unlinkSync(path.join(UPLOAD_DIR, req.file.stored_name)); } catch { /* file already gone */ }
  db.prepare('DELETE FROM files WHERE id = ?').run(req.file.id);
  logAction({ actorId: req.user.id, actorName: req.user.username, action: 'file.delete', entity: 'file', entityId: req.file.id });
  res.json({ ok: true, message: 'فایل حذف شد.' });
});

router.post('/:id/reset-stats', requireAuth, ownFile, (req, res) => {
  db.prepare('UPDATE files SET downloads = 0, views = 0 WHERE id = ?').run(req.file.id);
  res.json({ ok: true, message: 'آمار فایل بازنشانی شد.' });
});

module.exports = router;
module.exports.fileRow = fileRow;
