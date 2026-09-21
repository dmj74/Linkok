'use strict';
const express = require('express');
const { db, logAction, getSetting } = require('../db');
const { isValidHostname, randomCode, isValidSlug, isReserved, now } = require('../util');
const { requireAuth, limitsFor, baseUrl, rateLimit } = require('../auth');
const { checkDomain } = require('../dns');

const router = express.Router();

const cleanHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');

function domainRow(row, req) {
  const links = db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(clicks),0) AS clicks FROM links WHERE domain_id = ?').get(row.id);
  const base = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  return {
    ...row,
    dns_ok: !!row.dns_ok,
    link_count: links.c,
    clicks: links.clicks,
    base_url: row.status === 'verified' ? `${base}://${row.hostname}` : null,
    verify_instructions: {
      txt_host: `_linkok.${row.hostname}`,
      txt_value: row.token,
      cname_host: row.hostname,
      cname_value: baseUrl(req).replace(/^https?:\/\//, ''),
      bio_url: `/u/${row.bio_slug || ''}`,
    },
  };
}

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM domains WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ ok: true, items: rows.map((r) => domainRow(r, req)), limits: limitsFor(req.user.plan) });
});

router.post('/', requireAuth, rateLimit({ windowMs: 60_000, max: 20 }), (req, res) => {
  const hostname = cleanHost(req.body.hostname);
  if (!hostname) return res.status(400).json({ ok: false, error: 'نام دامنه را وارد کنید. نمونه: go.example.com' });
  if (!isValidHostname(hostname)) return res.status(400).json({ ok: false, error: 'ساختار دامنه معتبر نیست. دامنه باید شامل پسوند باشد (مثال: short.example.com).' });
  const mainHost = baseUrl(req).replace(/^https?:\/\//, '').split(':')[0];
  if (hostname === mainHost.toLowerCase()) return res.status(400).json({ ok: false, error: 'دامنه اصلی سامانه را نمی‌توان اضافه کرد.' });
  // ابتدا تکراری بودن بررسی می‌شود تا پیام دقیق‌تری به کاربر نشان داده شود
  if (db.prepare('SELECT 1 FROM domains WHERE hostname = ?').get(hostname)) return res.status(409).json({ ok: false, error: 'این دامنه قبلاً ثبت شده است (توسط شما یا کاربر دیگر).' });
  const limits = limitsFor(req.user.plan);
  const count = db.prepare('SELECT COUNT(*) AS c FROM domains WHERE user_id = ?').get(req.user.id).c;
  const maxDomains = limits.domains || Number(getSetting('free_domains', '0'));
  if (count >= maxDomains) {
    return res.status(403).json({ ok: false, error: maxDomains ? `سهمیه دامنه پلن شما (${maxDomains} دامنه) تکمیل شده است.` : 'افزودن دامنه شخصی در پلن رایگان فعال نیست. برای فعال‌سازی با پشتیبانی تماس بگیرید.' });
  }

  const info = db.prepare(`INSERT INTO domains (user_id, hostname, token, status, mode, bio_slug) VALUES (?,?,?, 'pending', 'shortener', ?)`)
    .run(req.user.id, hostname, `linkok-verify=${randomCode(24)}`, null);
  const row = db.prepare('SELECT * FROM domains WHERE id = ?').get(info.lastInsertRowid);
  logAction({ actorId: req.user.id, actorName: req.user.username, action: 'domain.add', entity: 'domain', entityId: row.id, meta: { hostname } });
  res.status(201).json({ ok: true, item: domainRow(row, req), message: 'دامنه ثبت شد. برای فعال‌سازی، رکورد DNS زیر را اضافه کنید و دکمه بررسی را بزنید.' });
});

const ownDomain = (req, res, next) => {
  const row = db.prepare('SELECT * FROM domains WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ ok: false, error: 'دامنه یافت نشد.' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'این دامنه به حساب شما تعلق ندارد.' });
  req.domain = row;
  return next();
};

router.post('/:id/verify', requireAuth, ownDomain, rateLimit({ windowMs: 60_000, max: 10, message: 'تعداد بررسی‌ها زیاد است. یک دقیقه صبر کنید.' }), async (req, res) => {
  const mainHost = baseUrl(req).replace(/^https?:\/\//, '').split(':')[0];
  let serverAddress = null;
  try { serverAddress = req.app.get('serverIp') || null; } catch { /* ignore */ }
  const result = await checkDomain(req.domain.hostname, req.domain.token, { mainHost, serverAddress });
  db.prepare(`UPDATE domains SET status = ?, dns_ok = ?, error = ?, verified_at = CASE WHEN ? THEN datetime('now') ELSE verified_at END, last_check_at = datetime('now') WHERE id = ?`)
    .run(result.ok ? 'verified' : (req.domain.status === 'verified' ? 'verified' : 'pending'), result.ok ? 1 : 0,
      result.ok ? null : result.message, result.ok ? 1 : 0, req.domain.id);
  if (result.ok) logAction({ actorId: req.user.id, actorName: req.user.username, action: 'domain.verify', entity: 'domain', entityId: req.domain.id, meta: { hostname: req.domain.hostname, method: result.method } });
  const row = db.prepare('SELECT * FROM domains WHERE id = ?').get(req.domain.id);
  res.json({ ok: result.ok, item: domainRow(row, req), records: result.records, method: result.method, message: result.message });
});

router.patch('/:id', requireAuth, ownDomain, (req, res) => {
  const fields = [];
  const values = [];
  if (req.body.mode !== undefined) {
    const mode = ['shortener', 'bio', 'redirect_home'].includes(req.body.mode) ? req.body.mode : null;
    if (!mode) return res.status(400).json({ ok: false, error: 'حالت دامنه نامعتبر است.' });
    fields.push('mode = ?'); values.push(mode);
  }
  if (req.body.bio_slug !== undefined) {
    const slug = String(req.body.bio_slug || '').trim().toLowerCase();
    if (slug) {
      if (!isValidSlug(slug) || isReserved(slug)) return res.status(400).json({ ok: false, error: 'نشانی صفحه بیو معتبر یا مجاز نیست.' });
      if (db.prepare('SELECT 1 FROM bio_pages WHERE slug = ? AND user_id <> ?').get(slug, req.user.id)) return res.status(409).json({ ok: false, error: 'این نشانی قبلاً استفاده شده است.' });
      const page = db.prepare('SELECT * FROM bio_pages WHERE user_id = ?').get(req.user.id);
      if (!page) return res.status(400).json({ ok: false, error: 'ابتدا صفحه بیو لینک خود را بسازید.' });
      if (db.prepare('SELECT 1 FROM bio_pages WHERE slug = ? AND id <> ?').get(slug, page.id)) return res.status(409).json({ ok: false, error: 'این نشانی قبلاً استفاده شده است.' });
      db.prepare('UPDATE bio_pages SET slug = ? WHERE id = ?').run(slug, page.id);
    }
    fields.push('bio_slug = ?'); values.push(slug || null);
  }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  values.push(req.domain.id);
  db.prepare(`UPDATE domains SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true, item: domainRow(db.prepare('SELECT * FROM domains WHERE id = ?').get(req.domain.id), req), message: 'تنظیمات دامنه ذخیره شد.' });
});

router.post('/:id/recheck', requireAuth, ownDomain, async (req, res) => {
  const mainHost = baseUrl(req).replace(/^https?:\/\//, '').split(':')[0];
  const result = await checkDomain(req.domain.hostname, req.domain.token, { mainHost, serverAddress: req.app.get('serverIp') || null });
  db.prepare(`UPDATE domains SET dns_ok = ?, error = ?, last_check_at = datetime('now') WHERE id = ?`)
    .run(result.ok ? 1 : 0, result.ok ? null : result.message, req.domain.id);
  res.json({ ok: result.ok, records: result.records, message: result.message });
});

router.delete('/:id', requireAuth, ownDomain, (req, res) => {
  const links = db.prepare('SELECT COUNT(*) AS c FROM links WHERE domain_id = ?').get(req.domain.id).c;
  if (links > 0 && String(req.query.force || '') !== '1') {
    return res.status(409).json({ ok: false, error: `روی این دامنه ${links} لینک ساخته شده است. برای حذف دامنه، لینک‌ها را ابتدا منتقل یا حذف کنید یا با force=1 حذف کنید.`, link_count: links });
  }
  db.prepare('DELETE FROM links WHERE domain_id = ?').run(req.domain.id);
  db.prepare('DELETE FROM domains WHERE id = ?').run(req.domain.id);
  logAction({ actorId: req.user.id, actorName: req.user.username, action: 'domain.delete', entity: 'domain', entityId: req.domain.id });
  res.json({ ok: true, message: 'دامنه حذف شد.' });
});

module.exports = router;
module.exports.domainRow = domainRow;
