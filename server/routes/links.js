'use strict';
const express = require('express');
const QRCode = require('qrcode');
const { db, getSetting, isOn, logAction } = require('../db');
const {
  normalizeUrl, isValidCode, isReserved, randomCode, hashPassword, verifyPassword,
  parseDateInput, toLatinDigits, pageParams, pickSort, toCsv, now,
} = require('../util');
const { requireAuth, baseUrl, limitsFor, usageOf } = require('../auth');

const router = express.Router();

/* --------------------------- ابزارها ------------------------------- */
function linkRow(row, req) {
  const domain = row.domain_id ? db.prepare('SELECT hostname, status FROM domains WHERE id = ?').get(row.domain_id) : null;
  const base = domain && domain.status === 'verified' ? `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${domain.hostname}` : baseUrl(req);
  return {
    ...row,
    is_active: !!row.is_active,
    has_password: !!row.password_hash,
    password_hash: undefined,
    expired: row.expires_at ? row.expires_at < now() : false,
    limit_reached: row.click_limit ? row.clicks >= row.click_limit : false,
    short_url: `${base}/${row.code}`,
    domain_host: domain ? domain.hostname : null,
    tags: row.tags ? String(row.tags).split(',').map((t) => t.trim()).filter(Boolean) : [],
  };
}

function uniqueCode(domainId, len) {
  for (let i = 0; i < 25; i++) {
    const code = randomCode(len);
    if (!db.prepare('SELECT 1 FROM links WHERE domain_id = ? AND code = ?').get(domainId, code) && !isReserved(code)) return code;
  }
  return randomCode(len + 4);
}

function checkUrlSafety(url) {
  const banned = String(getSetting('banned_words', '')).split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
  const lower = url.toLowerCase();
  const hit = banned.find((w) => w && lower.includes(w));
  if (hit) return { safe: false, reason: `دامنه/آدرس شامل کلمه غیرمجاز «${hit}» است و اجازه ساخت لینک ندارد.` };
  if (/^https?:\/\/(127\.|10\.|192\.168\.|169\.254\.|localhost)/i.test(url)) return { safe: false, reason: 'آدرس‌های داخلی/خصوصی مجاز نیستند.' };
  return { safe: true };
}

