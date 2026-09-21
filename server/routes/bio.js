'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, getSetting, logAction } = require('../db');
const { randomCode, isValidSlug, isReserved, pageParams, toLatinDigits } = require('../util');
const { requireAuth, limitsFor } = require('../auth');
const { UPLOAD_DIR } = require('../config');

const router = express.Router();

const BLOCK_KINDS = ['link', 'social', 'text', 'heading', 'email', 'phone', 'youtube', 'spotify', 'whatsapp', 'telegram', 'instagram', 'twitter', 'linkedin', 'github', 'aparat', 'shop', 'donate', 'custom'];
const ICONS = ['globe', 'link', 'instagram', 'telegram', 'whatsapp', 'twitter', 'youtube', 'linkedin', 'github', 'aparat', 'mail', 'phone', 'cart', 'heart', 'star', 'music', 'spotify', 'download', 'calendar', 'location', 'camera', 'book', 'code', 'gift'];

const DEFAULT_THEME = {
  layout: 'classic', bgType: 'gradient', bgFrom: '#6366f1', bgTo: '#a855f7', bgAngle: 160, bgImage: '',
  textColor: '#ffffff', buttonBg: '#ffffff', buttonText: '#312e81', buttonStyle: 'rounded',
  buttonStyleType: 'solid', buttonShadow: true, font: 'vazirmatn', avatarShape: 'circle',
  showViews: true, buttonOpacity: 92, subtitleColor: '', socialStyle: 'circle', buttonLayout: 'full',
  headerAlign: 'center', coverImage: '', pageWidth: 620, animation: 'fade', showBranding: true,
};

const avatarStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOAD_DIR, 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase().slice(0, 6);
    cb(null, `av-${req.user.id}-${Date.now().toString(36)}-${randomCode(6)}${ext}`);
  },
});
const uploadAvatar = multer({
  storage: avatarStorage, limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!/^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/.test(file.mimetype)) return cb(new Error('فقط تصویر (PNG/JPG/WEBP) مجاز است.'));
    return cb(null, true);
  },
});

function getPage(userId) {
  return db.prepare('SELECT * FROM bio_pages WHERE user_id = ?').get(userId);
}
function pagePayload(page, req) {
  const blocks = db.prepare('SELECT * FROM bio_blocks WHERE page_id = ? ORDER BY position ASC, id ASC').all(page.id)
    .map((b) => ({ ...b, is_active: !!b.is_active, meta: b.meta ? JSON.parse(b.meta) : null }));
  const views = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN ts >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS week,
      SUM(CASE WHEN ts >= datetime('now','-1 day') THEN 1 ELSE 0 END) AS today FROM bio_views WHERE page_id = ? AND is_bot = 0`).get(page.id);
  const series = [];
  const rows = db.prepare(`SELECT date(ts) AS day, COUNT(*) AS value FROM bio_views WHERE page_id = ? AND ts >= datetime('now','-30 days') AND is_bot = 0 GROUP BY day`).all(page.id);
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    series.push({ day, value: rows.find((r) => r.day === day)?.value || 0 });
  }
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  return {
    page: { ...page, published: !!page.published, theme: { ...DEFAULT_THEME, ...(page.theme ? JSON.parse(page.theme) : {}) } },
    blocks,
    stats: { ...views, series, block_clicks: blocks.reduce((s, b) => s + (b.clicks || 0), 0) },
    public_url: `${proto}://${host}/u/${page.slug}`,
  };
}

/* ------------------------------ خواندن ----------------------------- */
router.get('/', requireAuth, (req, res) => {
  let page = getPage(req.user.id);
  if (!page) {
    const { ensureBioPage } = require('./auth');
    page = ensureBioPage(req.user, { withBlocks: true });
  }
  res.json({ ok: true, ...pagePayload(page, req), limits: limitsFor(req.user.plan), icons: ICONS, kinds: BLOCK_KINDS });
});

