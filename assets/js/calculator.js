/* =========================================================================
   FINSERV — Live savings calculator
   Sliders drive an instant projection, an interactive growth chart,
   and a live legacy-bank comparison. No submit button required.
   ========================================================================= */

(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const shell = $('.calc-shell');
  if (!shell) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEGACY_RATE = 0.0001;   // 0.01% APY — typical big-bank savings rate

  /* ---------------------------------------------------------------------
     Formatting
     --------------------------------------------------------------------- */
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const moneyShort = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  });
  const compact = v => {
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
    if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'k';
    return '$' + Math.round(v);
  };

  /* ---------------------------------------------------------------------
     Math — monthly compounding, contributions at period end
     --------------------------------------------------------------------- */
  const project = (deposit, monthly, months, annualRate) => {
    const r = annualRate / 12;
    if (r === 0) return deposit + monthly * months;
    const growth = Math.pow(1 + r, months);
    return deposit * growth + monthly * ((growth - 1) / r);
  };

  // One point per year (index 0 = today)
  const series = (deposit, monthly, years, annualRate) => {
    const pts = [];
    for (let y = 0; y <= years; y++) {
      const months = y * 12;
      pts.push({
        year: y,
        principal: deposit + monthly * months,
        total: project(deposit, monthly, months, annualRate)
      });
    }
    return pts;
  };

  /* ---------------------------------------------------------------------
     Inputs
     --------------------------------------------------------------------- */
  const state = { deposit: 10000, monthly: 500, years: 10, rate: 0.045 };

  const sliders = [
    { el: $('#initial-deposit'),       out: $('#initial-deposit-val'),       key: 'deposit', fmt: v => moneyShort.format(v) },
    { el: $('#monthly-contribution'),  out: $('#monthly-contribution-val'),  key: 'monthly', fmt: v => moneyShort.format(v) },
    { el: $('#years'),                 out: $('#years-val'),                 key: 'years',
      fmt: v => v + (v === 1 ? ' year' : ' years') }
  ].filter(s => s.el);

  const paintTrack = el => {
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    el.style.setProperty('--fill', ((el.value - min) / (max - min)) * 100 + '%');
  };

  const bump = out => {
    if (!out) return;
    out.classList.add('bump');
    clearTimeout(out._t);
    out._t = setTimeout(() => out.classList.remove('bump'), 420);
  };

  /* ---------------------------------------------------------------------
     Growth chart
     --------------------------------------------------------------------- */
  const chartWrap = $('.chart-wrap');
  const svg = $('#growth-chart');
  const tooltip = $('#chart-tooltip');
  const PAD = { t: 16, r: 10, b: 26, l: 10 };
  let geometry = null;   // { pts, xy[], w, h }
  let firstDraw = true;

  const smooth = xy => {
    if (xy.length < 2) return '';
    let d = `M ${xy[0][0]} ${xy[0][1]}`;
    for (let i = 0; i < xy.length - 1; i++) {
      const p0 = xy[i - 1] || xy[i];
      const p1 = xy[i];
      const p2 = xy[i + 1];
      const p3 = xy[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
    }
    return d;
  };

  const drawChart = pts => {
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const w = Math.max(rect.width || svg.clientWidth || 520, 240);
    const h = rect.height || 210;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const innerW = w - PAD.l - PAD.r;
    const innerH = h - PAD.t - PAD.b;
    const maxVal = Math.max(pts[pts.length - 1].total, 1);
    const lastYear = Math.max(pts.length - 1, 1);

    const x = i => PAD.l + (i / lastYear) * innerW;
    const y = v => PAD.t + innerH - (v / maxVal) * innerH;

    const totalXY = pts.map((p, i) => [x(i), y(p.total)]);
    const princXY = pts.map((p, i) => [x(i), y(p.principal)]);

    const baseline = PAD.t + innerH;
    const areaOf = xy => smooth(xy) + ` L ${xy[xy.length - 1][0]} ${baseline} L ${xy[0][0]} ${baseline} Z`;

    // Horizontal grid + value labels. The zero line gets no label — it would
    // collide with the "0y" tick sitting directly beneath it.
    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const gy = PAD.t + (innerH / 3) * i;
      grid += `<line class="chart-grid-line" x1="${PAD.l}" y1="${gy}" x2="${w - PAD.r}" y2="${gy}"></line>`;
      if (i < 3) {
        grid += `<text x="${PAD.l + 2}" y="${gy - 5}" fill="rgba(255,255,255,0.35)" font-size="9"
                   font-family="JetBrains Mono, monospace">${compact(maxVal * (1 - i / 3))}</text>`;
      }
    }

    // Year ticks — at most 6 labels
    const stepY = Math.max(1, Math.ceil(lastYear / 5));
    let ticks = '';
    for (let i = 0; i <= lastYear; i += stepY) {
      ticks += `<text x="${x(i)}" y="${h - 8}" fill="rgba(255,255,255,0.4)" font-size="9"
                  text-anchor="middle" font-family="JetBrains Mono, monospace">${i}y</text>`;
    }

    svg.innerHTML = `
      <defs>
        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.42"></stop>
          <stop offset="100%" stop-color="#2dd4bf" stop-opacity="0.02"></stop>
        </linearGradient>
        <linearGradient id="gradPrincipal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"></stop>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.01"></stop>
        </linearGradient>
      </defs>
      ${grid}${ticks}
      <path class="area-total" d="${areaOf(totalXY)}"></path>
      <path class="area-principal" d="${areaOf(princXY)}"></path>
      <path class="line-principal" d="${smooth(princXY)}"></path>
      <path class="line-total" d="${smooth(totalXY)}"></path>
      <line class="chart-hover-line" x1="0" y1="${PAD.t}" x2="0" y2="${baseline}"></line>
      <circle class="chart-dot" cx="0" cy="0" r="5"></circle>
    `;

    // Trace the line in on first paint only - re-tracing on every
    // slider tick would fight the drag.
    if (firstDraw && !prefersReduced) {
      const line = $('.line-total', svg);
      if (line && line.getTotalLength) {
        const len = line.getTotalLength();
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
        line.getBoundingClientRect();       // force layout
        line.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)';
        line.style.strokeDashoffset = '0';
      }
    }

    firstDraw = false;
    geometry = { pts, xy: totalXY, w, h };
  };

  const initChartHover = () => {
    if (!chartWrap || !svg || !tooltip) return;

    const move = e => {
      if (!geometry || !geometry.xy.length) return;
      const rect = svg.getBoundingClientRect();
      const scale = geometry.w / (rect.width || 1);
      const localX = (e.clientX - rect.left) * scale;

      let best = 0;
      let bestDist = Infinity;
      geometry.xy.forEach((p, i) => {
        const d = Math.abs(p[0] - localX);
        if (d < bestDist) { bestDist = d; best = i; }
      });

      const [px, py] = geometry.xy[best];
      const point = geometry.pts[best];

      const line = $('.chart-hover-line', svg);
      const dot = $('.chart-dot', svg);
      if (line) { line.setAttribute('x1', px); line.setAttribute('x2', px); }
      if (dot) { dot.setAttribute('cx', px); dot.setAttribute('cy', py); }

      const interest = Math.max(0, point.total - point.principal);
      tooltip.innerHTML = `
        <div class="tt-year">${point.year === 0 ? 'Today' : 'Year ' + point.year}</div>
        <div class="tt-row"><span>Balance</span><span>${money.format(point.total)}</span></div>
        <div class="tt-row"><span>Deposited</span><span>${money.format(point.principal)}</span></div>
        <div class="tt-row"><span>Interest</span><span style="color:#7df3dd">${money.format(interest)}</span></div>
      `;

      // Position within the wrapper, clamped to its edges
      const wrapRect = chartWrap.getBoundingClientRect();
      const svgOffsetX = rect.left - wrapRect.left;
      const svgOffsetY = rect.top - wrapRect.top;
      const ttW = tooltip.offsetWidth || 170;
      const left = Math.min(
        Math.max(svgOffsetX + px / scale, ttW / 2 + 4),
        wrapRect.width - ttW / 2 - 4
      );
      tooltip.style.left = left + 'px';
      tooltip.style.top = (svgOffsetY + py / scale) + 'px';

      chartWrap.classList.add('hovering');
    };

    chartWrap.addEventListener('pointermove', move);
    chartWrap.addEventListener('pointerleave', () => chartWrap.classList.remove('hovering'));
  };

  /* ---------------------------------------------------------------------
     Animated numbers
     --------------------------------------------------------------------- */
  const tweens = new WeakMap();
  const setNumber = (el, value, fmt = v => money.format(v)) => {
    if (!el) return;
    const from = tweens.get(el) || 0;
    if (prefersReduced || Math.abs(value - from) < 0.5) {
      tweens.set(el, value);
      el.textContent = fmt(value);
      return;
    }
    if (el._raf) cancelAnimationFrame(el._raf);

    const start = performance.now();
    const dur = 550;
    const step = now => {
      const p = Math.min((now - start) / dur, 1);
      const v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      el.textContent = fmt(v);
      if (p < 1) { el._raf = requestAnimationFrame(step); }
      else { tweens.set(el, value); }
    };
    el._raf = requestAnimationFrame(step);
  };

  /* ---------------------------------------------------------------------
     Render everything
     --------------------------------------------------------------------- */
  const out = {
    total: $('#res-total'),
    delta: $('#res-delta-val'),
    principal: $('#bd-principal'),
    interest: $('#bd-interest'),
    effective: $('#bd-effective'),
    splitP: $('#split-principal'),
    splitI: $('#split-interest'),
    // Comparison block
    tradInterest: $('#trad-interest'),
    tradFinal: $('#trad-final'),
    tradDeposits: $('#trad-deposits'),
    finInterest: $('#fin-interest'),
    finFinal: $('#fin-final'),
    finDeposits: $('#fin-deposits'),
    finRate: $('#fin-rate'),
    gapAmount: $('#gap-amount'),
    horizonLabels: $$('[data-horizon]'),
    rateLabels: $$('[data-rate-label]')
  };

  const render = () => {
    const { deposit, monthly, years, rate } = state;
    const months = years * 12;

    const pts = series(deposit, monthly, years, rate);
    const total = pts[pts.length - 1].total;
    const principal = deposit + monthly * months;
    const interest = Math.max(0, total - principal);

    setNumber(out.total, total);
    setNumber(out.delta, interest);
    setNumber(out.principal, principal);
    setNumber(out.interest, interest);
    if (out.effective) {
      setNumber(out.effective, principal > 0 ? (interest / principal) * 100 : 0,
        v => v.toFixed(1) + '%');
    }

    const pctP = principal > 0 ? (principal / total) * 100 : 100;
    if (out.splitP) out.splitP.style.width = pctP + '%';
    if (out.splitI) out.splitI.style.width = (100 - pctP) + '%';

    // Legacy bank comparison, driven by the same inputs
    const legacyTotal = project(deposit, monthly, months, LEGACY_RATE);
    const legacyInterest = Math.max(0, legacyTotal - principal);

    setNumber(out.tradDeposits, principal);
    setNumber(out.tradInterest, legacyInterest);
    setNumber(out.tradFinal, legacyTotal);
    setNumber(out.finDeposits, principal);
    setNumber(out.finInterest, interest);
    setNumber(out.finFinal, total);
    setNumber(out.gapAmount, Math.max(0, total - legacyTotal));

    if (out.finRate) out.finRate.textContent = (rate * 100).toFixed(2) + '%';
    out.horizonLabels.forEach(el => { el.textContent = years + (years === 1 ? ' yr' : ' yrs'); });
    out.rateLabels.forEach(el => { el.textContent = (rate * 100).toFixed(2) + '%'; });

    drawChart(pts);
  };

  /* ---------------------------------------------------------------------
     Wiring
     --------------------------------------------------------------------- */
  sliders.forEach(({ el, out: label, key, fmt }) => {
    const sync = (animateLabel = true) => {
      const v = parseFloat(el.value);
      state[key] = v;
      if (label) label.textContent = fmt(v);
      paintTrack(el);
      if (animateLabel) bump(label);
    };
    el.addEventListener('input', () => { sync(); render(); });
    sync(false);
  });

  // APY chips
  $$('.chip[data-apy]').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.chip[data-apy]').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      state.rate = parseFloat(chip.dataset.apy) / 100;
      render();
    });
  });

  // Quick-start presets
  $$('.chip[data-preset]').forEach(chip => {
    chip.addEventListener('click', () => {
      const [d, m, y] = chip.dataset.preset.split(',').map(Number);
      const apply = (slider, value) => {
        if (!slider) return;
        slider.value = Math.min(Math.max(value, +slider.min), +slider.max);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      };
      apply($('#initial-deposit'), d);
      apply($('#monthly-contribution'), m);
      apply($('#years'), y);
    });
  });

  // Keep the chart crisp on resize / theme flip
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 140);
  });
  document.addEventListener('themechange', () => setTimeout(render, 60));

  initChartHover();
  render();
})();
