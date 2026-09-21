'use strict';
const { escapeHtml: esc, formatBytes } = require('./util');

/* ----------------------------- آیکن‌ها ----------------------------- */
const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
  telegram: '<path d="M21.5 4.5 2.8 11.3c-.9.3-.9 1.5.1 1.8l4.3 1.3 1.6 5c.3.9 1.4 1 1.9.3l2.3-3 4.6 3.4c.8.6 1.9.1 2.1-.9l3-13c.2-1-.8-1.8-1.7-1.4Z"/><path d="M7.2 14.4 19 6.6l-9.4 9.6"/>',
  whatsapp: '<path d="M21 11.6c0 4.3-3.8 7.7-8.4 7.7-1.4 0-2.7-.3-3.8-.8L4 20l1.5-4a7.4 7.4 0 0 1-1.1-4c0-4.2 3.8-7.7 8.4-7.7S21 7.3 21 11.6Z"/><path d="M9 8.6c.6-.4 1.3.1 1.5.6l.5 1.2c.1.3 0 .7-.3.9l-.5.4c.5 1.1 1.4 2 2.6 2.5l.4-.6c.2-.3.6-.4.9-.3l1.2.5c.5.2 1 .9.6 1.5-.4.7-1.2 1.2-2 1-2.1-.4-3.9-2.2-4.4-4.3-.2-.8.3-1.6 1-2Z" fill="currentColor" stroke="none"/>',
  twitter: '<path d="M4 4l7.3 9.2L4.4 20h2.3l5.6-6 4.3 6H20l-7.5-9.6L19.4 4h-2.3l-5.2 5.6L7.7 4H4Z" fill="currentColor" stroke="none"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M11 9.5l4.2 2.5L11 14.5v-5Z" fill="currentColor" stroke="none"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 10v7M7.5 7.2v.1M11.5 17v-4a2 2 0 0 1 4 0v4"/>',
  github: '<circle cx="12" cy="12" r="8.5"/><path d="M9 20v-2.5c-2 .4-2.6-1-2.6-1"/><path d="M15 20v-2.6c1.9-1.6 2-3.6 1.6-5.2-.3-1.3-1.4-2.4-2.7-2.7-1.3-.3-3.2-.3-4.5 0-1.3.3-2.4 1.4-2.7 2.7-.4 1.6-.3 3.6 1.6 5.2V20"/>',
  aparat: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5v-7Z" fill="currentColor" stroke="none"/>',
  spotify: '<circle cx="12" cy="12" r="9"/><path d="M7.5 9.5c3-1 6.5-.7 9 1M8 12.6c2.4-.8 5.2-.6 7.2.8M8.6 15.5c1.8-.6 3.9-.4 5.4.6"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7.5l8 5.5 8-5.5"/>',
  phone: '<path d="M6 3.5h3l1.5 4-2 1.3a12 12 0 0 0 6 6l1.3-2 4 1.5v3A2 2 0 0 1 17.7 20C10.6 19.4 4.6 13.4 4 6.3A2 2 0 0 1 6 3.5Z"/>',
  cart: '<circle cx="9.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/><path d="M3 4h2.2l2.3 10.2h10.8L21 7.5H6.2"/>',
  heart: '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/>',
  star: '<path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 4Z"/>',
  music: '<circle cx="7" cy="18" r="2.5"/><circle cx="18" cy="16" r="2.5"/><path d="M9.5 18V7l11-2v11"/>',
  download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/>',
  location: '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.3"/>',
  camera: '<rect x="3" y="6.5" width="18" height="13" rx="3"/><circle cx="12" cy="13" r="3.4"/><path d="M8.5 6.5l1.2-2h4.6l1.2 2"/>',
  book: '<path d="M5 4.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H5V4.5Z"/><path d="M19 4.5h-4a3 3 0 0 0-3 3"/>',
  code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  gift: '<rect x="3.5" y="8" width="17" height="12" rx="2.5"/><path d="M3.5 12h17M12 8v12M8.5 8a2.5 2.5 0 1 1 3.5-2.3c0 1.6-.6 2.3-1.5 2.3h-2Zm7 0a2.5 2.5 0 1 0-3.5-2.3c0 1.6.6 2.3 1.5 2.3h2Z"/>',
  file: '<path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V3.5Z"/><path d="M14 3.5V8h4"/>',
  eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="3"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/>',
  shield: '<path d="M12 3l7 2.5v6c0 4.4-3 7.9-7 9.5-4-1.6-7-5.1-7-9.5v-6L12 3Z"/><path d="M9 12l2 2 4-4"/>',
};
const icon = (name, size = 20) => {
  const path = ICONS[name] || ICONS.link;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};

