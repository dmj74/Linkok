/* ==========================================================================
   Linkok — چارت‌های سبک SVG (بدون وابستگی خارجی)
   ========================================================================== */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const fa = (n) => new Intl.NumberFormat('fa-IR').format(Number(n) || 0);
  const uid = () => 'c' + Math.random().toString(36).slice(2, 9);
  const PALETTE = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /**
   * چارت خطی/سطحی
   * series: [{ name, color, data: [{x: label, y: value}] }]
   */
  function lineChart(host, { series = [], height = 240, showLegend = true, yTicks = 4 } = {}) {
    const el = typeof host === 'string' ? document.querySelector(host) : host;
    if (!el) return;
    const W = 760, H = height, pad = { top: 16, right: 16, bottom: 30, left: 44 };
    const labels = series[0]?.data.map((d) => d.x) || [];
    const allValues = series.flatMap((s) => s.data.map((d) => Number(d.y) || 0));
    const max = Math.max(1, ...allValues);
    const niceMax = Math.ceil(max / 5) * 5 || 5;
    const iw = W - pad.left - pad.right;
    const ih = H - pad.top - pad.bottom;
    const xAt = (i) => pad.left + (labels.length <= 1 ? iw / 2 : (i * iw) / (labels.length - 1));
    const yAt = (v) => pad.top + ih - ((Number(v) || 0) / niceMax) * ih;

    let defs = '';
    let grid = '';
    for (let t = 0; t <= yTicks; t++) {
      const value = (niceMax / yTicks) * t;
      const y = yAt(value);
      grid += `<line class="grid-line" x1="${pad.left}" x2="${W - pad.right}" y1="${y}" y2="${y}"/>
        <text class="axis-label" x="${pad.left - 8}" y="${y + 3}" text-anchor="end">${fa(Math.round(value))}</text>`;
    }
    const step = Math.max(1, Math.round(labels.length / 7));
    let xLabels = '';
    labels.forEach((lb, i) => {
      if (i % step && i !== labels.length - 1) return;
      xLabels += `<text class="axis-label" x="${xAt(i)}" y="${H - 8}" text-anchor="middle">${esc(String(lb).slice(5))}</text>`;
    });

    let paths = '';
    series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const gid = uid();
      const pts = s.data.map((d, i) => [xAt(i), yAt(d.y)]);
      if (!pts.length) return;
      const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${(pad.top + ih).toFixed(1)} L${pts[0][0].toFixed(1)},${(pad.top + ih).toFixed(1)} Z`;
      defs += `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".45"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient>`;
      paths += `<path class="area" d="${area}" fill="url(#${gid})"/>
        <path class="line" d="${line}" stroke="${color}"/>`;
      if (labels.length <= 40) {
        paths += pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="${color}" opacity=".85">
          <title>${esc(labels[i])}: ${fa(s.data[i]?.y)}</title></circle>`).join('');
      }
    });

    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="نمودار">
        <defs>${defs}</defs>${grid}${xLabels}${paths}
      </svg>${showLegend && series.length > 1 ? `<div class="chart-legend">${series.map((s, i) =>
        `<span><i style="background:${s.color || PALETTE[i % PALETTE.length]}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}`;
  }

  /** چارت میله‌ای: data = [{label, value}] */
  function barChart(host, { data = [], height = 220, horizontal = false, colors = null } = {}) {
    const el = typeof host === 'string' ? document.querySelector(host) : host;
    if (!el || !data.length) { if (el) el.innerHTML = '<p class="text-sm text-dim text-center">داده‌ای برای نمایش نیست</p>'; return; }
    const W = horizontal ? 640 : Math.max(320, data.length * 44);
    const H = height;
    const pad = { top: 14, right: 12, bottom: 26, left: horizontal ? 96 : 38 };
    const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
    const iw = W - pad.left - pad.right;
    const ih = H - pad.top - pad.bottom;
    let bars = '';
    if (horizontal) {
      const bh = Math.min(26, ih / data.length - 8);
      data.forEach((d, i) => {
        const y = pad.top + i * (ih / data.length) + 4;
        const w = ((Number(d.value) || 0) / max) * iw;
        const color = (colors && colors[i % colors.length]) || PALETTE[i % PALETTE.length];
        bars += `<rect class="bar" x="${pad.left}" y="${y}" width="${Math.max(2, w)}" height="${bh}" rx="6" fill="${color}">
            <title>${esc(d.label)}: ${fa(d.value)}</title></rect>
          <text class="axis-label" x="${pad.left - 8}" y="${y + bh / 2 + 3}" text-anchor="end">${esc(String(d.label).slice(0, 14))}</text>
          <text class="axis-label" x="${pad.left + w + 6}" y="${y + bh / 2 + 3}">${fa(d.value)}</text>`;
      });
    } else {
      const bw = Math.max(8, iw / data.length - 10);
      data.forEach((d, i) => {
        const h = ((Number(d.value) || 0) / max) * ih;
        const x = pad.left + i * (iw / data.length) + 5;
        const color = (colors && colors[i % colors.length]) || PALETTE[i % PALETTE.length];
        bars += `<rect class="bar" x="${x}" y="${pad.top + ih - h}" width="${bw}" height="${Math.max(2, h)}" rx="6" fill="${color}">
            <title>${esc(d.label)}: ${fa(d.value)}</title></rect>
          <text class="axis-label" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(String(d.label).slice(0, 6))}</text>`;
      });
    }
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="${horizontal ? 'xMidYMid meet' : 'none'}">${bars}</svg>`;
  }

  /** چارت دونات با راهنما */
  function donutChart(host, { data = [], size = 168, thickness = 22, centerLabel = '', centerValue = '' } = {}) {
    const el = typeof host === 'string' ? document.querySelector(host) : host;
    if (!el) return;
    const rows = data.filter((d) => Number(d.value) > 0);
    const total = rows.reduce((s, d) => s + Number(d.value), 0) || 1;
    const r = (size - thickness) / 2;
    const c = size / 2;
    let angle = -Math.PI / 2;
    let arcs = '';
    rows.forEach((d, i) => {
      const frac = Number(d.value) / total;
      const sweep = frac * Math.PI * 2;
      const x1 = c + r * Math.cos(angle), y1 = c + r * Math.sin(angle);
      angle += sweep;
      const x2 = c + r * Math.cos(angle), y2 = c + r * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      const color = PALETTE[i % PALETTE.length];
      arcs += `<path d="M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}"
        fill="none" stroke="${color}" stroke-width="${thickness}" stroke-linecap="butt">
        <title>${esc(d.label)}: ${fa(d.value)} (${fa(Math.round(frac * 100))}٪)</title></path>`;
    });
    el.innerHTML = `<div class="donut-wrap">
      <svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${arcs || `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}"/>`}
        <text x="${c}" y="${c - 2}" text-anchor="middle" fill="var(--text)" font-size="17" font-weight="700">${centerValue || fa(total)}</text>
        <text x="${c}" y="${c + 16}" text-anchor="middle" fill="var(--text-dim)" font-size="10">${esc(centerLabel)}</text>
      </svg>
      <div class="bar-list" style="flex:1;min-width:150px">
        ${rows.map((d, i) => `<div class="bar-item"><span style="width:10px;height:10px;border-radius:3px;background:${PALETTE[i % PALETTE.length]};flex-shrink:0"></span>
          <span class="bar-label">${esc(d.label)}</span><span class="bar-value">${fa(d.value)}</span></div>`).join('') || '<span class="text-dim text-sm">داده‌ای موجود نیست</span>'}
      </div>
    </div>`;
  }

  /** نوارهای افقی ساده (لیست) */
  function barList(host, data = [], { color = 'var(--brand-grad)' } = {}) {
    const el = typeof host === 'string' ? document.querySelector(host) : host;
    if (!el) return;
    const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
    el.innerHTML = data.length ? `<div class="bar-list">${data.map((d) => `
      <div class="bar-item">
        <span class="bar-label">${esc(d.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${((Number(d.value) || 0) / max) * 100}%;background:${color}"></span></span>
        <span class="bar-value">${fa(d.value)}</span>
      </div>`).join('')}</div>` : '<p class="text-sm text-dim">داده‌ای موجود نیست</p>';
  }

  /** اسپارک‌لاین کوچک برای کارت‌های آماری */
  function sparkline(host, values = [], { color = '#6366f1', height = 34 } = {}) {
    const el = typeof host === 'string' ? document.querySelector(host) : host;
    if (!el) return;
    const data = values.slice(-24);
    const max = Math.max(1, ...data);
    el.innerHTML = `<div class="spark">${data.map((v) => `<i style="height:${Math.max(6, ((Number(v) || 0) / max) * 100)}%;background:${color}"></i>`).join('')}</div>`;
    el.style.height = height + 'px';
  }

  window.Charts = { lineChart, barChart, donutChart, barList, sparkline, PALETTE };
})();