function createLink({ req, userId, url, target_url, alias, domainId, domain_id, title, note, password, expiresAt, clickLimit, tags }) {
  if (domainId === undefined || domainId === null) domainId = domain_id; // پشتیبانی از نام‌گذاری snake_case در API
  if (!url && target_url) url = target_url; // پنل کاربری آدرس را با نام target_url می‌فرستد
  const norm = normalizeUrl(url);
  if (!norm || !norm.url) return { error: 'آدرس مقصد معتبر نیست. نمونه: https://example.com/page' };
  const safety = checkUrlSafety(norm.url);
  if (!safety.safe) return { error: safety.reason };

  domainId = Number(domainId) || 0;
  if (domainId) {
    const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(domainId);
    if (!domain) return { error: 'دامنه انتخاب‌شده یافت نشد.' };
    if (userId && domain.user_id !== userId) return { error: 'این دامنه به حساب شما تعلق ندارد.' };
    if (domain.status !== 'verified') return { error: 'ابتدا دامنه را تأیید کنید.' };
  }

  let code = String(alias || '').trim().replace(/\s+/g, '-');
  if (code) {
    if (!isValidCode(code)) return { error: 'نامک دلخواه باید ۳ تا ۴۰ کاراکتر انگلیسی، عدد، خط تیره یا زیرخط باشد.' };
    if (isReserved(code)) return { error: 'این نامک رزرو شده است. نامک دیگری امتحان کنید.' };
    if (db.prepare('SELECT 1 FROM links WHERE domain_id = ? AND code = ?').get(domainId, code)) return { error: 'این نامک قبلاً استفاده شده است.' };
  } else {
    code = uniqueCode(domainId, Math.max(4, Math.min(12, parseInt(getSetting('short_code_length', '6'), 10) || 6)));
  }

  const info = db.prepare(`INSERT INTO links (user_id, domain_id, code, target_url, title, note, password_hash, expires_at, click_limit, tags)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(userId || null, domainId, code, norm.url, String(title || '').trim() || norm.host, String(note || '').trim() || null,
      password ? hashPassword(password) : null, expiresAt ? parseDateInput(expiresAt) : null,
      clickLimit ? Math.max(1, parseInt(toLatinDigits(clickLimit), 10)) : null,
      tags ? (Array.isArray(tags) ? tags : String(tags).split(',')).map((t) => String(t).trim()).filter(Boolean).join(',') : null);
  return { link: db.prepare('SELECT * FROM links WHERE id = ?').get(info.lastInsertRowid) };
}

/* ----------------------------- لیست -------------------------------- */
const SORTS = { newest: 'l.created_at DESC', oldest: 'l.created_at ASC', clicks: 'l.clicks DESC', title: 'l.title ASC', target: 'l.target_url ASC' };

router.get('/', requireAuth, (req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const q = String(req.query.q || '').trim().replace(/[%_]/g, '');
  const status = String(req.query.status || '');
  const where = ['l.user_id = ?'];
  const args = [req.user.id];
  if (q) { where.push('(l.code LIKE ? OR l.target_url LIKE ? OR l.title LIKE ? OR l.tags LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (status === 'active') where.push('l.is_active = 1 AND (l.expires_at IS NULL OR l.expires_at > datetime(\'now\'))');
  if (status === 'inactive') where.push('l.is_active = 0');
  if (status === 'expired') where.push('l.expires_at IS NOT NULL AND l.expires_at <= datetime(\'now\')');
  if (status === 'finished') where.push('l.click_limit IS NOT NULL AND l.clicks >= l.click_limit');
  if (req.query.domain_id !== undefined) { where.push('l.domain_id = ?'); args.push(Number(req.query.domain_id) || 0); }
  const clause = where.join(' AND ');
  const order = SORTS[pickSort(String(req.query.sort || 'newest'), Object.keys(SORTS), 'newest')];
  const total = db.prepare(`SELECT COUNT(*) AS c FROM links l WHERE ${clause}`).get(...args).c;
  const rows = db.prepare(`SELECT l.* FROM links l WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args, perPage, offset);
  const sum = db.prepare(`SELECT COALESCE(SUM(l.clicks),0) AS clicks, COALESCE(SUM(l.unique_clicks),0) AS uniques FROM links l WHERE ${clause}`).get(...args);
  res.json({ ok: true, items: rows.map((r) => linkRow(r, req)), total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)), summary: sum });
});

