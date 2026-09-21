'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { SECRET } = require('./config');

/* ------------------------------------------------------------------ *
 *  رمزنگاری و توکن
 * ------------------------------------------------------------------ */
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (str) => Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const hashPassword = (pw) => bcrypt.hashSync(String(pw), 10);
const verifyPassword = (pw, hash) => {
  if (!hash) return false;
  try { return bcrypt.compareSync(String(pw), hash); } catch { return false; }
};

function signToken(payload, ttlSeconds = 60 * 60 * 24 * 30) {
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = b64u(JSON.stringify(body));
  const sig = b64u(crypto.createHmac('sha256', SECRET).update(data).digest());
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = b64u(crypto.createHmac('sha256', SECRET).update(data).digest());
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(unb64u(data).toString('utf8'));
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch { return null; }
}

/* ------------------------------------------------------------------ *
 *  تولید کد / اسلاگ
 * ------------------------------------------------------------------ */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const RESERVED = new Set(['api', 'admin', 'app', 'dashboard', 'login', 'register', 'logout', 'signin', 'signup',
  'u', 'f', 's', 'r', 'assets', 'static', 'uploads', 'public', 'help', 'support', 'about', 'pricing', 'terms',
  'privacy', 'blog', 'docs', 'status', 'health', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.json',
  'bio', 'links', 'files', 'domains', 'settings', 'qr', 'analytics', 'admin-panel']);

const isValidUsername = (u) => /^[a-zA-Z0-9](?:[a-zA-Z0-9_.-]{2,31})$/.test(String(u || ''));
const isValidSlug = (s) => /^[a-z0-9](?:[a-z0-9_-]{1,39})$/.test(String(s || '').toLowerCase());
const isReserved = (s) => RESERVED.has(String(s || '').toLowerCase());
const isValidCode = (c) => /^[a-zA-Z0-9_-]{3,40}$/.test(String(c || ''));

function normalizeUrl(input) {
  let url = String(input || '').trim();
  if (!url) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) && !/^https?:/i.test(url)) return { url, scheme: url.split(':')[0].toLowerCase() };
    url = 'https://' + url;
  }
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    if (!u.hostname || !u.hostname.includes('.') && u.hostname !== 'localhost') {
      if (u.hostname !== 'localhost') return null;
    }
    u.hash = u.hash;
    return { url: u.toString(), host: u.hostname.replace(/^www\./, '') };
  } catch { return null; }
}

const isValidHostname = (h) => /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(String(h || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '').toLowerCase());

/* ------------------------------------------------------------------ *
 *  کاربر-agent و شبکه
 * ------------------------------------------------------------------ */
function parseUA(ua = '') {
  const s = String(ua);
  const bots = /(bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegrambot|slackbot|preview|curl|wget|python-requests|axios|headless)/i;
  const isBot = bots.test(s);
  let device = 'desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) device = 'tablet';
  else if (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry/i.test(s)) device = 'mobile';

  let os = 'سایر';
  const OS = [[/Windows NT 10/, 'Windows 10/11'], [/Windows NT 6\.3/, 'Windows 8.1'], [/Windows/, 'Windows'],
    [/iPhone|iPad|iPod/, 'iOS'], [/Mac OS X|Macintosh/, 'macOS'], [/Android/, 'Android'], [/CrOS/, 'ChromeOS'],
    [/Ubuntu/, 'Ubuntu'], [/Linux/, 'Linux'], [/FreeBSD/, 'FreeBSD']];
  for (const [re, name] of OS) if (re.test(s)) { os = name; break; }

  let browser = 'سایر';
  const BR = [[/Edg\//, 'Edge'], [/OPR\/|Opera/, 'Opera'], [/YaBrowser/, 'Yandex'], [/SamsungBrowser/, 'Samsung'],
    [/Firefox\//, 'Firefox'], [/CriOS/, 'Chrome (iOS)'], [/Chrome\//, 'Chrome'], [/Safari\//, 'Safari'],
    [/MSIE|Trident/, 'IE']];
  for (const [re, name] of BR) if (re.test(s)) { browser = name; break; }
  if (isBot) { browser = 'Bot'; device = 'bot'; }

  return { browser, os, device, isBot };
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  let ip = fwd || req.socket?.remoteAddress || '';
  ip = ip.replace(/^::ffff:/, '');
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

const isPrivateIp = (ip) => /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost|0\.0\.0\.0)/.test(String(ip || ''));
function visitorHash(req) {
  const ip = clientIp(req) + '|' + String(req.headers['user-agent'] || '') + '|' + String(req.headers['accept-language'] || '');
  return crypto.createHmac('sha256', SECRET).update(ip).digest('hex').slice(0, 24);
}

/* ------------------------------------------------------------------ *
 *  عمومی
 * ------------------------------------------------------------------ */
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const toSqlDate = (d) => new Date(d).toISOString().slice(0, 19).replace('T', ' ');

function parseDateInput(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + ' 23:59:59';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return toSqlDate(d);
}

/** ورودی‌های فارسی/عربی/کد پستی → عدد (۱۴۰۳ → 1403) */
function toLatinDigits(s) {
  return String(s == null ? '' : s).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return b + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1, n = b;
  do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
  return n.toFixed(n < 10 ? 1 : 0) + ' ' + units[i];
}

function safeJson(str, fallback = null) {
  if (str == null) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return fallback; }
}

function pageParams(query) {
  const page = Math.max(1, Math.min(10000, parseInt(toLatinDigits(query.page || 1), 10) || 1));
  const perPage = Math.max(5, Math.min(200, parseInt(toLatinDigits(query.per_page || 20), 10) || 20));
  return { page, perPage, offset: (page - 1) * perPage };
}

function toCsv(rows, columns) {
  const head = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows.map((r) => columns.map((c) => {
    let v = typeof c.value === 'function' ? c.value(r) : r[c.key];
    if (v == null) v = '';
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  return '\uFEFF' + head + '\r\n' + body;
}

/** جایگزینی پارامترهای امن در کوئری‌های داینامیک (فقط ستون‌های مجاز) */
function pickSort(sort, allowed, fallback) {
  return allowed.includes(sort) ? sort : fallback;
}

module.exports = {
  b64u, unb64u, hashPassword, verifyPassword, signToken, verifyToken,
  randomCode, isValidUsername, isValidSlug, isReserved, isValidCode, isValidHostname,
  normalizeUrl, parseUA, clientIp, isPrivateIp, visitorHash,
  now, toSqlDate, parseDateInput, toLatinDigits, escapeHtml, formatBytes, safeJson,
  pageParams, toCsv, pickSort, ALPHABET, RESERVED,
};
