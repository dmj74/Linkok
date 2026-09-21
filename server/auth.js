'use strict';
const { db, getSetting } = require('./db');
const { verifyToken, signToken, clientIp } = require('./util');
const { BASE_URL, LIMITS: PLAN_LIMITS } = require('./config');

const COOKIE = 'lk_token';

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function readToken(req) {
  const cookies = parseCookies(req);
  if (cookies[COOKIE]) return cookies[COOKIE];
  const auth = req.headers.authorization || '';
  if (/^Bearer\s+/i.test(auth)) {
    const raw = auth.replace(/^Bearer\s+/i, '').trim();
    if (/^lk_/.test(raw)) {
      const u = db.prepare('SELECT * FROM users WHERE api_key = ?').get(raw);
      if (u) return { __apiUser: u };
    }
    return raw;
  }
  return null;
}

/** کاربر را از توکن/کوکی می‌خواند و روی req.user می‌گذارد (بدون اجبار) */
function attachUser(req, res, next) {
  req.user = null;
  try {
    const token = readToken(req);
    if (!token) return next();
    let payload = token;
    if (typeof token === 'string') payload = verifyToken(token);
    else payload = { uid: token.__apiUser?.id };
    if (!payload || !payload.uid) return next();
    const user = db.prepare(`SELECT id, username, email, display_name, role, status, plan, avatar, bio,
      token_version, created_at, last_login_at, login_count, api_key FROM users WHERE id = ?`).get(payload.uid);
    if (!user || user.status === 'banned') return next();
    if (payload.tv != null && payload.tv !== user.token_version) return next();
    req.user = user;
  } catch { /* ignore */ }
  return next();
}

function setAuthCookie(res, user) {
  const token = signToken({ uid: user.id, tv: user.token_version ?? 0, role: user.role }, 60 * 60 * 24 * 30);
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production' && String(process.env.LINKOK_SECURE_COOKIE || '0') === '1',
  });
  return token;
}

const clearAuthCookie = (res) => res.clearCookie(COOKIE);

const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ ok: false, error: 'برای این کار باید وارد حساب خود شوید.' }));
const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ ok: false, error: 'ابتدا وارد حساب خود شوید.' });
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') return res.status(403).json({ ok: false, error: 'دسترسی مدیریتی لازم است.' });
  return next();
};

/** آدرس پایه برای ساخت لینک کوتاه */
function baseUrl(req) {
  const fromEnv = BASE_URL || String(getSetting('base_url', '') || '').replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || `localhost:${process.env.PORT || 3000}`).split(',')[0].trim();
  return `${proto}://${host}`;
}

const limitsFor = (plan) => PLAN_LIMITS[plan] || PLAN_LIMITS.free;

/** شمارش منابع کاربر برای بررسی سهمیه */
function usageOf(userId) {
  const one = (sql) => db.prepare(sql).get(userId).c;
  const links = one('SELECT COUNT(*) AS c FROM links WHERE user_id = ?');
  const files = one('SELECT COUNT(*) AS c FROM files WHERE user_id = ?');
  const domains = one('SELECT COUNT(*) AS c FROM domains WHERE user_id = ?');
  const page = db.prepare('SELECT id FROM bio_pages WHERE user_id = ?').get(userId);
  const bioBlocks = page ? db.prepare('SELECT COUNT(*) AS c FROM bio_blocks WHERE page_id = ?').get(page.id).c : 0;
  const clicks = db.prepare(`SELECT COALESCE(SUM(l.clicks),0) AS c FROM links l WHERE l.user_id = ?`).get(userId).c;
  const storage = db.prepare('SELECT COALESCE(SUM(size),0) AS c FROM files WHERE user_id = ?').get(userId).c;
  return { links, files, domains, bioBlocks, clicks, storage };
}

/** محدودیت ساده درون‌حافظه‌ای برای مسیرهای حساس */
const buckets = new Map();
function rateLimit({ windowMs = 60_000, max = 30, keyFn = null, message = 'تعداد درخواست‌ها زیاد است. کمی بعد تلاش کنید.' } = {}) {
  return (req, res, next) => {
    const key = (keyFn ? keyFn(req) : clientIp(req)) + ':' + req.path;
    const nowMs = Date.now();
    const bucket = buckets.get(key) || { count: 0, reset: nowMs + windowMs };
    if (nowMs > bucket.reset) { bucket.count = 0; bucket.reset = nowMs + windowMs; }
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 5000) buckets.clear();
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.reset - nowMs) / 1000));
      return res.status(429).json({ ok: false, error: message });
    }
    return next();
  };
}

module.exports = { attachUser, requireAuth, requireAdmin, setAuthCookie, clearAuthCookie, baseUrl, limitsFor, usageOf, rateLimit, parseCookies, COOKIE, PLAN_LIMITS };
