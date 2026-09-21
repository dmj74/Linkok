'use strict';
const express = require('express');
const { db, logAction, getSetting, isOn } = require('../db');
const { hashPassword, verifyPassword, isValidUsername, isReserved, randomCode, clientIp, toLatinDigits } = require('../util');
const { setAuthCookie, clearAuthCookie, requireAuth, rateLimit, usageOf, limitsFor } = require('../auth');

const router = express.Router();

const publicUser = (u) => ({
  id: u.id, username: u.username, email: u.email, display_name: u.display_name, role: u.role,
  status: u.status, plan: u.plan, avatar: u.avatar, bio: u.bio, created_at: u.created_at,
  last_login_at: u.last_login_at, login_count: u.login_count, api_key: u.api_key,
});

const DEFAULT_BIO_THEME = {
  layout: 'classic', bgType: 'gradient', bgFrom: '#6366f1', bgTo: '#a855f7', bgAngle: 160, bgImage: '',
  textColor: '#ffffff', buttonBg: '#ffffff', buttonText: '#312e81', buttonStyle: 'rounded',
  buttonStyleType: 'solid', buttonShadow: true, font: 'vazirmatn', avatarShape: 'circle',
  showViews: true, buttonOpacity: 92, subtitleColor: '', socialStyle: 'circle',
};

/** ساخت صفحه بیو لینک پیش‌فرض برای کاربر تازه */
function ensureBioPage(user, { withBlocks = false } = {}) {
  let page = db.prepare('SELECT * FROM bio_pages WHERE user_id = ?').get(user.id);
  if (page) return page;
  let slug = String(user.username || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'user' + randomCode(4);
  if (db.prepare('SELECT 1 FROM bio_pages WHERE slug = ?').get(slug)) slug = slug + '-' + randomCode(3);
  const info = db.prepare(`INSERT INTO bio_pages (user_id, slug, title, headline, bio, theme)
    VALUES (?,?,?,?,?,?)`)
    .run(user.id, slug, user.display_name || user.username, '', 'به صفحه من خوش آمدید 👋', JSON.stringify(DEFAULT_BIO_THEME));
  page = db.prepare('SELECT * FROM bio_pages WHERE id = ?').get(info.lastInsertRowid);
  if (withBlocks) {
    const st = db.prepare('INSERT INTO bio_blocks (page_id, kind, label, url, icon, position) VALUES (?,?,?,?,?,?)');
    st.run(page.id, 'link', 'وب‌سایت من', 'https://example.com', 'globe', 0);
    st.run(page.id, 'social', 'اینستاگرام', 'https://instagram.com/', 'instagram', 1);
    st.run(page.id, 'social', 'تلگرام', 'https://t.me/', 'telegram', 2);
  }
  return page;
}

/* ----------------------------- ثبت نام ----------------------------- */
router.post('/register', rateLimit({ windowMs: 10 * 60_000, max: 20, message: 'تعداد تلاش‌های ثبت‌نام بیش از حد مجاز است.' }), (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const email = String(req.body.email || '').trim() || null;
  const displayName = String(req.body.display_name || '').trim() || username;

  if (!isOn('allow_registration')) return res.status(403).json({ ok: false, error: 'ثبت‌نام در حال حاضر توسط مدیر غیرفعال شده است.' });
  if (!isValidUsername(username)) return res.status(400).json({ ok: false, error: 'نام کاربری باید ۳ تا ۳۲ کاراکتر و شامل حروف انگلیسی، عدد، نقطه یا خط تیره باشد.' });
  if (isReserved(username)) return res.status(400).json({ ok: false, error: 'این نام کاربری رزرو شده است. نام دیگری انتخاب کنید.' });
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
  if (isOn('require_email') && !email) return res.status(400).json({ ok: false, error: 'وارد کردن ایمیل الزامی است.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: 'ایمیل وارد شده معتبر نیست.' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return res.status(409).json({ ok: false, error: 'این نام کاربری قبلاً ثبت شده است.' });
  if (email && db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ ok: false, error: 'این ایمیل قبلاً ثبت شده است.' });
  if (password.toLowerCase().includes(username.toLowerCase())) return res.status(400).json({ ok: false, error: 'رمز عبور نباید شامل نام کاربری باشد.' });

  const info = db.prepare(`INSERT INTO users (username, email, display_name, password_hash, role, plan, api_key, last_login_at, login_count)
    VALUES (?,?,?,?, 'user', ?, ?, datetime('now'), 1)`)
    .run(username, email, displayName, hashPassword(password), getSetting('default_plan', 'free'), 'lk_' + randomCode(28));

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  ensureBioPage(user, { withBlocks: true });
  setAuthCookie(res, user);
  logAction({ actorId: user.id, actorName: user.username, action: 'user.register', entity: 'user', entityId: user.id, ip: clientIp(req) });
  res.status(201).json({ ok: true, user: publicUser(user), message: 'حساب شما با موفقیت ساخته شد 🎉' });
});

/* ------------------------------ ورود ------------------------------- */
router.post('/login', rateLimit({ windowMs: 10 * 60_000, max: 30, message: 'تلاش‌های ناموفق زیاد بوده است. چند دقیقه بعد دوباره امتحان کنید.' }), (req, res) => {
  const username = toLatinDigits(String(req.body.username || '').trim());
  const password = String(req.body.password || '');
  if (!username || !password) return res.status(400).json({ ok: false, error: 'نام کاربری و رمز عبور را وارد کنید.' });

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ? OR username = ? COLLATE NOCASE')
    .get(username, username, username.toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    logAction({ actorName: username, action: 'auth.failed', entity: 'user', ip: clientIp(req) });
    return res.status(401).json({ ok: false, error: 'نام کاربری یا رمز عبور اشتباه است.' });
  }
  if (user.status === 'banned') return res.status(403).json({ ok: false, error: 'حساب شما توسط مدیر مسدود شده است.' });

  db.prepare('UPDATE users SET last_login_at = datetime(\'now\'), login_count = login_count + 1 WHERE id = ?').run(user.id);
  setAuthCookie(res, user);
  logAction({ actorId: user.id, actorName: user.username, action: 'auth.login', entity: 'user', entityId: user.id, ip: clientIp(req) });
  res.json({ ok: true, user: publicUser({ ...user, login_count: user.login_count + 1 }), message: `خوش آمدید ${user.display_name || user.username}!` });
});

/* ------------------------------ خروج ------------------------------- */
router.post('/logout', (req, res) => {
  if (req.user) logAction({ actorId: req.user.id, actorName: req.user.username, action: 'auth.logout', ip: clientIp(req) });
  clearAuthCookie(res);
  res.json({ ok: true, message: 'از حساب خود خارج شدید.' });
});

router.post('/logout-all', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.user.id);
  clearAuthCookie(res);
  res.json({ ok: true, message: 'از همه دستگاه‌ها خارج شدید.' });
});

