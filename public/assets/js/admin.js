/* ==========================================================================
   Linkok — پنل مدیریت
   ========================================================================== */
(function () {
  'use strict';
  const L = window.LK;
  const { qs, qsa, api, toast, fa, shortNum, bytes, jalali, timeAgo, modal, confirmDialog, btnLoading, emptyState,
    icon, escapeHtml, copy, debounce, renderPagination, avatarHtml, fileKind, fileExt, loadSiteConfig, showAnnouncement } = L;

  const state = {
    user: null, settings: {}, site: {}, range: 7,
    users: { page: 1, q: '', role: '', status: '', plan: '', items: [], total: 0, pages: 1 },
    links: { page: 1, q: '', status: '', items: [], total: 0, pages: 1 },
    files: { page: 1, q: '', items: [], total: 0, pages: 1 },
    logs: { page: 1, q: '', items: [], total: 0, pages: 1 },
    domains: [], bio: [], stats: null,
  };

  const TITLES = {
    dashboard: ['داشبورد مدیریت', 'نمای کلی سامانه و آمار کل'],
    analytics: ['تحلیل ترافیک', 'بررسی رفتار بازدیدکنندگان'],
    users: ['مدیریت کاربران', 'نقش‌ها، پلن‌ها، وضعیت و رمز عبور'],
    links: ['مدیریت لینک‌ها', 'همه لینک‌های کوتاه سامانه'],
    files: ['مدیریت فایل‌ها', 'فایل‌های آپلودشده و فضای مصرفی'],
    domains: ['مدیریت دامنه‌ها', 'تأیید یا رد دامنه‌های اختصاصی'],
    bio: ['صفحات بیو لینک', 'مدیریت صفحات کاربران'],
    settings: ['تنظیمات سایت', 'قوانین، محدودیت‌ها و متن‌ها'],
    announcements: ['اطلاعیه‌ها', 'پیام‌های نمایش داده‌شده به کاربران'],
    logs: ['گزارش فعالیت‌ها', 'تاریخچه عملیات سامانه'],
  };

  /* ------------------------------- ناوبری ------------------------------- */
  function switchTab(tab, push = true) {
    if (!TITLES[tab]) tab = 'dashboard';
    qsa('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    qsa('.side-item[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    qs('[data-page-title]').textContent = TITLES[tab][0];
    qs('[data-page-sub]').textContent = TITLES[tab][1];
    if (push) history.replaceState(null, '', `?tab=${tab}`);
    const sidebar = qs('[data-sidebar]'); sidebar.classList.remove('open');
    qs('[data-sidebar-backdrop]').classList.remove('show');
    const loaders = {
      dashboard: loadDashboard, analytics: loadAnalyticsTab, users: loadUsers, links: loadLinks,
      files: loadFiles, domains: loadDomains, bio: loadBioPages, settings: loadSettings, announcements: loadAnnouncements, logs: loadLogs,
    };
    (loaders[tab] || loadDashboard)();
  }

  /* ==========================================================================
     داشبورد
     ========================================================================== */
  async function loadDashboard() {
    try {
      const res = await api(`/api/admin/stats?days=${state.range}`);
      state.stats = res;
      const t = res.totals;
      qs('[data-kpis]').innerHTML = `
        <div class="stat"><div class="stat-icon">${icon('users', 21)}</div><div class="stat-value">${fa(t.total_users ?? t.users ?? 0)}</div>
          <div class="stat-label">کاربران</div><div class="stat-foot">${fa(t.new_week || 0)} کاربر جدید در هفته</div></div>
        <div class="stat"><div class="stat-icon">${icon('link', 21)}</div><div class="stat-value">${shortNum(t.total || 0)}</div>
          <div class="stat-label">لینک‌های کوتاه</div><div class="stat-foot">${fa(t.active || 0)} لینک فعال</div></div>
        <div class="stat"><div class="stat-icon">${icon('chart', 21)}</div><div class="stat-value">${shortNum(t.clicks || 0)}</div>
          <div class="stat-label">کل کلیک‌ها</div><div class="stat-foot">${fa(t.today || 0)} کلیک امروز · ${fa(t.bots || 0)} ربات</div></div>
        <div class="stat"><div class="stat-icon">${icon('file', 21)}</div><div class="stat-value">${fa(t.files ?? 0)}</div>
          <div class="stat-label">فایل‌ها</div><div class="stat-foot">${t.storage_label || '—'} فضا</div></div>`;

      window.Charts.lineChart('[data-chart-series]', {
        series: [
          { name: 'کلیک‌ها', color: '#6366f1', data: res.series.map((s) => ({ x: s.day, y: s.clicks })) },
          { name: 'کاربران جدید', color: '#10b981', data: res.series.map((s) => ({ x: s.day, y: s.users })) },
          { name: 'لینک‌های جدید', color: '#f59e0b', data: res.series.map((s) => ({ x: s.day, y: s.links })) },
        ], height: 260,
      });
      const sumClicks = res.series.reduce((a, b) => a + b.clicks, 0);
      const sumUsers = res.series.reduce((a, b) => a + b.users, 0);
      const sumLinks = res.series.reduce((a, b) => a + b.links, 0);
      qs('[data-series-sum]').textContent = `${fa(sumClicks)} کلیک، ${fa(sumUsers)} کاربر و ${fa(sumLinks)} لینک در ${fa(state.range)} روز گذشته`;

      window.Charts.donutChart('[data-chart-plans]', { data: res.breakdown.plan, centerLabel: 'کاربر', size: 156 });
      qs('[data-system-cards]').innerHTML = `
        <div class="stat-mini mb-2">${icon('clock', 19)}<div><b>${fa(Math.floor(res.system.uptime / 3600))} ساعت</b><span>زمان فعالیت سرور</span></div></div>
        <div class="stat-mini mb-2">${icon('layers', 19)}<div><b>${fa(res.system.memory)} مگابایت</b><span>مصرف حافظه</span></div></div>
        <div class="stat-mini mb-2">${icon('file', 19)}<div><b>${res.system.db_size}</b><span>حجم دیتابیس</span></div></div>
        <div class="stat-mini">${icon('code', 19)}<div><b>${escapeHtml(res.system.node)}</b><span>${escapeHtml(res.system.platform)}</span></div></div>`;
      qs('[data-system-info]').textContent = `${res.system.platform} · Node ${res.system.node} · دیسک ${res.system.db_size}`;

      window.Charts.barList('[data-top-links]', res.top.links.map((l) => ({ label: l.title || '/' + l.code, value: l.clicks })));
      window.Charts.barList('[data-top-users]', res.top.users.map((u) => ({ label: '@' + u.username, value: u.clicks })));
      window.Charts.barList('[data-chart-devices]', res.breakdown.device);
      window.Charts.barList('[data-chart-browsers]', res.breakdown.browser);
      window.Charts.barList('[data-chart-refs]', res.breakdown.referrer);

      qs('[data-top-files]').innerHTML = res.top.files.length ? res.top.files.map((f) => `
        <tr><td><div class="flex" style="min-width:0"><span class="file-icon-box ${fileKind(f.mime, f.orig_name)}">${escapeHtml(fileExt(f.orig_name))}</span>
          <span class="truncate text-sm" style="max-width:220px">${escapeHtml(f.orig_name)}</span></div></td>
          <td class="mono text-xs">/f/${escapeHtml(f.code)}</td><td class="nowrap">${f.size_label}</td><td><b>${fa(f.downloads)}</b></td>
          <td><a class="btn btn-ghost btn-icon btn-icon-sm" href="/f/${escapeHtml(f.code)}" target="_blank" rel="noopener">${icon('external', 14)}</a></td></tr>`).join('')
        : `<tr><td colspan="5" class="text-dim text-center">فایلی ثبت نشده است.</td></tr>`;

      qs('[data-recent-logs]').innerHTML = res.recent.length ? res.recent.map((l) => `
        <tr><td class="text-xs nowrap">${jalali(l.created_at)}</td><td class="text-sm">${escapeHtml(l.actor_name || 'سیستم')}</td>
        <td><span class="badge badge-brand">${escapeHtml(l.action)}</span></td>
        <td class="text-xs text-dim">${escapeHtml(l.entity || '—')} ${l.entity_id ? '#' + escapeHtml(l.entity_id) : ''}</td></tr>`).join('')
        : `<tr><td colspan="4" class="text-dim text-center">فعالیتی ثبت نشده است.</td></tr>`;

      const maint = state.settings.maintenance === '1' || state.settings.maintenance === true;
      qs('[data-action="maintenance"]').classList.toggle('btn-danger', maint);
      qsa('[data-count="users"]').forEach((el) => { el.textContent = fa(t.total_users ?? t.users ?? 0); });
      qsa('[data-count="links"]').forEach((el) => { el.textContent = fa(t.total || 0); });
      qsa('[data-count="files"]').forEach((el) => { el.textContent = fa(t.files ?? 0); });
    } catch (err) {
      if (err.status === 401 || err.status === 403) { toast('دسترسی مدیریتی لازم است.', 'err'); setTimeout(() => { location.href = '/dashboard'; }, 1200); return; }
      toast(err.message, 'err');
    }
  }

  /* ==========================================================================
     تحلیل ترافیک
     ========================================================================== */
  async function loadAnalyticsTab() {
    try {
      const res = await api(`/api/admin/analytics?days=${state.range}`);
      window.Charts.lineChart('[data-an-chart]', {
        series: [
          { name: 'کلیک‌ها', color: '#6366f1', data: res.series.map((s) => ({ x: s.day, y: s.clicks })) },
          { name: 'کاربران یکتا', color: '#22d3ee', data: res.series.map((s) => ({ x: s.day, y: s.uniques })) },
        ], height: 280,
      });
      window.Charts.barList('[data-an-browser]', res.breakdown.browser);
      window.Charts.barList('[data-an-os]', res.breakdown.os);
      window.Charts.donutChart('[data-an-device]', { data: res.breakdown.device, size: 150, centerLabel: 'بازدید' });
      window.Charts.barList('[data-an-ref]', res.breakdown.referrer);
      window.Charts.barChart('[data-an-hours]', { data: res.hourly.map((h) => ({ label: String(h.hour), value: h.value })), height: 210 });
      qs('[data-an-top]').innerHTML = res.top.links.map((l) => `<tr><td class="mono text-xs">/${escapeHtml(l.code)}</td>
        <td class="truncate" style="max-width:200px">${escapeHtml(l.title || '—')}</td><td><b>${fa(l.clicks)}</b></td><td>${fa(l.unique_clicks)}</td></tr>`).join('')
        || '<tr><td colspan="4" class="text-dim text-center">داده‌ای موجود نیست</td></tr>';
      qs('[data-an-domains]').innerHTML = res.top.domains.map((d) => `<tr><td class="mono text-xs">${escapeHtml(d.hostname)}</td><td><b>${fa(d.clicks)}</b></td></tr>`).join('')
        || '<tr><td colspan="2" class="text-dim text-center">دامنه‌ای ثبت نشده است</td></tr>';
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ==========================================================================
     کاربران
     ========================================================================== */
  async function loadUsers() {
    const p = state.users;
    const params = new URLSearchParams({ page: p.page, per_page: 15 });
    if (p.q) params.set('q', p.q);
    if (p.role) params.set('role', p.role);
    if (p.status) params.set('status', p.status);
    if (p.plan) params.set('plan', p.plan);
    const tbody = qs('[data-users-body]');
    tbody.innerHTML = L.tableSkeleton(5, 6);
    try {
      const res = await api('/api/admin/users?' + params.toString());
      p.items = res.items; p.total = res.total; p.pages = res.pages;
      qs('[data-users-total]').textContent = `${fa(res.total)} کاربر`;
      tbody.innerHTML = p.items.length ? p.items.map((u) => `
        <tr>
          <td><div class="flex" style="min-width:0">${avatarHtml(u, 38, true)}
            <div style="min-width:0"><b class="text-sm truncate" style="display:block">${escapeHtml(u.display_name || u.username)}</b>
            <span class="text-xs text-dim mono">@${escapeHtml(u.username)}${u.email ? ' · ' + escapeHtml(u.email) : ''}</span></div>
          </div></td>
          <td><span class="badge ${u.plan === 'free' ? '' : 'badge-brand'}">${escapeHtml(u.plan)}</span></td>
          <td>${u.role === 'admin' ? '<span class="badge badge-danger">مدیر</span>' : '<span class="badge">کاربر</span>'}</td>
          <td class="text-sm">${fa(u.links)} / ${fa(u.files)}<div class="text-xs text-dim">${u.bytes_label}</div></td>
          <td><b>${fa(u.clicks)}</b></td>
          <td>${u.status === 'active' ? '<span class="badge badge-ok">فعال</span>' : u.status === 'banned' ? '<span class="badge badge-danger">مسدود</span>' : '<span class="badge badge-warn">معلق</span>'}</td>
          <td class="text-xs text-dim nowrap">${timeAgo(u.created_at)}</td>
          <td><div class="actions">
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-user-view="${u.id}" title="جزئیات">${icon('eye', 15)}</button>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-user-edit="${u.id}" title="ویرایش">${icon('edit', 15)}</button>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-user-key="${u.id}" title="بازنشانی رمز">${icon('key', 15)}</button>
            ${u.id === state.user.id ? '' : `<button class="btn btn-ghost btn-icon btn-icon-sm" data-user-delete="${u.id}" style="color:var(--danger)" title="حذف">${icon('trash', 15)}</button>`}
          </div></td>
        </tr>`).join('') : `<tr><td colspan="8">${emptyState('کاربری یافت نشد', 'فیلترها را تغییر دهید.', 'users')}</td></tr>`;
      renderPagination(qs('[data-users-pagination]'), { ...p, onGo: (page) => { p.page = page; loadUsers(); } });
      bindDynamic();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="8">${emptyState('خطا', err.message, 'alert')}</td></tr>`; }
  }

  async function openUserDetail(id) {
    const m = modal({ title: 'جزئیات کاربر', body: '<div class="text-center" style="padding:30px"><span class="spinner lg"></span></div>', wide: true });
    try {
      const res = await api(`/api/admin/users/${id}`);
      const u = res.user;
      m.$('.modal-body').innerHTML = `
        <div class="flex wrap between mb-3" style="gap:12px">
          <div class="flex">${avatarHtml(u, 54, true)}
            <div><b>${escapeHtml(u.display_name || u.username)}</b>
              <div class="text-xs text-dim mono">@${escapeHtml(u.username)}${u.email ? ' · ' + escapeHtml(u.email) : ''}</div>
              <div class="text-xs text-dim">عضویت: ${jalali(u.created_at, false)} · آخرین ورود: ${u.last_login_at ? jalali(u.last_login_at) : '—'} · ${fa(u.login_count)} ورود</div>
            </div>
          </div>
          <div class="flex wrap" style="gap:6px">
            <span class="badge badge-brand">پلن ${escapeHtml(u.plan)}</span>
            <span class="badge ${u.status === 'active' ? 'badge-ok' : 'badge-danger'}">${escapeHtml(u.status)}</span>
            ${u.role === 'admin' ? '<span class="badge badge-danger">مدیر سامانه</span>' : ''}
          </div>
        </div>
        <div class="grid g-4 mb-3">
          <div class="stat-mini">${icon('link', 19)}<div><b>${fa(res.links.length)}</b><span>لینک</span></div></div>
          <div class="stat-mini">${icon('file', 19)}<div><b>${fa(res.files.length)}</b><span>فایل</span></div></div>
          <div class="stat-mini">${icon('domain', 19)}<div><b>${fa(res.domains.length)}</b><span>دامنه</span></div></div>
          <div class="stat-mini">${icon('bio', 19)}<div><b>${res.bio ? fa(res.bio.views) : '۰'}</b><span>بازدید بیو</span></div></div>
        </div>
        <h4 class="text-sm">لینک‌های اخیر</h4>
        <div class="table-wrap mb-3"><table class="table"><thead><tr><th>کد</th><th>مقصد</th><th>کلیک</th></tr></thead><tbody>
          ${res.links.slice(0, 8).map((l) => `<tr><td class="mono text-xs">/${escapeHtml(l.code)}</td>
            <td class="truncate" style="max-width:280px">${escapeHtml(l.target_url)}</td><td>${fa(l.clicks)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-dim text-center">لینکی ندارد</td></tr>'}
        </tbody></table></div>
        <h4 class="text-sm">فایل‌های اخیر</h4>
        <div class="table-wrap mb-3"><table class="table"><thead><tr><th>نام</th><th>حجم</th><th>دانلود</th></tr></thead><tbody>
          ${res.files.slice(0, 6).map((f) => `<tr><td class="truncate" style="max-width:260px">${escapeHtml(f.orig_name)}</td><td>${f.size_label}</td><td>${fa(f.downloads)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-dim text-center">فایلی ندارد</td></tr>'}
        </tbody></table></div>
        <h4 class="text-sm">آخرین فعالیت‌ها</h4>
        <ul class="text-xs text-dim">${res.logs.slice(0, 8).map((l) => `<li>${jalali(l.created_at)} — ${escapeHtml(l.action)} ${l.entity ? '(' + escapeHtml(l.entity) + ')' : ''}</li>`).join('') || '<li>فعالیتی ثبت نشده</li>'}</ul>`;
    } catch (err) { m.$('.modal-body').innerHTML = `<p>${escapeHtml(err.message)}</p>`; }
  }

  function openUserEdit(user) {
    const m = modal({
      title: `ویرایش کاربر @${user.username}`,
      body: `<form data-user-form>
        <div class="grid g-2" style="gap:12px">
          <label class="field"><span class="label">نام نمایشی</span><input class="input" name="display_name" value="${escapeHtml(user.display_name || '')}"></label>
          <label class="field"><span class="label">ایمیل</span><input class="input mono" dir="ltr" name="email" value="${escapeHtml(user.email || '')}"></label>
          <label class="field"><span class="label">پلن</span>
            <select class="select" name="plan">
              ${['free', 'pro', 'business'].map((p) => `<option value="${p}" ${user.plan === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select></label>
          <label class="field"><span class="label">نقش</span>
            <select class="select" name="role"><option value="user" ${user.role === 'user' ? 'selected' : ''}>کاربر عادی</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مدیر سامانه</option></select></label>
          <label class="field"><span class="label">وضعیت</span>
            <select class="select" name="status">
              <option value="active" ${user.status === 'active' ? 'selected' : ''}>فعال</option>
              <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>معلق</option>
              <option value="banned" ${user.status === 'banned' ? 'selected' : ''}>مسدود</option>
            </select></label>
        </div>
        <p class="hint">با مسدود یا معلق کردن کاربر، همه نشست‌های او بسته می‌شود. سهمیه‌ها بر اساس پلن اعمال می‌شوند.</p>
      </form>`,
      footer: `<button class="btn btn-primary" data-save>${icon('save', 16)} ذخیره تغییرات</button>
               <button class="btn btn-outline" data-goto-links>${icon('link', 16)} لینک‌های این کاربر</button>
               <button class="btn btn-ghost" data-close>انصراف</button>`,
    });
    m.$('[data-save]').addEventListener('click', async (e) => {
      const d = L.serializeForm(m.$('[data-user-form]'));
      btnLoading(e.currentTarget, true);
      try {
        await api(`/api/admin/users/${user.id}`, { method: 'PATCH', body: d });
        toast('کاربر به‌روزرسانی شد.', 'ok'); m.close(); loadUsers();
      } catch (err) { toast(err.message, 'err'); btnLoading(e.currentTarget, false); }
    });
    m.$('[data-goto-links]').addEventListener('click', () => {
      m.close(); state.links.q = '@' + user.username; state.links.page = 1;
      switchTab('links'); setTimeout(() => { const i = qs('[data-admin-links-search]'); if (i) i.value = user.username; }, 100);
    });
  }

  /* ==========================================================================
     لینک‌ها
     ========================================================================== */
  async function loadLinks() {
    const p = state.links;
    const params = new URLSearchParams({ page: p.page, per_page: 20 });
    if (p.q) params.set('q', p.q);
    if (p.status) params.set('status', p.status);
    const tbody = qs('[data-admin-links-body]');
    tbody.innerHTML = L.tableSkeleton(5, 6);
    try {
      const res = await api('/api/admin/links?' + params.toString());
      p.items = res.items; p.total = res.total; p.pages = res.pages;
      qs('[data-admin-links-total]').textContent = `${fa(res.total)} لینک`;
      tbody.innerHTML = p.items.length ? p.items.map((l) => `
        <tr>
          <td><div class="copy-cell"><button class="btn btn-ghost btn-icon btn-icon-sm" data-copy="${'/' + escapeHtml(l.code)}" data-copy-full="${escapeHtml(l.code)}">${icon('copy', 14)}</button>
            <span class="mono text-xs">/${escapeHtml(l.code)}</span></div>
            ${l.domain_host ? `<span class="badge badge-brand" style="margin-top:3px">${escapeHtml(l.domain_host)}</span>` : ''}</td>
          <td class="truncate" style="max-width:230px"><a class="text-xs" href="${escapeHtml(l.target_url)}" target="_blank" rel="noopener">${escapeHtml(l.target_url.slice(0, 52))}</a></td>
          <td class="text-sm">${l.username ? '@' + escapeHtml(l.username) : '<span class="badge">مهمان</span>'}</td>
          <td><b>${fa(l.clicks)}</b><div class="text-xs text-dim">${fa(l.clicks_24h)} در ۲۴ ساعت</div></td>
          <td>${l.is_active ? '<span class="badge badge-ok">فعال</span>' : '<span class="badge badge-warn">غیرفعال</span>'}
            ${l.has_password ? '<span class="badge badge-info">رمزدار</span>' : ''}</td>
          <td class="text-xs text-dim nowrap">${timeAgo(l.created_at)}</td>
          <td><div class="actions">
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-admin-link-toggle="${l.id}" title="فعال/غیرفعال">${icon(l.is_active ? 'pause' : 'play', 15)}</button>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-admin-link-edit="${l.id}" title="ویرایش">${icon('edit', 15)}</button>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-admin-link-delete="${l.id}" title="حذف" style="color:var(--danger)">${icon('trash', 15)}</button>
          </div></td>
        </tr>`).join('') : `<tr><td colspan="7">${emptyState('لینکی یافت نشد', 'فیلتر را تغییر دهید.', 'link')}</td></tr>`;
      renderPagination(qs('[data-admin-links-pagination]'), { ...p, onGo: (page) => { p.page = page; loadLinks(); } });
      bindDynamic();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="7">${emptyState('خطا', err.message, 'alert')}</td></tr>`; }
  }

  function openAdminLinkEdit(link) {
    const m = modal({
      title: `ویرایش لینک /${link.code}`,
      body: `<form data-admin-link-form>
        <label class="field"><span class="label">آدرس مقصد</span><input class="input mono" dir="ltr" name="target_url" value="${escapeHtml(link.target_url)}"></label>
        <div class="grid g-2" style="gap:12px">
          <label class="field"><span class="label">کد لینک</span><input class="input mono" dir="ltr" name="code" value="${escapeHtml(link.code)}"></label>
          <label class="field"><span class="label">شناسه مالک (user_id)</span><input class="input" name="user_id" value="${link.user_id || ''}" inputmode="numeric"><span class="hint">خالی بگذارید تا مهمان بماند.</span></label>
        </div>
        <label class="checkbox"><input type="checkbox" name="is_active" ${link.is_active ? 'checked' : ''}> لینک فعال باشد</label>
      </form>`,
      footer: `<button class="btn btn-primary" data-save>${icon('save', 16)} ذخیره</button>
               <a class="btn btn-outline" href="${escapeHtml((link.domain_host ? '//' + link.domain_host : '') + '/' + link.code)}" target="_blank" rel="noopener">${icon('external', 16)} آزمایش لینک</a>
               <button class="btn btn-ghost" data-close>انصراف</button>`,
    });
    m.$('[data-save]').addEventListener('click', async (e) => {
      const d = L.serializeForm(m.$('[data-admin-link-form]'));
      const body = { target_url: d.target_url, code: d.code, is_active: d.is_active };
      if (d.user_id) body.user_id = Number(d.user_id);
      btnLoading(e.currentTarget, true);
      try {
        await api(`/api/admin/links/${link.id}`, { method: 'PATCH', body });
        toast('لینک به‌روزرسانی شد.', 'ok'); m.close(); loadLinks();
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
    const tbody = qs('[data-admin-files-body]');
    tbody.innerHTML = L.tableSkeleton(4, 6);
    try {
      const res = await api('/api/admin/files?' + params.toString());
      p.items = res.items; p.total = res.total; p.pages = res.pages;
      qs('[data-admin-files-total]').textContent = `${fa(res.total)} فایل`;
      qs('[data-admin-files-summary]').innerHTML = `
        <div class="stat-mini">${icon('file', 20)}<div><b>${fa(res.total)}</b><span>فایل</span></div></div>
        <div class="stat-mini">${icon('layers', 20)}<div><b>${res.summary.bytes_label}</b><span>فضای مصرفی</span></div></div>
        <div class="stat-mini">${icon('download', 20)}<div><b>${fa(res.summary.downloads)}</b><span>کل دانلود</span></div></div>`;
      tbody.innerHTML = p.items.length ? p.items.map((f) => `
        <tr>
          <td><div class="flex" style="min-width:0"><span class="file-icon-box ${fileKind(f.mime, f.orig_name)}">${escapeHtml(fileExt(f.orig_name))}</span>
            <div style="min-width:0"><b class="text-sm truncate" style="display:block;max-width:220px">${escapeHtml(f.orig_name)}</b>
            <span class="text-xs text-dim">${escapeHtml(f.mime || '')}</span></div></div></td>
          <td class="mono text-xs">/f/${escapeHtml(f.code)}</td>
          <td class="text-sm">${f.username ? '@' + escapeHtml(f.username) : '<span class="badge">مهمان</span>'}</td>
          <td class="nowrap">${f.size_label}</td>
          <td><b>${fa(f.downloads)}</b><div class="text-xs text-dim">${fa(f.views)} بازدید</div></td>
          <td>${f.is_active ? '<span class="badge badge-ok">فعال</span>' : '<span class="badge badge-warn">غیرفعال</span>'}
            ${f.has_password ? '<span class="badge badge-info">رمزدار</span>' : ''}</td>
          <td><div class="actions">
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-copy="${escapeHtml(f.url || '/f/' + f.code)}" title="کپی آدرس">${icon('copy', 15)}</button>
            <a class="btn btn-ghost btn-icon btn-icon-sm" href="/f/${escapeHtml(f.code)}" target="_blank" rel="noopener" title="مشاهده">${icon('external', 15)}</a>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-admin-file-delete="${f.id}" style="color:var(--danger)" title="حذف">${icon('trash', 15)}</button>
          </div></td>
        </tr>`).join('') : `<tr><td colspan="7">${emptyState('فایلی یافت نشد', 'فیلتر را تغییر دهید.', 'file')}</td></tr>`;
      renderPagination(qs('[data-admin-files-pagination]'), { ...p, onGo: (page) => { p.page = page; loadFiles(); } });
      bindDynamic();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="7">${emptyState('خطا', err.message, 'alert')}</td></tr>`; }
  }

  /* ==========================================================================
     دامنه‌ها و بیو لینک‌ها
     ========================================================================== */
  async function loadDomains() {
    const tbody = qs('[data-admin-domains-body]');
    tbody.innerHTML = L.tableSkeleton(4, 6);
    try {
      const res = await api('/api/admin/domains');
      state.domains = res.items;
      qs('[data-admin-domains-total]').textContent = `${fa(res.items.length)} دامنه (${fa(res.items.filter((d) => d.status === 'verified').length)} تأییدشده)`;
      qsa('[data-count="domains"]').forEach((el) => { el.textContent = fa(res.items.filter((d) => d.status === 'pending').length); });
      tbody.innerHTML = res.items.length ? res.items.map((d) => `
        <tr>
          <td class="mono text-sm">${escapeHtml(d.hostname)}</td>
          <td class="text-sm">${d.username ? '@' + escapeHtml(d.username) : '—'}</td>
          <td>${d.status === 'verified' ? '<span class="badge badge-ok">تأییدشده</span>' : d.status === 'rejected' ? '<span class="badge badge-danger">ردشده</span>' : '<span class="badge badge-warn">در انتظار</span>'}
            ${d.dns_ok ? '<span class="badge badge-info">DNS سالمه</span>' : ''}</td>
          <td class="text-xs">${escapeHtml(d.mode)}</td>
          <td>${fa(d.links)} / <b>${fa(d.clicks)}</b></td>
          <td class="text-xs text-dim nowrap">${timeAgo(d.created_at)}</td>
          <td><div class="actions">
            ${d.status !== 'verified' ? `<button class="btn btn-soft btn-sm" data-domain-approve="${d.id}">${icon('check', 14)} تأیید</button>` : `<button class="btn btn-outline btn-sm" data-domain-reject="${d.id}">${icon('pause', 14)} تعلیق</button>`}
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-domain-detail="${d.id}" title="جزئیات">${icon('eye', 15)}</button>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-admin-domain-delete="${d.id}" style="color:var(--danger)" title="حذف">${icon('trash', 15)}</button>
          </div></td>
        </tr>`).join('') : `<tr><td colspan="7">${emptyState('دامنه‌ای ثبت نشده است', 'کاربران می‌توانند از داشبورد خود دامنه اضافه کنند.', 'domain')}</td></tr>`;
      bindDynamic();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="7">${emptyState('خطا', err.message, 'alert')}</td></tr>`; }
  }

  async function loadBioPages() {
    const tbody = qs('[data-admin-bio-body]');
    tbody.innerHTML = L.tableSkeleton(4, 6);
    try {
      const res = await api('/api/admin/bio');
      state.bio = res.items;
      qs('[data-admin-bio-total]').textContent = `${fa(res.items.length)} صفحه`;
      tbody.innerHTML = res.items.length ? res.items.map((p) => `
        <tr>
          <td class="text-sm">${p.username ? '@' + escapeHtml(p.username) : '—'}</td>
          <td class="mono text-xs">/u/${escapeHtml(p.slug)}</td>
          <td class="truncate" style="max-width:200px">${escapeHtml(p.title || '—')}</td>
          <td>${fa(p.blocks)}</td>
          <td><b>${fa(p.views)}</b></td>
          <td>${p.published ? '<span class="badge badge-ok">منتشرشده</span>' : '<span class="badge badge-warn">پیش‌نویس</span>'}</td>
          <td><div class="actions">
            <a class="btn btn-ghost btn-icon btn-icon-sm" href="/u/${escapeHtml(p.slug)}" target="_blank" rel="noopener" title="مشاهده">${icon('external', 15)}</a>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-bio-edit="${p.id}" title="ویرایش">${icon('edit', 15)}</button>
            <button class="btn btn-ghost btn-icon btn-icon-sm" data-bio-publish="${p.id}" title="انتشار/پیش‌نویس">${icon(p.published ? 'pause' : 'play', 15)}</button>
          </div></td>
        </tr>`).join('') : `<tr><td colspan="7">${emptyState('صفحه‌ای ساخته نشده', 'کاربران با ثبت‌نام یک صفحه پیش‌فرض می‌گیرند.', 'bio')}</td></tr>`;
      bindDynamic();
    } catch (err) { tbody.innerHTML = `<tr><td colspan="7">${emptyState('خطا', err.message, 'alert')}</td></tr>`; }
  }

  /* ==========================================================================
     تنظیمات / اطلاعیه‌ها / گزارش‌ها
     ========================================================================== */
  async function loadSettings() {
    try {
      const res = await api('/api/admin/settings');
      state.settings = res.settings;
      const form = qs('[data-settings-form]');
      Object.entries(res.settings).forEach(([key, value]) => {
        const input = form.elements[key];
        if (!input) return;
        if (input.type === 'checkbox') input.checked = value === '1' || value === true;
        else input.value = value == null ? '' : value;
      });
      qsa('[data-setting]').forEach((input) => {
        const key = input.dataset.setting;
        const value = res.settings[key];
        if (input.type === 'checkbox') input.checked = value === '1' || value === true;
        else if (input.tagName === 'SELECT') input.value = value;
        else input.value = value == null ? '' : value;
      });
    } catch (err) { toast(err.message, 'err'); }
  }

  async function loadAnnouncements() {
    try {
      const res = await api('/api/admin/announcements');
      qs('[data-announcements-list]').innerHTML = res.items.length ? `<div class="flex-col" style="gap:12px">${res.items.map((a) => `
        <div class="panel">
          <div class="flex between mb-1">
            <b class="text-sm">${escapeHtml(a.title)}</b>
            <div class="flex" style="gap:6px">
              <span class="badge ${a.level === 'danger' ? 'badge-danger' : a.level === 'warning' ? 'badge-warn' : a.level === 'success' ? 'badge-ok' : 'badge-info'}">${escapeHtml(a.level)}</span>
              <span class="text-xs text-dim">${timeAgo(a.created_at)}</span>
              <button class="btn btn-ghost btn-icon btn-icon-sm" data-ann-delete="${a.id}" style="color:var(--danger)">${icon('trash', 14)}</button>
            </div>
          </div>
          ${a.body ? `<p class="text-xs text-dim mb-0">${escapeHtml(a.body)}</p>` : ''}
        </div>`).join('')}</div>` : emptyState('اطلاعیه‌ای ثبت نشده', 'اولین اطلاعیه را از فرم کنار بسازید.', 'bell');
      bindDynamic();
    } catch (err) { toast(err.message, 'err'); }
  }

  async function loadLogs() {
    const p = state.logs;
    const params = new URLSearchParams({ page: p.page, per_page: 25 });
    if (p.q) params.set('q', p.q);
    const tbody = qs('[data-logs-body]');
    tbody.innerHTML = L.tableSkeleton(6, 6);
    try {
      const res = await api('/api/admin/logs?' + params.toString());
      p.items = res.items; p.total = res.total; p.pages = res.pages;
      tbody.innerHTML = p.items.length ? p.items.map((l) => `
        <tr><td class="text-xs nowrap">${jalali(l.created_at)}</td>
          <td class="text-sm">${escapeHtml(l.actor_name || 'سیستم')}</td>
          <td><span class="badge badge-brand">${escapeHtml(l.action)}</span></td>
          <td class="text-xs text-dim">${escapeHtml(l.entity || '—')} ${l.entity_id ? '#' + escapeHtml(l.entity_id) : ''}</td>
          <td class="mono text-xs">${escapeHtml(l.ip || '—')}</td>
          <td class="text-xs text-dim truncate" style="max-width:260px;direction:ltr;text-align:left">${escapeHtml(l.meta || '')}</td></tr>`).join('')
        : `<tr><td colspan="6">${emptyState('گزارشی یافت نشد', 'فیلتر را تغییر دهید.', 'clipboard')}</td></tr>`;
      renderPagination(qs('[data-logs-pagination]'), { ...p, onGo: (page) => { p.page = page; loadLogs(); } });
    } catch (err) { tbody.innerHTML = `<tr><td colspan="6">${emptyState('خطا', err.message, 'alert')}</td></tr>`; }
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

    bind('[data-copy]', 'copy', (e) => {
      const el = e.currentTarget;
      if (el.dataset.copyFull) copy((location.origin) + '/' + el.dataset.copyFull);
      else copy(el.dataset.copy);
    });
    bind('[data-tab]', 'tab', (e) => switchTab(e.currentTarget.dataset.tab));

    bind('[data-user-view]', 'uview', (e) => openUserDetail(e.currentTarget.dataset.userView));
    bind('[data-user-edit]', 'uedit', (e) => {
      const u = state.users.items.find((x) => String(x.id) === e.currentTarget.dataset.userEdit);
      if (u) openUserEdit(u);
    });
    bind('[data-user-key]', 'ukey', async (e) => {
      const u = state.users.items.find((x) => String(x.id) === e.currentTarget.dataset.userKey);
      if (!u) return;
      const yes = await confirmDialog({ title: 'بازنشانی رمز عبور', message: `برای @${u.username} رمز موقت ساخته شود؟`, confirmText: 'بساز' });
      if (!yes) return;
      try {
        const res = await api(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' });
        modal({
          title: 'رمز عبور جدید ساخته شد',
          body: `<p class="text-sm">این رمز را به کاربر اطلاع دهید. پس از ورود، توصیه کنید رمز را تغییر دهد.</p>
            <div class="code-block" style="font-size:1rem">${escapeHtml(res.password)}</div>`,
          footer: `<button class="btn btn-primary" data-copy="${escapeHtml(res.password)}">${icon('copy', 16)} کپی رمز</button><button class="btn btn-ghost" data-close>بستن</button>`,
        });
        bindDynamic();
      } catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-user-delete]', 'udel', async (e) => {
      const u = state.users.items.find((x) => String(x.id) === e.currentTarget.dataset.userDelete);
      if (!u) return;
      const yes = await confirmDialog({ title: 'حذف کاربر', message: `کاربر @${u.username} به همراه همه لینک‌ها، فایل‌ها و صفحات بیو حذف شود؟ این کار بازگشت‌پذیر نیست.`, confirmText: 'حذف کامل' });
      if (!yes) return;
      try { await api(`/api/admin/users/${u.id}`, { method: 'DELETE' }); toast('کاربر حذف شد.', 'ok'); loadUsers(); loadDashboard(); }
      catch (err) { toast(err.message, 'err'); }
    });

    bind('[data-admin-link-toggle]', 'ltoggle', async (e) => {
      const l = state.links.items.find((x) => String(x.id) === e.currentTarget.dataset.adminLinkToggle);
      if (!l) return;
      try { await api(`/api/admin/links/${l.id}`, { method: 'PATCH', body: { is_active: !l.is_active } }); toast('وضعیت لینک تغییر کرد.', 'ok'); loadLinks(); }
      catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-admin-link-edit]', 'ledit', (e) => {
      const l = state.links.items.find((x) => String(x.id) === e.currentTarget.dataset.adminLinkEdit);
      if (l) openAdminLinkEdit(l);
    });
    bind('[data-admin-link-delete]', 'ldel', async (e) => {
      const l = state.links.items.find((x) => String(x.id) === e.currentTarget.dataset.adminLinkDelete);
      if (!l) return;
      const yes = await confirmDialog({ title: 'حذف لینک', message: `لینک /${l.code} حذف شود؟` });
      if (!yes) return;
      try { await api(`/api/admin/links/${l.id}`, { method: 'DELETE' }); toast('لینک حذف شد.', 'ok'); loadLinks(); }
      catch (err) { toast(err.message, 'err'); }
    });

    bind('[data-admin-file-delete]', 'fdel', async (e) => {
      const id = e.currentTarget.dataset.adminFileDelete;
      const yes = await confirmDialog({ title: 'حذف فایل', message: 'این فایل از سرور حذف شود؟' });
      if (!yes) return;
      try { await api(`/api/admin/files/${id}`, { method: 'DELETE' }); toast('فایل حذف شد.', 'ok'); loadFiles(); }
      catch (err) { toast(err.message, 'err'); }
    });

    bind('[data-domain-approve]', 'dappr', async (e) => {
      try {
        await api(`/api/admin/domains/${e.currentTarget.dataset.domainApprove}`, { method: 'PATCH', body: { status: 'verified' } });
        toast('دامنه تأیید شد ✅', 'ok'); loadDomains();
      } catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-domain-reject]', 'drej', async (e) => {
      try {
        await api(`/api/admin/domains/${e.currentTarget.dataset.domainReject}`, { method: 'PATCH', body: { status: 'pending' } });
        toast('دامنه به حالت در انتظار برگشت.', 'warn'); loadDomains();
      } catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-domain-detail]', 'ddet', (e) => {
      const d = state.domains.find((x) => String(x.id) === e.currentTarget.dataset.domainDetail);
      if (!d) return;
      modal({
        title: `دامنه ${d.hostname}`,
        body: `<div class="flex-col" style="gap:12px">
          <div class="stat-mini">${icon('users', 18)}<div><b>${escapeHtml(d.username || '—')}</b><span>مالک دامنه</span></div></div>
          <div class="stat-mini">${icon('link', 18)}<div><b>${fa(d.links)}</b><span>لینک روی این دامنه</span></div></div>
          <div class="stat-mini">${icon('chart', 18)}<div><b>${fa(d.clicks)}</b><span>کلیک</span></div></div>
          <div class="stat-mini">${icon('clock', 18)}<div><b>${d.verified_at ? jalali(d.verified_at, false) : '—'}</b><span>تاریخ تأیید</span></div></div>
        </div>
        <h4 class="text-sm mt-3">توکن تأیید</h4>
        <div class="code-block">${escapeHtml(d.token)}</div>`,
        footer: `<button class="btn btn-primary" data-copy="${escapeHtml(d.token)}">${icon('copy', 15)} کپی توکن</button><button class="btn btn-ghost" data-close>بستن</button>`,
      });
      bindDynamic();
    });
    bind('[data-admin-domain-delete]', 'ddel', async (e) => {
      const d = state.domains.find((x) => String(x.id) === e.currentTarget.dataset.adminDomainDelete);
      const yes = await confirmDialog({ title: 'حذف دامنه', message: `دامنه ${d?.hostname || ''} و همه لینک‌های روی آن حذف شوند؟` });
      if (!yes) return;
      try { await api(`/api/admin/domains/${e.currentTarget.dataset.adminDomainDelete}`, { method: 'DELETE' }); toast('دامنه حذف شد.', 'ok'); loadDomains(); }
      catch (err) { toast(err.message, 'err'); }
    });

    bind('[data-bio-publish]', 'bp', async (e) => {
      const p = state.bio.find((x) => String(x.id) === e.currentTarget.dataset.bioPublish);
      if (!p) return;
      try {
        await api(`/api/admin/bio/${p.id}`, { method: 'PATCH', body: { published: !p.published } });
        toast('وضعیت صفحه تغییر کرد.', 'ok'); loadBioPages();
      } catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-bio-edit]', 'be', (e) => {
      const p = state.bio.find((x) => String(x.id) === e.currentTarget.dataset.bioEdit);
      if (!p) return;
      const m = modal({
        title: `ویرایش صفحه @${p.username}`,
        body: `<label class="field"><span class="label">نشانی صفحه</span><input class="input mono" dir="ltr" data-bio-slug value="${escapeHtml(p.slug)}"></label>`,
        footer: `<button class="btn btn-primary" data-save>${icon('save', 16)} ذخیره</button><button class="btn btn-ghost" data-close>انصراف</button>`,
      });
      m.$('[data-save]').addEventListener('click', async (e2) => {
        btnLoading(e2.currentTarget, true);
        try {
          await api(`/api/admin/bio/${p.id}`, { method: 'PATCH', body: { slug: m.$('[data-bio-slug]').value.trim() } });
          toast('نشانی صفحه ذخیره شد.', 'ok'); m.close(); loadBioPages();
        } catch (err) { toast(err.message, 'err'); btnLoading(e2.currentTarget, false); }
      });
    });

    bind('[data-ann-delete]', 'andel', async (e) => {
      const yes = await confirmDialog({ title: 'حذف اطلاعیه', message: 'این اطلاعیه حذف شود؟' });
      if (!yes) return;
      try { await api(`/api/admin/announcements/${e.currentTarget.dataset.annDelete}`, { method: 'DELETE' }); toast('حذف شد.', 'ok'); loadAnnouncements(); }
      catch (err) { toast(err.message, 'err'); }
    });

    bind('[data-action="logout"]', 'logout', async () => {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
      location.href = '/login';
    });
    bind('[data-action="maintenance"]', 'maint', async () => {
      const on = String(state.settings.maintenance) === '1';
      if (!on) {
        const yes = await confirmDialog({ title: 'فعال‌سازی حالت تعمیر', message: 'سایت برای کاربران عادی غیرفعال می‌شود و فقط مدیران دسترسی دارند. ادامه؟', confirmText: 'فعال کن' });
        if (!yes) return;
      }
      try {
        const res = await api('/api/admin/settings', { method: 'PUT', body: { maintenance: on ? '0' : '1' } });
        state.settings = res.settings;
        toast(on ? 'حالت تعمیر خاموش شد.' : 'حالت تعمیر روشن شد.', 'ok');
        loadDashboard();
      } catch (err) { toast(err.message, 'err'); }
    });
    bind('[data-action="export"]', 'exp', () => {
      modal({
        title: 'خروجی گرفتن داده‌ها',
        body: `<p class="text-sm text-dim">خروجی‌ها در قالب CSV (با پشتیبانی Excel فارسی) دانلود می‌شوند.</p>
          <div class="flex-col" style="gap:10px">
            <a class="btn btn-outline btn-block" href="/api/admin/export/users">${icon('users', 16)} خروجی کاربران</a>
            <a class="btn btn-outline btn-block" href="/api/admin/export/links">${icon('link', 16)} خروجی لینک‌ها</a>
            <a class="btn btn-outline btn-block" href="/api/admin/export/files">${icon('file', 16)} خروجی فایل‌ها</a>
            <a class="btn btn-outline btn-block" href="/api/admin/export/domains">${icon('domain', 16)} خروجی دامنه‌ها</a>
            <a class="btn btn-outline btn-block" href="/api/admin/logs/export">${icon('clipboard', 16)} خروجی گزارش‌های فعالیت</a>
          </div>`,
      });
    });
  }

  function bindToolbar() {
    qsa('[data-range]').forEach((btn) => btn.addEventListener('click', () => {
      qsa('[data-range]').forEach((b) => b.classList.toggle('active', b === btn));
      state.range = Number(btn.dataset.range);
      if (!qs('[data-panel="analytics"]').hidden) loadAnalyticsTab(); else loadDashboard();
    }));

    const us = qs('[data-users-search]');
    us.addEventListener('input', debounce(() => { state.users.q = us.value.trim(); state.users.page = 1; loadUsers(); }, 400));
    qs('[data-users-role]').addEventListener('change', (e) => { state.users.role = e.target.value; state.users.page = 1; loadUsers(); });
    qs('[data-users-status]').addEventListener('change', (e) => { state.users.status = e.target.value; state.users.page = 1; loadUsers(); });
    qs('[data-users-plan]').addEventListener('change', (e) => { state.users.plan = e.target.value; state.users.page = 1; loadUsers(); });

    const ls = qs('[data-admin-links-search]');
    ls.addEventListener('input', debounce(() => { state.links.q = ls.value.trim(); state.links.page = 1; loadLinks(); }, 400));
    qs('[data-admin-links-status]').addEventListener('change', (e) => { state.links.status = e.target.value; state.links.page = 1; loadLinks(); });

    const fs = qs('[data-admin-files-search]');
    fs.addEventListener('input', debounce(() => { state.files.q = fs.value.trim(); state.files.page = 1; loadFiles(); }, 400));

    const gs = qs('[data-logs-search]');
    gs.addEventListener('input', debounce(() => { state.logs.q = gs.value.trim(); state.logs.page = 1; loadLogs(); }, 400));

    qs('[data-settings-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = qs('button[type=submit]', e.target);
      const body = L.serializeForm(e.target);
      qsa('[data-setting]').forEach((input) => {
        body[input.dataset.setting] = input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value;
      });
      btnLoading(btn, true);
      try {
        const res = await api('/api/admin/settings', { method: 'PUT', body });
        state.settings = res.settings;
        toast('تنظیمات ذخیره شد ✅', 'ok');
        showAnnouncement(await loadSiteConfig(true));
      } catch (err) { toast(err.message, 'err'); } finally { btnLoading(btn, false); }
    });

    qs('[data-announcement-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = qs('button[type=submit]', e.target);
      const d = L.serializeForm(e.target);
      btnLoading(btn, true);
      try {
        await api('/api/admin/announcements', { method: 'POST', body: d });
        toast('اطلاعیه ثبت شد.', 'ok'); e.target.reset(); loadAnnouncements();
      } catch (err) { toast(err.message, 'err'); } finally { btnLoading(btn, false); }
    });
  }

  /* ------------------------------- راه‌اندازی ------------------------------ */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const me = await api('/api/auth/me');
      if (!me.user) { location.href = '/login?redirect=' + encodeURIComponent('/admin-panel'); return; }
      if (me.user.role !== 'admin') { toast('این بخش مخصوص مدیران است.', 'err'); setTimeout(() => { location.href = '/dashboard'; }, 1200); return; }
      state.user = me.user;
    } catch { location.href = '/login?redirect=' + encodeURIComponent('/admin-panel'); return; }

    const cfg = await loadSiteConfig();
    state.site = cfg.site || {};
    showAnnouncement(cfg);
    qs('[data-admin-avatar]').innerHTML = avatarHtml(state.user, 32, true);
    qsa('[data-admin-name], [data-admin-name-2]').forEach((el) => { el.textContent = state.user.display_name || state.user.username; });

    try { const s = await api('/api/admin/settings'); state.settings = s.settings; } catch { /* ignore */ }
    bindToolbar();
    bindDynamic();
    switchTab(new URLSearchParams(location.search).get('tab') || 'dashboard', false);
  });

  window.AdminPanel = { state, switchTab };
})();
