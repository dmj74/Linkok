'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_FILE, DATA_DIR, UPLOAD_DIR } = require('./config');
const { hashPassword, randomCode, now, toSqlDate } = require('./util');

/** زمان گذشته به شکل رشته SQLite (چون مودیفایرهای ترکیبی در SQLite پشتیبانی نمی‌شود) */
const agoStamp = (days = 0, hours = 0, minutes = 0) =>
  toSqlDate(new Date(Date.now() - days * 86400000 - hours * 3600000 - minutes * 60000));

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT,
  display_name  TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  status        TEXT NOT NULL DEFAULT 'active',
  plan          TEXT NOT NULL DEFAULT 'free',
  avatar        TEXT,
  bio           TEXT,
  api_key       TEXT UNIQUE,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  login_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS links (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER,
  domain_id     INTEGER NOT NULL DEFAULT 0,
  code          TEXT NOT NULL,
  target_url    TEXT NOT NULL,
  title         TEXT,
  note          TEXT,
  kind          TEXT NOT NULL DEFAULT 'link',
  file_id       INTEGER,
  password_hash TEXT,
  expires_at    TEXT,
  click_limit   INTEGER,
  clicks        INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  tags          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_links_domain_code ON links(domain_id, code);
CREATE INDEX IF NOT EXISTS ix_links_user ON links(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS clicks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id    INTEGER NOT NULL,
  ts         TEXT NOT NULL DEFAULT (datetime('now')),
  ip         TEXT,
  visitor    TEXT,
  referrer   TEXT,
  ua         TEXT,
  browser    TEXT,
  os         TEXT,
  device     TEXT,
  is_bot     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_clicks_link ON clicks(link_id, ts DESC);
CREATE INDEX IF NOT EXISTS ix_clicks_ts ON clicks(ts DESC);

CREATE TABLE IF NOT EXISTS files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER,
  code          TEXT NOT NULL UNIQUE,
  orig_name     TEXT,
  stored_name   TEXT,
  mime          TEXT,
  ext           TEXT,
  size          INTEGER NOT NULL DEFAULT 0,
  downloads     INTEGER NOT NULL DEFAULT 0,
  views         INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  expires_at    TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_files_user ON files(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS domains (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  hostname     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  token        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  mode         TEXT NOT NULL DEFAULT 'shortener',
  bio_slug     TEXT,
  dns_ok       INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  verified_at  TEXT,
  last_check_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bio_pages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title      TEXT,
  headline   TEXT,
  bio        TEXT,
  avatar     TEXT,
  theme      TEXT,
  published  INTEGER NOT NULL DEFAULT 1,
  views      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bio_blocks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'link',
  label      TEXT,
  url        TEXT,
  icon       TEXT,
  meta       TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  clicks     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (page_id) REFERENCES bio_pages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_bio_blocks_page ON bio_blocks(page_id, position);

CREATE TABLE IF NOT EXISTS bio_views (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id  INTEGER NOT NULL,
  ts       TEXT NOT NULL DEFAULT (datetime('now')),
  ip       TEXT,
  referrer TEXT,
  device   TEXT,
  is_bot   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (page_id) REFERENCES bio_pages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_bio_views_page ON bio_views(page_id, ts DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER,
  actor_name TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  meta       TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_logs_ts ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  body       TEXT,
  level      TEXT NOT NULL DEFAULT 'info',
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

db.exec(SCHEMA);

/* ------------------------------------------------------------------ *
 *  تنظیمات پیش‌فرض
 * ------------------------------------------------------------------ */
const DEFAULT_SETTINGS = {
  site_name: 'لینکوک',
  site_tagline: 'کوتاه‌کننده لینک، بیو لینک و اشتراک فایل',
  site_description: 'با لینکوک لینک‌های بلند را کوتاه کنید، فایل‌هایتان را با یک لینک کوتاه به اشتراک بگذارید، دامنه شخصی وصل کنید و صفحه بیو لینک حرفه‌ای بسازید.',
  base_url: '',
  allow_registration: '1',
  allow_anonymous_links: '1',
  allow_anonymous_files: '0',
  require_email: '0',
  default_plan: 'free',
  max_upload_mb: '50',
  banned_words: 'porn,sex,xxx,casino,بت',
  short_code_length: '6',
  announcement: '',
  announcement_level: 'info',
  theme_accent: '#6366f1',
  footer_text: 'ساخته شده با ❤️ برای وب فارسی',
  contact_email: 'support@linkok.ir',
  maintenance: '0',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
Object.entries(DEFAULT_SETTINGS).forEach(([k, v]) => insertSetting.run(k, v));

const getSetting = (key, fallback = null) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
};
const setSetting = (key, value) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value == null ? null : String(value));
const allSettings = () => {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of db.prepare('SELECT key, value FROM settings').all()) out[row.key] = row.value;
  return out;
};
const isOn = (key) => String(getSetting(key, '0')) === '1';

/* ------------------------------------------------------------------ *
 *  لاگ فعالیت
 * ------------------------------------------------------------------ */
function logAction({ actorId = null, actorName = null, action, entity = null, entityId = null, meta = null, ip = null }) {
  db.prepare('INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, meta, ip) VALUES (?,?,?,?,?,?,?)')
    .run(actorId ?? null, actorName ?? null, action, entity ?? null, entityId == null ? null : String(entityId), meta ? JSON.stringify(meta) : null, ip ?? null);
}

/* ------------------------------------------------------------------ *
 *  داده اولیه (Seed) — فقط در اولین اجرا
 * ------------------------------------------------------------------ */
/** ساخت چند فایل نمونه (تصویر، PDF و متن) برای دموی اشتراک فایل */
function seedFiles(ownerId) {
  try {
    const zlib = require('zlib');
    const shard = new Date().toISOString().slice(0, 7);
    const dir = path.join(UPLOAD_DIR, shard);
    fs.mkdirSync(dir, { recursive: true });

    const crcTable = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
    const pngChunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      let crc = 0xFFFFFFFF;
      for (const byte of Buffer.concat([Buffer.from(type), data])) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
      const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0);
      return Buffer.concat([len, Buffer.from(type), data, crcBuf]);
    };
    const W = 640, H = 400;
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; // RGB
    const rows = [];
    for (let y = 0; y < H; y++) {
      const row = Buffer.alloc(1 + W * 3);
      for (let x = 0; x < W; x++) {
        const t = (x / W + y / H) / 2;
        row[1 + x * 3] = Math.round(99 + t * 70);
        row[2 + x * 3] = Math.round(102 + t * 60);
        row[3 + x * 3] = Math.round(241 - t * 40);
      }
      rows.push(row);
    }
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), pngChunk('IEND', Buffer.alloc(0))]);

    const pdfText = ['%PDF-1.4', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj', 'trailer<</Root 1 0 R>>', '%%EOF'].join('\n');
    const guide = ['راهنمای سریع لینکوک', '====================', '',
      '۱) کوتاه کردن لینک: آدرس مقصد را وارد کنید و دکمه «ساخت لینک کوتاه» را بزنید.',
      '۲) دامنه اختصاصی: در داشبورد بخش دامنه‌ها، دامنه خود را اضافه کنید و رکورد DNS را ثبت کنید.',
      '۳) بیو لینک: از تب بیو لینک، رنگ‌ها، پس‌زمینه و بلوک‌ها را شخصی‌سازی کنید.',
      '۴) اشتراک فایل: فایل را بکشید و رها کنید؛ لینک دانلود بلافاصله ساخته می‌شود.', '',
      'پشتیبانی: support@linkok.ir'].join('\n');

    const items = [
      { name: 'بنر-معرفی-لینکوک.png', mime: 'image/png', ext: 'png', buf: png, downloads: 214 },
      { name: 'راهنمای-استفاده-از-لینکوک.pdf', mime: 'application/pdf', ext: 'pdf', buf: Buffer.from(pdfText, 'utf8'), downloads: 168 },
      { name: 'متن-معرفی-سرویس.txt', mime: 'text/plain', ext: 'txt', buf: Buffer.from(guide, 'utf8'), downloads: 96 },
    ];
    const insert = db.prepare(`INSERT INTO files (user_id, code, orig_name, stored_name, mime, ext, size, downloads, views, created_at)
      VALUES (?,?,?,?,?,?,?,?,?, datetime('now', ?))`);
    items.forEach((item, i) => {
      const stored = `seed-${randomCode(10)}.${item.ext}`;
      fs.writeFileSync(path.join(dir, stored), item.buf);
      insert.run(ownerId, randomCode(7), item.name, path.join(shard, stored), item.mime, item.ext, item.buf.length,
        item.downloads, Math.round(item.downloads * 1.7), `-${12 - i * 3} days`);
    });
  } catch (err) { console.error('seed files failed:', err.message); }
}