/* ------------------------- من / پروفایل ---------------------------- */
router.get('/me', (req, res) => {
  if (!req.user) return res.json({ ok: true, user: null, settings: { allow_registration: isOn('allow_registration') } });
  const usage = usageOf(req.user.id);
  const page = db.prepare('SELECT slug FROM bio_pages WHERE user_id = ?').get(req.user.id);
  return res.json({
    ok: true,
    user: { ...publicUser(req.user), bio_slug: page?.slug || null },
    usage,
    limits: limitsFor(req.user.plan),
    settings: {
      site_name: getSetting('site_name'), announcement: getSetting('announcement'),
      announcement_level: getSetting('announcement_level'), allow_registration: isOn('allow_registration'),
    },
  });
});

router.patch('/profile', requireAuth, (req, res) => {
  const fields = [];
  const values = [];
  const map = { display_name: 'display_name', email: 'email', bio: 'bio', avatar: 'avatar' };
  for (const [key, column] of Object.entries(map)) {
    if (req.body[key] !== undefined) {
      let value = String(req.body[key] ?? '').trim();
      if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return res.status(400).json({ ok: false, error: 'ایمیل معتبر نیست.' });
      if (key === 'avatar' && value && !/^(https?:\/\/|\/uploads\/|data:image\/)/.test(value)) return res.status(400).json({ ok: false, error: 'آدرس تصویر معتبر نیست.' });
      fields.push(`${column} = ?`); values.push(value || null);
    }
  }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'چیزی برای ذخیره ارسال نشده است.' });
  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, user: publicUser(user), message: 'پروفایل ذخیره شد.' });
});

router.post('/password', requireAuth, (req, res) => {
  const current = String(req.body.current_password || '');
  const next = String(req.body.new_password || '');
  if (next.length < 6) return res.status(400).json({ ok: false, error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, row.password_hash)) return res.status(400).json({ ok: false, error: 'رمز عبور فعلی صحیح نیست.' });
  if (current === next) return res.status(400).json({ ok: false, error: 'رمز جدید باید متفاوت از رمز فعلی باشد.' });
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(hashPassword(next), req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  setAuthCookie(res, user);
  logAction({ actorId: user.id, actorName: user.username, action: 'user.password_change', ip: clientIp(req) });
  res.json({ ok: true, message: 'رمز عبور با موفقیت تغییر کرد.' });
});

router.post('/api-key', requireAuth, (req, res) => {
  const key = 'lk_' + randomCode(28);
  db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(key, req.user.id);
  res.json({ ok: true, api_key: key, message: 'کلید API جدید ساخته شد. کلید قبلی غیرفعال شد.' });
});

module.exports = router;
module.exports.ensureBioPage = ensureBioPage;
module.exports.DEFAULT_BIO_THEME = DEFAULT_BIO_THEME;