/* ------------------------- تنظیمات صفحه ---------------------------- */
router.patch('/', requireAuth, (req, res) => {
  const page = getPage(req.user.id);
  if (!page) return res.status(404).json({ ok: false, error: 'صفحه بیو لینک پیدا نشد.' });
  const fields = [];
  const values = [];
  if (req.body.slug !== undefined && String(req.body.slug).trim().toLowerCase() !== page.slug) {
    const slug = String(req.body.slug).trim().toLowerCase();
    if (!isValidSlug(slug)) return res.status(400).json({ ok: false, error: 'نشانی باید ۳ تا ۴۰ کاراکتر انگلیسی/عدد/خط تیره باشد.' });
    if (isReserved(slug)) return res.status(400).json({ ok: false, error: 'این نشانی رزرو شده است.' });
    if (db.prepare('SELECT 1 FROM bio_pages WHERE slug = ? AND id <> ?').get(slug, page.id)) return res.status(409).json({ ok: false, error: 'این نشانی قبلاً گرفته شده است.' });
    fields.push('slug = ?'); values.push(slug);
  }
  for (const key of ['title', 'headline', 'bio', 'avatar']) {
    if (req.body[key] !== undefined) {
      let value = String(req.body[key] ?? '').trim();
      if (key === 'title') value = value.slice(0, 60);
      if (key === 'headline') value = value.slice(0, 120);
      if (key === 'bio') value = value.slice(0, 500);
      if (key === 'avatar' && value && !/^(https?:\/\/|\/uploads\/|data:image\/)/.test(value)) {
        return res.status(400).json({ ok: false, error: 'آدرس تصویر پروفایل معتبر نیست.' });
      }
      fields.push(`${key} = ?`); values.push(value || null);
    }
  }
  if (req.body.published !== undefined) { fields.push('published = ?'); values.push(req.body.published ? 1 : 0); }
  if (req.body.theme !== undefined) {
    const incoming = typeof req.body.theme === 'string' ? JSON.parse(req.body.theme) : req.body.theme;
    const merged = { ...DEFAULT_THEME, ...(page.theme ? JSON.parse(page.theme) : {}), ...incoming };
    // اعتبارسنجی مقادیر پرخطر (فقط کلیدهای شناخته‌شده)
    const COLOR_KEYS = ['bgFrom', 'bgTo', 'textColor', 'subtitleColor', 'buttonBg', 'buttonText'];
    const URL_KEYS = ['bgImage', 'coverImage'];
    const colorOk = (c) => /^#[0-9a-f]{3,8}$/i.test(String(c)) || /^rgba?\([\d\s.,%]+\)$/i.test(String(c)) || c === 'transparent' || c === '';
    for (const key of COLOR_KEYS) {
      if (!colorOk(merged[key])) return res.status(400).json({ ok: false, error: `مقدار رنگ «${key}» نامعتبر است.` });
    }
    for (const key of URL_KEYS) {
      const value = String(merged[key] || '');
      if (value && !/^(https?:\/\/|\/uploads\/|data:image\/)/.test(value)) {
        return res.status(400).json({ ok: false, error: `آدرس تصویر «${key}» نامعتبر است.` });
      }
    }
    if (!/^#[0-9a-f]{6}$/i.test(String(merged.bgFrom)) && !/^rgba?\(/i.test(String(merged.bgFrom))) merged.bgFrom = DEFAULT_THEME.bgFrom;
    if (!/^#[0-9a-f]{6}$/i.test(String(merged.bgTo)) && !/^rgba?\(/i.test(String(merged.bgTo))) merged.bgTo = DEFAULT_THEME.bgTo;
    merged.bgAngle = Math.max(0, Math.min(360, Number(merged.bgAngle) || 160));
    merged.pageWidth = Math.max(420, Math.min(860, Number(merged.pageWidth) || 620));
    merged.buttonOpacity = Math.max(40, Math.min(100, Number(merged.buttonOpacity) || 92));
    fields.push('theme = ?'); values.push(JSON.stringify(merged));
  }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  fields.push("updated_at = datetime('now')");
  values.push(page.id);
  db.prepare(`UPDATE bio_pages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = getPage(req.user.id);
  res.json({ ok: true, ...pagePayload(updated, req), message: 'صفحه بیو لینک ذخیره شد.' });
});

/** آپلود تصویر پروفایل/پس‌زمینه */
router.post('/upload', requireAuth, (req, res) => {
  uploadAvatar.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? 'حجم تصویر بیش از ۴ مگابایت است.' : err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'تصویری انتخاب نشده است.' });
    const url = `/uploads/avatars/${req.file.filename}`;
    res.status(201).json({ ok: true, url, message: 'تصویر آپلود شد.' });
  });
});

/* ------------------------------ بلوک‌ها ---------------------------- */
const blockLimits = (req) => limitsFor(req.user.plan).bioBlocks || 25;

router.post('/blocks', requireAuth, (req, res) => {
  const page = getPage(req.user.id);
  if (!page) return res.status(404).json({ ok: false, error: 'صفحه بیو لینک پیدا نشد.' });
  const count = db.prepare('SELECT COUNT(*) AS c FROM bio_blocks WHERE page_id = ?').get(page.id).c;
  if (count >= blockLimits(req)) return res.status(403).json({ ok: false, error: `حداکثر ${blockLimits(req)} بلوک در پلن شما مجاز است.` });
  const kind = BLOCK_KINDS.includes(req.body.kind) ? req.body.kind : 'link';
  const label = String(req.body.label || '').trim().slice(0, 80) || 'بلوک جدید';
  let url = String(req.body.url || '').trim().slice(0, 500);
  if (['link', 'social', 'youtube', 'spotify', 'whatsapp', 'telegram', 'instagram', 'twitter', 'linkedin', 'github', 'aparat', 'shop', 'donate'].includes(kind) && !url) {
    return res.status(400).json({ ok: false, error: 'آدرس مقصد را وارد کنید.' });
  }
  if (url && !/^(https?:|mailto:|tel:|\/)/i.test(url)) url = 'https://' + url;
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM bio_blocks WHERE page_id = ?').get(page.id).p + 1;
  const info = db.prepare('INSERT INTO bio_blocks (page_id, kind, label, url, icon, meta, position, is_active) VALUES (?,?,?,?,?,?,?,?)')
    .run(page.id, kind, label, url || null, String(req.body.icon || '').slice(0, 30) || null,
      req.body.meta ? JSON.stringify(req.body.meta) : null, maxPos, req.body.is_active === false ? 0 : 1);
  const block = db.prepare('SELECT * FROM bio_blocks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ok: true, item: block, message: 'بلوک اضافه شد.' });
});

router.patch('/blocks/reorder', requireAuth, (req, res) => {
  const page = getPage(req.user.id);
  if (!page) return res.status(404).json({ ok: false, error: 'صفحه پیدا نشد.' });
  const order = Array.isArray(req.body.order) ? req.body.order.map((v) => parseInt(toLatinDigits(v), 10)).filter(Number.isFinite) : [];
  const stmt = db.prepare('UPDATE bio_blocks SET position = ? WHERE id = ? AND page_id = ?');
  const tx = db.transaction((ids) => ids.forEach((id, i) => stmt.run(i, id, page.id)));
  tx(order);
  res.json({ ok: true, message: 'ترتیب بلوک‌ها ذخیره شد.' });
});

const ownBlock = (req, res, next) => {
  const block = db.prepare('SELECT b.* FROM bio_blocks b JOIN bio_pages p ON p.id = b.page_id WHERE b.id = ? AND p.user_id = ?')
    .get(Number(req.params.id), req.user.id);
  if (!block) return res.status(404).json({ ok: false, error: 'بلوک یافت نشد.' });
  req.block = block;
  return next();
};

router.patch('/blocks/:id', requireAuth, ownBlock, (req, res) => {
  const b = req.block;
  const fields = [];
  const values = [];
  if (req.body.label !== undefined) { fields.push('label = ?'); values.push(String(req.body.label).trim().slice(0, 80)); }
  if (req.body.url !== undefined) {
    let url = String(req.body.url || '').trim().slice(0, 500);
    if (url && !/^(https?:|mailto:|tel:|\/)/i.test(url)) url = 'https://' + url;
    fields.push('url = ?'); values.push(url || null);
  }
  if (req.body.icon !== undefined) { fields.push('icon = ?'); values.push(String(req.body.icon).slice(0, 30) || null); }
  if (req.body.is_active !== undefined) { fields.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
  if (req.body.meta !== undefined) { fields.push('meta = ?'); values.push(req.body.meta ? JSON.stringify(req.body.meta) : null); }
  if (req.body.kind !== undefined && BLOCK_KINDS.includes(req.body.kind)) { fields.push('kind = ?'); values.push(req.body.kind); }
  if (req.body.position !== undefined) { fields.push('position = ?'); values.push(parseInt(toLatinDigits(req.body.position), 10) || 0); }
  if (!fields.length) return res.status(400).json({ ok: false, error: 'تغییری ارسال نشده است.' });
  values.push(b.id);
  db.prepare(`UPDATE bio_blocks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true, item: db.prepare('SELECT * FROM bio_blocks WHERE id = ?').get(b.id), message: 'بلوک به‌روزرسانی شد.' });
});

router.delete('/blocks/:id', requireAuth, ownBlock, (req, res) => {
  db.prepare('DELETE FROM bio_blocks WHERE id = ?').run(req.block.id);
  res.json({ ok: true, message: 'بلوک حذف شد.' });
});

/** آمار بازدید صفحه بیو */
router.get('/analytics', requireAuth, (req, res) => {
  const page = getPage(req.user.id);
  if (!page) return res.status(404).json({ ok: false, error: 'صفحه پیدا نشد.' });
  const days = Math.max(7, Math.min(180, parseInt(toLatinDigits(req.query.days || 30), 10) || 30));
  const rows = db.prepare(`SELECT date(ts) AS day, COUNT(*) AS value FROM bio_views WHERE page_id = ? AND is_bot = 0 AND ts >= datetime('now', ?) GROUP BY day`).all(page.id, `-${days} days`);
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    series.push({ day, value: rows.find((r) => r.day === day)?.value || 0 });
  }
  const by = (col) => db.prepare(`SELECT COALESCE(NULLIF(${col},''),'نامشخص') AS label, COUNT(*) AS value FROM bio_views WHERE page_id = ? AND is_bot = 0 GROUP BY label ORDER BY value DESC LIMIT 8`).all(page.id);
  const blocks = db.prepare('SELECT id, label, kind, clicks, is_active FROM bio_blocks WHERE page_id = ? ORDER BY clicks DESC').all(page.id);
  res.json({ ok: true, series, referrer: by('referrer'), device: by('device'), blocks, total: db.prepare('SELECT COUNT(*) AS c FROM bio_views WHERE page_id = ? AND is_bot = 0').get(page.id).c });
});

module.exports = router;
module.exports.DEFAULT_THEME = DEFAULT_THEME;
module.exports.ICONS = ICONS;
