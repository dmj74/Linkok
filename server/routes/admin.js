'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, allSettings, setSetting, logAction, DEFAULT_SETTINGS } = require('../db');
const {
  pageParams, toCsv, toLatinDigits, hashPassword, randomCode, formatBytes, clientIp, isValidUsername, parseDateInput, now,
} = require('../util');
const { requireAdmin, rateLimit } = require('../auth');
const { UPLOAD_DIR } = require('../config');

const router = express.Router();
router.use(requireAdmin);

const adminName = (req) => req.user.username;

/* ---------------------------- داشبورد ------------------------------ */
router.get('/stats', (req, res) => {
  const days = Math.max(7, Math.min(180, parseInt(toLatinDigits(req.query.days || 30), 10) || 30));
  const count = (sql, ...a) => db.prepare(sql).get(...a);
  const linkTotals = count('SELECT COUNT(*) AS total, SUM(is_active) AS active, COALESCE(SUM(clicks),0) AS clicks, COALESCE(SUM(unique_clicks),0) AS uniques FROM links');
  const fileTotals = count('SELECT COUNT(*) AS total, COALESCE(SUM(size),0) AS bytes, COALESCE(SUM(downloads),0) AS downloads FROM files');
  const userTotals = count("SELECT COUNT(*) AS total, SUM(CASE WHEN status='banned' THEN 1 ELSE 0 END) AS banned, SUM(CASE WHEN created_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS new_week FROM users");
  const domainTotals = count("SELECT COUNT(*) AS total, SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) AS verified FROM domains");
  const bioTotals = count('SELECT COUNT(*) AS total, COALESCE(SUM(views),0) AS views FROM bio_pages');
  const clickTotals = count(`SELECT COUNT(*) AS clicks, SUM(is_bot) AS bots,
      SUM(CASE WHEN ts >= datetime('now','-1 day') THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN ts >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS week FROM clicks`);
  const series = (() => {
    const rows = db.prepare(`SELECT date(ts) AS day, COUNT(*) AS clicks FROM clicks WHERE ts >= datetime('now', ?) GROUP BY day`).all(`-${days} days`);
    const urows = db.prepare(`SELECT date(created_at) AS day, COUNT(*) AS users FROM users WHERE created_at >= datetime('now', ?) GROUP BY day`).all(`-${days} days`);
    const lrows = db.prepare(`SELECT date(created_at) AS day, COUNT(*) AS links FROM links WHERE created_at >= datetime('now', ?) GROUP BY day`).all(`-${days} days`);
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ day, clicks: rows.find((r) => r.day === day)?.clicks || 0, users: urows.find((r) => r.day === day)?.users || 0, links: lrows.find((r) => r.day === day)?.links || 0 });
    }
    return out;
  })();
  const topLinks = db.prepare(`SELECT l.id, l.code, l.title, l.clicks, l.target_url, u.username FROM links l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.clicks DESC LIMIT 8`).all();
  const topUsers = db.prepare(`SELECT u.id, u.username, u.plan, COUNT(l.id) AS links, COALESCE(SUM(l.clicks),0) AS clicks
    FROM users u LEFT JOIN links l ON l.user_id = u.id GROUP BY u.id ORDER BY clicks DESC LIMIT 8`).all();
  const topFiles = db.prepare('SELECT id, code, orig_name, size, downloads, mime FROM files ORDER BY downloads DESC LIMIT 6').all();
  res.json({
    ok: true, days, series,
    totals: {
      ...linkTotals, ...fileTotals, ...userTotals, ...domainTotals, ...bioTotals, ...clickTotals,
      storage_label: formatBytes(fileTotals.bytes),
    },
    breakdown: {
      device: db.prepare(`SELECT COALESCE(NULLIF(device,''),'نامشخص') AS label, COUNT(*) AS value FROM clicks WHERE is_bot = 0 GROUP BY label ORDER BY value DESC LIMIT 6`).all(),
      browser: db.prepare(`SELECT COALESCE(NULLIF(browser,''),'نامشخص') AS label, COUNT(*) AS value FROM clicks WHERE is_bot = 0 GROUP BY label ORDER BY value DESC LIMIT 6`).all(),
      referrer: db.prepare(`SELECT COALESCE(NULLIF(referrer,''),'ورود مستقیم') AS label, COUNT(*) AS value FROM clicks WHERE is_bot = 0 GROUP BY label ORDER BY value DESC LIMIT 6`).all(),
      plan: db.prepare(`SELECT plan AS label, COUNT(*) AS value FROM users GROUP BY plan ORDER BY value DESC`).all(),
    },
    top: { links: topLinks, users: topUsers, files: topFiles.map((f) => ({ ...f, size_label: formatBytes(f.size) })) },
    recent: db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 12').all(),
    system: {
      uptime: Math.round(process.uptime()), memory: Math.round(process.memoryUsage().rss / 1048576),
      node: process.version, platform: `${process.platform} ${process.arch}`,
      db_size: (() => { try { return formatBytes(fs.statSync(require('../config').DB_FILE).size); } catch { return '—'; } })(),
    },
  });
});

