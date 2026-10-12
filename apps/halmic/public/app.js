// halmic behaviour: live/offline state from /api/live, bar meters (the logotype's bars as a level meter),
// click-to-load video (youtube-nocookie only after interaction) and Twitch clips, played in place inside their card. No dependencies.
// Testing override: ?live=1 (or ?live=0) forces the state and skips the fetch; with ?live=1 you can add &game=Name.
// ?clips=demo swaps in six fake clips (local video thumbnails) and skips the fetch (layout testing; the embed will not load a real clip).
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
      // no-store: the zone's Browser Cache TTL rewrites max-age to hours; the edge cache still shields Twitch
      const r = await fetch('/api/live', { cache: 'no-store', headers: { accept: 'application/json' } });
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

  // ---- icons (same sprite the build links) and small element helpers ----
  const SPRITE = (document.querySelector('use[href*="icons.svg"]')?.getAttribute('href') ?? '/icons.svg').split('#')[0];
  const NS = 'http://www.w3.org/2000/svg';
  const icon = (name, cls = '') => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', `ic${cls ? ` ${cls}` : ''}`); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); const u = document.createElementNS(NS, 'use'); u.setAttribute('href', `${SPRITE}#${name}`); s.appendChild(u); return s; };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const label = (a, ic, text, end) => { a.append(...(ic ? [icon(ic)] : []), el('span', '', text), ...(end ? [icon(end, 'ic-end')] : [])); return a; };

  // ---- click-to-load video and clips: the card's media area cross-fades to the player; one player open at a time ----
  let open = null;   // { el: the playing card, orig: the card it replaced }
  function closePlayer(focus = true) {
    if (!open) return;
    const { el: cur, orig } = open; open = null;
    cur.replaceWith(orig);   // dropping the iframe stops playback
    if (focus) orig.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { e.preventDefault(); closePlayer(); } });
  // the control row and the corner close button, shared by clips, video cards and the featured player
  function controls(a, site, siteIcon) {
    const x = el('button', 'btn btn-sm btn-blue'); x.type = 'button'; label(x, 'x', 'Close');
    x.addEventListener('click', () => closePlayer());
    const l = el('a', 'btn btn-sm btn-ghost'); l.href = a.href; l.rel = 'noopener'; label(l, siteIcon, `Open on ${site}`, 'arrow-up-right');
    const row = el('div', 'crow'); row.append(x, l);
    const c = el('button', 'ibtn pclose'); c.type = 'button'; c.setAttribute('aria-label', 'Close player'); c.title = 'Close player'; c.appendChild(icon('x'));
    c.addEventListener('click', () => closePlayer());
    return { row, corner: c, first: x };
  }
  const mkFrame = (src, title, allow) => { const f = el('iframe', 'vframe'); f.src = src; f.title = title; f.allow = allow; f.allowFullscreen = true; return f; };
  function playCard(a, src, title, allow, site, siteIcon) {
    closePlayer(false);
    const d = el('div', `${a.className} playing`);
    const m = el('div', 'cm'); const c = controls(a, site, siteIcon);
    m.append(mkFrame(src, title, allow), c.corner);
    const b = a.querySelector('.cb').cloneNode(true);
    b.querySelector('.bt').appendChild(c.row);
    d.append(m, b); a.replaceWith(d);
    open = { el: d, orig: a };
    c.first.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-vid], a[data-clip]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (a.dataset.clip) {
      playCard(a, `https://clips.twitch.tv/embed?clip=${encodeURIComponent(a.dataset.clip)}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`, `Twitch clip: ${a.dataset.title}`, 'autoplay; fullscreen', 'Twitch', 'b-twitch');
    } else if (a.classList.contains('card')) {
      playCard(a, `https://www.youtube-nocookie.com/embed/${a.dataset.vid}?autoplay=1&rel=0`, a.dataset.title, 'autoplay; encrypted-media; picture-in-picture', 'YouTube', 'b-youtube');
    } else {
      // the featured player on a video's own page: swap the link for a div with the player, same caption, the same control row
      closePlayer(false);
      const d = el('div', `${a.className} playing`);
      const th = el('span', 'thumb'); const c = controls(a, 'YouTube', 'b-youtube');
      th.append(mkFrame(`https://www.youtube-nocookie.com/embed/${a.dataset.vid}?autoplay=1&rel=0`, a.dataset.title, 'autoplay; encrypted-media; picture-in-picture'), c.corner);
      const parts = [th];
      if (a.querySelector('.vt')) parts.push(el('span', 'vt', a.dataset.title));
      parts.push(c.row);
      d.append(...parts); a.replaceWith(d);
      open = { el: d, orig: a };
      c.first.focus({ preventScroll: true });
    }
  });

  // ---- the dental logo loop: plays only while on screen and only when motion is allowed; the detail page has a pause button ----
  const loops = [...document.querySelectorAll('video[data-loop]')];
  const toggle = document.querySelector('[data-vtoggle]');
  const setToggle = (playing) => { if (!toggle) return; toggle.classList.toggle('is-paused', !playing); toggle.setAttribute('aria-label', playing ? 'Pause video' : 'Play video'); toggle.setAttribute('aria-pressed', String(!playing)); };
  let userPaused = reduce;   // with reduced motion the poster stays until someone presses play
  if (loops.length) {
    const io = new IntersectionObserver((ens) => ens.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting && !userPaused) v.play().then(() => setToggle(true), () => {});
      else if (!en.isIntersecting) { v.pause(); }
    }), { threshold: 0.35 });
    loops.forEach((v) => io.observe(v));
    if (toggle) {
      const v = toggle.parentElement.querySelector('video');
      v.addEventListener('pause', () => setToggle(false)); v.addEventListener('play', () => setToggle(true));
      toggle.addEventListener('click', () => { if (v.paused) { userPaused = false; v.play(); } else { userPaused = true; v.pause(); } });
    }
  }

  // ---- clips: the built text-only cards are the fallback; /api/clips (top clips, thumbnails proxied by the Worker) replaces them ----
  const clipAll = document.getElementById('clips-all');
  const mmss = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  function clipCard(c, i) {
    const a = el('a', `card${i === 0 ? ' w4 h4 big' : ''}`);
    a.href = c.url; a.rel = 'noopener'; a.dataset.clip = c.id; a.dataset.title = c.title; a.dataset.clipcard = '';
    const m = el('div', 'cm'), img = el('img');
    img.src = c.thumb; img.width = 640; img.height = 360; img.loading = 'lazy'; img.decoding = 'async'; img.alt = `Thumbnail of the clip ${c.title}`;
    img.addEventListener('error', () => img.remove());   // no thumbnail: the card keeps its dark media block
    const play = el('span', 'play'); play.setAttribute('aria-hidden', 'true'); play.appendChild(icon('play'));
    const chip = el('span', 'chip'); chip.append(icon('clock'), el('span', '', mmss(c.duration)));
    m.append(img, play, chip);
    const b = el('div', 'cb'), t = el('div', 'bt'), ey = el('p', 'ey');
    ey.append(icon('scissors'), el('span', '', ['clip', c.game].filter(Boolean).join(' · ')));
    t.append(ey, el('h3', 'ct', c.title)); b.appendChild(t);
    a.append(m, b);
    return a;
  }
  function renderClips(clips) {
    closePlayer();
    document.querySelectorAll('[data-clipcard]').forEach((n) => n.remove());
    clips.forEach((c, i) => clipAll.before(clipCard(c, i)));
  }
  if (clipAll) {
    if (params.get('clips') === 'demo') {
      const demo = [['Demo clip with a rather long title to check how cards wrap on narrow screens', 'Minecraft', 40], ['4k clutch on Bind', 'VALORANT', 39], ['Hbox would be proud', '', 19], ['5 kills no win :<', '', 59], ['cross map tomahawk on miami', 'VALORANT', 24], ['run 6 dies after blaze rods...', 'Minecraft', 51]];
      renderClips(demo.map(([title, game, duration], i) => ({ id: `DemoClip${i}`, title, game, duration, url: 'https://www.twitch.tv/halmictv/clips', thumb: `/videos/${['2DPVz25OXSM', '3-fIoRP40_A', '8oJoEXIenfU', 'Bo3wJLjhHhk', 'EngAOffWsa4', 'GdsFqsdzX9M'][i]}.jpg` })));
    } else (async () => {
      try {
        const r = await fetch('/api/clips', { cache: 'no-store', headers: { accept: 'application/json' } });
        if (!r.ok) return;
        const d = await r.json();
        const ok = Array.isArray(d.clips) ? d.clips.filter((c) => c && /^[A-Za-z0-9_-]+$/.test(c.id) && typeof c.title === 'string' && typeof c.url === 'string' && c.url.startsWith('https://') && Number.isFinite(c.duration) && c.thumb === `/api/clip-thumb/${c.id}`) : [];
        if (ok.length) renderClips(ok);
      } catch { /* keep the built cards */ }
    })();
  }
})();