const FONT_STACKS = {
  vazirmatn: "'Vazirmatn', system-ui, -apple-system, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif",
  serif: "'Vazirmatn', Georgia, 'Times New Roman', serif",
  mono: "'Vazirmatn', ui-monospace, 'Courier New', monospace",
};

const BASE_CSS = `
@font-face{font-family:'Vazirmatn';src:url('/assets/fonts/Vazirmatn-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Vazirmatn';src:url('/assets/fonts/Vazirmatn-Medium.woff2') format('woff2');font-weight:500;font-display:swap}
@font-face{font-family:'Vazirmatn';src:url('/assets/fonts/Vazirmatn-SemiBold.woff2') format('woff2');font-weight:600;font-display:swap}
@font-face{font-family:'Vazirmatn';src:url('/assets/fonts/Vazirmatn-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
@font-face{font-family:'Vazirmatn';src:url('/assets/fonts/Vazirmatn-ExtraBold.woff2') format('woff2');font-weight:800;font-display:swap}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Vazirmatn',system-ui,sans-serif;min-height:100vh;line-height:1.75;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:52px;padding:.8rem 1.2rem;font:inherit;font-weight:600;cursor:pointer;border:0;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;text-align:center}
.btn:hover{transform:translateY(-2px)}
.btn:active{transform:translateY(0)}
.wrap{width:100%;max-width:var(--page-width,620px);margin:0 auto;padding:32px 18px 48px}
`;

