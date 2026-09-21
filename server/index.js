'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const { PORT, PUBLIC_DIR, UPLOAD_DIR, DB_FILE, NODE_ENV } = require('./config');
const { db, getSetting, isOn, logAction, seedResult } = require('./db');
const { attachUser, baseUrl, rateLimit, requireAuth } = require('./auth');
const { parseUA, clientIp, isPrivateIp } = require('./util');
const { serverIp } = require('./dns');
const views = require('./views');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

/* ------------------------------ فایل‌های استاتیک ------------------------------ */
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), {
  maxAge: '7d', immutable: false, setHeaders: (res, file) => {
    if (/fonts\//.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d', index: false, dotfiles: 'deny',
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self' data:; style-src 'unsafe-inline'");
  },
}));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: '1h' }));

/* --------------------------------- کاربر -------------------------------------- */
app.use(attachUser);

/* --------------------------------- سلامت -------------------------------------- */
app.get('/healthz', (req, res) => {
  const links = db.prepare('SELECT COUNT(*) AS c FROM links').get().c;
  res.json({ ok: true, status: 'healthy', uptime: Math.round(process.uptime()), links, node: process.version, env: NODE_ENV });
});

/* --------------------------------- API --------------------------------------- */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/links', require('./routes/links'));
app.use('/api/files', require('./routes/files'));
app.use('/api/domains', require('./routes/domains'));
app.use('/api/bio', require('./routes/bio'));
app.use('/api/admin', require('./routes/admin'));

/* ----------------------- دامنه‌های اختصاصی + مسیرهای عمومی --------------------- */
const publicRoutes = require('./routes/public');

// حالت تعمیر: فقط مدیران دسترسی دارند
app.use((req, res, next) => {
  if (!isOn('maintenance')) return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/assets/') || req.path === '/healthz') return next();
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) return next();
  return res.status(503).send(views.noticeHtml({
    title: 'سایت در حال به‌روزرسانی است',
    message: 'به‌دلیل انجام عملیات نگهداری، دسترسی موقتاً محدود شده است. لطفاً چند دقیقه دیگر مراجعه کنید.',
    siteName: getSetting('site_name', 'لینکوک'), status: 503,
  }));
});

app.use(publicRoutes.customDomainHandler);
app.use(publicRoutes);
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'این مسیر API وجود ندارد.' }));

/* ------------------------------ صفحات اپلیکیشن -------------------------------- */
const page = (file, title) => (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, file));
};
app.get('/', page('index.html'));
app.get('/login', page('login.html'));
app.get('/register', page('register.html'));
app.get('/app', (req, res) => res.redirect('/dashboard'));
app.get('/dashboard', page('dashboard.html'));
app.get('/admin-panel', page('admin.html'));
app.get('/admin', (req, res) => res.redirect('/admin-panel'));
app.get('/pricing', page('pricing.html'));
app.get('/terms', page('terms.html'));

/* ------------------------- لینک کوتاه در ریشه دامنه اصلی ---------------------- */
app.get('/:code', (req, res, next) => {
  const code = String(req.params.code || '');
  if (['favicon.ico', 'robots.txt', 'manifest.json', 'sitemap.xml', 'sw.js'].includes(code)) return next();
  const link = db.prepare('SELECT * FROM links WHERE domain_id = 0 AND code = ?').get(code)
    || db.prepare('SELECT * FROM links WHERE code = ?').get(code);
  if (!link) return next();
  return publicRoutes.deliverLink(req, res, link);
});

/* --------------------------------- ۴۰۴ --------------------------------------- */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'مسیر مورد نظر یافت نشد.' });
  return res.status(404).send(views.noticeHtml({
    title: 'صفحه مورد نظر پیدا نشد',
    message: 'متأسفانه صفحه‌ای که دنبال آن بودید وجود ندارد یا حذف شده است. می‌توانید از صفحه اصلی شروع کنید.',
    siteName: getSetting('site_name', 'لینکوک'), status: 404,
  }));
});

/* ------------------------------- مدیریت خطا ----------------------------------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (NODE_ENV !== 'test') console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} →`, err.message);
  if (req.path.startsWith('/api/')) return res.status(status).json({ ok: false, error: status === 500 ? 'خطای داخلی سرور رخ داد.' : err.message });
  return res.status(status).send(views.noticeHtml({
    title: status === 413 ? 'حجم ارسال‌شده زیاد است' : 'خطایی رخ داد',
    message: status === 500 ? 'در پردازش درخواست شما مشکلی پیش آمد. لطفاً دوباره تلاش کنید.' : String(err.message || ''),
    siteName: getSetting('site_name', 'لینکوک'), status,
  }));
});

/* ------------------------------ کارهای زمان‌بندی‌شده --------------------------- */
function maintenanceJob() {
  try {
    const expiredFiles = db.prepare('SELECT id, stored_name FROM files WHERE expires_at IS NOT NULL AND expires_at < datetime(\'now\')').all();
    for (const f of expiredFiles) {
      db.prepare('UPDATE files SET is_active = 0 WHERE id = ?').run(f.id);
    }
    const retention = Number(getSetting('retention_days', '0')) || 0;
    if (retention > 0) {
      const old = db.prepare(`SELECT id, stored_name FROM files WHERE created_at < datetime('now', ?)`).all(`-${retention} days`);
      for (const f of old) {
        try { fs.unlinkSync(path.join(UPLOAD_DIR, f.stored_name)); } catch { /* ignore */ }
        db.prepare('DELETE FROM files WHERE id = ?').run(f.id);
      }
    }
    db.prepare("UPDATE links SET is_active = 0 WHERE expires_at IS NOT NULL AND expires_at < datetime('now') AND is_active = 1").run();
    db.prepare("DELETE FROM clicks WHERE ts < datetime('now','-400 days')").run();
    db.prepare("DELETE FROM bio_views WHERE ts < datetime('now','-400 days')").run();
  } catch (err) { console.error('maintenance job failed:', err.message); }
}
setInterval(maintenanceJob, 1000 * 60 * 30).unref();
setTimeout(maintenanceJob, 5000).unref();

/* --------------------------------- اجرا -------------------------------------- */
let currentIp = null;
serverIp().then((ip) => {
  currentIp = ip;
  app.set('serverIp', ip);
  if (ip) console.log(`ℹ️  IP عمومی سرور برای راهنمای دامنه: ${ip}`);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  const line = '─'.repeat(58);
  console.log(`\n${line}\n  🔗 Linkok ${NODE_ENV} → http://0.0.0.0:${PORT}\n${line}`);
  console.log(`  دیتابیس: ${DB_FILE}`);
  console.log(`  فایل‌ها: ${UPLOAD_DIR}`);
  if (seedResult?.seeded) {
    console.log('\n  ✅ داده اولیه ساخته شد. حساب‌های پیش‌فرض:');
    for (const a of seedResult.accounts) console.log(`     • ${a.username} / ${a.password}  (${a.role})`);
  }
  console.log(`\n  پنل مدیریت: http://localhost:${PORT}/admin-panel\n${line}\n`);
});

const shutdown = (signal) => {
  console.log(`\n${signal} دریافت شد؛ خروج تمیز...`);
  server.close(() => { try { db.close(); } catch { /* ignore */ } process.exit(0); });
  setTimeout(() => process.exit(0), 4000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
