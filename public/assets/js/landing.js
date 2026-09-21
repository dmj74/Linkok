/* ==========================================================================
   Linkok — منطق صفحه اصلی (لندینگ)
   ========================================================================== */
(function () {
  'use strict';
  const { qs, qsa, api, toast, fa, shortNum, bytes, copy, icon, escapeHtml, loadSiteConfig, showAnnouncement, fileKind, fileExt } = window.LK;

  let site = { name: 'لینکوک' };

  /* ------------------------------- تب ابزارها ------------------------------- */
  function initToolTabs() {
    qsa('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        qsa('[data-tool]').forEach((b) => b.classList.toggle('active', b === btn));
        qs('[data-form="shorten"]').classList.toggle('hide', btn.dataset.tool !== 'shorten');
        qs('[data-form="upload"]').classList.toggle('hide', btn.dataset.tool !== 'upload');
        qs('[data-result]').classList.add('hide');
      });
    });
  }

  function showResult(shortUrl, qrUrl) {
    const box = qs('[data-result]');
    box.classList.remove('hide');
    qs('[data-result-url]').textContent = shortUrl;
    qs('[data-result-copy]').onclick = () => copy(shortUrl);
    const qr = qs('[data-result-qr]');
    qr.href = qrUrl || ('https://api.qrserver.com/v1/create-qr-code/?size=520x520&data=' + encodeURIComponent(shortUrl));
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ------------------------------ فرم کوتاه‌کننده --------------------------- */
  function initShortenForm() {
    const form = qs('[data-form="shorten"]');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = qs('button[type=submit]', form);
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.url || !data.url.trim()) return toast('آدرس مقصد را وارد کنید.', 'warn');
      LK.btnLoading(btn, true);
      try {
        const res = await api('/api/public/shorten', { method: 'POST', body: { url: data.url, alias: data.alias } });
        showResult(res.item.short_url, `/api/public/qr?data=${encodeURIComponent(res.item.short_url)}`);
        toast('لینک کوتاه ساخته شد ✅', 'ok');
        form.reset();
      } catch (err) {
        if (err.status === 401) {
          toast('برای ساخت لینک نامحدود حساب رایگان بسازید؛ در حال انتقال...', 'info');
          setTimeout(() => { location.href = '/register?redirect=' + encodeURIComponent('/dashboard?tab=links&new=1'); }, 1200);
        } else toast(err.message, 'err');
      } finally { LK.btnLoading(btn, false); }
    });
  }

  /* -------------------------------- آپلود فایل ----------------------------- */
  function initUpload() {
    const zone = qs('[data-dropzone]');
    const input = qs('[data-file-input]');
    if (!zone || !input) return;
    const list = qs('[data-upload-list]');
    const progress = qs('[data-progress]');
    const bar = progress ? progress.querySelector('i') : null;

    zone.addEventListener('click', () => input.click());
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', (e) => { if (e.dataTransfer.files?.length) sendFiles(e.dataTransfer.files); });
    input.addEventListener('change', () => { if (input.files.length) sendFiles(input.files); });

    function sendFiles(files) {
      const fd = new FormData();
      Array.from(files).slice(0, 5).forEach((f) => fd.append('files', f));
      progress.classList.remove('hide');
      if (bar) bar.style.width = '0%';
      list.innerHTML = '';

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files/upload');
      xhr.upload.onprogress = (e) => { if (bar && e.lengthComputable) bar.style.width = Math.round((e.loaded / e.total) * 100) + '%'; };
      xhr.onload = () => {
        progress.classList.add('hide');
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 400 || res.ok === false) {
          if (xhr.status === 401) {
            toast('برای آپلود فایل باید حساب بسازید. در حال انتقال به ثبت‌نام...', 'info');
            setTimeout(() => { location.href = '/register?redirect=' + encodeURIComponent('/dashboard?tab=files'); }, 1300);
          } else toast(res.error || 'آپلود ناموفق بود.', 'err');
          return;
        }
        list.innerHTML = res.items.map((f) => `
          <li class="stat-mini" style="justify-content:space-between">
            <div class="flex" style="min-width:0">
              <span class="file-icon-box ${fileKind(f.mime, f.orig_name)}">${escapeHtml(fileExt(f.orig_name))}</span>
              <div style="min-width:0">
                <b class="truncate" style="font-size:.85rem;display:block">${escapeHtml(f.orig_name)}</b>
                <span class="text-xs text-dim">${bytes(f.size)}</span>
              </div>
            </div>
            <button class="btn btn-soft btn-sm" data-copy-link="${escapeHtml(f.full_url)}">${icon('copy', 15)} کپی لینک</button>
          </li>`).join('');
        qsa('[data-copy-link]', list).forEach((b) => b.addEventListener('click', () => copy(b.dataset.copyLink)));
        if (res.items[0]) showResult(res.items[0].full_url);
        toast(res.message || 'فایل آپلود شد ✅', 'ok');
        input.value = '';
      };
      xhr.onerror = () => { progress.classList.add('hide'); toast('ارتباط با سرور قطع شد.', 'err'); };
      xhr.send(fd);
    }
  }

  /* ---------------------------------- آمار --------------------------------- */
  function initStats(cfg) {
    const stats = cfg?.stats || {};
    const put = (key, value) => qsa(`[data-stat="${key}"]`).forEach((el) => { el.textContent = value; });
    let n = 0;
    const animate = (el, value) => {
      const target = Number(value) || 0;
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / 900);
        el.textContent = shortNum(Math.floor(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    qsa('[data-stat="links"]').forEach((el) => setTimeout(() => animate(el, stats.links || 0), n++ * 120));
    qsa('[data-stat="clicks"]').forEach((el) => setTimeout(() => animate(el, stats.clicks || 0), n++ * 120));
    qsa('[data-stat="files"]').forEach((el) => setTimeout(() => animate(el, stats.files || 0), n++ * 120));
    qsa('[data-stat="users"]').forEach((el) => setTimeout(() => animate(el, stats.users || 0), n++ * 120));
  }

  /* ------------------------------ فایل‌های اخیر ---------------------------- */
  async function initRecentFiles() {
    const host = qs('[data-recent-files]');
    if (!host) return;
    try {
      const res = await api('/api/public/recent-files');
      const items = res.items || [];
      host.innerHTML = items.length ? items.map((f) => `
        <a class="stat-mini" href="/f/${escapeHtml(f.code)}" style="justify-content:space-between">
          <div class="flex" style="min-width:0">
            <span class="file-icon-box ${fileKind(f.mime, f.orig_name)}">${escapeHtml(fileExt(f.orig_name))}</span>
            <div style="min-width:0">
              <b class="truncate" style="font-size:.85rem;display:block">${escapeHtml(f.orig_name || 'فایل')}</b>
              <span class="text-xs text-dim">${bytes(f.size)} · ${fa(f.downloads || 0)} دانلود</span>
            </div>
          </div>
          <span class="badge badge-brand">${icon('download', 14)}</span>
        </a>`).join('')
        : `<div class="empty" style="padding:22px">${icon('file', 34)}<p class="text-sm mb-0">هنوز فایلی به اشتراک گذاشته نشده. اولین نفر باش!</p></div>`;
    } catch {
      host.innerHTML = `<div class="empty" style="padding:22px"><p class="text-sm mb-0">آمار فایل‌ها در دسترس نیست.</p></div>`;
    }
  }

  /* -------------------------------- سوالات -------------------------------- */
  function initFaq() {
    qsa('.faq-q').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const open = item.classList.contains('open');
        qsa('.faq-item').forEach((i) => i.classList.remove('open'));
        if (!open) item.classList.add('open');
      });
    });
  }

  /* -------------------------------- تعرفه‌ها ------------------------------- */
  function initPricing() {
    qsa('[data-price-cycle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        qsa('[data-price-cycle]').forEach((b) => b.classList.toggle('active', b === btn));
        const yearly = btn.dataset.priceCycle === 'yearly';
        qsa('[data-price]').forEach((el) => { el.textContent = yearly ? el.dataset.yearly : el.dataset.monthly; });
        qsa('.price-card small').forEach((s) => { if (s.textContent.includes('ماه')) s.textContent = yearly ? 'تومان / سال' : 'تومان / ماه'; });
      });
    });
  }

  /* ------------------------------- بارگذاری ------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    initToolTabs(); initShortenForm(); initUpload(); initFaq(); initPricing();
    const year = qs('[data-year]'); if (year) year.textContent = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(new Date());
    const cfg = await loadSiteConfig();
    site = cfg.site || site;
    showAnnouncement(cfg);
    initStats(cfg);
    initRecentFiles();
    const maxUp = qs('[data-max-upload]'); if (maxUp) maxUp.textContent = fa(site.max_upload_mb || 25);
    const contact = qs('[data-contact]');
    if (contact && site.contact) { contact.textContent = site.contact; contact.href = 'mailto:' + site.contact; }
    const foot = qs('[data-footer-text]'); if (foot && site.footer) foot.textContent = site.footer;
    qsa('[data-copy="domain"]').forEach((el) => el.addEventListener('click', () => copy((site.base_url || location.origin) + '/')));
    if (site.name) document.title = `${site.name} | ${site.tagline || 'کوتاه‌کننده لینک، بیو لینک و اشتراک فایل'}`;
  });
})();