/* ------------------------------ لایه‌ها ---------------------------- */
function htmlDocument({ title, description, head = '', body, lang = 'fa', dir = 'rtl', bodyClass = '' }) {
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || '')}">
<meta name="theme-color" content="#6366f1">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<style>${BASE_CSS}${head}</style>
</head>
<body class="${bodyClass}">
${body}
</body>
</html>`;
}

/* -------------------------- صفحه بیو لینک -------------------------- */
function bioHtml({ page, blocks, theme, views, siteName, customDomain }) {
  const t = theme || {};
  const bgLayers = [];
  if (t.bgType === 'gradient') bgLayers.push(`linear-gradient(${Number(t.bgAngle) || 160}deg, ${t.bgFrom || '#6366f1'}, ${t.bgTo || '#a855f7'})`);
  else if (t.bgType === 'solid') bgLayers.push(t.bgFrom || '#6366f1');
  else if (t.bgType === 'image' && t.bgImage) bgLayers.push(`url('${esc(t.bgImage)}')`);
  else if (t.bgType === 'mesh') bgLayers.push(`radial-gradient(at 12% 18%, ${t.bgFrom} 0px, transparent 55%), radial-gradient(at 84% 12%, ${t.bgTo} 0px, transparent 55%), radial-gradient(at 70% 88%, ${t.bgFrom} 0px, transparent 60%), ${t.bgTo}`);
  else bgLayers.push('#0f172a');
  const bgCss = bgLayers.join(', ');

  const radius = { rounded: '16px', pill: '999px', square: '6px', soft: '24px' }[t.buttonStyle] || '16px';
  const avatarRadius = { circle: '50%', rounded: '22%', square: '8px' }[t.avatarShape] || '50%';
  const btnStyleType = t.buttonStyleType || 'solid';
  const buttonBg = t.buttonStyleType === 'outline' ? 'transparent' : t.buttonBg;
  const opacity = Math.max(40, Math.min(100, Number(t.buttonOpacity) || 92)) / 100;

  const btnBase = `background:${buttonBg};color:${t.buttonText || '#1e1b4b'};border:1.6px solid ${btnStyleType === 'outline' ? (t.buttonText || '#fff') : 'rgba(255,255,255,.18)'};border-radius:${radius};opacity:${opacity};`;
  const shadow = t.buttonShadow ? 'box-shadow:0 10px 30px -12px rgba(2,6,23,.5);' : 'box-shadow:none;';

  const socialKinds = ['instagram', 'telegram', 'whatsapp', 'twitter', 'youtube', 'linkedin', 'github', 'aparat', 'spotify', 'email', 'phone'];
  const socials = blocks.filter((b) => b.is_active && (b.kind === 'social' || socialKinds.includes(b.kind)) && b.url);
  const mains = blocks.filter((b) => b.is_active && !socials.includes(b));
  const socialStyle = t.socialStyle === 'row' ? 'flex' : 'grid';
  const socialCols = socialStyle === 'grid' ? 'repeat(auto-fit,minmax(56px,56px))' : '';

  const mainBlocks = mains.map((b, i) => {
    const delay = `style="animation-delay:${(i * 60) % 600}ms"`;
    if (b.kind === 'text') return `<p class="bio-text" ${delay}>${esc(b.label || '')}</p>`;
    if (b.kind === 'heading') return `<h3 class="bio-heading" ${delay}>${esc(b.label || '')}</h3>`;
    const href = b.url || '#';
    return `<a class="btn bio-btn" href="${esc(href)}" target="_blank" rel="noopener nofollow" data-block="${b.id}" ${delay}>
      <span class="bio-btn-icon">${icon(b.icon || (b.kind === 'telegram' ? 'telegram' : b.kind === 'email' ? 'email' : 'link'), 19)}</span>
      <span class="bio-btn-label">${esc(b.label || href)}</span>
    </a>`;
  }).join('');

  const socialButtons = socials.map((b) => `<a class="social-btn" href="${esc(b.url)}" target="_blank" rel="noopener nofollow" title="${esc(b.label || '')}" data-block="${b.id}">${icon(b.icon || b.kind, 21)}</a>`).join('');

  const styles = `
  body{background:${bgCss};background-size:cover;background-position:center;${t.bgType === 'image' ? 'background-attachment:fixed;' : ''}color:${t.textColor || '#fff'};font-family:${FONT_STACKS[t.font] || FONT_STACKS.vazirmatn}}
  body::before{content:'';position:fixed;inset:0;background:linear-gradient(180deg,rgba(2,6,23,.18),rgba(2,6,23,.34));pointer-events:none}
  .wrap{position:relative;z-index:1;max-width:${Number(t.pageWidth) || 620}px;text-align:${t.headerAlign || 'center'}}
  .avatar{width:112px;height:112px;border-radius:${avatarRadius};object-fit:cover;border:3px solid rgba(255,255,255,.65);box-shadow:0 14px 40px -14px rgba(2,6,23,.7);background:rgba(255,255,255,.25);margin:0 auto 16px;display:block}
  .avatar-fallback{width:112px;height:112px;border-radius:${avatarRadius};background:rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:800;margin:0 auto 16px;border:3px solid rgba(255,255,255,.65)}
  .verified{display:inline-flex;align-items:center;gap:4px;font-size:12px;background:rgba(255,255,255,.2);padding:3px 10px;border-radius:999px;margin-bottom:10px;backdrop-filter:blur(6px)}
  h1{font-size:24px;margin:0 0 6px;font-weight:800;letter-spacing:-.3px}
  .headline{font-size:15px;opacity:.92;margin:0 0 12px;color:${t.subtitleColor || 'inherit'}}
  .bio{font-size:14.5px;line-height:1.9;opacity:.95;margin:0 auto 20px;max-width:520px;white-space:pre-wrap}
  .stats{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:18px;font-size:12.5px;opacity:.9}
  .stats span{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);padding:5px 12px;border-radius:999px;display:inline-flex;gap:6px;align-items:center;backdrop-filter:blur(6px)}
  .blocks{display:flex;flex-direction:column;gap:12px;margin-top:6px}
  .bio-btn{width:100%;${btnBase}${shadow}animation:bioIn .5s ease both}
  .bio-btn:hover{filter:brightness(1.05);transform:translateY(-3px) scale(1.01)}
  .bio-btn-icon{display:inline-flex}
  .bio-btn-label{flex:1;text-align:center}
  .bio-text{margin:4px 0;font-size:14px;opacity:.95;animation:bioIn .5s ease both}
  .bio-heading{margin:10px 0 2px;font-size:17px;font-weight:700;animation:bioIn .5s ease both}
  .socials{display:${socialStyle};grid-template-columns:${socialCols};gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap}
  .social-btn{width:48px;height:48px;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);color:${t.textColor || '#fff'};border-radius:${socialStyle === 'row' ? '999px' : '16px'};backdrop-filter:blur(8px);transition:.2s}
  .social-btn:hover{background:rgba(255,255,255,.34);transform:translateY(-3px) rotate(-4deg)}
  .footer{margin-top:34px;font-size:12px;opacity:.8;text-align:center}
  .footer a{font-weight:700;border-bottom:1px dashed currentColor}
  @keyframes bioIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  @media (max-width:480px){.avatar,.avatar-fallback{width:92px;height:92px}h1{font-size:21px}.wrap{padding:26px 14px 40px}}
  `;

  const initial = esc(String(page.title || 'L').trim().charAt(0) || 'L');
  const avatar = page.avatar
    ? `<img class="avatar" src="${esc(page.avatar)}" alt="${esc(page.title || '')}" loading="lazy">`
    : `<div class="avatar-fallback">${initial}</div>`;

  const body = `<div class="wrap">
  <img src="/assets/img/logo.svg" alt="logo" style="display:none">
  ${avatar}
  ${customDomain ? `<div class="verified">${icon('shield', 13)} دامنه اختصاصی</div>` : ''}
  <h1>${esc(page.title || '')}</h1>
  ${page.headline ? `<p class="headline">${esc(page.headline)}</p>` : ''}
  ${page.bio ? `<div class="bio">${esc(page.bio)}</div>` : ''}
  ${theme.showViews ? `<div class="stats"><span>${icon('eye', 13)} ${Number(views || 0).toLocaleString('fa-IR')} بازدید</span><span>${icon('spark', 13)} ${Number(blocks.length).toLocaleString('fa-IR')} لینک</span></div>` : ''}
  <div class="blocks">${mainBlocks}</div>
  ${socialButtons ? `<div class="socials">${socialButtons}</div>` : ''}
  ${theme.showBranding === false ? '' : `<div class="footer">ساخته شده با <a href="${esc(originSafe(siteName))}" target="_blank" rel="noopener">${esc(siteName || 'لینکوک')}</a> · کوتاه‌کننده لینک و بیو لینک</div>`}