/* ------------------------- تحلیل سایت ------------------------------ */
router.get('/analytics', (req, res) => {
  const days = Math.max(7, Math.min(365, parseInt(toLatinDigits(req.query.days || 30), 10) || 30));
  const rows = db.prepare(`SELECT date(ts) AS day, COUNT(*) AS clicks, COUNT(DISTINCT visitor) AS uniques FROM clicks WHERE ts >= datetime('now', ?) GROUP BY day`).all(`-${days} days`);
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const found = rows.find((r) => r.day === day);
    series.push({ day, clicks: found?.clicks || 0, uniques: found?.uniques || 0 });
  }
  const by = (col, limit = 10) => db.prepare(`SELECT COALESCE(NULLIF(${col},''),'نامشخص') AS label, COUNT(*) AS value FROM clicks WHERE is_bot = 0 GROUP BY label ORDER BY value DESC LIMIT ${limit}`).all();
  res.json({
    ok: true, days, series,
    breakdown: { browser: by('browser'), os: by('os'), device: by('device'), referrer: by('referrer') },
    hourly: db.prepare(`SELECT CAST(strftime('%H', ts) AS INTEGER) AS hour, COUNT(*) AS value FROM clicks GROUP BY hour ORDER BY hour`).all(),
    top: {
      links: db.prepare('SELECT id, code, title, clicks, unique_clicks FROM links ORDER BY clicks DESC LIMIT 20').all(),
      domains: db.prepare('SELECT d.hostname, COUNT(c.id) AS clicks FROM domains d LEFT JOIN links l ON l.domain_id = d.id LEFT JOIN clicks c ON c.link_id = l.id GROUP BY d.id ORDER BY clicks DESC LIMIT 10').all(),
    },
  });
});

/* ---------------------------- کاربران ------------------------------ */
router.get('/users', (req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const q = String(req.query.q || '').trim();
  const where = ['1=1'];
  const args = [];
  if (q) { where.push('(username LIKE ? OR email LIKE ? OR display_name LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (req.query.role) { where.push('role = ?'); args.push(String(req.query.role)); }
  if (req.query.status) { where.push('status = ?'); args.push(String(req.query.status)); }
  if (req.query.plan) { where.push('plan = ?'); args.push(String(req.query.plan)); }
  const clause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE ${clause}`).get(...args).c;
  const rows = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM links l WHERE l.user_id = u.id) AS links,
      (SELECT COALESCE(SUM(clicks),0) FROM links l WHERE l.user_id = u.id) AS clicks,
      (SELECT COUNT(*) FROM files f WHERE f.user_id = u.id) AS files,
      (SELECT COALESCE(SUM(size),0) FROM files f WHERE f.user_id = u.id) AS bytes
    FROM users u WHERE ${clause} ORDER BY u.id DESC LIMIT ? OFFSET ?`).all(...args, perPage, offset);
  res.json({
    ok: true, total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)),
    items: rows.map(({ password_hash, ...u }) => ({ ...u, bytes_label: formatBytes(u.bytes) })),
  });
});