/* ---------------------------- خروجی CSV ---------------------------- */
router.get('/export/csv', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const csv = toCsv(rows.map((r) => linkRow(r, req)), [
    { key: 'code', label: 'code' }, { key: 'short_url', label: 'short_url' }, { key: 'target_url', label: 'target_url' },
    { key: 'title', label: 'title' }, { key: 'clicks', label: 'clicks' }, { key: 'unique_clicks', label: 'unique_clicks' },
    { key: 'created_at', label: 'created_at' }, { key: 'expires_at', label: 'expires_at' }, { key: 'tags', label: 'tags', value: (r) => (r.tags || []).join('|') },
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="linkok-links-${Date.now()}.csv"`);
  res.send(csv);
});

/* --------------------------- ساخت لینک ----------------------------- */
router.post('/', requireAuth, (req, res) => {
  const limits = limitsFor(req.user.plan);
  const usage = usageOf(req.user.id);
  if (usage.links >= limits.links) return res.status(403).json({ ok: false, error: `سهمیه ساخت لینک پلن ${req.user.plan} تکمیل شده است. برای ارتقا با پشتیبانی تماس بگیرید.` });
  const result = createLink({ req, userId: req.user.id, ...req.body });
  if (result.error) return res.status(400).json({ ok: false, error: result.error });
  logAction({ actorId: req.user.id, actorName: req.user.username, action: 'link.create', entity: 'link', entityId: result.link.id, meta: { code: result.link.code } });
  res.status(201).json({ ok: true, item: linkRow(result.link, req), message: 'لینک کوتاه شما ساخته شد ✅' });
});

/* ------------------------- ساخت گروهی ------------------------------ */
router.post('/bulk', requireAuth, (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'لیستی از لینک‌ها وارد کنید (هر خط یک آدرس).' });
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200);
  const results = { created: [], failed: [] };
  for (const line of lines) {
    const parts = line.split(/[\s,]+/).filter(Boolean);
    const [url, alias] = parts;
    const result = createLink({ req, userId: req.user.id, url, alias, domainId: req.body.domain_id });
    if (result.error) results.failed.push({ line, error: result.error });
    else results.created.push({ line, item: linkRow(result.link, req) });
  }
  if (results.created.length) {
    logAction({ actorId: req.user.id, actorName: req.user.username, action: 'link.bulk_create', entity: 'link', meta: { count: results.created.length, failed: results.failed.length } });
  }
  res.status(201).json({ ok: true, ...results, message: `${results.created.length} لینک ساخته شد${results.failed.length ? ` و ${results.failed.length} مورد ناموفق بود` : ''}.` });
});

/* ------------------------- جزئیات و ویرایش ------------------------- */
const ownLink = (req, res, next) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(Number(req.params.id));
  if (!link) return res.status(404).json({ ok: false, error: 'لینک یافت نشد.' });
  if (link.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'این لینک به حساب شما تعلق ندارد.' });
  req.link = link;
  return next();
};

router.get('/:id', requireAuth, ownLink, (req, res) => res.json({ ok: true, item: linkRow(req.link, req) }));

router.patch('/:id', requireAuth, ownLink, (req, res) => {
  const link = req.link;
  const fields = [];
  const values = [];
  const nextTarget = req.body.target_url !== undefined ? req.body.target_url : req.body.url;
  if (nextTarget !== undefined) {
    const norm = normalizeUrl(nextTarget);
    if (!norm || !norm.url) return res.status(400).json({ ok: false, error: 'آدرس مقصد معتبر نیست.' });
    fields.push('target_url = ?'); values.push(norm.url);
  }
  if (req.body.title !== undefined) { fields.push('title = ?'); values.push(String(req.body.title).trim().slice(0, 120)); }
  if (req.body.note !== undefined) { fields.push('note = ?'); values.push(String(req.body.note).trim().slice(0, 300) || null); }
  if (req.body.is_active !== undefined) { fields.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
  if (req.body.expires_at !== undefined) { fields.push('expires_at = ?'); values.push(req.body.expires_at ? parseDateInput(req.body.expires_at) : null); }
  if (req.body.click_limit !== undefined) { fields.push('click_limit = ?'); values.push(req.body.click_limit ? Math.max(1, parseInt(toLatinDigits(req.body.click_limit), 10)) : null); }
  if (req.body.tags !== undefined) {
    fields.push('tags = ?');
    values.push((Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags).split(',')).map((t) => String(t).trim()).filter(Boolean).join(',') || null);
  }
  if (req.body.password !== undefined) {
    fields.push('password_hash = ?');
    values.push(req.body.password ? hashPassword(String(req.body.password)) : null);
  }
  if (req.body.code !== undefined && String(req.body.code).trim() !== link.code) {
    const code = String(req.body.code).trim();
    if (!isValidCode(code) || isReserved(code)) return res.status(400).json({ ok: false, error: 'نامک وارد‌شده معتبر یا مجاز نیست.' });
    if (db.prepare('SELECT 1 FROM links WHERE domain_id = ? AND code = ? AND id <> ?').get(link.domain_id, code, link.id)) return res.status(409).json({ ok: false, error: 'این نامک قبلاً استفاده شده است.' });
    fields.push('code = ?'); values.push(code);
  }
  if (req.body.domain_id !== undefined) {
    const domainId = Number(req.body.domain_id) || 0;
    if (domainId) {
      const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(domainId);
      if (!domain || domain.user_id !== link.user_id || domain.status !== 'verified') return res.status(400).json({ ok: false, error: 'دامنه انتخاب‌شده معتبر یا تأییدشده نیست.' });
    }
    if (db.prepare('SELECT 1 FROM links WHERE domain_id = ? AND code = ? AND id <> ?').get(domainId, link.code, link.id)) {
      return res.status(409).json({ ok: false, error: 'روی دامنه مقصد، نامکی با همین نام وجود دارد.' });
    }
    fields.push('domain_id = ?'); values.push(domainId);
  }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  fields.push("updated_at = datetime('now')");
  values.push(link.id);
  db.prepare(`UPDATE links SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM links WHERE id = ?').get(link.id);
  logAction({ actorId: req.user.id, actorName: req.user.username, action: 'link.update', entity: 'link', entityId: link.id, meta: { fields: fields.map((f) => f.split(' ')[0]) } });
  res.json({ ok: true, item: linkRow(updated, req), message: 'لینک به‌روزرسانی شد.' });
});

router.delete('/:id', requireAuth, ownLink, (req, res) => {
  db.prepare('DELETE FROM links WHERE id = ?').run(req.link.id);
  logAction({ actorId: req.user.id, actorName: req.user.username, action: 'link.delete', entity: 'link', entityId: req.link.id, meta: { code: req.link.code } });
  res.json({ ok: true, message: 'لینک حذف شد.' });
});

router.post('/:id/reset-stats', requireAuth, ownLink, (req, res) => {
  db.prepare('DELETE FROM clicks WHERE link_id = ?').run(req.link.id);
  db.prepare('UPDATE links SET clicks = 0, unique_clicks = 0 WHERE id = ?').run(req.link.id);
  res.json({ ok: true, message: 'آمار این لینک بازنشانی شد.' });
});

/* ----------------------------- آمار -------------------------------- */
router.get('/:id/stats', requireAuth, ownLink, (req, res) => {
  const days = Math.max(1, Math.min(365, parseInt(toLatinDigits(req.query.days || 30), 10) || 30));
  const link = req.link;
  const series = db.prepare(`SELECT date(ts) AS day, COUNT(*) AS clicks, COUNT(DISTINCT visitor) AS uniques,
      SUM(is_bot) AS bots FROM clicks WHERE link_id = ? AND ts >= datetime('now', ?) GROUP BY day ORDER BY day`).all(link.id, `-${days} days`);
  const fill = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const found = series.find((s) => s.day === day);
    fill.push({ day, clicks: found?.clicks || 0, uniques: found?.uniques || 0, bots: found?.bots || 0 });
  }
  const by = (col) => db.prepare(`SELECT COALESCE(NULLIF(${col},''),'نامشخص') AS label, COUNT(*) AS value FROM clicks WHERE link_id = ? AND is_bot = 0 GROUP BY label ORDER BY value DESC LIMIT 8`).all(link.id);
  const referrers = db.prepare(`SELECT COALESCE(NULLIF(referrer,''),'ورود مستقیم') AS label, COUNT(*) AS value FROM clicks WHERE link_id = ? AND is_bot = 0 GROUP BY label ORDER BY value DESC LIMIT 8`).all(link.id);
  const hourly = db.prepare(`SELECT CAST(strftime('%H', ts) AS INTEGER) AS hour, COUNT(*) AS value FROM clicks WHERE link_id = ? GROUP BY hour ORDER BY hour`).all(link.id);
  const recent = db.prepare(`SELECT ts, ip, device, browser, os, referrer, is_bot FROM clicks WHERE link_id = ? ORDER BY ts DESC LIMIT 25`).all(link.id);
  const totals = db.prepare(`SELECT COUNT(*) AS clicks, COUNT(DISTINCT visitor) AS uniques, SUM(is_bot) AS bots,
      SUM(CASE WHEN ts >= datetime('now','-1 day') THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN ts >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS week
    FROM clicks WHERE link_id = ?`).get(link.id);
  res.json({
    ok: true, series: fill, hours: hourly, totals,
    breakdown: { device: by('device'), browser: by('browser'), os: by('os'), referrer: referrers },
    recent, link: linkRow(link, req),
  });
});

/* ------------------------------ QR --------------------------------- */
router.get('/:id/qr', requireAuth, ownLink, async (req, res) => {
  const url = linkRow(req.link, req).short_url;
  const format = String(req.query.format || 'png').toLowerCase();
  const opts = { width: Math.min(1024, Math.max(120, parseInt(req.query.size || 400, 10) || 400)), margin: 1,
    color: { dark: String(req.query.dark || '#0f172a'), light: String(req.query.light || '#ffffff') } };
  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(url, { ...opts, type: 'svg' });
      res.type('image/svg+xml').send(svg);
    } else if (format === 'json') {
      res.json({ ok: true, data_url: await QRCode.toDataURL(url, opts), url });
    } else {
      res.type('image/png').send(await QRCode.toBuffer(url, opts));
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'ساخت QR ناموفق بود.' });
  }
});

module.exports = router;
module.exports.createLink = createLink;
module.exports.linkRow = linkRow;
