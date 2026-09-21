'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, getSetting, isOn } = require('../db');
const {
  verifyPassword, parseUA, clientIp, isPrivateIp, visitorHash, signToken, verifyToken, now, escapeHtml: esc,
} = require('../util');
const { baseUrl } = require('../auth');
const views = require('../views');
const { UPLOAD_DIR, BASE_URL } = require('../config');

const router = express.Router();

const siteName = () => getSetting('site_name', 'لینکوک');
const isAdminReq = (req) => req.user && (req.user.role === 'admin' || req.user.role === 'superadmin');

/* ------------------------------------------------------------------ *
 *  رکورد بازدید لینک
 * ------------------------------------------------------------------ */
function recordClick(link, req) {
  const ua = parseUA(req.headers['user-agent']);
  const ip = clientIp(req);
  const visitor = visitorHash(req);
  const referrer = String(req.headers.referer || '').slice(0, 200);
  const isPrivate = isPrivateIp(ip);
  if (isPrivate) return; // بازدیدهای داخلی/تست شمرده نمی‌شوند
  const seen = db.prepare('SELECT 1 FROM clicks WHERE link_id = ? AND visitor = ? LIMIT 1').get(link.id, visitor);
  db.prepare(`INSERT INTO clicks (link_id, ip, visitor, referrer, ua, browser, os, device, is_bot) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(link.id, ip, visitor, referrer, String(req.headers['user-agent'] || '').slice(0, 250), ua.browser, ua.os, ua.device, ua.isBot ? 1 : 0);
  db.prepare('UPDATE links SET clicks = clicks + 1, unique_clicks = unique_clicks + ? WHERE id = ?').run(seen ? 0 : 1, link.id);
  link.clicks += 1;
}

/* ------------------------------------------------------------------ *
 *  مسیرهای عمومی API
 * ------------------------------------------------------------------ */
router.get('/api/public/health', (req, res) => res.json({ ok: true, status: 'ok', uptime: Math.round(process.uptime()), version: require('../../package.json').version }));

router.get('/api/public/config', (req, res) => {
  res.json({
    ok: true,
    site: {
      name: siteName(), tagline: getSetting('site_tagline'), description: getSetting('site_description'),
      footer: getSetting('footer_text'), contact: getSetting('contact_email'), accent: getSetting('theme_accent'),
      announcement: getSetting('announcement'), announcement_level: getSetting('announcement_level'),
      allow_registration: isOn('allow_registration'), allow_anonymous_links: isOn('allow_anonymous_links'),
      allow_anonymous_files: isOn('allow_anonymous_files'), max_upload_mb: Number(getSetting('max_upload_mb', '50')),
      base_url: baseUrl(req),
    },
    stats: (() => {
      const links = db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(clicks),0) AS clicks FROM links').get();
      const files = db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(size),0) AS bytes FROM files').get();
      const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      return { links: links.c, clicks: links.clicks, files: files.c, bytes: files.bytes, users };
    })(),
  });
});

/** ساخت لینک کوتاه بدون حساب کاربری (در صورت فعال بودن) */
router.post('/api/public/shorten', (req, res) => {
  if (!isOn('allow_anonymous_links')) return res.status(401).json({ ok: false, error: 'برای ساخت لینک باید وارد حساب خود شوید.' });
  const { createLink } = require('./links');
  const { linkRow } = require('./links');
  const result = createLink({ req, userId: 0, ...req.body });
  if (result.error) return res.status(400).json({ ok: false, error: result.error });
  res.status(201).json({ ok: true, item: linkRow(result.link, req), message: 'لینک کوتاه ساخته شد ✅' });
});

/** اطلاع از کلیک روی بلوک‌های بیو لینک (بدون داده هویتی) */
router.post('/api/public/block/:id/click', (req, res) => {
  db.prepare('UPDATE bio_blocks SET clicks = clicks + 1 WHERE id = ?').run(Number(req.params.id) || 0);
  res.json({ ok: true });
});

/** فایل‌های عمومی اخیر (برای نمایش در صفحه اصلی) */
router.get('/api/public/recent-files', (req, res) => {
  const rows = db.prepare(`SELECT code, orig_name, size, mime, downloads FROM files
    WHERE is_active = 1 AND password_hash IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY id DESC LIMIT 6`).all();
  res.json({ ok: true, items: rows });
});

/** ساخت تصویر QR برای هر آدرس دلخواه */
router.get('/api/public/qr', async (req, res) => {
  const QRCode = require('qrcode');
  const data = String(req.query.data || '').slice(0, 600);
  if (!/^https?:\/\//i.test(data)) return res.status(400).json({ ok: false, error: 'فقط آدرس‌های http/https مجاز هستند.' });
  try {
    const size = Math.min(1200, Math.max(120, parseInt(req.query.size || 420, 10) || 420));
    const buffer = await QRCode.toBuffer(data, { width: size, margin: 1, errorCorrectionLevel: 'M' });
    res.type('image/png').setHeader('Cache-Control', 'public, max-age=86400').send(buffer);
  } catch { res.status(500).json({ ok: false, error: 'ساخت QR ناموفق بود.' }); }
});

/** اطلاعات عمومی یک لینک کوتاه (برای نمایش پیش‌نمایش) */
router.get('/api/public/link/:code', (req, res) => {
  const link = db.prepare('SELECT id, code, title, target_url, clicks, created_at FROM links WHERE code = ?').get(String(req.params.code));
  if (!link) return res.status(404).json({ ok: false, error: 'لینک پیدا نشد.' });
  res.json({ ok: true, item: { code: link.code, title: link.title, clicks: link.clicks, created_at: link.created_at } });
});

/* ------------------------------------------------------------------ *
 *  کوتاه‌کننده: /r/:code , /s/:code و ریشه دامنه اختصاصی
 * ------------------------------------------------------------------ */
function grantCookieName(kind, code) { return `lk_${kind}_${code}`; }
function hasGrant(req, kind, code) {
  const raw = req.cookies?.[grantCookieName(kind, code)];
  if (!raw) return false;
  const payload = verifyToken(raw);
  return !!payload && payload.g === `${kind}:${code}`;
}
const setGrant = (res, kind, code) => res.cookie(grantCookieName(kind, code), signToken({ g: `${kind}:${code}` }, 60 * 60 * 6), { httpOnly: true, sameSite: 'lax', maxAge: 6 * 3600 * 1000 });

function deliverLink(req, res, link) {
  if (!link.is_active) return res.status(410).send(views.noticeHtml({ title: 'این لینک غیرفعال شده است', message: 'مالک لینک این لینک را موقتاً غیرفعال کرده است. اگر فکر می‌کنید اشتباهی رخ داده با پشتیبانی تماس بگیرید.', siteName: siteName(), status: 410 }));
  if (link.expires_at && link.expires_at < now()) return res.status(410).send(views.noticeHtml({ title: 'اعتبار این لینک به پایان رسیده است', message: `این لینک در تاریخ ${esc(link.expires_at.slice(0, 10))} منقضی شده است.`, siteName: siteName(), status: 410 }));
  if (link.click_limit && link.clicks >= link.click_limit) return res.status(410).send(views.noticeHtml({ title: 'ظرفیت این لینک تکمیل شده است', message: 'تعداد کلیک‌های مجاز این لینک به پایان رسیده است.', siteName: siteName(), status: 410 }));

  if (link.password_hash && !hasGrant(req, 'l', link.code)) {
    const error = String(req.query.e || '') === '1' ? '<div class="err">رمز عبور اشتباه است. دوباره تلاش کنید.</div>' : '';
    const form = `${error}<form method="post" action="/r/${esc(link.code)}/unlock"><input type="password" name="password" placeholder="رمز عبور لینک" required autofocus autocomplete="off"><button class="btn" type="submit">مشاهده لینک</button></form>`;
    return res.status(423).send(views.noticeHtml({ title: 'این لینک محافظت‌شده است', message: 'برای مشاهده مقصد، رمز عبور را وارد کنید.', siteName: siteName(), form, status: 423 }));
  }

  recordClick(link, req);
  return res.redirect(302, link.target_url);
}

router.post('/r/:code/unlock', (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE code = ?').get(String(req.params.code));
  if (!link) return res.status(404).send(views.noticeHtml({ title: 'لینک پیدا نشد', message: 'لینکی با این نشانی وجود ندارد.', siteName: siteName(), status: 404 }));
  if (!link.password_hash || verifyPassword(String(req.body.password || ''), link.password_hash)) {
    setGrant(res, 'l', link.code);
    return res.redirect(303, `/r/${link.code}`);
  }
  return res.redirect(303, `/r/${link.code}?e=1`);
});

router.get(['/s/:code', '/r/:code'], (req, res, next) => {
  const link = db.prepare('SELECT * FROM links WHERE domain_id = 0 AND code = ?').get(String(req.params.code))
    || db.prepare('SELECT * FROM links WHERE code = ?').get(String(req.params.code));
  if (!link) return next();
  return deliverLink(req, res, link);
});

/** دامنه‌های اختصاصی: هر مسیر یک کد لینک است */
/* فهرست دامنه‌های تأییدشده با کش ۶۰ ثانیه‌ای (برای بررسی سریع هاست) */
let verifiedHostsCache = { at: 0, set: new Set() };
function verifiedHosts() {
  if (Date.now() - verifiedHostsCache.at > 60000) {
    const rows = db.prepare("SELECT LOWER(hostname) AS hostname FROM domains WHERE status = 'verified'").all();
    verifiedHostsCache = { at: Date.now(), set: new Set(rows.map((r) => r.hostname)) };
  }
  return verifiedHostsCache.set;
}
const isCustomHost = (host) => !!host && verifiedHosts().has(String(host).toLowerCase());

function customDomainHandler(req, res, next) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].split(':')[0].trim().toLowerCase();
  if (!host) return next();
  // هاست اصلی فقط وقتی معتبر است که BASE_URL یا تنظیمات base_url مشخص شده باشد؛
  // در غیر این صورت مقایسه با هاست درخواست، دامنه‌های اختصاصی را از کار می‌انداخت.
  const configuredBase = String(BASE_URL || getSetting('base_url', '') || '').replace(/\/+$/, '');
  const mainHost = configuredBase ? configuredBase.replace(/^https?:\/\//, '').split(':')[0].toLowerCase() : '';
  if (mainHost && host === mainHost) return next();
  if (!isCustomHost(host)) return next();
  const domain = db.prepare("SELECT * FROM domains WHERE LOWER(hostname) = ? AND status = 'verified'").get(host);
  if (!domain) return next();

  const parts = req.path.split('/').filter(Boolean);
  if (!parts.length) {
    if (domain.mode === 'bio' && domain.bio_slug) return res.redirect(302, `/u/${domain.bio_slug}`);
    // دامنه‌های تنظیم‌شده روی «انتقال به سایت اصلی» ریشه را به دامنه اصلی هدایت می‌کنند
    if (domain.mode === 'redirect_home') {
      const home = BASE_URL || String(getSetting('base_url', '') || '').replace(/\/+$/, '');
      if (home && home.replace(/^https?:\/\//, '').split(':')[0].toLowerCase() !== host) return res.redirect(302, home + '/');
    }
    const owner = db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(domain.user_id);
    const page = db.prepare('SELECT slug FROM bio_pages WHERE user_id = ?').get(domain.user_id);
    return res.send(views.noticeHtml({
      title: `دامنه ${esc(host)} فعال است`, message: `این دامنه به ${esc(owner?.display_name || owner?.username || 'یک کاربر')} تعلق دارد و برای کوتاه‌سازی لینک آماده است.`,
      siteName: siteName(), form: '', cta: page ? `<a class="btn" href="/u/${esc(page.slug)}" style="display:flex;align-items:center;justify-content:center;min-height:50px;text-decoration:none">مشاهده صفحه بیو لینک</a>` : '',
    }));
  }
  if (parts[0] === 'u' && parts[1]) {
    const page = db.prepare('SELECT * FROM bio_pages WHERE slug = ? AND user_id = ?').get(String(parts[1]).toLowerCase(), domain.user_id);
    if (page) return renderBio(req, res, page, domain);
  }
  if (parts.length === 1) {
    const link = db.prepare('SELECT * FROM links WHERE domain_id = ? AND code = ?').get(domain.id, parts[0]);
    if (link) return deliverLink(req, res, link);
    if (domain.mode === 'bio' && domain.bio_slug) return res.redirect(302, `/u/${domain.bio_slug}`);
  }
  return next();
}

/* ------------------------------------------------------------------ *
 *  صفحه بیو لینک
 * ------------------------------------------------------------------ */
function renderBio(req, res, page, domain = null) {
  if (!page.published && !isAdminReq(req) && req.user?.id !== page.user_id) {
    return res.status(404).send(views.noticeHtml({ title: 'صفحه در دسترس نیست', message: 'این صفحه بیو لینک هنوز منتشر نشده است.', siteName: siteName(), status: 404 }));
  }
  const blocks = db.prepare('SELECT * FROM bio_blocks WHERE page_id = ? AND is_active = 1 ORDER BY position ASC, id ASC').all(page.id);
  const ua = parseUA(req.headers['user-agent']);
  const ip = clientIp(req);
  if (!isPrivateIp(ip)) {
    db.prepare('INSERT INTO bio_views (page_id, ip, referrer, device, is_bot) VALUES (?,?,?,?,?)')
      .run(page.id, ip, String(req.headers.referer || '').slice(0, 200), ua.device, ua.isBot ? 1 : 0);
    db.prepare('UPDATE bio_pages SET views = views + 1 WHERE id = ?').run(page.id);
  }
  const totalViews = page.views || db.prepare('SELECT COUNT(*) AS c FROM bio_views WHERE page_id = ?').get(page.id).c;
  const theme = { ...require('./bio').DEFAULT_THEME, ...(page.theme ? JSON.parse(page.theme) : {}) };
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(views.bioHtml({ page, blocks, theme, views: totalViews, siteName: siteName(), customDomain: !!domain, origin: baseUrl(req) }));
}

router.get('/u/:slug', (req, res, next) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const page = db.prepare('SELECT * FROM bio_pages WHERE slug = ?').get(slug);
  if (!page) {
    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(slug);
    if (user) {
      const own = db.prepare('SELECT * FROM bio_pages WHERE user_id = ?').get(user.id);
      if (own) return renderBio(req, res, own);
    }
    return next();
  }
  return renderBio(req, res, page);
});

/* ------------------------------------------------------------------ *
 *  صفحه فایل و دانلود
 * ------------------------------------------------------------------ */
function fileLocked(req, res, file, kind = 'f') {
  const error = String(req.query.e || '') === '1' ? '<div class="err">رمز عبور اشتباه است.</div>' : '';
  return res.status(423).send(views.noticeHtml({
    title: 'فایل محافظت‌شده است',
    message: 'برای دسترسی به این فایل رمز عبور را وارد کنید.',
    siteName: siteName(),
    form: `${error}<form method="post" action="/f/${esc(file.code)}/unlock"><input type="password" name="password" placeholder="رمز عبور" required autofocus><button class="btn" type="submit">باز کردن فایل</button></form>`,
    status: 423,
  }));
}

router.post('/f/:code/unlock', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE code = ?').get(String(req.params.code));
  if (!file) return res.status(404).send(views.noticeHtml({ title: 'فایل پیدا نشد', message: 'فایلی با این نشانی وجود ندارد.', siteName: siteName(), status: 404 }));
  if (!file.password_hash || verifyPassword(String(req.body.password || ''), file.password_hash)) {
    setGrant(res, 'f', file.code);
    return res.redirect(303, `/f/${file.code}`);
  }
  return res.redirect(303, `/f/${file.code}?e=1`);
});

function findFile(code) { return db.prepare('SELECT * FROM files WHERE code = ?').get(String(code)); }

function guardFile(req, res, file) {
  if (!file) { res.status(404).send(views.noticeHtml({ title: 'فایل پیدا نشد', message: 'فایلی با این نشانی وجود ندارد یا حذف شده است.', siteName: siteName(), status: 404 })); return false; }
  if (!file.is_active) { res.status(410).send(views.noticeHtml({ title: 'این فایل غیرفعال شده است', message: 'دسترسی به این فایل توسط مالک آن غیرفعال شده است.', siteName: siteName(), status: 410 })); return false; }
  if (file.expires_at && file.expires_at < now()) { res.status(410).send(views.noticeHtml({ title: 'اعتبار این فایل تمام شده است', message: 'مدت زمان دسترسی به این فایل به پایان رسیده است.', siteName: siteName(), status: 410 })); return false; }
  return true;
}

router.get('/f/:code', (req, res, next) => {
  const file = findFile(req.params.code);
  if (!file) return next();
  if (!guardFile(req, res, file)) return undefined;
  if (file.password_hash && !hasGrant(req, 'f', file.code)) return fileLocked(req, res, file);
  db.prepare('UPDATE files SET views = views + 1 WHERE id = ?').run(file.id);
  const owner = file.user_id ? db.prepare('SELECT display_name, username FROM users WHERE id = ?').get(file.user_id) : null;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(views.fileHtml({
    file: { ...file, full_url: `${baseUrl(req)}/f/${file.code}` }, siteName: siteName(), origin: baseUrl(req),
    owner: owner ? (owner.display_name || owner.username) : 'مهمان',
  }));
});

router.get(['/f/:code/download', '/files/:code/download', '/d/:code'], (req, res, next) => {
  const file = findFile(req.params.code);
  if (!file) return next();
  if (!guardFile(req, res, file)) return undefined;
  if (file.password_hash && !hasGrant(req, 'f', file.code)) return fileLocked(req, res, file);
  const full = path.join(UPLOAD_DIR, file.stored_name);
  if (!fs.existsSync(full)) {
    return res.status(410).send(views.noticeHtml({ title: 'فایل روی سرور یافت نشد', message: 'فایل حذف شده یا منتقل شده است.', siteName: siteName(), status: 410 }));
  }
  db.prepare('UPDATE files SET downloads = downloads + 1 WHERE id = ?').run(file.id);
  const inline = /^(image|video|audio|text\/plain|application\/pdf)/.test(file.mime || '') || String(req.query.disposition || '') === 'inline';
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', file.mime || 'application/octet-stream');
  if (inline) {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.orig_name || 'file')}"`);
    return res.sendFile(full, { acceptRanges: true });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.orig_name || 'file')}"; filename*=UTF-8''${encodeURIComponent(file.orig_name || 'file')}`);
  return res.sendFile(full, { acceptRanges: true });
});

module.exports = router;
module.exports.customDomainHandler = customDomainHandler;
module.exports.isCustomHost = isCustomHost;
module.exports.deliverLink = deliverLink;
module.exports.renderBio = renderBio;
module.exports.recordClick = recordClick;
