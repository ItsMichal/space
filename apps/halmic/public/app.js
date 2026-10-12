// halmic behaviour: live/offline state from /api/live, bar meters (the logotype's bars as a level meter),
// click-to-load video (youtube-nocookie only after interaction). No dependencies.
// Testing override: ?live=1 (or ?live=0) forces the state and skips the fetch; with ?live=1 you can add &game=Name.
(() => {
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const override = params.get('live');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEAN = 13;

  // ---- live state: the page is offline until the status endpoint says otherwise ----
  const settle = () => { if (reduce) meters.forEach((m) => { for (let s = 0; s < 40; s++) tick(m, 3, 1 / 20); }); };
  function setLive(on, game) {
    root.dataset.live = on ? '1' : '0';
    const g = document.querySelector('[data-game]');
    if (g) { g.querySelector('[data-game-name]').textContent = on && game ? game : ''; g.hidden = !(on && game); }
    settle();
  }
  async function poll() {
    try {
      const r = await fetch('/api/live', { headers: { accept: 'application/json' } });
      if (!r.ok) return;
      const d = await r.json();
      setLive(d.live === true, typeof d.game === 'string' ? d.game : '');
    } catch { /* stay as we are: offline on first load */ }
  }
  root.dataset.live = '0';
  if (override === '0' || override === '1') { root.dataset.live = override; if (override === '1') queueMicrotask(() => setLive(true, params.get('game') || '')); }
  else {
    poll();
    setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 60000);
  }

  // ---- noise ----
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };

  // ---- meters ----
  // A meter is a row of leaning, fully-round bars (the logotype's bar) plus a dot at the end (the "!" dot).
  // Heights are springs chasing a hand-tuned signal; pointer contact kicks nearby bars; everything stays interruptible.
  const meters = [];
  function build(el) {
    const sc = innerWidth < 600 && el.dataset.count === 'fill' ? 0.5 : 1;   // phones: a denser, finer field
    const T = (+el.dataset.t || 20) * sc, pitch = (+el.dataset.pitch || T * 1.5) * sc, maxH = (+el.dataset.h || el.clientHeight || 120) * (sc === 1 ? 1 : 0.8);
    const dotMode = el.dataset.dot !== 'off';
    const fill = el.dataset.count === 'fill';
    let n = fill ? Math.ceil(el.clientWidth / pitch) + 2 : +el.dataset.count || 7;
    el.textContent = '';
    const bars = [];
    for (let i = 0; i < n; i++) {
      const b = document.createElement('i'); b.className = 'bar';
      b.style.cssText = `width:${T}px;left:${i * pitch}px;border-radius:${T}px;transform:skewX(-${LEAN}deg)`;
      el.appendChild(b);
      bars.push({ el: b, h: T, v: 0, seed: i * 1.7 + (+el.dataset.seed || 0) });
    }
    let dot = null;
    if (dotMode) { dot = document.createElement('i'); dot.className = 'mdot'; dot.style.cssText = `width:${T}px;height:${T}px;left:${n * pitch + T * 0.2}px`; el.appendChild(dot); }
    return { el, T, pitch, maxH, bars, dot, kick: [], run: true };
  }
  function target(m, b, i, t) {
    const T = m.T;
    if (root.dataset.live !== '1') return T + (m.maxH * 0.015) * (1 + Math.sin(t * 0.55 + b.seed));        // offline: low stumps that barely breathe
    const s = b.seed;
    const env = Math.pow(vnoise(t * 0.45 + s * 0.31), 1.6);                                                // slow speech-like envelope
    const wob = 0.5 + 0.28 * Math.sin(t * 1.3 + s) + 0.16 * Math.sin(t * 2.9 + s * 1.9) + 0.06 * Math.sin(t * 5.3 + s * 0.4);
    const level = Math.min(1, 0.12 + 0.88 * env * wob * 1.25);
    return T + (m.maxH - T) * level * (m.el.dataset.gain ? +m.el.dataset.gain : 1);
  }
  function tick(m, t, dt) {
    const k = 22, c = 2 * Math.sqrt(k) * 0.95;                                                             // slightly under-damped: a little follow-through
    m.bars.forEach((b, i) => {
      let tg = target(m, b, i, t);
      for (const p of m.kick) { const d = Math.abs(i * m.pitch + m.T / 2 - p.x) / (m.pitch * 2.2); if (d < 1) tg += (m.maxH - m.T) * 0.55 * p.s * (1 - d * d); }
      b.v += (k * (tg - b.h) - c * b.v) * dt; b.h += b.v * dt;
      b.el.style.height = Math.max(m.T, b.h).toFixed(1) + 'px';
    });
    m.kick = m.kick.map((p) => ({ ...p, s: p.s * Math.pow(0.12, dt) })).filter((p) => p.s > 0.02);
  }
  document.querySelectorAll('[data-meter]').forEach((el) => {
    const m = build(el); meters.push(m);
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); m.kick.push({ x: e.clientX - r.left, s: 0.5 }); if (m.kick.length > 6) m.kick.shift(); });
    el.addEventListener('pointerdown', (e) => { const r = el.getBoundingClientRect(); m.kick.push({ x: e.clientX - r.left, s: 1 }); });
    new IntersectionObserver(([en]) => { m.run = en.isIntersecting; }).observe(el);
    if (el.dataset.count === 'fill') new ResizeObserver(() => { const keep = m.run; Object.assign(m, build(el)); m.run = keep; }).observe(el.parentElement);
  });
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) meters.forEach((m) => m.run && tick(m, now / 1000, dt));
    requestAnimationFrame(frame);
  }
  if (reduce) settle(); else requestAnimationFrame(frame);

  // ---- click-to-load video ----
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-vid]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${a.dataset.vid}?autoplay=1&rel=0`;
    f.title = a.dataset.title; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.className = 'vframe';
    // a link can't hold an iframe: swap the card for a div with the player, same caption, plus a plain YouTube link
    const d = document.createElement('div'); d.className = a.className + ' playing';
    const th = document.createElement('span'); th.className = 'thumb'; th.appendChild(f);
    const cap = document.createElement('span'); cap.className = 'vt'; cap.textContent = a.dataset.title;
    const yt = document.createElement('a'); yt.className = 'vm'; yt.href = a.href; yt.textContent = 'open on YouTube';
    d.append(th, cap, yt); a.replaceWith(d);
  });
})();