function seed() {
  const hasUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0;
  if (hasUsers) return { seeded: false };

  const created = [];
  const mkUser = (u) => {
    const info = db.prepare(`INSERT INTO users (username, email, display_name, password_hash, role, plan, status, bio, created_at, api_key)
      VALUES (?,?,?,?,?,?, 'active', ?, datetime('now', ?), ?)`)
      .run(u.username, u.email, u.display_name, hashPassword(u.password), u.role, u.plan, u.bio || null, u.created_ago || '-30 days', 'lk_' + randomCode(28));
    created.push({ username: u.username, password: u.password, role: u.role });
    return info.lastInsertRowid;
  };

  const adminId = mkUser({
    username: 'admin', email: 'admin@linkok.ir', display_name: 'مدیر سامانه', password: 'Admin@1234',
    role: 'admin', plan: 'business', bio: 'مدیریت پلتفرم لینکوک', created_ago: '-91 days',
  });
  const demoId = mkUser({
    username: 'demo', email: 'demo@linkok.ir', display_name: 'کاربر نمونه', password: 'Demo@1234',
    role: 'user', plan: 'pro', bio: 'تولیدکننده محتوا و مدرس آنلاین', created_ago: '-64 days',
  });
  const saraId = mkUser({
    username: 'sara', email: 'sara@example.com', display_name: 'سارا محمدی', password: 'Sara@1234',
    role: 'user', plan: 'free', bio: 'طراح گرافیک', created_ago: '-21 days',
  });

  const linkStmt = db.prepare(`INSERT INTO links (user_id, domain_id, code, target_url, title, kind, clicks, unique_clicks, is_active, tags, created_at)
    VALUES (?, 0, ?, ?, ?, 'link', ?, ?, ?, ?, datetime('now', ?))`);
  const clickStmt = db.prepare(`INSERT INTO clicks (link_id, ts, ip, visitor, referrer, browser, os, device, is_bot, ua)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Chrome (iOS)', 'Samsung'];
  const oses = ['Android', 'iOS', 'Windows 10/11', 'macOS', 'Linux'];
  const devices = ['mobile', 'mobile', 'mobile', 'desktop', 'desktop', 'tablet'];
  const refs = ['https://www.google.com/', 'https://instagram.com/', 'https://t.me/', 'direct', 'direct', 'https://twitter.com/', 'https://www.aparat.com/'];
  const targets = [
    ['landing-campaign', 'https://linkok.ir/blog/link-shortening-guide', 'راهنمای کامل کوتاه‌سازی لینک', 'آموزش,بازاریابی'],
    ['instagram-bio', 'https://instagram.com/linkok', 'پیج اینستاگرام لینکوک', 'شبکه اجتماعی'],
    ['youtube-tutorial', 'https://www.youtube.com/watch?v=linkok-demo', 'آموزش ویدیویی پنل مدیریت', 'آموزش'],
    ['telegram-channel', 'https://t.me/linkok_channel', 'کانال تلگرام اطلاع‌رسانی', 'شبکه اجتماعی'],
    ['shop-summer', 'https://shop.example.com/products?collection=summer-sale&utm_source=linkok', 'فروش ویژه تابستان', 'فروشگاه,کمپین'],
    ['webinar-register', 'https://events.example.com/webinar/seo-1404', 'ثبت‌نام وبینار سئو', 'رویداد'],
    ['portfolio', 'https://sara.design', 'نمونه کارهای سارا', 'شخصی'],
    ['aparat-video', 'https://www.aparat.com/v/linkok', 'ویدیو معرفی محصول', 'ویدیو'],
    ['support-docs', 'https://docs.example.com/faq', 'مستندات و سوالات متداول', 'پشتیبانی'],
    ['app-download', 'https://play.google.com/store/apps/details?id=ir.linkok.app', 'دانلود اپلیکیشن اندروید', 'اپلیکیشن'],
  ];

  let idx = 0;
  for (const owner of [demoId, demoId, demoId, demoId, demoId, demoId, demoId, saraId, saraId, adminId]) {
    const [code, url, title, tags] = targets[idx];
    const ageDays = 3 + idx * 3;
    const clicks = Math.round(40 + Math.random() * 260 * (1 - idx / 14));
    const info = linkStmt.run(owner, code, url, title, clicks, Math.round(clicks * 0.72), 1, tags, `-${ageDays} days`);
    const linkId = info.lastInsertRowid;
    const uniqSet = new Set();
    for (let c = 0; c < clicks; c++) {
      const dayAgo = Math.max(0, Math.round(Math.random() * ageDays));
      const hour = String(Math.floor(Math.random() * 24)).padStart(2, '0');
      const minute = String(Math.floor(Math.random() * 60)).padStart(2, '0');
      const visitor = c % 2 === 0
        ? 'u-fixed-' + Math.floor(Math.random() * Math.max(3, Math.round(clicks * 0.3)))
        : 'u' + Math.random().toString(36).slice(2, 12);
      uniqSet.add(visitor);
      clickStmt.run(linkId, agoStamp(dayAgo, Number(hour), Number(minute)), '5.' + Math.floor(Math.random() * 250) + '.1.' + Math.floor(Math.random() * 250),
        visitor, refs[c % refs.length], browsers[c % browsers.length], oses[c % oses.length], devices[c % devices.length], Math.random() < 0.06 ? 1 : 0,
        'Mozilla/5.0 (seed data)');
    }
    db.prepare('UPDATE links SET unique_clicks = ? WHERE id = ?').run(uniqSet.size, linkId);
    idx++;
  }

  // دامنه نمونه
  db.prepare(`INSERT INTO domains (user_id, hostname, token, status, mode, verified_at, dns_ok, created_at)
    VALUES (?, 'go.demolink.ir', ?, 'verified', 'shortener', datetime('now', '-12 days'), 1, datetime('now', '-14 days'))`)
    .run(demoId, 'linkok-verify-' + randomCode(12));
  db.prepare(`INSERT INTO domains (user_id, hostname, token, status, created_at)
    VALUES (?, 'short.sara.design', ?, 'pending', datetime('now', '-2 days'))`)
    .run(saraId, 'linkok-verify-' + randomCode(12));

  // صفحه بیو لینک نمونه
  const theme = {
    layout: 'classic', bgType: 'gradient', bgFrom: '#6366f1', bgTo: '#8b5cf6', bgAngle: 160,
    bgImage: '', textColor: '#ffffff', buttonBg: '#ffffff', buttonText: '#312e81', buttonStyle: 'rounded',
    buttonStyleType: 'solid', buttonShadow: true, font: 'vazirmatn', avatarShape: 'circle', showViews: true, buttonOpacity: 92,
  };
  const pageInfo = db.prepare(`INSERT INTO bio_pages (user_id, slug, title, headline, bio, theme, views, created_at)
    VALUES (?, 'demo', 'کاربر نمونه', 'تولیدکننده محتوا و مدرس آنلاین', 'سلام! من مدیر نمونه لینکوک هستم. اینجا همه لینک‌های مهم من جمع شده است ✨', ?, 0, datetime('now', '-40 days'))`)
    .run(demoId, JSON.stringify(theme));
  const pageId = pageInfo.lastInsertRowid;
  const blocks = [
    ['link', 'وب‌سایت من', 'https://linkok.ir', 'globe', 0, 412],
    ['link', 'کانال تلگرام', 'https://t.me/linkok_channel', 'telegram', 1, 318],
    ['link', 'اینستاگرام', 'https://instagram.com/linkok', 'instagram', 2, 254],
    ['link', 'آموزش ویدیویی پنل', 'https://www.youtube.com/watch?v=linkok', 'youtube', 3, 187],
    ['link', 'خرید قالب‌های من', 'https://shop.example.com', 'cart', 4, 96],
    ['social', 'ایمیل', 'mailto:demo@linkok.ir', 'email', 5, 41],
    ['text', 'برای همکاری پیام بدهید 💌', '', '', 6, 0],
  ];
  const blockStmt = db.prepare('INSERT INTO bio_blocks (page_id, kind, label, url, icon, position, clicks) VALUES (?,?,?,?,?,?,?)');
  blocks.forEach((b) => blockStmt.run(pageId, ...b));

  const bv = db.prepare(`INSERT INTO bio_views (page_id, ts, ip, referrer, device, is_bot) VALUES (?, ?, ?, ?, ?, 0)`);
  for (let i = 0; i < 486; i++) {
    bv.run(pageId, agoStamp(Math.round(Math.random() * 30), Math.floor(Math.random() * 24)), '5.1.1.1', refs[i % refs.length], devices[i % devices.length]);
  }
  db.prepare('UPDATE bio_pages SET views = ? WHERE id = ?').run(486, pageId);

  seedFiles(demoId);

  logAction({ actorName: 'system', action: 'seed', entity: 'database', meta: { users: created.length } });
  return { seeded: true, accounts: created };
}

const seedResult = seed();

module.exports = { db, getSetting, setSetting, allSettings, isOn, logAction, seedResult, DEFAULT_SETTINGS };
