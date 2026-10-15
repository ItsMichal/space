// halmic behaviour: live/offline state from /api/live, bar meters (the logotype's bars as a level meter),
// click-to-load video (youtube-nocookie only after interaction) and Twitch clips, played in place inside their card. No dependencies.
// Testing override: ?live=1 (or ?live=0) forces the state and skips the fetch; with ?live=1 you can add &game=Name.
// Clips are inserted before the Twitch tile, inside the Twitch cluster.
// ?clips=demo swaps in six fake clips (local video thumbnails, stand-in game art) and skips the fetch (layout testing; the embed will not load a real clip);
// the first four demo clips use real clip ids, so their hover previews (public/previews/clip-<id>) play; &n=3 shows only three, ?clips=none none (the Watch bento then holds videos only).
(() => {
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const override = params.get('live');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEAN = 13;
  const still = () => reduce || root.dataset.motion === '0';   // ?motion=0 is the test override that switches motion off

  // ---- live state: the page is offline until the status endpoint says otherwise ----
  const settle = () => { if (reduce) meters.forEach((m) => { for (let s = 0; s < 40; s++) tick(m, 3, 1 / 20); }); };
  // a flip of the live state: the status pill springs once and the meter bars kick (the bars' own springs do the rest)
  function flip() {
    if (still()) return;
    const pill = document.querySelector('.status');
    if (pill) { pill.classList.remove('flip'); void pill.offsetWidth; pill.classList.add('flip'); pill.addEventListener('animationend', () => pill.classList.remove('flip'), { once: true }); }
    meters.forEach((m) => { const w = m.el.clientWidth; m.kick = [...m.kick, ...[0.15, 0.5, 0.85].map((f) => ({ x: w * f, s: 0.9 }))].slice(-6); });
  }
  function setLive(on, game) {
    const before = root.dataset.live;
    root.dataset.live = on ? '1' : '0';
    if (before !== root.dataset.live) flip();
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
    if (!still()) { orig.classList.add('back'); orig.addEventListener('animationend', () => orig.classList.remove('back'), { once: true }); setTimeout(() => orig.classList.remove('back'), 600); }   // the tile comes back with a fade
    refit();
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
  // the iframe stays transparent until it has loaded; meanwhile a disc with a spinner arc shows where the play button was (motion.css), then the iframe fades in
  const mkFrame = (src, title, allow) => {
    const f = el('iframe', 'vframe'), l = el('span', 'pload'); l.setAttribute('aria-hidden', 'true'); l.appendChild(el('i'));
    const ready = () => { f.classList.add('ready'); l.classList.add('done'); setTimeout(() => l.remove(), 500); };
    f.addEventListener('load', ready, { once: true }); setTimeout(ready, 8000);
    f.src = src; f.title = title; f.allow = allow; f.allowFullscreen = true; f.loader = l; return f;
  };
  function playCard(a, src, title, allow, site, siteIcon) {
    closePlayer(false);
    const d = el('div', `${a.className} playing`);
    const m = el('div', 'cm'); const c = controls(a, site, siteIcon);
    const fr = mkFrame(src, title, allow); m.append(fr, fr.loader, c.corner);
    const b = a.querySelector('.cb').cloneNode(true);
    b.querySelector('.bt').appendChild(c.row);
    d.append(m, b); a.replaceWith(d);
    open = { el: d, orig: a };
    c.first.focus({ preventScroll: true });
  }
  // a bento tile that is playing grows to 2x2: player on top, title and the same Close / Open-on buttons beneath
  function playTile(a, src, title, allow, site, siteIcon) {
    closePlayer(false);
    const d = el('div', 'tile playing');
    const tp = el('div', 'tp'); const c = controls(a, site, siteIcon);
    const fr = mkFrame(src, title, allow); tp.append(fr, fr.loader, c.corner);
    const pb = el('div', 'pb'); pb.append(el('h3', 'tt', a.querySelector('.tt')?.textContent ?? title), c.row);
    d.append(tp, pb); a.replaceWith(d);
    open = { el: d, orig: a };
    c.first.focus({ preventScroll: true });
    d.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    refit();
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-vid], a[data-clip]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    pvStop(true);
    if (a.classList.contains('tile')) {
      if (a.dataset.clip) playTile(a, `https://clips.twitch.tv/embed?clip=${encodeURIComponent(a.dataset.clip)}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`, `Twitch clip: ${a.dataset.title}`, 'autoplay; fullscreen', 'Twitch', 'b-twitch');
      else playTile(a, `https://www.youtube-nocookie.com/embed/${a.dataset.vid}?autoplay=1&rel=0`, a.dataset.title, 'autoplay; encrypted-media; picture-in-picture', 'YouTube', 'b-youtube');
    } else if (a.dataset.clip) {
      playCard(a, `https://clips.twitch.tv/embed?clip=${encodeURIComponent(a.dataset.clip)}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`, `Twitch clip: ${a.dataset.title}`, 'autoplay; fullscreen', 'Twitch', 'b-twitch');
    } else if (a.classList.contains('card')) {
      playCard(a, `https://www.youtube-nocookie.com/embed/${a.dataset.vid}?autoplay=1&rel=0`, a.dataset.title, 'autoplay; encrypted-media; picture-in-picture', 'YouTube', 'b-youtube');
    } else {
      // the featured player on a video's own page: swap the link for a div with the player, same caption, the same control row
      closePlayer(false);
      const d = el('div', `${a.className} playing`);
      const th = el('span', 'thumb'); const c = controls(a, 'YouTube', 'b-youtube');
      const fr = mkFrame(`https://www.youtube-nocookie.com/embed/${a.dataset.vid}?autoplay=1&rel=0`, a.dataset.title, 'autoplay; encrypted-media; picture-in-picture');
      th.append(fr, fr.loader, c.corner);
      const parts = [th];
      if (a.querySelector('.vt')) parts.push(el('span', 'vt', a.dataset.title));
      parts.push(c.row);
      d.append(...parts); a.replaceWith(d);
      open = { el: d, orig: a };
      c.first.focus({ preventScroll: true });
    }
  });

  // ---- hover previews: a silent highlight loop fades in over a video or clip tile's thumbnail on hover / keyboard focus ----
  // Nothing is requested until a tile is hovered or focused (previews/index.json first, then the one loop). Hover-capable pointers only: touch devices skip
  // previews entirely (autoplaying on scroll would spend data nobody asked for). Not with reduced motion, Save-Data, or while a real player is open.
  const PV_SEL = 'a.tile[data-vid], a.tile[data-clip]';
  let pvIds = null, pvIdsP = null, pv = null, pvTimer = 0;
  const pvIndex = () => (pvIdsP ??= fetch('/previews/index.json', { cache: 'no-cache', headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : { ids: [] })).catch(() => ({ ids: [] })).then((d) => { pvIds = new Set(Array.isArray(d.ids) ? d.ids.filter((x) => typeof x === 'string') : []); return pvIds; }));
  const pvAllowed = () => !open && !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData;
  function pvStop(now) {
    clearTimeout(pvTimer);
    if (!pv) return;
    const { tile, video, bar, raf } = pv; pv = null;
    cancelAnimationFrame(raf);
    video.classList.remove('on'); bar.remove();
    const drop = () => { video.pause(); video.removeAttribute('src'); video.replaceChildren(); video.load(); video.remove(); };   // free the decoder and the buffered data
    if (now) drop(); else setTimeout(drop, 210);   // after the fade-out (--t2)
    tile.removeAttribute('data-pv');
  }
  async function pvStart(tile) {
    if (!pvAllowed() || !tile.isConnected) return;
    const key = tile.dataset.clip ? `clip-${tile.dataset.clip}` : tile.dataset.vid;
    const ids = pvIds ?? await pvIndex();
    if (!ids.has(key) || !tile.isConnected || !pvAllowed() || pv?.tile === tile) return;
    if (!(tile.matches(':hover') || tile.matches(':focus-visible'))) return;   // the pointer left while the list loaded
    pvStop(true);
    const bg = tile.querySelector('.tbg'); if (!bg) return;
    const video = el('video', 'pv'); video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'; video.disablePictureInPicture = true;
    video.setAttribute('muted', ''); video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
    for (const [ext, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) { const s = el('source'); s.src = `/previews/${key}.${ext}`; s.type = type; video.appendChild(s); }
    const bar = el('i', 'pvbar'); bar.setAttribute('aria-hidden', 'true');
    const state = { tile, video, bar, raf: 0 }; pv = state;
    const tickBar = () => { if (pv !== state) return; if (video.duration) bar.style.transform = `scaleX(${(video.currentTime / video.duration).toFixed(3)})`; state.raf = requestAnimationFrame(tickBar); };
    video.addEventListener('playing', () => { if (pv !== state) return; video.classList.add('on'); cancelAnimationFrame(state.raf); state.raf = requestAnimationFrame(tickBar); }, { once: true });
    video.addEventListener('error', () => { if (pv === state) pvStop(true); }, true);
    bg.appendChild(video); tile.appendChild(bar); tile.dataset.pv = key;
    video.play().catch(() => { if (pv === state) pvStop(true); });
  }
  const pvArm = (tile) => { if (pv?.tile === tile) return; clearTimeout(pvTimer); if (pvAllowed()) pvTimer = setTimeout(() => pvStart(tile), 120); };
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; const t = e.target.closest?.(PV_SEL); if (t) pvArm(t); });
    document.addEventListener('pointerout', (e) => { const t = e.target.closest?.(PV_SEL); if (t && !t.contains(e.relatedTarget)) { clearTimeout(pvTimer); if (pv?.tile === t) pvStop(); } });
  }
  document.addEventListener('focusin', (e) => { const t = e.target.closest?.(PV_SEL); if (t && t === e.target && t.matches(':focus-visible')) pvArm(t); });
  document.addEventListener('focusout', (e) => { const t = e.target.closest?.(PV_SEL); if (t && pv?.tile === t && !t.matches(':hover')) pvStop(); else clearTimeout(pvTimer); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pvStop(true); });

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

  // ---- clusters: the one tile marked data-flex gets the width that fills its cluster's last row. The column count is the bento's own (--cols, set by a container query). ----
  const spanOf = (v) => +(/span (\d+)/.exec(v)?.[1] ?? 1);
  function fit(b) {
    const flex = b.querySelector(':scope > [data-flex]');
    if (!flex) return;
    const cols = parseInt(getComputedStyle(b).getPropertyValue('--cols'), 10) || 2;
    let cells = 0;
    for (const t of b.children) { if (t === flex) continue; const cs = getComputedStyle(t); cells += Math.min(cols, spanOf(cs.gridColumnStart)) * spanOf(cs.gridRowStart); }
    flex.style.gridColumn = `span ${cols - (cells % cols)}`;
  }
  const bentos = [...document.querySelectorAll('.bento')];
  let refitQueued = false;
  function refit() { if (refitQueued) return; refitQueued = true; requestAnimationFrame(() => { refitQueued = false; document.querySelectorAll('.cl').forEach(fit); }); }
  if (bentos.length) { const ro = new ResizeObserver(refit); bentos.forEach((b) => ro.observe(b)); refit(); }

  // ---- the Twitch tile: "Live now" comes from the same data-live the hero uses; the game name is copied from the hero's status text, no second fetch ----
  const liveGame = document.querySelector('[data-live-game]'), heroGame = document.querySelector('[data-game-name]');
  if (liveGame) {
    const sync = () => { liveGame.textContent = heroGame?.textContent.trim() || 'halmictv'; };
    if (heroGame) new MutationObserver(sync).observe(heroGame, { childList: true, characterData: true, subtree: true });
    sync();
  }

  // ---- clips: the built stand-ins (scissors on a dark tile) are the fallback; /api/clips (top clips; thumbnails and box art proxied by the Worker) replaces them ----
  const twitchTile = document.getElementById('twitch');
  const mmss = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const bdg = () => { const b = el('span', 'bdg bdg-tw'); b.setAttribute('role', 'img'); b.setAttribute('aria-label', 'Twitch'); b.title = 'Twitch'; b.appendChild(icon('b-twitch')); return b; };
  function clipTile(c, i) {
    const wide = i === 0;
    const a = el('a', `tile tm${wide ? ' w2' : ''}`);
    a.href = c.url; a.rel = 'noopener'; a.dataset.clip = c.id; a.dataset.title = c.title; a.dataset.clipcard = '';
    const bg = el('span', 'tbg'), img = el('img');
    img.src = c.thumb; img.width = 640; img.height = 360; img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
    img.addEventListener('error', () => { img.remove(); a.classList.add('tm-nopic'); bg.appendChild(icon('scissors', 'ghost')); });   // no thumbnail: the dark tile with the scissors
    img.addEventListener('load', () => img.classList.add('ld'), { once: true });   // the picture fades in once it is there (motion.css, .clip-in)
    bg.appendChild(img);
    const chip = el('span', 'chip'); chip.append(icon(wide ? 'clock' : 'play'), el('span', '', mmss(c.duration)));
    a.append(bg, bdg(), chip);
    if (wide) { const p = el('span', 'play'); p.setAttribute('aria-hidden', 'true'); p.appendChild(icon('play')); a.appendChild(p); }
    const cap = el('span', 'tcap'), tx = el('span', 'tx');
    if (c.gameArt) {   // the game as box art beside the title; its name stays as the title attribute and for screen readers
      const art = el('img', 'gart'); art.src = c.gameArt; art.width = 188; art.height = 250; art.loading = 'lazy'; art.decoding = 'async'; art.alt = ''; art.title = c.game;
      art.addEventListener('error', () => art.remove()); cap.appendChild(art);
    }
    tx.appendChild(el('h3', 'tt', c.title));
    if (c.game) tx.appendChild(el('span', 'sr', `Game: ${c.game}`));
    cap.appendChild(tx); a.appendChild(cap);
    return a;
  }
  function renderClips(clips) {
    closePlayer();
    document.querySelectorAll('[data-clipcard]').forEach((n) => n.remove());
    const fresh = clips.map((c, i) => clipTile(c, i));
    if (!still() && fresh.length) {   // swap without a blink: content fades in, staggered; the platform badge pops
      fresh.forEach((t, i) => { t.classList.add('clip-in'); t.style.setProperty('--d', `${i * 70}ms`); });
      setTimeout(() => fresh.forEach((t) => { t.classList.remove('clip-in'); t.style.removeProperty('--d'); }), 1500 + fresh.length * 70);
    }
    fresh.forEach((t) => twitchTile.before(t));
    refit();
  }
  if (twitchTile) {
    const mode = params.get('clips');
    if (mode === 'demo' || mode === 'none') {
      // stand-in box art for the demo: a coloured spine with a letter, inlined as SVG data (the CSP allows data: images)
      const art = (a, b, ch) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 188 250"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="188" height="250" fill="url(#g)"/><text x="94" y="150" font-family="Arial,sans-serif" font-size="96" font-weight="900" fill="#fff" text-anchor="middle">${ch}</text></svg>`)}`;
      const demo = [['Demo clip with a rather long title to check how tiles wrap on narrow screens', 'Minecraft', 40, art('#5b8c2a', '#2b4a12', 'M')], ['4k clutch on Bind', 'VALORANT', 39, art('#ff4655', '#7a1d28', 'V')], ['Hbox would be proud', '', 19, ''], ['5 kills no win :<', '', 59, art('#e63946', '#1d3557', 'S')], ['cross map tomahawk on miami', 'VALORANT', 24, art('#ff4655', '#7a1d28', 'V')], ['run 6 dies after blaze rods...', 'Minecraft', 51, art('#5b8c2a', '#2b4a12', 'M')]];
      const n = mode === 'none' ? 0 : Math.min(6, +params.get('n') || 6);
      renderClips(demo.slice(0, n).map(([title, game, duration, gameArt], i) => ({ id: ['GlamorousFrozenStorkBloodTrail', 'TsundereOutstandingChipmunkOSkomodo', 'LachrymoseLazyTubersTTours-0pFkdn50gXLMyqh1', 'MistySleepyNuggetsWOOP', 'DemoClip4', 'DemoClip5'][i], title, game, duration, gameArt, url: 'https://www.twitch.tv/halmictv/clips', thumb: `/videos/${['2DPVz25OXSM', '3-fIoRP40_A', '8oJoEXIenfU', 'Bo3wJLjhHhk', 'EngAOffWsa4', 'GdsFqsdzX9M'][i]}.jpg` })));
    } else (async () => {
      try {
        const r = await fetch('/api/clips', { cache: 'no-store', headers: { accept: 'application/json' } });
        if (!r.ok) return;
        const d = await r.json();
        const ok = Array.isArray(d.clips) ? d.clips.filter((c) => c && /^[A-Za-z0-9_-]+$/.test(c.id) && typeof c.title === 'string' && typeof c.url === 'string' && c.url.startsWith('https://') && Number.isFinite(c.duration) && c.thumb === `/api/clip-thumb/${c.id}`).map((c) => ({ ...c, game: typeof c.game === 'string' ? c.game : '', gameArt: typeof c.gameArt === 'string' && /^\/api\/game-art\/\d+$/.test(c.gameArt) ? c.gameArt : '' })) : [];
        if (ok.length || (Array.isArray(d.clips) && d.unknown !== true)) renderClips(ok.slice(0, 6));   // an answer with no clips means no clips: Watch is videos only. A failure keeps the built stand-ins.
      } catch { /* keep the built stand-ins */ }
    })();
  }
})();
