/* ==========================================================================
   Linkok — ویرایشگر بیو لینک (تب بیو در داشبورد)
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LK;
  const { qs, qsa, api, toast, fa, icon, escapeHtml, copy, modal, confirmDialog, btnLoading, emptyState, debounce, jalali } = L;

  const DEFAULT_THEME = {
    layout: 'classic', bgType: 'gradient', bgFrom: '#6366f1', bgTo: '#a855f7', bgAngle: 160, bgImage: '',
    textColor: '#ffffff', buttonBg: '#ffffff', buttonText: '#312e81', buttonStyle: 'rounded',
    buttonStyleType: 'solid', buttonShadow: true, font: 'vazirmatn', avatarShape: 'circle',
    showViews: true, buttonOpacity: 92, subtitleColor: '', socialStyle: 'circle',
    buttonLayout: 'full', headerAlign: 'center', pageWidth: 620, animation: 'fade', showBranding: true,
  };
  const SOCIAL_KINDS = ['instagram', 'telegram', 'whatsapp', 'twitter', 'youtube', 'linkedin', 'github', 'aparat', 'spotify', 'email', 'phone'];

  const state = { page: null, blocks: [], stats: null, icons: [], kinds: [], publicUrl: '', theme: { ...DEFAULT_THEME }, tab: 'profile', dirty: false };

  /* ------------------------------------------------------------------ */
  async function load() {
    const root = qs('[data-bio-root]');
    if (root.dataset.loaded === '1') { renderPreview(); return; }
    root.innerHTML = `<div class="card"><div class="skeleton" style="height:120px"></div></div>`;
    try {
      const res = await api('/api/bio');
      state.page = res.page;
      state.blocks = res.blocks || [];
      state.stats = res.stats || { series: [] };
      state.icons = res.icons || [];
      state.kinds = res.kinds || [];
      state.publicUrl = res.public_url;
      state.theme = { ...DEFAULT_THEME, ...(res.page.theme || {}) };
      root.dataset.loaded = '1';
      render();
    } catch (err) {
      root.innerHTML = `<div class="card">${emptyState('خطا در بارگذاری بیو لینک', err.message, 'alert')}</div>`;
    }
  }

  function render() {
    const root = qs('[data-bio-root]');
    root.innerHTML = `
      <div class="card mb-3">
        <div class="row-between">
          <div class="flex wrap" style="gap:12px">
            <span class="logo-mark" style="background:var(--brand-grad)">${icon('bio', 19)}</span>
            <div>
              <b>صفحه بیو لینک شما</b>
              <div class="copy-cell"><span class="mono text-xs truncate">${escapeHtml(state.publicUrl)}</span>
                <button class="btn btn-ghost btn-icon btn-icon-sm" data-copy="${escapeHtml(state.publicUrl)}">${icon('copy', 14)}</button></div>
            </div>
          </div>
          <div class="flex wrap" style="gap:8px">
            <span class="badge ${state.page.published ? 'badge-ok' : 'badge-warn'}">${state.page.published ? 'منتشر شده' : 'پیش‌نویس'}</span>
            <button class="btn btn-outline btn-sm" data-publish>${icon(state.page.published ? 'pause' : 'play', 15)} ${state.page.published ? 'لغو انتشار' : 'انتشار صفحه'}</button>
            <a class="btn btn-outline btn-sm" href="/u/${escapeHtml(state.page.slug)}" target="_blank" rel="noopener">${icon('external', 15)} مشاهده صفحه</a>
            <button class="btn btn-primary btn-sm" data-save-all>${icon('save', 15)} ذخیره همه تغییرات</button>
          </div>
        </div>
      </div>

      <div class="bio-editor">
        <div>
          <div class="tabs">
            <button class="tab ${state.tab === 'profile' ? 'active' : ''}" data-biotab="profile">${icon('users', 15)} مشخصات</button>
            <button class="tab ${state.tab === 'theme' ? 'active' : ''}" data-biotab="theme">${icon('palette', 15)} ظاهر و رنگ‌ها</button>
            <button class="tab ${state.tab === 'blocks' ? 'active' : ''}" data-biotab="blocks">${icon('layers', 15)} بلوک‌ها (${fa(state.blocks.length)})</button>
            <button class="tab ${state.tab === 'stats' ? 'active' : ''}" data-biotab="stats">${icon('chart', 15)} آمار صفحه</button>
          </div>
          <div data-biosection></div>
        </div>
        <div>
          <div class="phone-frame">
            <div class="phone-screen" data-preview>
              <div class="phone-notch"></div>
            </div>
          </div>
          <p class="text-xs text-dim text-center mt-2">پیش‌نمایش زنده — تغییرات بلافاصله اینجا دیده می‌شود</p>
        </div>
      </div>`;
    renderSection();
    renderPreview();
    bind();
  }

  function renderSection() {
    const host = qs('[data-biosection]');
    if (state.tab === 'profile') host.innerHTML = profileSection();
    if (state.tab === 'theme') host.innerHTML = themeSection();
    if (state.tab === 'blocks') host.innerHTML = blocksSection();
    if (state.tab === 'stats') host.innerHTML = statsSection();
    bindSection();
    if (state.tab === 'stats') renderStats();
  }

  /* ------------------------------- بخش مشخصات ------------------------------ */
  function profileSection() {
    const p = state.page;
    return `<div class="card">
      <div class="grid g-2" style="gap:16px">
        <label class="field"><span class="label">عنوان صفحه (نام شما)</span>
          <input class="input" data-bio="title" maxlength="60" value="${escapeHtml(p.title || '')}" placeholder="مثلاً: رضا محمدی"></label>
        <label class="field"><span class="label">نشانی صفحه</span>
          <div class="input-group">
            <input class="input mono" data-bio="slug" dir="ltr" value="${escapeHtml(p.slug)}" placeholder="my-page">
            <span class="btn btn-outline" style="pointer-events:none">/u/</span>
          </div>
          <span class="hint">حروف انگلیسی، عدد و خط تیره — این آدرس پایانی صفحه شماست.</span></label>
      </div>
      <label class="field"><span class="label">شعار / عنوان فرعی</span>
        <input class="input" data-bio="headline" maxlength="120" value="${escapeHtml(p.headline || '')}" placeholder="مثلاً: تولیدکننده محتوا و مدرس آنلاین"></label>
      <label class="field"><span class="label">درباره من</span>
        <textarea class="textarea" data-bio="bio" maxlength="500" placeholder="چند خط درباره خودت بنویس...">${escapeHtml(p.bio || '')}</textarea></label>
      <div class="field">
        <span class="label">تصویر پروفایل</span>
        <div class="flex wrap" style="gap:12px">
          <div data-avatar-preview></div>
          <div>
            <input type="file" class="input" accept="image/*" data-avatar-file style="max-width:280px">
            <span class="hint">حداکثر ۴ مگابایت (PNG/JPG/WEBP)</span>
          </div>
          <button class="btn btn-ghost btn-sm" data-avatar-clear>${icon('x', 15)} حذف تصویر</button>
        </div>
      </div>
      <div class="flex wrap" style="gap:12px">
        <button class="btn btn-primary" data-save-all>${icon('save', 16)} ذخیره مشخصات</button>
        <span class="text-xs text-dim" data-dirty-hint></span>
      </div>
    </div>`;
  }

  /* -------------------------------- بخش ظاهر ------------------------------- */
  function themeSection() {
    const t = state.theme;
    const colorField = (key, label) => `<label class="field mb-0"><span class="label">${label}</span>
      <div class="flex" style="gap:8px"><input type="color" data-theme-key="${key}" value="${t[key] || '#6366f1'}">
      <input class="input mono" data-theme-text="${key}" dir="ltr" value="${escapeHtml(t[key] || '')}" style="font-size:.8rem"></div></label>`;
    const preset = (from, to, name) => `<button class="btn btn-outline btn-sm" data-preset="${from},${to}">
      <span style="width:16px;height:16px;border-radius:5px;background:linear-gradient(135deg,${from},${to});display:inline-block"></span> ${name}</button>`;
    return `<div class="card mb-3">
      <div class="card-head"><h3 class="card-title">${icon('palette', 18)} قالب‌های آماده رنگ</h3></div>
      <div class="flex wrap" style="gap:8px">
        ${preset('#6366f1', '#a855f7', 'بنفش کهکشانی')}
        ${preset('#0ea5e9', '#22d3ee', 'آبی اقیانوس')}
        ${preset('#f43f5e', '#fb923c', 'غروب گرم')}
        ${preset('#10b981', '#84cc16', 'جنگل')}
        ${preset('#1e293b', '#0f172a', 'شب آرام')}
        ${preset('#f472b6', '#c084fc', 'پاستل')}
        ${preset('#f59e0b', '#ef4444', 'آتشین')}
        ${preset('#14b8a6', '#0ea5e9', 'فیروزه‌ای')}
      </div>
    </div>
    <div class="card mb-3">
      <div class="card-head"><h3 class="card-title">${icon('image', 18)} پس‌زمینه</h3></div>
      <div class="grid g-2" style="gap:14px">
        <label class="field mb-0"><span class="label">نوع پس‌زمینه</span>
          <select class="select" data-theme-key="bgType">
            ${[['gradient', 'گرادیان رنگی'], ['solid', 'رنگ ثابت'], ['image', 'تصویر'], ['mesh', 'مش چندرنگ']]
              .map(([v, l]) => `<option value="${v}" ${t.bgType === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        <label class="field mb-0"><span class="label">زاویه گرادیان: <b data-angle-label>${fa(t.bgAngle)}</b>°</span>
          <input type="range" min="0" max="360" data-theme-key="bgAngle" value="${t.bgAngle}"></label>
        ${colorField('bgFrom', 'رنگ اصلی / شروع')}
        ${colorField('bgTo', 'رنگ دوم / پایان')}
      </div>
      <div class="field mt-2"><span class="label">تصویر پس‌زمینه (آدرس یا آپلود)</span>
        <div class="flex wrap" style="gap:8px">
          <input class="input mono" data-theme-key="bgImage" dir="ltr" value="${escapeHtml(t.bgImage || '')}" placeholder="https://..." style="flex:1;min-width:220px">
          <label class="btn btn-outline" style="cursor:pointer">${icon('upload', 15)} آپلود تصویر
            <input type="file" class="hide" accept="image/*" data-bg-file></label>
        </div></div>
    </div>
    <div class="card mb-3">
      <div class="card-head"><h3 class="card-title">${icon('text', 18)} متن و دکمه‌ها</h3></div>
      <div class="grid g-2" style="gap:14px">
        ${colorField('textColor', 'رنگ متن')}
        ${colorField('subtitleColor', 'رنگ متن فرعی (اختیاری)')}
        ${colorField('buttonBg', 'رنگ دکمه')}
        ${colorField('buttonText', 'رنگ متن دکمه')}
        <label class="field mb-0"><span class="label">شکل دکمه‌ها</span>
          <select class="select" data-theme-key="buttonStyle">
            ${[['rounded', 'گرد (۱۶px)'], ['pill', 'کپسولی'], ['soft', 'خیلی گرد'], ['square', 'گوشه‌تیز']]
              .map(([v, l]) => `<option value="${v}" ${t.buttonStyle === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        <label class="field mb-0"><span class="label">سبک دکمه‌ها</span>
          <select class="select" data-theme-key="buttonStyleType">
            ${[['solid', 'توپر'], ['outline', 'دور خطی'], ['glass', 'شیشه‌ای']]
              .map(([v, l]) => `<option value="${v}" ${t.buttonStyleType === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        <label class="field mb-0"><span class="label">فونت</span>
          <select class="select" data-theme-key="font">
            ${[['vazirmatn', 'وزیرمتن (پیشنهادی)'], ['system', 'فونت سیستم'], ['serif', 'سریف'], ['mono', 'مونو']]
              .map(([v, l]) => `<option value="${v}" ${t.font === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        <label class="field mb-0"><span class="label">شکل تصویر پروفایل</span>
          <select class="select" data-theme-key="avatarShape">
            ${[['circle', 'دایره'], ['rounded', 'گرد گوشه'], ['square', 'مربع']]
              .map(([v, l]) => `<option value="${v}" ${t.avatarShape === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        <label class="field mb-0"><span class="label">چیدمان دکمه‌های شبکه اجتماعی</span>
          <select class="select" data-theme-key="socialStyle">
            ${[['circle', 'شبکه‌ای (کارت‌های مربع)'], ['row', 'ردیفی (کپسولی)']]
              .map(([v, l]) => `<option value="${v}" ${t.socialStyle === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        <label class="field mb-0"><span class="label">چینش سربرگ</span>
          <select class="select" data-theme-key="headerAlign">
            ${[['center', 'وسط‌چین'], ['right', 'راست‌چین']]
              .map(([v, l]) => `<option value="${v}" ${t.headerAlign === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
        <label class="field mb-0"><span class="label">عرض صفحه: <b data-width-label>${fa(t.pageWidth)}</b> پیکسل</span>
          <input type="range" min="420" max="860" step="20" data-theme-key="pageWidth" value="${t.pageWidth}"></label>
        <label class="field mb-0"><span class="label">شفافیت دکمه‌ها: <b data-opacity-label>${fa(t.buttonOpacity)}</b>٪</span>
          <input type="range" min="40" max="100" data-theme-key="buttonOpacity" value="${t.buttonOpacity}"></label>
      </div>
      <div class="flex wrap mt-3" style="gap:18px">
        <label class="checkbox"><input type="checkbox" data-theme-check="buttonShadow" ${t.buttonShadow ? 'checked' : ''}> سایه دکمه‌ها</label>
        <label class="checkbox"><input type="checkbox" data-theme-check="showViews" ${t.showViews ? 'checked' : ''}> نمایش تعداد بازدید</label>
        <label class="checkbox"><input type="checkbox" data-theme-check="showBranding" ${t.showBranding !== false ? 'checked' : ''}> نمایش «ساخته شده با لینکوک»</label>
      </div>
      <button class="btn btn-primary mt-3" data-save-all>${icon('save', 16)} ذخیره ظاهر صفحه</button>
    </div>`;
  }

  /* ------------------------------- بخش بلوک‌ها ------------------------------ */
  function blocksSection() {
    const social = state.blocks.filter((b) => b.kind === 'social' || SOCIAL_KINDS.includes(b.kind));
    const main = state.blocks.filter((b) => !social.includes(b));
    const renderItem = (b) => `
      <div class="block-item" draggable="true" data-block="${b.id}">
        <span class="handle">${icon('menu', 16)}</span>
        <span class="file-icon-box" style="width:38px;height:38px;border-radius:12px">${icon(b.icon || (b.kind === 'text' ? 'text' : 'link'), 16)}</span>
        <div class="block-label">
          <b>${escapeHtml(b.label || '—')}</b>
          <span>${escapeHtml(b.url || (b.kind === 'text' ? 'متن ساده' : ''))}</span>
        </div>
        <span class="badge ${b.is_active ? 'badge-ok' : 'badge-warn'}">${b.is_active ? 'فعال' : 'غیرفعال'}</span>
        <span class="text-xs text-dim nowrap">${icon('chart', 13)} ${fa(b.clicks || 0)}</span>
        <div class="flex" style="gap:4px">
          <button class="btn btn-ghost btn-icon btn-icon-sm" data-block-toggle="${b.id}" title="فعال/غیرفعال">${icon(b.is_active ? 'pause' : 'play', 14)}</button>
          <button class="btn btn-ghost btn-icon btn-icon-sm" data-block-edit="${b.id}" title="ویرایش">${icon('edit', 14)}</button>
          <button class="btn btn-ghost btn-icon btn-icon-sm" data-block-delete="${b.id}" title="حذف" style="color:var(--danger)">${icon('trash', 14)}</button>
        </div>
      </div>`;
    return `<div class="card mb-3">
      <div class="row-between mb-2">
        <div><h3 class="card-title">${icon('layers', 18)} بلوک‌های صفحه</h3>
          <p class="card-sub">با درگ و دراپ ترتیب را تغییر دهید. بلوک‌های شبکه اجتماعی در بخش آیکن‌ها نمایش داده می‌شوند.</p></div>
        <div class="flex wrap" style="gap:8px">
          <button class="btn btn-outline btn-sm" data-block-add="social">${icon('instagram', 15)} افزودن شبکه اجتماعی</button>
          <button class="btn btn-primary btn-sm" data-block-add="link">${icon('plus', 15)} افزودن بلوک</button>
        </div>
      </div>
      <h4 class="text-sm text-dim mt-2">بلوک‌های اصلی (${fa(main.length)})</h4>
      <div class="flex-col" data-block-list style="gap:8px">${main.length ? main.map(renderItem).join('') : '<p class="text-dim text-sm">هنوز بلوکی ندارید؛ با دکمه «افزودن بلوک» شروع کنید.</p>'}</div>
      ${social.length ? `<h4 class="text-sm text-dim mt-4">شبکه‌های اجتماعی (${fa(social.length)})</h4>
        <div class="flex-col" data-block-list style="gap:8px">${social.map(renderItem).join('')}</div>` : ''}
      <p class="hint mt-2">برای ذخیره ترتیب جدید، دکمه «ذخیره همه تغییرات» را بزنید یا یک‌بار بلوک‌ها را جابه‌جا کنید.</p>
    </div>`;
  }

  /* -------------------------------- بخش آمار ------------------------------- */
  function statsSection() {
    return `<div class="card mb-3">
      <div class="grid g-3 mb-3" data-bio-stats></div>
      <div data-bio-chart style="min-height:230px"></div>
      <div class="grid g-2 mt-3">
        <div><h4 class="text-sm">منبع ورود بازدیدکنندگان</h4><div data-bio-ref></div></div>
        <div><h4 class="text-sm">دستگاه‌ها</h4><div data-bio-device></div></div>
      </div>
      <h4 class="text-sm mt-3">کلیک روی بلوک‌ها</h4>
      <div class="table-wrap"><table class="table"><thead><tr><th>بلوک</th><th>نوع</th><th>کلیک</th><th>وضعیت</th></tr></thead><tbody data-bio-blocks-stats></tbody></table></div>
    </div>`;
  }

  async function renderStats() {
    try {
      const res = await api('/api/bio/analytics?days=30');
      qs('[data-bio-stats]').innerHTML = `
        <div class="stat-mini">${icon('eye', 19)}<div><b>${fa(res.total)}</b><span>بازدید کل صفحه</span></div></div>
        <div class="stat-mini">${icon('layers', 19)}<div><b>${fa(state.blocks.length)}</b><span>بلوک فعال</span></div></div>
        <div class="stat-mini">${icon('bolt', 19)}<div><b>${fa(res.blocks.reduce((s, b) => s + (b.clicks || 0), 0))}</b><span>کلیک روی لینک‌ها</span></div></div>`;
      window.Charts.lineChart('[data-bio-chart]', { series: [{ name: 'بازدید', color: '#8b5cf6', data: res.series.map((s) => ({ x: s.day, y: s.value })) }], height: 230 });
      window.Charts.barList('[data-bio-ref]', res.referrer);
      window.Charts.barList('[data-bio-device]', res.device);
      qs('[data-bio-blocks-stats]').innerHTML = res.blocks.length ? res.blocks.map((b) => `
        <tr><td>${escapeHtml(b.label || '—')}</td><td class="text-xs text-dim">${escapeHtml(b.kind)}</td>
        <td><b>${fa(b.clicks || 0)}</b></td><td>${b.is_active ? '<span class="badge badge-ok">فعال</span>' : '<span class="badge badge-warn">غیرفعال</span>'}</td></tr>`).join('')
        : `<tr><td colspan="4" class="text-dim text-center">داده‌ای موجود نیست</td></tr>`;
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ------------------------------ پیش‌نمایش زنده ---------------------------- */
  function renderPreview() {
    const host = qs('[data-preview]');
    if (!host || !state.page) return;
    const t = state.theme;
    const bg = t.bgType === 'gradient' ? `linear-gradient(${Number(t.bgAngle) || 160}deg, ${t.bgFrom}, ${t.bgTo})`
      : t.bgType === 'solid' ? t.bgFrom
        : t.bgType === 'image' && t.bgImage ? `url('${t.bgImage}') center/cover`
          : t.bgType === 'mesh'
            ? `radial-gradient(at 15% 20%, ${t.bgFrom} 0, transparent 55%), radial-gradient(at 85% 15%, ${t.bgTo} 0, transparent 55%), radial-gradient(at 70% 90%, ${t.bgFrom} 0, transparent 60%), ${t.bgTo}`
            : '#0f172a';
    const radius = { rounded: '16px', pill: '999px', soft: '24px', square: '6px' }[t.buttonStyle] || '16px';
    const avatarRadius = { circle: '50%', rounded: '22%', square: '8px' }[t.avatarShape] || '50%';
    const social = state.blocks.filter((b) => b.is_active !== false && (b.kind === 'social' || SOCIAL_KINDS.includes(b.kind)));
    const mains = state.blocks.filter((b) => b.is_active !== false && !social.includes(b));
    const opacity = Math.max(40, Math.min(100, Number(t.buttonOpacity) || 92)) / 100;
    const btnBase = `background:${t.buttonStyleType === 'outline' ? 'transparent' : t.buttonBg};color:${t.buttonText};
      border:1.6px solid ${t.buttonStyleType === 'outline' ? t.buttonText : 'rgba(255,255,255,.2)'};border-radius:${radius};
      opacity:${opacity};${t.buttonShadow ? 'box-shadow:0 10px 26px -14px rgba(2,6,23,.6);' : ''}`;

    host.innerHTML = `
      <div class="preview-scroll">
        <div class="preview-inner" style="background:${bg};color:${t.textColor};max-width:${Number(t.pageWidth) || 620}px;margin:0 auto;text-align:${t.headerAlign || 'center'};font-family:${t.font === 'serif' ? 'Georgia,serif' : t.font === 'mono' ? 'ui-monospace,monospace' : 'inherit'}">
          ${state.page.avatar
            ? `<img class="preview-avatar" src="${escapeHtml(state.page.avatar)}" alt="" style="border-radius:${avatarRadius}">`
            : `<div class="preview-avatar" style="border-radius:${avatarRadius}">${escapeHtml((state.page.title || 'L').charAt(0))}</div>`}
          <h3 style="margin:0 0 4px;color:inherit;font-size:1.1rem">${escapeHtml(state.page.title || 'عنوان صفحه')}</h3>
          ${state.page.headline ? `<p style="opacity:.92;font-size:.82rem;margin-bottom:8px;color:${t.subtitleColor || 'inherit'}">${escapeHtml(state.page.headline)}</p>` : ''}
          ${state.page.bio ? `<p style="font-size:.78rem;opacity:.95;white-space:pre-wrap;margin-bottom:14px">${escapeHtml(state.page.bio)}</p>` : ''}
          ${t.showViews ? `<div style="display:flex;gap:6px;justify-content:center;font-size:.68rem;opacity:.9;margin-bottom:14px">
            <span style="background:rgba(255,255,255,.18);padding:3px 9px;border-radius:99px">${icon('eye', 12)} ${fa((state.page.views || 0))} بازدید</span>
            <span style="background:rgba(255,255,255,.18);padding:3px 9px;border-radius:99px">${icon('layers', 12)} ${fa(state.blocks.length)} لینک</span></div>` : ''}
          ${mains.map((b) => b.kind === 'text'
            ? `<p style="font-size:.78rem;opacity:.95;margin:6px 0">${escapeHtml(b.label)}</p>`
            : b.kind === 'heading'
              ? `<h4 style="color:inherit;font-size:.95rem;margin:8px 0 4px">${escapeHtml(b.label)}</h4>`
              : `<div class="preview-btn" style="justify-content:center;text-align:center;${btnBase}">${icon(b.icon || 'link', 15)} <span style="flex:1;text-align:center">${escapeHtml(b.label)}</span></div>`).join('')}
          ${social.length ? `<div class="preview-social" style="display:${t.socialStyle === 'row' ? 'flex' : 'grid'};grid-template-columns:${t.socialStyle === 'row' ? '' : 'repeat(auto-fit, minmax(38px, 38px))'};justify-content:center;gap:8px;margin-top:14px">
            ${social.map((b) => `<span style="width:38px;height:38px;border-radius:${t.socialStyle === 'row' ? '999px' : '13px'};background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.32);display:flex;align-items:center;justify-content:center">${icon(b.icon || b.kind, 17)}</span>`).join('')}</div>` : ''}
          ${t.showBranding === false ? '' : '<p style="font-size:.62rem;opacity:.75;margin-top:22px">ساخته شده با لینکوک</p>'}
        </div>
      </div>`;
  }

  /* -------------------------------- رویدادها ------------------------------- */
  function bind() {
    qsa('[data-biotab]').forEach((btn) => btn.addEventListener('click', () => {
      state.tab = btn.dataset.biotab;
      qsa('[data-biotab]').forEach((b) => b.classList.toggle('active', b === btn));
      renderSection();
    }));
    qs('[data-publish]')?.addEventListener('click', async () => {
      try {
        const res = await api('/api/bio', { method: 'PATCH', body: { published: !state.page.published } });
        state.page = res.page; state.blocks = res.blocks;
        toast(res.page.published ? 'صفحه منتشر شد ✅' : 'صفحه به حالت پیش‌نویس رفت.', 'ok');
        render();
      } catch (err) { toast(err.message, 'err'); }
    });
    qs('[data-save-all]')?.addEventListener('click', saveAll);
  }

  function bindSection() {
    // مشخصات
    qsa('[data-bio]').forEach((input) => {
      input.addEventListener('input', () => {
        state.page[input.dataset.bio] = input.value;
        markDirty();
        renderPreview();
      });
    });
    renderAvatarPreview();
    qs('[data-avatar-file]')?.addEventListener('change', uploadAvatar);
    qs('[data-avatar-clear]')?.addEventListener('click', () => { state.page.avatar = ''; markDirty(); renderAvatarPreview(); renderPreview(); });

    // ظاهر
    qsa('[data-theme-key]').forEach((input) => {
      const key = input.dataset.themeKey;
      const isRange = input.type === 'range';
      const handler = () => {
        state.theme[key] = isRange ? Number(input.value) : input.value;
        const mirror = qs(`[data-theme-text="${key}"]`);
        if (mirror && mirror !== input) mirror.value = input.value;
        const angle = qs('[data-angle-label]'); if (angle && key === 'bgAngle') angle.textContent = fa(input.value);
        const width = qs('[data-width-label]'); if (width && key === 'pageWidth') width.textContent = fa(input.value);
        const op = qs('[data-opacity-label]'); if (op && key === 'buttonOpacity') op.textContent = fa(input.value);
        markDirty();
        renderPreview();
      };
      input.addEventListener(isRange || input.tagName === 'SELECT' ? 'input' : 'input', handler);
      input.addEventListener('change', handler);
    });
    qsa('[data-theme-text]').forEach((input) => {
      input.addEventListener('input', () => {
        state.theme[input.dataset.themeText] = input.value;
        const color = qs(`[data-theme-key="${input.dataset.themeText}"]`);
        if (color && /^#[0-9a-f]{6}$/i.test(input.value)) color.value = input.value;
        markDirty();
        renderPreview();
      });
    });
    qsa('[data-theme-check]').forEach((input) => input.addEventListener('change', () => {
      state.theme[input.dataset.themeCheck] = input.checked;
      markDirty(); renderPreview();
    }));
    qsa('[data-preset]').forEach((btn) => btn.addEventListener('click', () => {
      const [from, to] = btn.dataset.preset.split(',');
      state.theme.bgFrom = from; state.theme.bgTo = to; state.theme.bgType = 'gradient';
      markDirty(); renderSection(); renderPreview();
    }));
    qs('[data-bg-file]')?.addEventListener('change', (e) => uploadImage(e.target.files[0], (url) => { state.theme.bgImage = url; state.theme.bgType = 'image'; markDirty(); renderSection(); renderPreview(); }));

    // بلوک‌ها
    qsa('[data-block-add]').forEach((btn) => btn.addEventListener('click', () => openBlockModal(null, btn.dataset.blockAdd)));
    qsa('[data-block-edit]').forEach((btn) => btn.addEventListener('click', () => openBlockModal(state.blocks.find((b) => String(b.id) === btn.dataset.blockEdit))));
    qsa('[data-block-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
      const block = state.blocks.find((b) => String(b.id) === btn.dataset.blockToggle);
      if (!block) return;
      try {
        await api(`/api/bio/blocks/${block.id}`, { method: 'PATCH', body: { is_active: !block.is_active } });
        block.is_active = !block.is_active;
        renderSection(); renderPreview();
      } catch (err) { toast(err.message, 'err'); }
    }));
    qsa('[data-block-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      const block = state.blocks.find((b) => String(b.id) === btn.dataset.blockDelete);
      if (!block) return;
      const yes = await confirmDialog({ title: 'حذف بلوک', message: `بلوک «${block.label}» حذف شود؟` });
      if (!yes) return;
      try {
        await api(`/api/bio/blocks/${block.id}`, { method: 'DELETE' });
        state.blocks = state.blocks.filter((b) => b.id !== block.id);
        toast('بلوک حذف شد.', 'ok'); renderSection(); renderPreview();
      } catch (err) { toast(err.message, 'err'); }
    }));
    initDragSort();
  }

  function renderAvatarPreview() {
    const host = qs('[data-avatar-preview]');
    if (!host) return;
    host.innerHTML = state.page.avatar
      ? `<img src="${escapeHtml(state.page.avatar)}" style="width:64px;height:64px;border-radius:${state.theme.avatarShape === 'circle' ? '50%' : '18px'};object-fit:cover;border:2px solid var(--border)">`
      : `<div class="avatar avatar-lg" style="background:var(--brand-grad);color:#fff">${escapeHtml((state.page.title || 'L').charAt(0))}</div>`;
  }

  function initDragSort() {
    let dragged = null;
    qsa('.block-item').forEach((item) => {
      item.addEventListener('dragstart', () => { dragged = item; item.classList.add('dragging'); });
      item.addEventListener('dragend', async () => {
        item.classList.remove('dragging');
        if (!dragged) return;
        const ids = qsa('[data-block-list] .block-item').map((el) => Number(el.dataset.block));
        const socialIds = state.blocks.filter((b) => b.kind === 'social' || SOCIAL_KINDS.includes(b.kind)).map((b) => b.id);
        const ordered = ids.filter((id) => !socialIds.includes(id)).concat(socialIds);
        try {
          await api('/api/bio/blocks/reorder', { method: 'PATCH', body: { order: ordered } });
          const map = new Map(state.blocks.map((b) => [b.id, b]));
          state.blocks = ordered.map((id) => map.get(id)).filter(Boolean);
          toast('ترتیب بلوک‌ها ذخیره شد.', 'ok');
          renderPreview();
        } catch (err) { toast(err.message, 'err'); }
        dragged = null;
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragged || dragged === item) return;
        const list = item.parentElement;
        const items = Array.from(list.children).filter((el) => el !== dragged);
        const after = items.find((el) => {
          const rect = el.getBoundingClientRect();
          return e.clientY < rect.top + rect.height / 2;
        });
        if (after) list.insertBefore(dragged, after); else list.appendChild(dragged);
      });
    });
  }

  function openBlockModal(block = null, presetKind = 'link') {
    const icons = state.icons.length ? state.icons : ['link', 'globe', 'instagram', 'telegram', 'whatsapp', 'twitter', 'youtube', 'linkedin', 'github', 'aparat', 'spotify', 'email', 'phone', 'cart', 'heart', 'star', 'music', 'download', 'calendar', 'location', 'camera', 'book', 'code', 'gift'];
    const kinds = state.kinds.length ? state.kinds : ['link', 'social', 'text', 'heading', 'email', 'phone'];
    const kindNames = { link: 'لینک ساده', social: 'شبکه اجتماعی', text: 'متن', heading: 'عنوان', email: 'ایمیل', phone: 'شماره تماس', youtube: 'یوتیوب', spotify: 'اسپاتیفای', whatsapp: 'واتساپ', telegram: 'تلگرام', instagram: 'اینستاگرام', twitter: 'توییتر', linkedin: 'لینکدین', github: 'گیت‌هاب', aparat: 'آپارات', shop: 'فروشگاه', donate: 'حمایت مالی', custom: 'دلخواه' };
    const kind = block?.kind || presetKind;
    const m = modal({
      title: block ? 'ویرایش بلوک' : 'افزودن بلوک جدید',
      body: `<form data-block-form>
        <div class="grid g-2" style="gap:12px">
          <label class="field"><span class="label">نوع بلوک</span>
            <select class="select" name="kind">${kinds.map((k) => `<option value="${k}" ${kind === k ? 'selected' : ''}>${kindNames[k] || k}</option>`).join('')}</select></label>
          <label class="field"><span class="label">عنوان</span>
            <input class="input" name="label" maxlength="80" value="${escapeHtml(block?.label || '')}" placeholder="مثلاً: کانال تلگرام"></label>
        </div>
        <label class="field"><span class="label">آدرس (برای متن و عنوان لازم نیست)</span>
          <input class="input mono" name="url" dir="ltr" value="${escapeHtml(block?.url || '')}" placeholder="https://..."></label>
        <div class="field"><span class="label">آیکن</span>
          <input type="hidden" name="icon" value="${escapeHtml(block?.icon || 'link')}">
          <div class="icon-picker">${icons.map((ic) => `<button type="button" data-icon-pick="${ic}" class="${(block?.icon || 'link') === ic ? 'active' : ''}">${icon(ic, 18)}</button>`).join('')}</div>
        </div>
        <label class="checkbox"><input type="checkbox" name="is_active" ${block?.is_active !== false ? 'checked' : ''}> بلوک فعال باشد</label>
      </form>`,
      footer: `<button class="btn btn-primary" data-save>${icon('check', 16)} ${block ? 'ذخیره' : 'افزودن بلوک'}</button>
               <button class="btn btn-ghost" data-close>انصراف</button>`,
    });
    let pickedIcon = block?.icon || 'link';
    m.$$('[data-icon-pick]').forEach((btn) => btn.addEventListener('click', () => {
      pickedIcon = btn.dataset.iconPick;
      m.$$('[data-icon-pick]').forEach((b) => b.classList.toggle('active', b === btn));
    }));
    m.$('[data-save]').addEventListener('click', async (e) => {
      const d = L.serializeForm(m.$('[data-block-form]'));
      d.icon = pickedIcon;
      if (!d.label) return toast('عنوان بلوک را وارد کنید.', 'warn');
      if (!['text', 'heading'].includes(d.kind) && !d.url) return toast('آدرس بلوک را وارد کنید.', 'warn');
      btnLoading(e.currentTarget, true);
      try {
        if (block) {
          const res = await api(`/api/bio/blocks/${block.id}`, { method: 'PATCH', body: d });
          Object.assign(block, res.item);
          toast('بلوک ذخیره شد.', 'ok');
        } else {
          const res = await api('/api/bio/blocks', { method: 'POST', body: d });
          state.blocks.push({ ...res.item, is_active: !!res.item.is_active, clicks: 0 });
          toast('بلوک اضافه شد ✅', 'ok');
        }
        m.close(); render(); state.tab = 'blocks';
        qsa('[data-biotab]').forEach((b) => b.classList.toggle('active', b.dataset.biotab === 'blocks'));
        renderSection();
      } catch (err) { toast(err.message, 'err'); btnLoading(e.currentTarget, false); }
    });
  }

  async function uploadImage(file, cb) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast('حجم تصویر بیش از ۴ مگابایت است.', 'err');
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/bio/upload', { method: 'POST', body: fd, credentials: 'same-origin' }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || 'آپلود ناموفق بود');
      toast('تصویر آپلود شد ✅', 'ok');
      cb(res.url);
    } catch (err) { toast(err.message, 'err'); }
  }

  function uploadAvatar(e) {
    uploadImage(e.target.files[0], (url) => { state.page.avatar = url; markDirty(); renderAvatarPreview(); renderPreview(); });
  }

  function markDirty() {
    state.dirty = true;
    const hint = qs('[data-dirty-hint]');
    if (hint) hint.textContent = 'تغییرات ذخیره‌نشده دارید…';
    clearTimeout(markDirty.t);
    markDirty.t = setTimeout(saveAll, 2500);
  }

  async function saveAll() {
    if (!state.page) return;
    try {
      const res = await api('/api/bio', {
        method: 'PATCH',
        body: {
          title: state.page.title, headline: state.page.headline, bio: state.page.bio,
          slug: state.page.slug, avatar: state.page.avatar || '', theme: state.theme,
        },
      });
      state.page = res.page; state.blocks = res.blocks; state.theme = res.page.theme;
      state.dirty = false;
      const hint = qs('[data-dirty-hint]'); if (hint) hint.textContent = 'همه تغییرات ذخیره شد ✅';
      renderPreview();
    } catch (err) {
      if (/نشانی/.test(err.message)) toast(err.message, 'err');
      else toast('ذخیره ناموفق: ' + err.message, 'err');
      const hint = qs('[data-dirty-hint]'); if (hint) hint.textContent = 'خطا در ذخیره‌سازی';
    }
  }

  window.BioTab = { load, state, saveAll };
})();