router.get('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ ok: false, error: 'کاربر یافت نشد.' });
  const links = db.prepare('SELECT id, code, title, target_url, clicks, created_at FROM links WHERE user_id = ? ORDER BY clicks DESC LIMIT 20').all(user.id);
  const files = db.prepare('SELECT id, code, orig_name, size, downloads, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(user.id);
  const domains = db.prepare('SELECT * FROM domains WHERE user_id = ?').all(user.id);
  const page = db.prepare('SELECT * FROM bio_pages WHERE user_id = ?').get(user.id);
  const logs = db.prepare('SELECT * FROM audit_logs WHERE actor_id = ? ORDER BY id DESC LIMIT 20').all(user.id);
  const { password_hash, ...safe } = user;
  res.json({ ok: true, user: safe, links, files: files.map((f) => ({ ...f, size_label: formatBytes(f.size) })), domains, bio: page || null, logs });
});

router.patch('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ ok: false, error: 'کاربر یافت نشد.' });
  const fields = [];
  const values = [];
  if (req.body.role !== undefined) {
    const role = ['user', 'admin'].includes(req.body.role) ? req.body.role : null;
    if (!role) return res.status(400).json({ ok: false, error: 'نقش نامعتبر است.' });
    if (user.id === req.user.id) return res.status(400).json({ ok: false, error: 'نمی‌توانید نقش خودتان را تغییر دهید.' });
    fields.push('role = ?'); values.push(role);
  }
  if (req.body.status !== undefined) {
    const status = ['active', 'banned', 'suspended'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ ok: false, error: 'وضعیت نامعتبر است.' });
    if (user.id === req.user.id) return res.status(400).json({ ok: false, error: 'نمی‌توانید حساب خودتان را مسدود کنید.' });
    fields.push('status = ?'); values.push(status);
  }
  if (req.body.plan !== undefined) { fields.push('plan = ?'); values.push(String(req.body.plan).slice(0, 20)); }
  if (req.body.display_name !== undefined) { fields.push('display_name = ?'); values.push(String(req.body.display_name).slice(0, 60)); }
  if (req.body.email !== undefined) { fields.push('email = ?'); values.push(String(req.body.email).trim() || null); }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  values.push(user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  if (req.body.status && req.body.status !== 'active') db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(user.id);
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.user_update', entity: 'user', entityId: user.id, meta: req.body, ip: clientIp(req) });
  const { password_hash, ...safe } = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ ok: true, user: safe, message: 'کاربر به‌روزرسانی شد.' });
});

router.post('/users/:id/reset-password', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ ok: false, error: 'کاربر یافت نشد.' });
  const password = String(req.body.new_password || '').trim() || ('Lk' + randomCode(9) + '!');
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'رمز باید حداقل ۶ کاراکتر باشد.' });
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(hashPassword(password), user.id);
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.password_reset', entity: 'user', entityId: user.id, ip: clientIp(req) });
  res.json({ ok: true, password, message: 'رمز عبور جدید ساخته شد. آن را به کاربر اطلاع دهید.' });
});

router.delete('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ ok: false, error: 'کاربر یافت نشد.' });
  if (user.id === req.user.id) return res.status(400).json({ ok: false, error: 'حساب خودتان را نمی‌توانید حذف کنید.' });
  const files = db.prepare('SELECT stored_name FROM files WHERE user_id = ?').all(user.id);
  files.forEach((f) => { try { fs.unlinkSync(path.join(UPLOAD_DIR, f.stored_name)); } catch { /* ignore */ } });
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.user_delete', entity: 'user', entityId: user.id, meta: { username: user.username }, ip: clientIp(req) });
  res.json({ ok: true, message: `کاربر ${user.username} و همه داده‌هایش حذف شد.` });
});

