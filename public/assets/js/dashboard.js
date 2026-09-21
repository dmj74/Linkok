/* ==========================================================================
   Linkok — داشبورد کاربری (لینک‌ها، فایل‌ها، دامنه‌ها، آمار، تنظیمات)
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LK;
  const { qs, qsa, api, toast, fa, shortNum, bytes, jalali, timeAgo, modal, confirmDialog, btnLoading, emptyState,
    icon, escapeHtml, copy, debounce, renderPagination, avatarHtml, fileKind, fileExt, localInput, loadSiteConfig,
    showAnnouncement, downloadFile } = L;

  const state = {
    user: null, usage: {}, limits: {}, site: {}, config: {},
    tab: 'overview', range: 30,
    links: { page: 1, q: '', status: '', sort: 'newest', domain_id: '', items: [], total: 0, pages: 1 },
    files: { page: 1, q: '', items: [], total: 0, pages: 1 },
    domains: [], domainsLoaded: false,
  };

  const TITLES = {
    overview: ['نمای کلی', 'خلاصه وضعیت حساب شما'],
    links: ['لینک‌های من', 'ساخت، ویرایش و تحلیل لینک‌های کوتاه'],
    files: ['فایل‌های من', 'آپلود فایل و ساخت لینک دانلود'],
    domains: ['دامنه‌های اختصاصی', 'اتصال دامنه شخصی برای لینک‌های برندشده'],
    bio: ['بیو لینک', 'ساخت و شخصی‌سازی صفحه لینک‌های شما'],
    analytics: ['آمار و تحلیل', 'عملکرد لینک‌ها و بازدیدکنندگان'],
    settings: ['تنظیمات حساب', 'پروفایل، رمز عبور و کلید API'],
  };

  /* ------------------------------- ناوبری ------------------------------- */
  function switchTab(tab, push = true) {
    if (!TITLES[tab]) tab = 'overview';
    state.tab = tab;
    qsa('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    qsa('.side-item[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    qs('[data-page-title]').textContent = TITLES[tab][0];
    qs('[data-page-sub]').textContent = TITLES[tab][1];
    if (push) history.replaceState(null, '', `?tab=${tab}`);
    qs('[data-sidebar]').classList.remove('open');
    const backdrop = qs('[data-sidebar-backdrop]'); if (backdrop) backdrop.classList.remove('show');
    if (tab === 'overview') loadOverview();
    if (tab === 'links') loadLinks();
    if (tab === 'files') loadFiles();
    if (tab === 'domains') loadDomains();
    if (tab === 'bio' && window.BioTab) window.BioTab.load();
    if (tab === 'analytics') loadAnalytics();
    if (tab === 'settings') renderSettings();
  }

  /* ------------------------------- رندر پلن ------------------------------ */
  function renderPlan() {
    const planNames = { free: 'پلن رایگان', pro: 'پلن حرفه‌ای', business: 'پلن کسب‌وکار' };
    qs('[data-plan-name]').textContent = planNames[state.user.plan] || state.user.plan;
    qs('[data-plan-badge]').textContent = state.user.plan;
    const pct = (used, total) => Math.min(100, Math.round((used / Math.max(1, total)) * 100));
    const linksBar = qs('[data-usage="links"]');
    linksBar.style.width = pct(state.usage.links, state.limits.links) + '%';
    linksBar.style.background = pct(state.usage.links, state.limits.links) > 85 ? 'var(--danger)' : 'var(--brand-grad)';
    const filesBar = qs('[data-usage="files"]');
    filesBar.style.width = pct(state.usage.files, state.limits.files) + '%';
    filesBar.style.background = pct(state.usage.files, state.limits.files) > 85 ? 'var(--danger)' : 'var(--brand-grad)';
    qs('[data-count="links"]').textContent = fa(state.usage.links || 0);
    qs('[data-count="files"]').textContent = fa(state.usage.files || 0);
    const av = qs('[data-user-avatar]'); if (av) av.innerHTML = avatarHtml(state.user, 32, true);
    qsa('[data-user-name], [data-user-name-2]').forEach((el) => { el.textContent = state.user.display_name || state.user.username; });
    qsa('[data-user-username]').forEach((el) => { el.textContent = '@' + state.user.username; });
  }

  const STATUS_BADGE = (l) => {
    if (!l.is_active) return '<span class="badge badge-warn">غیرفعال</span>';
    if (l.expired) return '<span class="badge badge-danger">منقضی</span>';
    if (l.limit_reached) return '<span class="badge badge-danger">سقف کلیک</span>';
    if (l.has_password) return '<span class="badge badge-info">رمزدار</span>';
    return '<span class="badge badge-ok">فعال</span>';
  };

  const shortCell = (l) => `
    <div class="copy-cell">
      <button class="btn btn-ghost btn-icon btn-icon-sm" data-copy="${escapeHtml(l.short_url)}" title="کپی لینک">${icon('copy', 15)}</button>
      <a class="mono text-sm" href="${escapeHtml(l.short_url)}" target="_blank" rel="noopener">/${escapeHtml(l.code)}</a>
    </div>
    ${l.domain_host ? `<span class="badge badge-brand" style="margin-top:4px">${escapeHtml(l.domain_host)}</span>` : ''}`;

  /* ==========================================================================
     نمای کلی
     ========================================================================== */
  async function loadOverview() {
    try {
      const me = await api('/api/auth/me');
      state.user = me.user || state.user;
      state.usage = me.usage || {};
      state.limits = me.limits || {};
      renderPlan();
    } catch (err) { if (err.status === 401) return requireLogin(); }

    const res = await api(`/api/links?per_page=200&sort=clicks`);
    const all = res.items || [];
    const totalClicks = all.reduce((s, l) => s + l.clicks, 0);
    const uniqueClicks = all.reduce((s, l) => s + l.unique_clicks, 0);
    const activeCount = all.filter((l) => l.is_active && !l.expired).length;
    const topToday = all.slice(0, 1)[0];

    qs('[data-overview-stats]').innerHTML = `
      <div class="stat"><div class="stat-icon">${icon('link', 21)}</div><div class="stat-value">${fa(res.total)}</div>
        <div class="stat-label">لینک کوتاه</div><div class="stat-foot">${fa(activeCount)} لینک فعال</div></div>
      <div class="stat"><div class="stat-icon">${icon('chart', 21)}</div><div class="stat-value">${shortNum(totalClicks)}</div>
        <div class="stat-label">کل کلیک‌ها</div><div class="stat-foot">${fa(uniqueClicks)} بازدیدکننده یکتا</div></div>
      <div class="stat"><div class="stat-icon">${icon('file', 21)}</div><div class="stat-value">${fa(state.usage.files || 0)}</div>
        <div class="stat-label">فایل‌ها</div><div class="stat-foot">${bytes(state.usage.storage || 0)} فضا</div></div>
      <div class="stat"><div class="stat-icon">${icon('fire', 21)}</div><div class="stat-value">${shortNum(topToday ? topToday.clicks : 0)}</div>
        <div class="stat-label">پربازدیدترین لینک</div><div class="stat-foot truncate">${escapeHtml(topToday ? (topToday.title || topToday.code) : '—')}</div></div>`;

    // نمودار کلیک‌ها
    await loadClicksChart();

    // لینک‌های اخیر
    qs('[data-recent-links]').innerHTML = all.length ? all.slice(0, 6).map((l) => `
      <tr>
        <td>${shortCell(l)}</td>
        <td class="truncate" style="max-width:220px"><a class="text-sm text-dim" href="${escapeHtml(l.target_url)}" target="_blank" rel="noopener">${escapeHtml(l.target_url.slice(0, 46))}</a></td>
        <td><b>${fa(l.clicks)}</b></td>
      </tr>`).join('') : `<tr><td colspan="3">${emptyState('هنوز لینکی نساخته‌اید', 'اولین لینک کوتاه خود را بسازید.', 'link', '<button class="btn btn-primary btn-sm mt-2" data-action="new-link">ساخت لینک</button>')}</td></tr>`;

    // پربازدیدترین
    const top = all.slice(0, 8).map((l) => ({ label: l.title || '/' + l.code, value: l.clicks }));
    window.Charts.barList('[data-top-links]', top);

    // بخش بیو لینک
    try {
      const bio = await api('/api/bio');
      qs('[data-bio-mini]').innerHTML = `
        <div class="flex between mb-2">
          <b class="text-sm">${icon('bio', 16)} بیو لینک من</b>
          <span class="badge ${bio.page.published ? 'badge-ok' : 'badge-warn'}">${bio.page.published ? 'منتشر شده' : 'پیش‌نویس'}</span>
        </div>
        <div class="copy-cell mb-2"><span class="mono text-xs truncate">${escapeHtml(bio.public_url)}</span>
          <button class="btn btn-ghost btn-icon btn-icon-sm" data-copy="${escapeHtml(bio.public_url)}">${icon('copy', 14)}</button></div>
        <div class="flex wrap text-xs text-dim" style="gap:14px">
          <span>${icon('eye', 14)} ${fa(bio.page.views)} بازدید</span>
          <span>${icon('layers', 14)} ${fa(bio.blocks.length)} بلوک</span>
          <span>${icon('bolt', 14)} ${fa(bio.stats.block_clicks)} کلیک روی لینک‌ها</span>
        </div>
        <button class="btn btn-outline btn-sm btn-block mt-2" data-tab="bio">ویرایش صفحه بیو</button>`;
    } catch { qs('[data-bio-mini]').innerHTML = ''; }
    bindDynamic();
  }

  async function loadClicksChart() {
    const res = await api(`/api/links?per_page=200&sort=clicks`);
    const ids = (res.items || []).slice(0, 12).map((l) => l.id);
    const series = await Promise.all(ids.map((id) => api(`/api/links/${id}/stats?days=${state.range}`).then((r) => ({ id, r })).catch(() => null)));
    const days = [];
    for (let i = state.range - 1; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    const totals = days.map((d) => series.reduce((sum, s) => sum + (s?.r?.series.find((x) => x.day === d)?.clicks || 0), 0));
    const uniques = days.map((d) => series.reduce((sum, s) => sum + (s?.r?.series.find((x) => x.day === d)?.uniques || 0), 0));
    window.Charts.lineChart('[data-chart-clicks]', {
      series: [
        { name: 'کلیک‌ها', color: '#6366f1', data: days.map((d, i) => ({ x: d, y: totals[i] })) },
        { name: 'کاربران یکتا', color: '#22d3ee', data: days.map((d, i) => ({ x: d, y: uniques[i] })) },
      ],
      height: 250,
    });
    const sum = totals.reduce((a, b) => a + b, 0);
    qs('[data-clicks-summary]').textContent = `${fa(sum)} کلیک در ${fa(state.range)} روز گذشته`;
  }

  /* ==========================================================================
     لینک‌ها
     ========================================================================== */
  async function loadLinks() {
    const p = state.links;
    const params = new URLSearchParams({ page: p.page, per_page: 20, sort: p.sort });
    if (p.q) params.set('q', p.q);
    if (p.status) params.set('status', p.status);
    if (p.domain_id !== '') params.set('domain_id', p.domain_id);
    const tbody = qs('[data-links-body]');
    tbody.innerHTML = L.tableSkeleton(5, 6);
    try {
      const res = await api('/api/links?' + params.toString());
      p.items = res.items; p.total = res.total; p.pages = res.pages;
      qs('[data-links-summary]').innerHTML = `
        <div class="stat-mini">${icon('link', 20)}<div><b>${fa(res.total)}</b><span>لینک در این فهرست</span></div></div>
        <div class="stat-mini">${icon('chart', 20)}<div><b>${fa(res.summary.clicks)}</b><span>کلیک ثبت شده</span></div></div>
        <div class="stat-mini">${icon('users', 20)}<div><b>${fa(res.summary.uniques)}</b><span>بازدیدکننده یکتا</span></div></div>`;
      tbody.innerHTML = p.items.length ? p.items.map((l) => `
        <tr>
          <td>${shortCell(l)}</td>
          <td class="truncate" style="max-width:240px">
            <a class="text-sm" href="${escapeHtml(l.target_url)}" target="_blank" rel="noopener" title="${escapeHtml(l.target_url)}">${escapeHtml(l.target_url.replace(/^https?:\/\//, '').slice(0, 48))}</a>
          </td>
          <td>
            <div class="text-sm strong truncate" style="max-width:180px">${escapeHtml(l.title || '—')}</div>
            ${(l.tags || []).slice(0, 2).map((t) => `<span class="badge" style="margin-top:3px">${escapeHtml(t)}</span>`).join(' ')}
          </td>
          <td><b>${fa(l.clicks)}</b><div class="text-xs text-dim">${fa(l.unique_clicks)} یکتا</div></td>
          <td>${STATUS_BADGE(l)}${l.expires_at ? `<div class="text-xs text-dim">تا ${jalali(l.expires_at, false)}</div>` : ''}</td>
          <td class="text-xs text-dim nowrap">${timeAgo(l.created_at)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-ghost btn-icon btn-icon-sm" data-link-stats="${l.id}" title="آمار">${icon('chart', 15)}</button>
              <button class="btn btn-ghost btn-icon btn-icon-sm" data-link-qr="${l.id}" title="کد QR">${icon('qr', 15)}</button>
              <button class="btn btn-ghost btn-icon btn-icon-sm" data-link-edit="${l.id}" title="ویرایش">${icon('edit', 15)}</button>
              <button class="btn btn-ghost btn-icon btn-icon-sm" data-link-toggle="${l.id}" title="${l.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}">${icon(l.is_active ? 'pause' : 'play', 15)}</button>
              <button class="btn btn-ghost btn-icon btn-icon-sm" data-link-delete="${l.id}" title="حذف" style="color:var(--danger)">${icon('trash', 15)}</button>
            </div>
          </td>
        </tr>`).join('') : `<tr><td colspan="7">${emptyState('لینکی پیدا نشد', p.q || p.status ? 'فیلترها را تغییر دهید یا جستجو را پاک کنید.' : 'اولین لینک کوتاه خود را بسازید.', 'link', '<button class="btn btn-primary btn-sm mt-2" data-action="new-link">ساخت لینک</button>')}</td></tr>`;
      renderPagination(qs('[data-links-pagination]'), { ...p, onGo: (page) => { p.page = page; loadLinks(); } });
      bindDynamic();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7">${emptyState('خطا در دریافت لینک‌ها', err.message, 'alert')}</td></tr>`;
    }
  }

  function domainOptions(selected = 0) {
    const list = state.domains.filter((d) => d.status === 'verified');
    return `<option value="0">دامنه اصلی سایت</option>` + list.map((d) => `<option value="${d.id}" ${Number(selected) === d.id ? 'selected' : ''}>${escapeHtml(d.hostname)}</option>`).join('');
  }

  function linkFormHtml(link = {}) {
    return `
      <form data-link-form="${link.id || ''}" class="flex-col" style="gap:2px">
        <label class="field"><span class="label">آدرس مقصد <span class="req">*</span></span>
          <input class="input" name="url" dir="ltr" required placeholder="https://example.com/page" value="${escapeHtml(link.target_url || '')}"></label>
        <div class="grid g-2" style="gap:12px">
          <label class="field"><span class="label">نامک دلخواه</span>
            <input class="input" name="alias" dir="ltr" placeholder="خالی = تصادفی" value="${escapeHtml(link.code || '')}"></label>
          <label class="field"><span class="label">دامنه</span>
            <select class="select" name="domain_id">${domainOptions(link.domain_id || 0)}</select></label>
        </div>
        <label class="field"><span class="label">عنوان</span>
          <input class="input" name="title" maxlength="120" placeholder="مثلاً: کمپین فروش تابستان" value="${escapeHtml(link.title || '')}"></label>
        <label class="field"><span class="label">توضیح داخلی</span>
          <input class="input" name="note" maxlength="300" placeholder="فقط برای خودتان" value="${escapeHtml(link.note || '')}"></label>
        <div class="grid g-3" style="gap:12px">
          <label class="field"><span class="label">رمز عبور</span>
            <input class="input" type="password" name="password" dir="ltr" placeholder="${link.has_password ? 'رمز فعلی فعال است' : 'اختیاری'}"></label>
          <label class="field"><span class="label">انقضا</span>
            <input class="input" type="date" name="expires" value="${link.expires_at ? localInput(link.expires_at) : ''}"></label>
          <label class="field"><span class="label">سقف کلیک</span>
            <input class="input" name="click_limit" inputmode="numeric" placeholder="مثلاً ۱۰۰۰" value="${link.click_limit || ''}"></label>
        </div>
        <label class="field"><span class="label">برچسب‌ها</span>
          <input class="input" name="tags" placeholder="آموزش, محصول (با کاما جدا کنید)" value="${escapeHtml((link.tags || []).join(', '))}"></label>
        <label class="checkbox"><input type="checkbox" name="is_active" ${link.is_active !== false ? 'checked' : ''}> لینک فعال باشد</label>
      </form>`;
  }

  function openLinkModal(link = null) {
    const m = modal({
      title: link ? `ویرایش لینک /${link.code}` : 'ساخت لینک کوتاه جدید',
      body: linkFormHtml(link || {}),
      footer: `${link ? `<button class="btn btn-danger" data-delete>${icon('trash', 16)} حذف لینک</button>` : ''}
               <button class="btn btn-primary" data-save>${icon('check', 16)} ${link ? 'ذخیره تغییرات' : 'ساخت لینک'}</button>
               <button class="btn btn-ghost" data-close>انصراف</button>`,
    });
    const form = m.$('[data-link-form]');
    if (link) m.$('[data-delete]')?.addEventListener('click', async () => {
      const yes = await confirmDialog({ title: 'حذف لینک', message: `لینک /${link.code} و همه آمار آن حذف شود؟` });
      if (!yes) return;
      await api(`/api/links/${link.id}`, { method: 'DELETE' });
      toast('لینک حذف شد.', 'ok'); m.close(); loadLinks();
    });
    m.$('[data-save]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const d = L.serializeForm(form);
      if (!d.url || !d.url.trim()) return toast('آدرس مقصد را وارد کنید.', 'warn');
      if (d.password === '' && form.password.value === '' && link) d.password_unchanged = true;
      btnLoading(btn, true);
      try {
        const payload = {
          target_url: d.url.trim(), alias: d.alias?.trim() || undefined, domain_id: Number(d.domain_id) || 0,
          title: d.title, note: d.note, expires_at: d.expires || null, click_limit: d.click_limit || null,
          tags: d.tags, is_active: d.is_active,
        };
        if (d.password) payload.password = d.password;
        if (link) {
          if (d.alias && d.alias.trim() !== link.code) payload.code = d.alias.trim();
          await api(`/api/links/${link.id}`, { method: 'PATCH', body: payload });
          toast('لینک به‌روزرسانی شد.', 'ok');
        } else {
          const res = await api('/api/links', { method: 'POST', body: payload });
          toast('لینک ساخته شد ✅', 'ok');
          m.close();
          showLinkResult(res.item);
          loadLinks(); loadOverview();
          return;
        }
        m.close(); loadLinks();
      } catch (err) { toast(err.message, 'err'); btnLoading(btn, false); }
    });
  }

  function showLinkResult(item) {
    const m = modal({
      title: 'لینک کوتاه شما آماده است 🎉',
      body: `<div class="flex-col" style="gap:12px">
          <div class="mono" style="background:var(--input-bg);padding:12px;border-radius:12px;border:1px dashed var(--border-strong);word-break:break-all">${escapeHtml(item.short_url)}</div>
          <img src="/api/links/${item.id}/qr?size=320" alt="QR" style="width:220px;margin:0 auto;border-radius:16px;background:#fff;padding:8px">
          <div class="flex wrap" style="gap:8px;justify-content:center">
            <button class="btn btn-primary btn-sm" data-copy="${escapeHtml(item.short_url)}">${icon('copy', 15)} کپی لینک</button>
            <a class="btn btn-outline btn-sm" href="${escapeHtml(item.short_url)}" target="_blank" rel="noopener">${icon('external', 15)} آزمایش لینک</a>
            <a class="btn btn-outline btn-sm" href="/dashboard?tab=analytics">${icon('chart', 15)} مشاهده آمار</a>
          </div>
        </div>`,
    });
    bindDynamic(m.el);
  }

  async function openLinkStats(id) {
    const m = modal({ title: 'آمار لینک', body: '<div class="text-center" style="padding:30px"><span class="spinner lg"></span></div>', wide: true });
    try {
      const res = await api(`/api/links/${id}/stats?days=${state.range}`);
      const t = res.totals;
      m.$('.modal-body').innerHTML = `
        <div class="flex between wrap mb-3" style="gap:12px">
          <div>
            <b class="mono">${escapeHtml(res.link.short_url)}</b>
            <div class="text-xs text-dim truncate" style="max-width:420px">${escapeHtml(res.link.target_url)}</div>
          </div>
          <div class="flex" style="gap:8px">
            <button class="btn btn-soft btn-sm" data-copy="${escapeHtml(res.link.short_url)}">${icon('copy', 15)} کپی</button>
            <button class="btn btn-outline btn-sm" data-reset="${id}">${icon('refresh', 15)} بازنشانی آمار</button>
          </div>
        </div>
        <div class="grid g-4 mb-3">
          <div class="stat-mini">${icon('chart', 20)}<div><b>${fa(t.clicks || 0)}</b><span>کل کلیک</span></div></div>
          <div class="stat-mini">${icon('users', 20)}<div><b>${fa(t.uniques || 0)}</b><span>کاربر یکتا</span></div></div>
          <div class="stat-mini">${icon('clock', 20)}<div><b>${fa(t.today || 0)}</b><span>۲۴ ساعت اخیر</span></div></div>
          <div class="stat-mini">${icon('bolt', 20)}<div><b>${fa(t.week || 0)}</b><span>۷ روز اخیر</span></div></div>
        </div>
        <div data-modal-chart style="min-height:230px"></div>
        <div class="grid g-2 mt-3">
          <div><h4 class="text-sm">دستگاه‌ها</h4><div data-modal-device></div></div>
          <div><h4 class="text-sm">مرورگرها</h4><div data-modal-browser></div></div>
          <div><h4 class="text-sm">سیستم‌عامل</h4><div data-modal-os></div></div>
          <div><h4 class="text-sm">منبع ورود</h4><div data-modal-ref></div></div>
        </div>
        <h4 class="text-sm mt-3">آخرین بازدیدها</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>زمان</th><th>دستگاه</th><th>مرورگر</th><th>منبع</th><th>IP</th></tr></thead>
          <tbody>${res.recent.length ? res.recent.map((c) => `<tr>
            <td class="text-xs nowrap">${jalali(c.ts)}</td><td>${escapeHtml(c.device || '—')}${c.is_bot ? ' <span class="badge badge-warn">ربات</span>' : ''}</td>
            <td class="text-xs">${escapeHtml(c.browser || '—')} · ${escapeHtml(c.os || '')}</td>
            <td class="text-xs truncate" style="max-width:180px">${escapeHtml(c.referrer || 'ورود مستقیم')}</td>
            <td class="mono text-xs">${escapeHtml(c.ip || '—')}</td></tr>`).join('') : '<tr><td colspan="5" class="text-dim text-center">هنوز بازدیدی ثبت نشده است.</td></tr>'}</tbody></table></div>`;
      window.Charts.lineChart(m.$('[data-modal-chart]'), {
        series: [{ name: 'کلیک', color: '#6366f1', data: res.series.map((s) => ({ x: s.day, y: s.clicks })) }], height: 220,
      });
      window.Charts.barList(m.$('[data-modal-device]'), res.breakdown.device);
      window.Charts.barList(m.$('[data-modal-browser]'), res.breakdown.browser);
      window.Charts.barList(m.$('[data-modal-os]'), res.breakdown.os);
      window.Charts.barList(m.$('[data-modal-ref]'), res.breakdown.referrer);
      m.$('[data-reset]')?.addEventListener('click', async (e) => {
        const yes = await confirmDialog({ title: 'بازنشانی آمار', message: 'همه آمار کلیک این لینک پاک شود؟' });
        if (!yes) return;
        await api(`/api/links/${id}/reset-stats`, { method: 'POST' });
        toast('آمار بازنشانی شد.', 'ok');
        openLinkStats(id);
      });
      bindDynamic(m.el);
    } catch (err) { m.$('.modal-body').innerHTML = `<p class="text-center">${escapeHtml(err.message)}</p>`; }
  }

  function openQrModal(link) {
    const m = modal({
      title: `کد QR لینک /${link.code}`,
      body: `<div class="text-center">
          <img data-qr-img src="/api/links/${link.id}/qr?size=420" alt="QR" style="width:260px;margin:0 auto;background:#fff;padding:10px;border-radius:18px">
          <div class="mono mt-2 text-sm">${escapeHtml(link.short_url)}</div>
          <div class="grid g-2 mt-3" style="gap:12px;text-align:right">
            <label class="field mb-0"><span class="label">رنگ کد</span><input type="color" data-qr-dark value="#0f172a"></label>
            <label class="field mb-0"><span class="label">رنگ پس‌زمینه</span><input type="color" data-qr-light value="#ffffff"></label>
          </div>
        </div>`,
      footer: `<a class="btn btn-primary" data-qr-download href="/api/links/${link.id}/qr?size=1024" download="linkok-${escapeHtml(link.code)}.png">${icon('download', 16)} دانلود PNG</a>
               <a class="btn btn-outline" href="/api/links/${link.id}/qr?format=svg&size=600" target="_blank" rel="noopener">${icon('external', 16)} نمایش SVG</a>
               <button class="btn btn-ghost" data-copy="${escapeHtml(link.short_url)}">${icon('copy', 16)} کپی لینک</button>`,
    });
    const refresh = () => {
      const url = `/api/links/${link.id}/qr?size=420&dark=${encodeURIComponent(m.$('[data-qr-dark]').value)}&light=${encodeURIComponent(m.$('[data-qr-light]').value)}`;
      m.$('[data-qr-img]').src = url + '&t=' + Date.now();
      m.$('[data-qr-download]').href = url.replace('size=420', 'size=1024');
    };
    m.$$('[data-qr-dark], [data-qr-light]').forEach((i) => i.addEventListener('change', refresh));
    bindDynamic(m.el);
  }

  function openBulkModal() {
    const m = modal({
      title: 'افزودن گروهی لینک‌ها',
      body: `<p class="text-sm text-dim">هر خط یک لینک: اول آدرس، سپس (اختیاری) نامک دلخواه. حداکثر ۲۰۰ خط.</p>
        <textarea class="textarea mono" data-bulk style="min-height:190px;direction:ltr;text-align:left" placeholder="https://example.com/page-1 page-one
https://example.com/page-2 page-two
https://example.com/page-3"></textarea>
        <label class="field mt-2"><span class="label">دامنه</span><select class="select" data-bulk-domain>${domainOptions(0)}</select></label>`,
      footer: `<button class="btn btn-primary" data-run>${icon('bolt', 16)} ساخت لینک‌ها</button><button class="btn btn-ghost" data-close>انصراف</button>`,
    });
    m.$('[data-run]').addEventListener('click', async (e) => {
      const text = m.$('[data-bulk]').value.trim();
      if (!text) return toast('حداقل یک لینک وارد کنید.', 'warn');
      btnLoading(e.currentTarget, true);
      try {
        const res = await api('/api/links/bulk', { method: 'POST', body: { text, domain_id: Number(m.$('[data-bulk-domain]').value) || 0 } });
        toast(res.message, res.failed.length ? 'warn' : 'ok');
        m.$('.modal-body').innerHTML = `<h4 class="text-sm">نتیجه عملیات</h4>
          ${res.created.length ? `<div class="table-wrap mb-2"><table class="table"><thead><tr><th>مقصد</th><th>لینک کوتاه</th></tr></thead><tbody>
            ${res.created.map((c) => `<tr><td class="truncate" style="max-width:260px">${escapeHtml(c.line)}</td>
              <td><button class="btn btn-soft btn-sm" data-copy="${escapeHtml(c.item.short_url)}">${icon('copy', 14)} ${escapeHtml(c.item.code)}</button></td></tr>`).join('')}
          </tbody></table></div>` : ''}
          ${res.failed.length ? `<h5 class="text-sm" style="color:var(--danger)">ناموفق (${fa(res.failed.length)})</h5>
            <ul class="text-xs text-dim">${res.failed.slice(0, 12).map((f) => `<li class="truncate">${escapeHtml(f.line)} — ${escapeHtml(f.error)}</li>`).join('')}</ul>` : ''}`;
        bindDynamic(m.el);
        loadLinks(); loadOverview();
      } catch (err) { toast(err.message, 'err'); btnLoading(e.currentTarget, false); }
    });
  }

  /* ==========================================================================
     فایل‌ها
     ========================================================================== */
  async function loadFiles() {
    const p = state.files;
    const params = new URLSearchParams({ page: p.page, per_page: 20 });
    if (p.q) params.set('q', p.q);
    const tbody = qs('[data-files-body]');
    tbody.innerHTML = L.tableSkeleton(4, 6);
    try {
      const res = await api('/api/files?' + params.toString());
      p.items = res.items; p.total = res.total; p.pages = res.pages;
      qs('[data-files-summary]').innerHTML = `
        <div class="stat-mini">${icon('file', 20)}<div><b>${fa(res.summary.total)}</b><span>فایل آپلود‌شده</span></div></div>
        <div class="stat-mini">${icon('layers', 20)}<div><b>${res.summary.bytes_label}</b><span>فضای مصرفی</span></div></div>
        <div class="stat-mini">${icon('download', 20)}<div><b>${fa(res.summary.downloads)}</b><span>کل دانلودها</span></div></div>`;
      tbody.innerHTML = p.items.length ? p.items.map((f) => {
        const kind = fileKind(f.mime, f.orig_name);
        const thumb = /^image\//.test(f.mime || '')
          ? `<img class="file-thumb" src="/f/${escapeHtml(f.code)}/download" alt="" loading="lazy">`
          : `<span class="file-icon-box ${kind}">${escapeHtml(fileExt(f.orig_name))}</span>`;
        return `<tr>
          <td><div class="flex" style="min-width:0">${thumb}
            <div style="min-width:0"><b class="text-sm truncate" style="display:block;max-width:190px">${escapeHtml(f.orig_name || 'فایل')}</b>
            <span class="text-xs text-dim">${escapeHtml((f.ext || '').toUpperCase())}</span></div></div></td>
          <td><div class="copy-cell"><button class="btn btn-ghost btn-icon btn-icon-sm" data-copy="${escapeHtml(f.full_url)}">${icon('copy', 14)}</button>
            <a class="mono text-xs" href="/f/${escapeHtml(f.code)}" target="_blank" rel="noopener">/f/${escapeHtml(f.code)}</a></div></td>
          <td class="nowrap">${f.size_label}</td>
          <td><b>${fa(f.downloads)}</b><div class="text-xs text-dim">${fa(f.views)} بازدید</div></td>
          <td>${f.is_active ? '<span class="badge badge-ok">فعال</span>' : '<span class="badge badge-warn">غیرفعال</span>'}
              ${f.has_password ? '<span class="badge badge-info">رمزدار</span>' : ''}
              ${f.expired ? '<span class="badge badge-danger">منقضی</span>' : ''}</td>
          <td class="text-xs text-dim nowrap">${timeAgo(f.created_at)}</td>
          <td><div class="actions">
            <a class="btn btn-ghost btn-icon btn-icon-sm" href="/f/${escapeHtml(f.code)}" target="_blank" rel="noopener" title="صفحه دانلود">${icon('external', 15)}</a>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-file-edit="${f.id}" title="ویرایش">${icon('edit', 15)}</button>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-file-delete="${f.id}" title="حذف" style="color:var(--danger)">${icon('trash', 15)}</button>
          </div></td>
        </tr>`;
      }).join('') : `<tr><td colspan="7">${emptyState('فایلی آپلود نشده', 'اولین فایل خود را بکشید و رها کنید تا لینک دانلود ساخته شود.', 'file')}</td></tr>`;
      renderPagination(qs('[data-files-pagination]'), { ...p, onGo: (page) => { p.page = page; loadFiles(); } });
      bindDynamic();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="7">${emptyState('خطا در دریافت فایل‌ها', err.message, 'alert')}</td></tr>`; }
  }

  function initUpload() {
    const zone = qs('[data-dropzone]');
    const input = qs('[data-file-input]');
    const progress = qs('[data-progress]');
    const bar = progress.querySelector('i');
    const results = qs('[data-upload-results]');

    zone.addEventListener('click', () => input.click());
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', (e) => { if (e.dataTransfer.files?.length) send(e.dataTransfer.files); });
    input.addEventListener('change', () => { if (input.files.length) send(input.files); });

    function send(files) {
      const fd = new FormData();
      Array.from(files).slice(0, 25).forEach((f) => fd.append('files', f));
      const pw = qs('[data-upload-password]').value;
      const exp = qs('[data-upload-expiry]').value;
      if (pw) fd.append('password', pw);
      if (exp) fd.append('expires_at', exp);
      progress.classList.remove('hide'); bar.style.width = '0%';
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files/upload');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) bar.style.width = Math.round((e.loaded / e.total) * 100) + '%'; };
      xhr.onload = () => {
        progress.classList.add('hide');
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 400 || res.ok === false) return toast(res.error || 'آپلود ناموفق بود.', 'err');
        results.innerHTML = res.items.map((f) => `
          <div class="stat-mini" style="justify-content:space-between">
            <div class="flex" style="min-width:0">
              <span class="file-icon-box ${fileKind(f.mime, f.orig_name)}">${escapeHtml(fileExt(f.orig_name))}</span>
              <div style="min-width:0"><b class="text-sm truncate" style="display:block">${escapeHtml(f.orig_name)}</b>
              <span class="text-xs text-dim">${f.size_label}</span></div>
            </div>
            <div class="flex" style="gap:6px">
              <button class="btn btn-soft btn-sm" data-copy="${escapeHtml(f.full_url)}">${icon('copy', 14)} کپی لینک</button>
              <a class="btn btn-outline btn-sm" href="/f/${escapeHtml(f.code)}" target="_blank" rel="noopener">${icon('external', 14)}</a>
            </div>
          </div>`).join('');
        toast(res.message || 'آپلود انجام شد ✅', 'ok');
        input.value = ''; qs('[data-upload-password]').value = '';
        bindDynamic();
        loadFiles(); loadOverview();
      };
      xhr.onerror = () => { progress.classList.add('hide'); toast('ارتباط با سرور قطع شد.', 'err'); };
      xhr.send(fd);
    }
  }

  function openFileEdit(file) {
    const m = modal({
      title: 'ویرایش فایل',
      body: `<form data-file-form>
        <label class="field"><span class="label">نام نمایشی فایل</span><input class="input" name="orig_name" value="${escapeHtml(file.orig_name || '')}"></label>
        <label class="field"><span class="label">کد لینک</span><input class="input mono" name="code" dir="ltr" value="${escapeHtml(file.code)}"></label>
        <div class="grid g-2" style="gap:12px">
          <label class="field"><span class="label">رمز عبور</span><input class="input" type="password" name="password" dir="ltr" placeholder="${file.has_password ? 'رمز فعال است' : 'اختیاری'}"></label>
          <label class="field"><span class="label">تاریخ انقضا</span><input class="input" type="date" name="expires" value="${file.expires_at ? localInput(file.expires_at) : ''}"></label>
        </div>
        <label class="checkbox"><input type="checkbox" name="is_active" ${file.is_active ? 'checked' : ''}> فایل در دسترس باشد</label>
        ${file.has_password ? '<label class="checkbox mt-2"><input type="checkbox" name="remove_password"> حذف رمز عبور</label>' : ''}
      </form>`,
      footer: `<button class="btn btn-primary" data-save>${icon('save', 16)} ذخیره</button>
               <button class="btn btn-outline" data-reset>${icon('refresh', 16)} بازنشانی آمار</button>
               <button class="btn btn-ghost" data-close>انصراف</button>`,
    });
    m.$('[data-save]').addEventListener('click', async (e) => {
      const d = L.serializeForm(m.$('[data-file-form]'));
      btnLoading(e.currentTarget, true);
      try {
        const body = { orig_name: d.orig_name, code: d.code, expires_at: d.expires || null, is_active: d.is_active };
        if (d.remove_password) body.password = '';
        else if (d.password) body.password = d.password;
        await api(`/api/files/${file.id}`, { method: 'PATCH', body });
        toast('فایل به‌روزرسانی شد.', 'ok'); m.close(); loadFiles();
      } catch (err) { toast(err.message, 'err'); btnLoading(e.currentTarget, false); }
    });
    m.$('[data-reset]').addEventListener('click', async () => {
      await api(`/api/files/${file.id}/reset-stats`, { method: 'POST' });
      toast('آمار فایل بازنشانی شد.', 'ok'); m.close(); loadFiles();
    });
  }

  /* ==========================================================================
     دامنه‌ها
     ========================================================================== */
  async function loadDomains() {
    const host = qs('[data-domains-list]');
    host.innerHTML = `<div class="card"><div class="skeleton" style="height:70px"></div></div>`;
    try {
      const res = await api('/api/domains');
      state.domains = res.items || [];
      state.domainsLoaded = true;
      const limits = res.limits || state.limits;
      qs('[data-domain-hint]').textContent = limits.domains
        ? `در پلن شما تا ${fa(limits.domains)} دامنه مجاز است (استفاده‌شده: ${fa(state.domains.length)}).`
        : 'در پلن فعلی امکان افزودن دامنه اختصاصی وجود ندارد؛ برای فعال‌سازی با پشتیبانی تماس بگیرید.';
      const select = qs('[data-links-domain]');
      if (select) select.innerHTML = '<option value="">همه دامنه‌ها</option><option value="0">دامنه اصلی</option>' +
        state.domains.map((d) => `<option value="${d.id}">${escapeHtml(d.hostname)}</option>`).join('');
      host.innerHTML = state.domains.length ? state.domains.map(domainCard).join('') : `<div class="card">${emptyState('هنوز دامنه‌ای اضافه نکرده‌اید', 'دامنه یا زیر‌دامنه خود را اضافه کنید تا لینک‌ها با برند شما ساخته شوند.', 'domain')}</div>`;
      bindDynamic();
    } catch (err) { host.innerHTML = `<div class="card">${emptyState('خطا', err.message, 'alert')}</div>`; }
  }

  function domainCard(d) {
    const statusBadge = d.status === 'verified' ? '<span class="badge badge-ok">تأیید شده</span>'
      : d.status === 'rejected' ? '<span class="badge badge-danger">رد شده</span>' : '<span class="badge badge-warn">در انتظار تأیید</span>';
    const modeNames = { shortener: 'کوتاه‌کننده لینک', bio: 'صفحه بیو لینک', redirect_home: 'انتقال به صفحه اصلی' };
    return `<div class="card" data-domain-card="${d.id}">
      <div class="row-between mb-2">
        <div class="flex wrap" style="gap:10px">
          <span class="logo-mark" style="background:var(--brand-grad)">${icon('domain', 19)}</span>
          <div>
            <b class="mono">${escapeHtml(d.hostname)}</b>
            <div class="flex wrap text-xs text-dim" style="gap:12px">
              <span>${icon('link', 13)} ${fa(d.link_count)} لینک</span>
              <span>${icon('chart', 13)} ${fa(d.clicks)} کلیک</span>
              ${d.verified_at ? `<span>${icon('check', 13)} تأیید: ${jalali(d.verified_at, false)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="flex wrap" style="gap:8px">
          ${statusBadge}
          <button class="btn btn-soft btn-sm" data-domain-verify="${d.id}">${icon('refresh', 15)} بررسی DNS</button>
          <button class="btn btn-danger btn-icon btn-icon-sm" data-domain-delete="${d.id}" title="حذف">${icon('trash', 15)}</button>
        </div>
      </div>
      ${d.status === 'verified' ? `
        <div class="grid g-2 mb-2" style="gap:12px">
          <label class="field mb-0"><span class="label">کاربرد دامنه</span>
            <select class="select" data-domain-mode="${d.id}">
              ${Object.entries(modeNames).map(([k, v]) => `<option value="${k}" ${d.mode === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select></label>
          <label class="field mb-0"><span class="label">نشانی صفحه بیو روی این دامنه</span>
            <input class="input mono" dir="ltr" data-domain-bioslug="${d.id}" placeholder="my-page" value="${escapeHtml(d.bio_slug || '')}"></label>
        </div>
        <div class="flex wrap" style="gap:8px">
          <button class="btn btn-primary btn-sm" data-domain-save="${d.id}">${icon('save', 15)} ذخیره تنظیمات</button>
          ${d.base_url ? `<button class="btn btn-outline btn-sm" data-copy="${escapeHtml(d.base_url + '/')}">${icon('copy', 15)} کپی آدرس پایه</button>` : ''}
          ${d.mode === 'bio' && d.bio_slug ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(d.base_url + '/u/' + d.bio_slug)}" target="_blank" rel="noopener">${icon('external', 15)} مشاهده صفحه</a>` : ''}
        </div>` : `
        <div class="panel">
          <b class="text-sm">مراحل تأیید مالکیت</b>
          <p class="text-xs text-dim mb-2">یکی از رکوردهای زیر را در پنل DNS دامنه خود ثبت کنید، سپس دکمه «بررسی DNS» را بزنید.</p>
          <div class="code-block mb-2"><span class="c-key">TXT</span> &nbsp; Host: <span class="c-val">_linkok.${escapeHtml(d.hostname)}</span><br>
            Value: <span class="c-val">${escapeHtml(d.token)}</span></div>
          <div class="code-block"><span class="c-key">CNAME</span> &nbsp; Host: <span class="c-val">${escapeHtml(d.hostname)}</span><br>
            Value: <span class="c-val">${escapeHtml(d.verify_instructions.cname_value)}</span></div>
          <div class="flex wrap mt-2" style="gap:8px">
            <button class="btn btn-outline btn-sm" data-copy="${escapeHtml(d.verify_instructions.txt_value)}">${icon('copy', 15)} کپی مقدار TXT</button>
            <button class="btn btn-outline btn-sm" data-copy="${escapeHtml(d.hostname)}">${icon('copy', 15)} کپی دامنه</button>
          </div>
          ${d.error ? `<p class="hint mt-2">آخرین بررسی: ${escapeHtml(d.error)}</p>` : ''}
        </div>`}
    </div>`;
  }

  /* ==========================================================================
     آمار کاربر
     ========================================================================== */
  async function loadAnalytics() {
    const res = await api('/api/links?per_page=200&sort=clicks');
    const items = res.items || [];
    const days = state.range;
    const statsHost = qs('[data-analytics-stats]');
    statsHost.innerHTML = '<div class="stat"><div class="skeleton" style="height:60px"></div></div>'.repeat(4);
    const seriesList = await Promise.all(items.slice(0, 20).map((l) => api(`/api/links/${l.id}/stats?days=${days}`).then((r) => r).catch(() => null)));
    const dayList = [];
    for (let i = days - 1; i >= 0; i--) dayList.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    const clicks = dayList.map((d) => seriesList.reduce((s, r) => s + (r?.series.find((x) => x.day === d)?.clicks || 0), 0));
    const uniques = dayList.map((d) => seriesList.reduce((s, r) => s + (r?.series.find((x) => x.day === d)?.uniques || 0), 0));
    const totalClicks = clicks.reduce((a, b) => a + b, 0);
    const totalUniques = uniques.reduce((a, b) => a + b, 0);
    const today = clicks[clicks.length - 1] || 0;
    const week = clicks.slice(-7).reduce((a, b) => a + b, 0);

    const agg = (key) => {
      const map = new Map();
      seriesList.forEach((r) => (r?.breakdown?.[key] || []).forEach((row) => map.set(row.label, (map.get(row.label) || 0) + row.value)));
      return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    };
    const hours = new Array(24).fill(0);
    seriesList.forEach((r) => (r?.hours || []).forEach((h) => { hours[h.hour] += h.value; }));

    statsHost.innerHTML = `
      <div class="stat"><div class="stat-icon">${icon('chart', 21)}</div><div class="stat-value">${shortNum(totalClicks)}</div><div class="stat-label">کلیک در ${fa(days)} روز</div></div>
      <div class="stat"><div class="stat-icon">${icon('users', 21)}</div><div class="stat-value">${shortNum(totalUniques)}</div><div class="stat-label">بازدیدکننده یکتا</div></div>
      <div class="stat"><div class="stat-icon">${icon('clock', 21)}</div><div class="stat-value">${fa(today)}</div><div class="stat-label">۲۴ ساعت اخیر</div></div>
      <div class="stat"><div class="stat-icon">${icon('bolt', 21)}</div><div class="stat-value">${fa(week)}</div><div class="stat-label">۷ روز اخیر</div></div>`;

    window.Charts.lineChart('[data-chart-trend]', {
      series: [
        { name: 'کلیک‌ها', color: '#6366f1', data: dayList.map((d, i) => ({ x: d, y: clicks[i] })) },
        { name: 'کاربران یکتا', color: '#22d3ee', data: dayList.map((d, i) => ({ x: d, y: uniques[i] })) },
      ], height: 270,
    });
    window.Charts.donutChart('[data-chart-device]', { data: agg('device'), centerLabel: 'بازدید' });
    window.Charts.barList('[data-chart-browser]', agg('browser'));
    window.Charts.barList('[data-chart-referrer]', agg('referrer'));
    window.Charts.barChart('[data-chart-hours]', { data: hours.map((v, h) => ({ label: String(h), value: v })), height: 200 });

    qs('[data-analytics-top]').innerHTML = items.slice(0, 12).map((l) => `
      <tr>
        <td><div class="copy-cell"><button class="btn btn-ghost btn-icon btn-icon-sm" data-copy="${escapeHtml(l.short_url)}">${icon('copy', 14)}</button>
          <span class="mono text-xs">/${escapeHtml(l.code)}</span></div></td>
        <td class="truncate" style="max-width:220px">${escapeHtml(l.title || '—')}</td>
        <td><b>${fa(l.clicks)}</b></td><td>${fa(l.unique_clicks)}</td>
        <td><button class="btn btn-soft btn-sm" data-link-stats="${l.id}">${icon('chart', 14)} جزئیات</button></td>
      </tr>`).join('') || `<tr><td colspan="5">${emptyState('داده‌ای موجود نیست', 'پس از دریافت کلیک، آمار اینجا نمایش داده می‌شود.', 'chart')}</td></tr>`;
    bindDynamic();
  }

  /* ==========================================================================
     تنظیمات
     ========================================================================== */
  function renderSettings() {
    const u = state.user;
    qs('[data-settings-avatar]').innerHTML = avatarHtml(u, 56, true);
    qs('[data-settings-username]').textContent = '@' + u.username;
    const form = qs('[data-profile-form]');
    form.display_name.value = u.display_name || '';
    form.email.value = u.email || '';
    form.bio.value = u.bio || '';
    qs('[data-api-key]').textContent = u.api_key || '—';
    qs('[data-account-info]').innerHTML = `
      <div class="flex-col" style="gap:10px">
        <div class="stat-mini">${icon('calendar', 19)}<div><b>${jalali(u.created_at, false)}</b><span>تاریخ عضویت</span></div></div>
        <div class="stat-mini">${icon('clock', 19)}<div><b>${u.last_login_at ? timeAgo(u.last_login_at) : '—'}</b><span>آخرین ورود</span></div></div>
        <div class="stat-mini">${icon('link', 19)}<div><b>${fa(state.usage.links || 0)} / ${fa(state.limits.links || 0)}</b><span>سهمیه لینک</span></div></div>
        <div class="stat-mini">${icon('file', 19)}<div><b>${fa(state.usage.files || 0)} / ${fa(state.limits.files || 0)}</b><span>سهمیه فایل</span></div></div>
        <div class="stat-mini">${icon('layers', 19)}<div><b>${bytes(state.usage.storage || 0)}</b><span>فضای مصرفی</span></div></div>
        <div class="stat-mini">${icon('chart', 19)}<div><b>${fa(state.usage.clicks || 0)}</b><span>کل کلیک‌ها</span></div></div>
      </div>`;
  }

  async function refreshMe() {
    const me = await api('/api/auth/me');
    state.user = me.user; state.usage = me.usage || {}; state.limits = me.limits || {};
    renderPlan();
  }

  /* ==========================================================================
     رویدادها
     ========================================================================== */
  function bindDynamic(root = document) {
    const bind = (selector, key, handler) => qsa(selector, root).forEach((el) => {
      const flag = 'b' + key;
      if (el.dataset[flag]) return;
      el.dataset[flag] = '1';
      el.addEventListener('click', handler);
    });

    bind('[data-copy]', 'copy', (e) => { e.preventDefault(); copy(e.currentTarget.dataset.copy); });
    bind('[data-tab]', 'tab', (e) => switchTab(e.currentTarget.dataset.tab));
    bind('[data-action="new-link"]', 'newlink', () => {
      if (!state.domainsLoaded) loadDomains().then(() => openLinkModal());
      else openLinkModal();
    });
    bind('[data-action="bulk-links"]', 'bulk', () => {
      if (!state.domainsLoaded) loadDomains().then(openBulkModal); else openBulkModal();
    });
    bind('[data-action="upload-file"]', 'upl', () => { switchTab('files'); setTimeout(() => qs('[data-file-input]')?.click(), 350); });
    bind('[data-action="regen-key"]', 'regen', async (e) => {
      const yes = await confirmDialog({ title: 'ساخت کلید API جدید', message: 'کلید فعلی بلافاصله غیرفعال می‌شود. ادامه؟', confirmText: 'بساز', danger: false });
      if (!yes) return;
      btnLoading(e.currentTarget, true);
      try {
        const res = await api('/api/auth/api-key', { method: 'POST' });
        state.user.api_key = res.api_key;
        qs('[data-api-key]').textContent = res.api_key;
        toast('کلید جدید ساخته شد. آن را کپی کنید.', 'ok');
      } catch (err) { toast(err.message, 'err'); } finally { btnLoading(e.currentTarget, false); }
    });
    bind('[data-action="copy-key"]', 'copykey', () => copy(state.user?.api_key || ''));
    bind('[data-action="logout"]', 'logout', logout);
    bind('[data-action="logout-all"]', 'logoutall', async () => {
      const yes = await confirmDialog({ title: 'خروج از همه دستگاه‌ها', message: 'از همه دستگاه‌ها خارج می‌شوید و باید دوباره وارد شوید.', confirmText: 'خروج از همه' });
      if (!yes) return;
      await api('/api/auth/logout-all', { method: 'POST' });
      location.href = '/login';
    });

    bind('[data-link-stats]', 'lstats', (e) => openLinkStats(e.currentTarget.dataset.linkStats));
    bind('[data-link-qr]', 'lqr', (e) => {
      const link = state.links.items.find((x) => String(x.id) === e.currentTarget.dataset.linkQr);
      if (link) openQrModal(link); else toast('ابتدا از تب لینک‌ها اقدام کنید.', 'warn');
    });
    bind('[data-link-edit]', 'ledit', (e) => {
      const link = state.links.items.find((x) => String(x.id) === e.currentTarget.dataset.linkEdit);
      if (link) openLinkModal(link); else toast('ابتدا از تب لینک‌ها اقدام کنید.', 'warn');
    });
    bind('[data-link-toggle]', 'ltoggle', async (e) => {
      const link = state.links.items.find((x) => String(x.id) === e.currentTarget.dataset.linkToggle);
      if (!link) return;
      try {
        await api(`/api/links/${link.id}`, { method: 'PATCH', body: { is_active: !link.is_active } });
        toast(link.is_active ? 'لینک غیرفعال شد.' : 'لینک فعال شد.', 'ok');
        loadLinks(); loadOverview();
      } catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-link-delete]', 'ldelete', async (e) => {
      const link = state.links.items.find((x) => String(x.id) === e.currentTarget.dataset.linkDelete);
      if (!link) return;
      const yes = await confirmDialog({ title: 'حذف لینک', message: `لینک /${link.code} و تمام آمار آن حذف شود؟` });
      if (!yes) return;
      try { await api(`/api/links/${link.id}`, { method: 'DELETE' }); toast('لینک حذف شد.', 'ok'); loadLinks(); loadOverview(); }
      catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-file-edit]', 'fedit', (e) => {
      const f = state.files.items.find((x) => String(x.id) === e.currentTarget.dataset.fileEdit);
      if (f) openFileEdit(f);
    });
    bind('[data-file-delete]', 'fdelete', async (e) => {
      const f = state.files.items.find((x) => String(x.id) === e.currentTarget.dataset.fileDelete);
      if (!f) return;
      const yes = await confirmDialog({ title: 'حذف فایل', message: `فایل «${f.orig_name}» برای همیشه حذف شود؟` });
      if (!yes) return;
      try { await api(`/api/files/${f.id}`, { method: 'DELETE' }); toast('فایل حذف شد.', 'ok'); loadFiles(); loadOverview(); refreshMe(); }
      catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-domain-verify]', 'dverify', async (e) => {
      const btn = e.currentTarget;
      btnLoading(btn, true);
      try {
        const res = await api(`/api/domains/${btn.dataset.domainVerify}/verify`, { method: 'POST' });
        toast(res.message, res.ok ? 'ok' : 'warn');
        loadDomains();
      } catch (err) { toast(err.message, 'err'); btnLoading(btn, false); }
    });
    bind('[data-domain-save]', 'dsave', async (e) => {
      const id = e.currentTarget.dataset.domainSave;
      const mode = qs(`[data-domain-mode="${id}"]`).value;
      const bioSlug = qs(`[data-domain-bioslug="${id}"]`).value.trim();
      btnLoading(e.currentTarget, true);
      try {
        await api(`/api/domains/${id}`, { method: 'PATCH', body: { mode, bio_slug: bioSlug } });
        toast('تنظیمات دامنه ذخیره شد.', 'ok'); loadDomains();
      } catch (err) { toast(err.message, 'err'); btnLoading(e.currentTarget, false); }
    });
    bind('[data-domain-delete]', 'ddelete', async (e) => {
      const id = e.currentTarget.dataset.domainDelete;
      const yes = await confirmDialog({ title: 'حذف دامنه', message: 'این دامنه حذف شود؟ لینک‌های ساخته‌شده روی آن نیز حذف خواهند شد.' });
      if (!yes) return;
      try { await api(`/api/domains/${id}`, { method: 'DELETE' }); }
      catch (err) {
        if (err.status === 409) {
          const force = await confirmDialog({ title: 'حذف با لینک‌ها', message: err.message + ' ادامه می‌دهید؟', confirmText: 'بله، همه را حذف کن' });
          if (!force) return;
          await api(`/api/domains/${id}?force=1`, { method: 'DELETE' });
        } else { toast(err.message, 'err'); return; }
      }
      toast('دامنه حذف شد.', 'ok'); loadDomains();
    });
  }

  function bindToolbar() {
    qsa('[data-range]').forEach((btn) => btn.addEventListener('click', () => {
      qsa('[data-range]').forEach((b) => b.classList.toggle('active', b === btn));
      state.range = Number(btn.dataset.range);
      if (state.tab === 'overview') loadClicksChart();
      if (state.tab === 'analytics') loadAnalytics();
    }));

    const search = qs('[data-links-search]');
    search.addEventListener('input', debounce(() => { state.links.q = search.value.trim(); state.links.page = 1; loadLinks(); }, 400));
    qs('[data-links-status]').addEventListener('change', (e) => { state.links.status = e.target.value; state.links.page = 1; loadLinks(); });
    qs('[data-links-sort]').addEventListener('change', (e) => { state.links.sort = e.target.value; state.links.page = 1; loadLinks(); });
    qs('[data-links-domain]').addEventListener('change', (e) => { state.links.domain_id = e.target.value === '' ? '' : Number(e.target.value); state.links.page = 1; loadLinks(); });

    const fsearch = qs('[data-files-search]');
    fsearch.addEventListener('input', debounce(() => { state.files.q = fsearch.value.trim(); state.files.page = 1; loadFiles(); }, 400));

    qs('[data-domain-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = qs('button[type=submit]', e.target);
      const hostname = e.target.hostname.value.trim();
      if (!hostname) return;
      btnLoading(btn, true);
      try {
        const res = await api('/api/domains', { method: 'POST', body: { hostname } });
        toast(res.message, 'ok'); e.target.reset(); loadDomains(); refreshMe();
      } catch (err) { toast(err.message, 'err'); } finally { btnLoading(btn, false); }
    });

    qs('[data-profile-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = qs('button[type=submit]', e.target);
      btnLoading(btn, true);
      try {
        const res = await api('/api/auth/profile', { method: 'PATCH', body: { display_name: e.target.display_name.value, email: e.target.email.value, bio: e.target.bio.value } });
        state.user = { ...state.user, ...res.user };
        toast('پروفایل ذخیره شد.', 'ok'); renderPlan(); renderSettings();
      } catch (err) { toast(err.message, 'err'); } finally { btnLoading(btn, false); }
    });

    qs('[data-profile-avatar]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('files', file);
      fd.append('is_public', '1');
      try {
        const res = await fetch('/api/files/upload', { method: 'POST', body: fd, credentials: 'same-origin' }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error || 'آپلود ناموفق بود');
        const url = res.items[0].url;
        const saved = await api('/api/auth/profile', { method: 'PATCH', body: { avatar: url } });
        state.user = { ...state.user, ...saved.user };
        toast('تصویر پروفایل ذخیره شد ✅', 'ok');
        renderPlan(); renderSettings();
      } catch (err) { toast(err.message, 'err'); }
    });

    qs('[data-password-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = qs('button[type=submit]', e.target);
      btnLoading(btn, true);
      try {
        await api('/api/auth/password', { method: 'POST', body: { current_password: e.target.current_password.value, new_password: e.target.new_password.value } });
        toast('رمز عبور تغییر کرد.', 'ok'); e.target.reset();
      } catch (err) { toast(err.message, 'err'); } finally { btnLoading(btn, false); }
    });
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    location.href = '/login';
  }
  function requireLogin() { location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search); }

  /* -------------------------------- راه‌اندازی ------------------------------ */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const me = await api('/api/auth/me');
      if (!me.user) return requireLogin();
      state.user = me.user; state.usage = me.usage || {}; state.limits = me.limits || {};
      state.config = me.settings || {};
    } catch { return requireLogin(); }

    const cfg = await loadSiteConfig();
    state.site = cfg.site || {};
    showAnnouncement(cfg);
    renderPlan();
    bindToolbar();
    bindDynamic();

    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') || 'overview';
    switchTab(tab, false);
    if (params.get('new') === '1') setTimeout(() => { switchTab('links'); openLinkModal(); }, 400);
    if (tab === 'bio' && window.BioTab) window.BioTab.load();
    window.addEventListener('hashchange', () => switchTab((location.hash || '#overview').slice(1), false));
  });

  window.Dashboard = { state, switchTab, loadLinks, loadFiles, loadDomains, refreshMe, bindDynamic, openLinkModal, showLinkResult, shortCell, STATUS_BADGE };
})();
