'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.LINKOK_DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = process.env.LINKOK_UPLOAD_DIR || path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// پایداری کلید امضای توکن‌ها بین ری‌استارت‌ها
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
let SECRET = process.env.LINKOK_SECRET || '';
if (!SECRET) {
  try {
    SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  } catch { /* not created yet */ }
  if (!SECRET || SECRET.length < 32) {
    SECRET = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 });
  }
}

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOAD_DIR,
  PUBLIC_DIR,
  SECRET,
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_FILE: process.env.LINKOK_DB || path.join(DATA_DIR, 'linkok.db'),
  // اگر ست شود، لینک‌های کوتاه با این دامنه ساخته می‌شوند؛ در غیر این صورت از Host درخواست استفاده می‌شود
  BASE_URL: (process.env.BASE_URL || '').replace(/\/+$/, ''),
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  // محدودیت‌های پیش‌فرض (قابل تغییر از تنظیمات/پنل مدیریت)
  LIMITS: {
    free: { links: 500, files: 100, domains: 0, bioBlocks: 25, maxUploadMb: 25, retentionDays: 0 },
    pro: { links: 5000, files: 1000, domains: 5, bioBlocks: 100, maxUploadMb: 200, retentionDays: 0 },
    business: { links: 100000, files: 20000, domains: 50, bioBlocks: 500, maxUploadMb: 1024, retentionDays: 0 },
  },
};