/* ----------------------------- لینک‌ها ----------------------------- */
router.get('/links', (req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const q = String(req.query.q || '').trim();
  const where = ['1=1'];
  const args = [];
  if (q) { where.push('(l.code LIKE ? OR l.target_url LIKE ? OR l.title LIKE ? OR u.username LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (req.query.user_id) { where.push('l.user_id = ?'); args.push(Number(req.query.user_id)); }
  if (req.query.status === 'active') where.push('l.is_active = 1');
  if (req.query.status === 'inactive') where.push('l.is_active = 0');
  if (req.query.status === 'expired') where.push("l.expires_at IS NOT NULL AND l.expires_at <= datetime('now')");
  const clause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM links l LEFT JOIN users u ON u.id = l.user_id WHERE ${clause}`).get(...args).c;
  const rows = db.prepare(`SELECT l.*, u.username, d.hostname AS domain_host,
      (SELECT COUNT(*) FROM clicks c WHERE c.link_id = l.id AND c.ts >= datetime('now','-1 day')) AS clicks_24h
    FROM links l LEFT JOIN users u ON u.id = l.user_id LEFT JOIN domains d ON d.id = l.domain_id
    WHERE ${clause} ORDER BY l.id DESC LIMIT ? OFFSET ?`).all(...args, perPage, offset);
  res.json({ ok: true, total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)), items: rows.map((r) => ({ ...r, is_active: !!r.is_active, has_password: !!r.password_hash, password_hash: undefined })) });
});

router.patch('/links/:id', (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(Number(req.params.id));
  if (!link) return res.status(404).json({ ok: false, error: 'لینک یافت نشد.' });
  const fields = [];
  const values = [];
  if (req.body.is_active !== undefined) { fields.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
  if (req.body.target_url !== undefined) {
    const { normalizeUrl } = require('../util');
    const norm = normalizeUrl(req.body.target_url);
    if (!norm || !norm.url) return res.status(400).json({ ok: false, error: 'آدرس مقصد معتبر نیست.' });
    fields.push('target_url = ?'); values.push(norm.url);
  }
  if (req.body.code !== undefined) {
    const code = String(req.body.code).trim();
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(code)) return res.status(400).json({ ok: false, error: 'کد لینک نامعتبر است.' });
    if (db.prepare('SELECT 1 FROM links WHERE domain_id = ? AND code = ? AND id <> ?').get(link.domain_id, code, link.id)) return res.status(409).json({ ok: false, error: 'این کد قبلاً استفاده شده است.' });
    fields.push('code = ?'); values.push(code);
  }
  if (req.body.user_id !== undefined) {
    const owner = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(req.body.user_id));
    if (!owner) return res.status(400).json({ ok: false, error: 'کاربر مقصد یافت نشد.' });
    fields.push('user_id = ?'); values.push(owner.id);
  }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  values.push(link.id);
  db.prepare(`UPDATE links SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.link_update', entity: 'link', entityId: link.id, meta: req.body, ip: clientIp(req) });
  res.json({ ok: true, message: 'لینک به‌روزرسانی شد.' });
});

router.delete('/links/:id', (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(Number(req.params.id));
  if (!link) return res.status(404).json({ ok: false, error: 'لینک یافت نشد.' });
  db.prepare('DELETE FROM links WHERE id = ?').run(link.id);
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.link_delete', entity: 'link', entityId: link.id, meta: { code: link.code }, ip: clientIp(req) });
  res.json({ ok: true, message: 'لینک حذف شد.' });
});

/* ------------------------------ فایل‌ها ---------------------------- */
router.get('/files', (req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const q = String(req.query.q || '').trim();
  const where = ['1=1'];
  const args = [];
  if (q) { where.push('(f.orig_name LIKE ? OR f.code LIKE ? OR u.username LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const clause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM files f LEFT JOIN users u ON u.id = f.user_id WHERE ${clause}`).get(...args).c;
  const rows = db.prepare(`SELECT f.*, u.username FROM files f LEFT JOIN users u ON u.id = f.user_id WHERE ${clause} ORDER BY f.id DESC LIMIT ? OFFSET ?`).all(...args, perPage, offset);
  const sum = db.prepare(`SELECT COALESCE(SUM(f.size),0) AS bytes, COALESCE(SUM(f.downloads),0) AS downloads FROM files f LEFT JOIN users u ON u.id = f.user_id WHERE ${clause}`).get(...args);
  res.json({
    ok: true, total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)),
    summary: { ...sum, bytes_label: formatBytes(sum.bytes) },
    items: rows.map((f) => ({ ...f, is_active: !!f.is_active, has_password: !!f.password_hash, password_hash: undefined, size_label: formatBytes(f.size) })),
  });
});

router.delete('/files/:id', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(Number(req.params.id));
  if (!file) return res.status(404).json({ ok: false, error: 'فایل یافت نشد.' });
  try { fs.unlinkSync(path.join(UPLOAD_DIR, file.stored_name)); } catch { /* ignore */ }
  db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.file_delete', entity: 'file', entityId: file.id, ip: clientIp(req) });
  res.json({ ok: true, message: 'فایل حذف شد.' });
});

/* ------------------------------ دامنه‌ها --------------------------- */
router.get('/domains', (req, res) => {
  const rows = db.prepare(`SELECT d.*, u.username,
      (SELECT COUNT(*) FROM links l WHERE l.domain_id = d.id) AS links,
      (SELECT COALESCE(SUM(l.clicks),0) FROM links l WHERE l.domain_id = d.id) AS clicks
    FROM domains d LEFT JOIN users u ON u.id = d.user_id ORDER BY d.id DESC`).all();
  res.json({ ok: true, items: rows.map((r) => ({ ...r, dns_ok: !!r.dns_ok })) });
});

router.patch('/domains/:id', (req, res) => {
  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(Number(req.params.id));
  if (!domain) return res.status(404).json({ ok: false, error: 'دامنه یافت نشد.' });
  const fields = [];
  const values = [];
  if (req.body.status !== undefined) {
    const status = ['pending', 'verified', 'rejected'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ ok: false, error: 'وضعیت نامعتبر است.' });
    fields.push('status = ?'); values.push(status);
    if (status === 'verified') { fields.push("verified_at = datetime('now')"); fields.push('dns_ok = 1'); }
  }
  if (req.body.mode !== undefined && ['shortener', 'bio', 'redirect_home'].includes(req.body.mode)) { fields.push('mode = ?'); values.push(req.body.mode); }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  values.push(domain.id);
  db.prepare(`UPDATE domains SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.domain_update', entity: 'domain', entityId: domain.id, meta: req.body, ip: clientIp(req) });
  res.json({ ok: true, message: 'دامنه به‌روزرسانی شد.' });
});

router.delete('/domains/:id', (req, res) => {
  db.prepare('DELETE FROM links WHERE domain_id = ?').run(Number(req.params.id));
  db.prepare('DELETE FROM domains WHERE id = ?').run(Number(req.params.id));
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.domain_delete', entity: 'domain', entityId: req.params.id, ip: clientIp(req) });
  res.json({ ok: true, message: 'دامنه و لینک‌های آن حذف شدند.' });
});

/* ------------------------------ صفحات بیو -------------------------- */
router.get('/bio', (req, res) => {
  const rows = db.prepare(`SELECT p.*, u.username, (SELECT COUNT(*) FROM bio_blocks b WHERE b.page_id = p.id) AS blocks,
      (SELECT COUNT(*) FROM bio_views v WHERE v.page_id = p.id) AS view_count
    FROM bio_pages p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.views DESC`).all();
  res.json({ ok: true, items: rows.map((r) => ({ ...r, published: !!r.published })) });
});

router.patch('/bio/:id', (req, res) => {
  const page = db.prepare('SELECT * FROM bio_pages WHERE id = ?').get(Number(req.params.id));
  if (!page) return res.status(404).json({ ok: false, error: 'صفحه یافت نشد.' });
  const fields = [];
  const values = [];
  if (req.body.published !== undefined) { fields.push('published = ?'); values.push(req.body.published ? 1 : 0); }
  if (req.body.slug !== undefined) {
    const slug = String(req.body.slug).trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9_-]{1,39})$/.test(slug)) return res.status(400).json({ ok: false, error: 'نشانی معتبر نیست.' });
    if (db.prepare('SELECT 1 FROM bio_pages WHERE slug = ? AND id <> ?').get(slug, page.id)) return res.status(409).json({ ok: false, error: 'این نشانی استفاده شده است.' });
    fields.push('slug = ?'); values.push(slug);
  }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  values.push(page.id);
  db.prepare(`UPDATE bio_pages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true, message: 'صفحه به‌روزرسانی شد.' });
});