</div>`;

  return htmlDocument({
    title: page.title ? `${page.title}${page.headline ? ' | ' + page.headline : ''}` : (siteName || 'لینکوک'),
    description: page.bio || page.headline || '',
    head: styles,
    body,
    bodyClass: 'bio-page',
  });
}
const originSafe = (v) => (typeof v === 'string' && v.startsWith('http') ? v : '/');

/* --------------------------- صفحه فایل ----------------------------- */
function fileHtml({ file, owner, siteName, links }) {
  const isImage = /^image\//.test(file.mime || '');
  const isVideo = /^video\//.test(file.mime || '');
  const isAudio = /^audio\//.test(file.mime || '');
  const preview = isImage
    ? `<img src="/f/${esc(file.code)}/download" alt="${esc(file.orig_name)}" class="preview">`
    : isVideo ? `<video src="/f/${esc(file.code)}/download" controls playsinline class="preview"></video>`
      : isAudio ? `<audio src="/f/${esc(file.code)}/download" controls style="width:100%"></audio>` : '';
  const styles = `
  body{background:radial-gradient(1200px 600px at 50% -10%,#4338ca 0%,#1e1b4b 45%,#0b1020 100%);color:#f8fafc;font-family:'Vazirmatn',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:100%;max-width:600px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.22);border-radius:26px;padding:26px;backdrop-filter:blur(14px);box-shadow:0 30px 80px -30px rgba(0,0,0,.8);animation:up .5s ease both}
  @keyframes up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  .head{display:flex;gap:16px;align-items:center;margin-bottom:20px}
  .file-icon{width:62px;height:62px;border-radius:18px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 12px 30px -14px #6366f1}
  h1{font-size:18px;margin:0 0 4px;word-break:break-all;font-weight:700}
  .meta{font-size:13px;color:#94a3b8;display:flex;gap:10px;flex-wrap:wrap}
  .preview{width:100%;border-radius:18px;margin-bottom:18px;max-height:380px;object-fit:contain;background:rgba(2,6,23,.5)}
  .btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:16px;width:100%;font-size:16px;box-shadow:0 16px 40px -18px #6366f1}
  .btn.ghost{background:rgba(148,163,184,.14);border:1px solid rgba(148,163,184,.3);box-shadow:none}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  .row .btn{flex:1;min-width:150px}
  .code-box{display:flex;gap:8px;align-items:center;background:rgba(2,6,23,.55);border:1px dashed rgba(148,163,184,.35);border-radius:14px;padding:10px 14px;margin-bottom:16px;font-size:13px;direction:ltr;overflow:auto}
  .footer{margin-top:20px;font-size:12.5px;color:#94a3b8;text-align:center}
  .footer a{color:#a5b4fc;font-weight:700}
  `;
  const body = `<div class="card">
  <div class="head">
    <div class="file-icon">${icon('file', 30)}</div>
    <div style="min-width:0">
      <h1>${esc(file.orig_name || 'فایل')}</h1>
      <div class="meta"><span>${esc(formatBytes(file.size))}</span><span>${esc((file.ext || 'file').toUpperCase())}</span><span>${Number(file.downloads || 0).toLocaleString('fa-IR')} دانلود</span>${owner ? `<span>${esc(owner)}</span>` : ''}</div>
    </div>
  </div>
  ${preview}
  <div class="code-box"><strong>لینک:</strong><span>${esc(file.full_url || '')}</span></div>
  <div class="row">
    <a class="btn" href="/f/${esc(file.code)}/download">${icon('download', 19)} دانلود فایل</a>
    <a class="btn ghost" href="/dashboard?tab=files">${icon('spark', 18)} ساخت لینک مشابه</a>
  </div>
  <div class="footer">اشتراک‌گذاری امن با <a href="/">${esc(siteName || 'لینکوک')}</a></div>
</div>`;
  return htmlDocument({ title: `${file.orig_name || 'فایل'} | ${siteName || 'لینکوک'}`, description: `دانلود ${file.orig_name}`, head: styles, body, bodyClass: 'file-page' });
}

/* ----------------------- صفحه رمز / پیام‌ها ------------------------ */
function noticeHtml({ title, message, siteName, form = '', cta = '', status = 404 }) {
  const styles = `
  body{background:radial-gradient(900px 500px at 50% -20%,#4f46e5 0%,#1e1b4b 50%,#0b1020 100%);color:#f8fafc;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:100%;max-width:470px;text-align:center;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.22);border-radius:26px;padding:34px 26px;backdrop-filter:blur(14px);box-shadow:0 30px 80px -30px rgba(0,0,0,.8)}
  .icon-wrap{width:76px;height:76px;border-radius:24px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6366f1,#a855f7);box-shadow:0 18px 40px -18px #6366f1}
  h1{font-size:21px;margin:0 0 10px;font-weight:800}
  p{color:#cbd5e1;font-size:14.5px;line-height:1.9;margin:0 0 20px}
  .btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:16px;width:100%;font-size:15.5px}
  input{width:100%;padding:14px 16px;border-radius:14px;border:1px solid rgba(148,163,184,.35);background:rgba(2,6,23,.5);color:#fff;font:inherit;margin-bottom:12px;text-align:center}
  input:focus{outline:2px solid #6366f1;border-color:transparent}
  .err{background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.4);color:#fecaca;padding:10px;border-radius:12px;font-size:13.5px;margin-bottom:14px}
  .footer{margin-top:18px;font-size:12.5px;color:#94a3b8}
  .footer a{color:#a5b4fc;font-weight:700}
  `;
  const body = `<div class="card">
  <div class="icon-wrap">${icon(status === 404 ? 'file' : status === 410 ? 'calendar' : status === 423 ? 'lock' : 'shield', 34)}</div>
  <h1>${esc(title)}</h1>
  <p>${message}</p>
  ${form}
  ${cta || '<a class="btn" href="/" style="display:flex;align-items:center;justify-content:center;min-height:50px;text-decoration:none">بازگشت به صفحه اصلی</a>'}
  <div class="footer"><a href="/">${esc(siteName || 'لینکوک')}</a> · کوتاه‌کننده لینک و بیو لینک حرفه‌ای</div>
</div>`;
  return htmlDocument({ title: `${title} | ${siteName || 'لینکوک'}`, description: title, head: styles, body });
}

module.exports = { ICONS, icon, bioHtml, fileHtml, noticeHtml, htmlDocument, FONT_STACKS, BASE_CSS };
