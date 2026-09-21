/* ==========================================================================
   Linkok — ابزارهای مشترک سمت کلاینت
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------- آیکن‌ها -------------------------------- */
  const ICONS = {
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/>',
    upload: '<path d="M12 17V5m0 0L8 9m4-4 4 4"/><path d="M4 19h16"/>',
    download: '<path d="M12 4v12m0 0 4-4m-4 4-4-4"/><path d="M4 20h16"/>',
    file: '<path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V3.5Z"/><path d="M14 3.5V8h4"/>',
    users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/><path d="M16.5 5.2a3.2 3.2 0 0 1 0 6.2M18 14.6c2.2.6 3.5 2.2 3.5 4.4"/>',
    chart: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
    chartLine: '<path d="M3 17l5-5 4 3 5-7 4 4"/><path d="M3 20h18"/>',
    shield: '<path d="M12 3l7 2.5v6c0 4.4-3 7.9-7 9.5-4-1.6-7-5.1-7-9.5v-6L12 3Z"/><path d="M9 12l2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-2.87-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 11.5 4.6V4.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 11.5h.1a2 2 0 1 1 0 4h-.1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13.5h10L18 7"/><path d="M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15V6a3 3 0 0 1 3-3h9"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><path d="M14 14h3v3h-3zM19.5 14H21v3M14 19.5V21h3M19 19h2v2"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="3"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20V10.5Z"/><path d="M9.5 21.5V14h5v7.5"/>',
    bio: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    domain: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9.5h17M3.5 14.5h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    logout: '<path d="M15 4.5H18A1.5 1.5 0 0 1 19.5 6v12A1.5 1.5 0 0 1 18 19.5h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
    bell: '<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
    bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 12.5 12 17.5l9-5M3 16.5 12 21.5l9-5"/>',
    fire: '<path d="M12 2.5s5 4.2 5 9a5 5 0 0 1-10 0c0-1.8.8-3.3.8-3.3S9 11 10.5 11c0-3 1.5-6 1.5-8.5Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7.5l8 5.5 8-5.5"/>',
    phone: '<path d="M6 3.5h3l1.5 4-2 1.3a12 12 0 0 0 6 6l1.3-2 4 1.5v3A2 2 0 0 1 17.7 20C10.6 19.4 4.6 13.4 4 6.3A2 2 0 0 1 6 3.5Z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
    telegram: '<path d="M21.5 4.5 2.8 11.3c-.9.3-.9 1.5.1 1.8l4.3 1.3 1.6 5c.3.9 1.4 1 1.9.3l2.3-3 4.6 3.4c.8.6 1.9.1 2.1-.9l3-13c.2-1-.8-1.8-1.7-1.4Z"/>',
    whatsapp: '<path d="M21 11.6c0 4.3-3.8 7.7-8.4 7.7-1.4 0-2.7-.3-3.8-.8L4 20l1.5-4a7.4 7.4 0 0 1-1.1-4c0-4.2 3.8-7.7 8.4-7.7S21 7.3 21 11.6Z"/>',
    twitter: '<path d="M4 4l7.3 9.2L4.4 20h2.3l5.6-6 4.3 6H20l-7.5-9.6L19.4 4h-2.3l-5.2 5.6L7.7 4H4Z" fill="currentColor" stroke="none"/>',
    youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M11 9.5l4.2 2.5L11 14.5v-5Z" fill="currentColor" stroke="none"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 10v7M7.5 7.2v.1M11.5 17v-4a2 2 0 0 1 4 0v4"/>',
    github: '<circle cx="12" cy="12" r="8.5"/><path d="M9 20v-2.5c-2 .4-2.6-1-2.6-1M15 20v-2.6c1.9-1.6 2-3.6 1.6-5.2-.3-1.3-1.4-2.4-2.7-2.7-1.3-.3-3.2-.3-4.5 0-1.3.3-2.4 1.4-2.7 2.7-.4 1.6-.3 3.6 1.6 5.2V20"/>',
    aparat: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5v-7Z" fill="currentColor" stroke="none"/>',
    cart: '<circle cx="9.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/><path d="M3 4h2.2l2.3 10.2h10.8L21 7.5H6.2"/>',
    heart: '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/>',
    star: '<path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 4Z"/>',
    music: '<circle cx="7" cy="18" r="2.5"/><circle cx="18" cy="16" r="2.5"/><path d="M9.5 18V7l11-2v11"/>',
    spotify: '<circle cx="12" cy="12" r="9"/><path d="M7.5 9.5c3-1 6.5-.7 9 1M8 12.6c2.4-.8 5.2-.6 7.2.8M8.6 15.5c1.8-.6 3.9-.4 5.4.6"/>',
    location: '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.3"/>',
    camera: '<rect x="3" y="6.5" width="18" height="13" rx="3"/><circle cx="12" cy="13" r="3.4"/><path d="M8.5 6.5l1.2-2h4.6l1.2 2"/>',
    book: '<path d="M5 4.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H5V4.5Z"/><path d="M19 4.5h-4a3 3 0 0 0-3 3"/>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    gift: '<rect x="3.5" y="8" width="17" height="12" rx="2.5"/><path d="M3.5 12h17M12 8v12M8.5 8a2.5 2.5 0 1 1 3.5-2.3c0 1.6-.6 2.3-1.5 2.3h-2Zm7 0a2.5 2.5 0 1 0-3.5-2.3c0 1.6.6 2.3 1.5 2.3h2Z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"/>',
    filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',
    pause: '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
    play: '<path d="M8 5l11 7-11 7V5Z"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="M11 12l9-9M17 3l3 3M15 6l2.5 2.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.1"/>',
    alert: '<path d="M12 3.5 21 19H3l9-15.5Z"/><path d="M12 9.5v4.5M12 17v.1"/>',
    clipboard: '<rect x="6" y="4.5" width="12" height="16.5" rx="2.5"/><path d="M9.5 4.5V3h5v1.5M9.5 10h5M9.5 14h5"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8s-.6-1.7-.6-2.5c0-1 .8-1.7 1.9-1.7H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z"/><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10.5" r="1.1" fill="currentColor" stroke="none"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17.5l5-4.5 4 3.5 3-2.5 4 3.5"/>',
    text: '<path d="M5 6.5h14M5 12h9M5 17.5h12"/>',
    heading: '<path d="M6 5v14M18 5v14M6 12h12"/>',
    attach: '<path d="M20 11.5l-8 8a5.5 5.5 0 0 1-7.8-7.8l8-8a3.7 3.7 0 0 1 5.2 5.2l-8 8a1.8 1.8 0 0 1-2.6-2.6l7.3-7.3"/>',
    save: '<path d="M5 4.5h11l3 3V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4.5Z"/><path d="M9 4.5V9h6V4.5M9 21.5V15h6v6.5"/>',
    rocket: '<path d="M12 3c3.5 2 5 5.5 5 9l-2.5 2.5h-5L7 12c0-3.5 1.5-7 5-9Z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.5 17.5 8 21l3-1.5M14.5 17.5 16 21l-3-1.5"/>',
  };

  const icon = (name, size = 18, cls = '') =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${ICONS[name] || ICONS.link}</svg>`;

  /* -------------------------------- اعداد و تاریخ ---------------------------- */
  const nf = new Intl.NumberFormat('fa-IR');
  const fa = (n) => nf.format(Number(n) || 0);
  const faShort = (n) => {
    const v = Number(n) || 0;
    if (v >= 1e9) return fa((v / 1e9).toFixed(1)) + ' میلیارد';
    if (v >= 1e6) return fa((v / 1e6).toFixed(1)) + ' میلیون';
    if (v >= 1e3) return fa(Math.round(v / 1e3)) + ' هزار';
    return fa(v);
  };
  const bytes = (b) => {
    const v = Number(b) || 0;
    if (v < 1024) return fa(Math.round(v)) + ' بایت';
    if (v < 1048576) return fa((v / 1024).toFixed(1)) + ' کیلوبایت';
    if (v < 1073741824) return fa((v / 1048576).toFixed(1)) + ' مگابایت';
    return fa((v / 1073741824).toFixed(2)) + ' گیگابایت';
  };
  const jalali = (input, withTime = true) => {
    if (!input) return '—';
    const iso = String(input).replace(' ', 'T');
    const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
    if (Number.isNaN(d.getTime())) return String(input);
    try {
      const date = new Intl.DateTimeFormat('fa-IR', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'medium' }).format(d);
      return date;
    } catch { return String(input); }
  };
  const timeAgo = (input) => {
    if (!input) return '—';
    const iso = String(input).replace(' ', 'T');
    const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
    const diff = (Date.now() - d.getTime()) / 1000;
    if (Number.isNaN(diff)) return '—';
    if (diff < 60) return 'لحظه‌ای پیش';
    if (diff < 3600) return fa(Math.floor(diff / 60)) + ' دقیقه پیش';
    if (diff < 86400) return fa(Math.floor(diff / 3600)) + ' ساعت پیش';
    if (diff < 2592000) return fa(Math.floor(diff / 86400)) + ' روز پیش';
    if (diff < 31536000) return fa(Math.floor(diff / 2592000)) + ' ماه پیش';
    return fa(Math.floor(diff / 31536000)) + ' سال پیش';
  };
  const localInput = (input) => {
    if (!input) return '';
    const d = new Date(String(input).replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shortNum = (n) => { const v = Number(n) || 0; return v >= 10000 ? faShort(v) : fa(v); };

  /* ---------------------------------- تم ------------------------------------ */
  const THEME_KEY = 'linkok-theme';
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon', 19);
      btn.setAttribute('aria-label', theme === 'dark' ? 'حالت روشن' : 'حالت تاریک');
    });
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#070b18' : '#f6f7fc');
  }
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(saved || (prefersLight ? 'light' : 'dark'));
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  /* ---------------------------------- API ----------------------------------- */
  async function api(path, { method = 'GET', body, raw = false, headers = {} } = {}) {
    const opts = { method, headers: { ...headers }, credentials: 'same-origin' };
    if (body instanceof FormData) { opts.body = body; }
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(path, opts); } catch { throw new Error('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.'); }
    if (raw) return res;
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) { try { data = await res.json(); } catch { data = null; } }
    if (!res.ok || (data && data.ok === false)) {
      const err = new Error((data && data.error) || `خطا در درخواست (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data || { ok: true };
  }

  /* --------------------------------- توست‌ها -------------------------------- */
  function toast(message, type = 'info', timeout = 4200) {
    let host = document.getElementById('toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
    const names = { ok: 'check', err: 'alert', warn: 'alert', info: 'info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(names[type] || 'info', 19)}<div style="flex:1">${escapeHtml(message)}</div>`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, timeout);
  }

  /* --------------------------------- مودال‌ها ------------------------------- */
  function modal({ title, body, footer = '', wide = false, onClose = null, closeOnBackdrop = true }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal-card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title || '')}">
        <div class="modal-head">
          <h3 class="mb-0" style="font-size:1.05rem">${escapeHtml(title || '')}</h3>
          <button class="btn btn-ghost btn-icon" data-close aria-label="بستن">${icon('x', 18)}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>`;
    const close = () => { wrap.remove(); document.body.classList.remove('no-scroll'); if (onClose) onClose(); };
    wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    if (closeOnBackdrop) wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    return { el: wrap, close, $: (sel) => wrap.querySelector(sel), $$: (sel) => Array.from(wrap.querySelectorAll(sel)) };
  }

  function confirmDialog({ title = 'تأیید عملیات', message, confirmText = 'تأیید و حذف', danger = true }) {
    return new Promise((resolve) => {
      const m = modal({
        title,
        body: `<p style="margin:0">${escapeHtml(message)}</p>`,
        footer: `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${escapeHtml(confirmText)}</button>
                 <button class="btn btn-ghost" data-close>انصراف</button>`,
        onClose: () => resolve(false),
      });
      m.$('[data-yes]').addEventListener('click', () => { resolve(true); const el = m.el; el.remove(); document.body.classList.remove('no-scroll'); });
    });
  }

  /* --------------------------------- کپی کردن -------------------------------- */
  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast('در حافظه کپی شد ✅', 'ok');
      return true;
    } catch { toast('کپی خودکار ناموفق بود. دستی کپی کنید.', 'warn'); return false; }
  }

  /* ---------------------------------- کمکی‌ها -------------------------------- */
  const debounce = (fn, wait = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };
  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));
  const formData = (form) => Object.fromEntries(new FormData(form).entries());
  function serializeForm(form) {
    const out = {};
    for (const [k, v] of new FormData(form).entries()) {
      if (out[k] === undefined) out[k] = v;
      else if (Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    }
    qsa('input[type=checkbox]', form).forEach((c) => { out[c.name] = c.checked; });
    return out;
  }
  const btnLoading = (btn, on = true) => {
    if (!btn) return;
    if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
    else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  };
  const emptyState = (title, desc, iconName = 'link', action = '') =>
    `<div class="empty">${icon(iconName, 46)}<h4>${escapeHtml(title)}</h4><p class="text-sm">${escapeHtml(desc || '')}</p>${action}</div>`;

  const fileKind = (mime = '', name = '') => {
    const m = String(mime);
    if (m.startsWith('image/')) return 'img';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('audio/')) return 'audio';
    if (/zip|rar|7z|tar|gz/.test(m) || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'zip';
    if (/pdf|word|excel|powerpoint|text|document|sheet/.test(m)) return 'doc';
    return '';
  };
  const fileExt = (name = '') => (String(name).split('.').pop() || 'FILE').slice(0, 4);

  /* --------------------------- هدر سایت و منوی موبایل ----------------------- */
  function initSiteHeader() {
    const header = qs('.site-header');
    const onScroll = () => { if (header) header.classList.toggle('scrolled', window.scrollY > 12); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const burger = qs('[data-burger]');
    const menu = qs('[data-mobile-menu]');
    if (burger && menu) {
      burger.addEventListener('click', () => {
        const open = menu.classList.toggle('hide') === false;
        burger.classList.toggle('open', open);
        document.body.classList.toggle('no-scroll', open);
      });
      qsa('a', menu).forEach((a) => a.addEventListener('click', () => {
        menu.classList.add('hide'); burger.classList.remove('open'); document.body.classList.remove('no-scroll');
      }));
    }
    qsa('[data-theme-toggle]').forEach((b) => b.addEventListener('click', toggleTheme));
    qsa('[data-copy]').forEach((el) => el.addEventListener('click', () => copy(el.dataset.copy)));
  }

  /* ------------------------------ سایدبار پنل ------------------------------- */
  function initSidebar() {
    const sidebar = qs('[data-sidebar]');
    const openBtn = qs('[data-sidebar-open]');
    const backdrop = qs('[data-sidebar-backdrop]');
    if (!sidebar) return;
    const close = () => { sidebar.classList.remove('open'); if (backdrop) backdrop.classList.remove('show'); };
    if (openBtn) openBtn.addEventListener('click', () => { sidebar.classList.add('open'); if (backdrop) backdrop.classList.add('show'); });
    if (backdrop) backdrop.addEventListener('click', close);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return close;
  }

  /* --------------------------- منوی کشویی کاربر ---------------------------- */
  function initDropdowns() {
    qsa('[data-dropdown]').forEach((trigger) => {
      const menu = qs(`[data-dropdown-menu="${trigger.dataset.dropdown}"]`);
      if (!menu) return;
      menu.classList.add('hide');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        qsa('[data-dropdown-menu]').forEach((m) => { if (m !== menu) m.classList.add('hide'); });
        menu.classList.toggle('hide');
      });
    });
    document.addEventListener('click', () => qsa('[data-dropdown-menu]').forEach((m) => m.classList.add('hide')));
  }

  /* --------------------------------- لینک فعال ------------------------------ */
  function markActiveNav(path = location.pathname) {
    qsa('.nav-links a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href === path || (href !== '/' && path.startsWith(href))) a.classList.add('active');
    });
  }

  /* ------------------------------ بارگذاری تنظیمات ------------------------- */
  let siteConfig = null;
  async function loadSiteConfig(force = false) {
    if (siteConfig && !force) return siteConfig;
    try { siteConfig = await api('/api/public/config'); } catch { if (!siteConfig) siteConfig = { site: {} }; }
    return siteConfig;
  }
  function showAnnouncement(cfg) {
    const host = qs('[data-announcement]');
    if (!host || !cfg?.site?.announcement) return;
    host.innerHTML = `<div class="announce ${cfg.site.announcement_level || 'info'}">${icon('bell', 18)}<div>${escapeHtml(cfg.site.announcement)}</div></div>`;
  }

  /* ------------------------------- اسکلت جدول ----------------------------- */
  const tableSkeleton = (rows = 5, cols = 4) => Array.from({ length: rows }).map(() =>
    `<tr>${Array.from({ length: cols }).map(() => '<td><div class="skeleton" style="height:16px"></div></td>').join('')}</tr>`).join('');

  /* -------------------------------- صفحه‌بندی ------------------------------ */
  function renderPagination(host, { page, pages, total, onGo }) {
    if (!host) return;
    if (!total || pages <= 1) { host.innerHTML = total ? `<span class="text-xs text-dim">${fa(total)} مورد</span>` : ''; return; }
    const btn = (label, p, opts = {}) => `<button ${opts.disabled ? 'disabled' : ''} class="${opts.active ? 'active' : ''}" data-page="${p}">${label}</button>`;
    const list = [];
    list.push(btn('قبلی', page - 1, { disabled: page <= 1 }));
    const from = Math.max(1, page - 2), to = Math.min(pages, from + 4);
    for (let p = from; p <= to; p++) list.push(btn(fa(p), p, { active: p === page }));
    list.push(btn('بعدی', page + 1, { disabled: page >= pages }));
    host.innerHTML = list.join('');
    qsa('button[data-page]', host).forEach((b) => b.addEventListener('click', () => onGo(Number(b.dataset.page))));
  }

  /* --------------------------------- صدور CSV ------------------------------ */
  function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob(['\uFEFF' + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* --------------------------------- فایل‌ها -------------------------------- */
  const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16'];
  const colorFor = (str = '') => AVATAR_COLORS[[...String(str)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const initials = (name = '?') => String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '؟';
  const avatarHtml = (user, size = 40, round = false) => {
    const cls = `avatar${size <= 34 ? ' avatar-sm' : ''}${round ? ' avatar-round' : ''}`;
    const style = `width:${size}px;height:${size}px;background:${colorFor(user?.username || 'x')}`;
    if (user?.avatar) return `<img class="${cls}" style="${style}" src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.display_name || user.username || '')}">`;
    return `<div class="${cls}" style="${style}">${escapeHtml(initials(user?.display_name || user?.username || '?'))}</div>`;
  };

  /* ------------------------------- شروع خودکار ----------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSiteHeader();
    initSidebar();
    initDropdowns();
    markActiveNav();
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size || 18)); });
    if (!document.getElementById('toasts')) { const d = document.createElement('div'); d.id = 'toasts'; document.body.appendChild(d); }
  });

  /* --------------------------------- صادرات -------------------------------- */
  window.LK = {
    icon, ICONS, fa, faShort, shortNum, bytes, jalali, timeAgo, localInput, escapeHtml, copy, toast,
    api, modal, confirmDialog, debounce, qs, qsa, formData, serializeForm, btnLoading, emptyState,
    fileKind, fileExt, initSiteHeader, initSidebar, initDropdowns, markActiveNav, loadSiteConfig,
    showAnnouncement, tableSkeleton, renderPagination, downloadFile, avatarHtml, colorFor, initials, toggleTheme, applyTheme,
  };
})();