/* ------------------------------ تنظیمات ---------------------------- */
router.get('/settings', (req, res) => res.json({ ok: true, settings: allSettings(), defaults: DEFAULT_SETTINGS }));
router.put('/settings', (req, res) => {
  const incoming = req.body && typeof req.body === 'object' ? req.body : {};
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const changed = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (!allowed.includes(key)) continue;
    setSetting(key, value);
    changed[key] = value;
  }
  logAction({ actorId: req.user.id, actorName: adminName(req), action: 'admin.settings_update', entity: 'settings', meta: changed, ip: clientIp(req) });
  res.json({ ok: true, settings: allSettings(), message: 'تنظیمات ذخیره شد.' });
});

/* ------------------------------- لاگ‌ها ---------------------------- */
router.get('/logs', (req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const q = String(req.query.q || '').trim();
  const where = ['1=1'];
  const args = [];
  if (q) { where.push('(action LIKE ? OR actor_name LIKE ? OR entity LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const clause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_logs WHERE ${clause}`).get(...args).c;
  const rows = db.prepare(`SELECT * FROM audit_logs WHERE ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, perPage, offset);
  res.json({ ok: true, total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)), items: rows });
});

router.get('/logs/export', (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 5000').all();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="linkok-logs.csv"');
  res.send(toCsv(rows, [{ key: 'created_at', label: 'time' }, { key: 'actor_name', label: 'actor' }, { key: 'action', label: 'action' }, { key: 'entity', label: 'entity' }, { key: 'entity_id', label: 'entity_id' }, { key: 'ip', label: 'ip' }, { key: 'meta', label: 'meta' }]));
});

/* ---------------------------- اطلاعیه‌ها --------------------------- */
router.get('/announcements', (req, res) => res.json({ ok: true, items: db.prepare('SELECT * FROM announcements ORDER BY id DESC').all() }));
router.post('/announcements', (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ ok: false, error: 'عنوان اطلاعیه لازم است.' });
  const level = ['info', 'success', 'warning', 'danger'].includes(req.body.level) ? req.body.level : 'info';
  const info = db.prepare('INSERT INTO announcements (title, body, level, is_active) VALUES (?,?,?,1)').run(title, String(req.body.body || '').slice(0, 600), level);
  if (req.body.as_banner) {
    setSetting('announcement', title);
    setSetting('announcement_level', level);
  }
  res.status(201).json({ ok: true, item: db.prepare('SELECT * FROM announcements WHERE id = ?').get(info.lastInsertRowid), message: 'اطلاعیه ثبت شد.' });
});
router.delete('/announcements/:id', (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true, message: 'اطلاعیه حذف شد.' });
});

/* ----------------------------- پشتیبان‌گیری ------------------------ */
router.get('/export/:type', (req, res) => {
  const type = String(req.params.type);
  const map = {
    users: { sql: 'SELECT id, username, email, display_name, role, status, plan, created_at, last_login_at, login_count FROM users', cols: ['id', 'username', 'email', 'display_name', 'role', 'status', 'plan', 'created_at', 'last_login_at', 'login_count'] },
    links: { sql: 'SELECT l.id, l.code, l.target_url, l.title, l.clicks, l.unique_clicks, l.is_active, l.created_at, u.username FROM links l LEFT JOIN users u ON u.id = l.user_id', cols: ['id', 'code', 'target_url', 'title', 'clicks', 'unique_clicks', 'is_active', 'created_at', 'username'] },
    files: { sql: 'SELECT f.id, f.code, f.orig_name, f.size, f.downloads, f.created_at, u.username FROM files f LEFT JOIN users u ON u.id = f.user_id', cols: ['id', 'code', 'orig_name', 'size', 'downloads', 'created_at', 'username'] },
    domains: { sql: 'SELECT d.id, d.hostname, d.status, d.mode, d.verified_at, u.username FROM domains d LEFT JOIN users u ON u.id = d.user_id', cols: ['id', 'hostname', 'status', 'mode', 'verified_at', 'username'] },
  };
  const conf = map[type];
  if (!conf) return res.status(400).json({ ok: false, error: 'نوع خروجی نامعتبر است.' });
  const rows = db.prepare(conf.sql).all();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="linkok-${type}-${Date.now()}.csv"`);
  res.send(toCsv(rows, conf.cols.map((c) => ({ key: c, label: c }))));
});

module.exports = router;
