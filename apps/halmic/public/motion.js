// halmic motion, the script half (motion.css has the rest). Nothing here listens to scroll, wheel or touchmove, and nothing is ever prevented:
// scrolling stays the browser's. Work is done by IntersectionObserver callbacks, one rAF-throttled pointermove handler and a few one-off rAF counters.
//   - header: a "solid" class once the hero (or the first 56px of an inner page) is behind (the CSS timeline does the same where it exists)
//   - tiles: pointer sheen and a 2.5 degree tilt on hover-capable pointers, a press state for mouse and touch
//   - nav: one marker that follows hover/focus and rests under the section in view (scroll-spy)
// Gate: html.mo (vt.js): scripts on, no reduced-motion preference, no ?motion=0. Without it this file only keeps the header backdrop and the nav marker.
(() => {
  const root = document.documentElement;
  const mo = root.classList.contains('mo');
  const io = (fn, opt) => new IntersectionObserver((es) => es.forEach(fn), opt);

  // ---- header backdrop (fallback and CSS-timeline browsers alike; the CSS animation wins where it exists) ----
  const top = document.querySelector('.top');
  if (top) {
    const hero = document.querySelector('.hero');
    let watch = hero, margin = `-${top.offsetHeight || 72}px 0px 0px 0px`;
    if (!hero) { watch = document.createElement('i'); watch.className = 'tsent'; watch.setAttribute('aria-hidden', 'true'); document.body.prepend(watch); margin = '0px'; }
    io((e) => top.classList.toggle('solid', !e.isIntersecting), { rootMargin: margin }).observe(watch);
  }

  // ---- nav marker and scroll-spy ----
  const nav = document.querySelector('.top nav');
  if (nav) {
    const links = [...nav.querySelectorAll('a')];
    const mk = document.createElement('i'); mk.className = 'mk'; mk.setAttribute('aria-hidden', 'true'); nav.appendChild(mk);
    let current = links.find((a) => a.hasAttribute('aria-current')) ?? null, shown = null, placed = false;
    const place = (a) => {
      shown = a;
      if (!a) { mk.classList.remove('on'); return; }
      mk.style.setProperty('--mx', `${Math.round(a.offsetLeft + (a.offsetWidth - 20) / 2)}px`);
      if (!placed) { placed = true; requestAnimationFrame(() => mk.classList.add('go')); }
      mk.classList.add('on');
    };
    place(current);
    new ResizeObserver(() => place(shown)).observe(nav);
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    nav.addEventListener('pointerover', (e) => { const a = e.target.closest('a'); if (a && fine.matches && e.pointerType !== 'touch') place(a); });
    nav.addEventListener('pointerleave', () => place(current));
    nav.addEventListener('focusin', (e) => { const a = e.target.closest('a'); if (a && a.matches(':focus-visible')) place(a); });
    nav.addEventListener('focusout', () => place(current));
    // home page: the section crossing the middle of the screen is the current one
    const byHash = new Map(links.map((a) => [new URL(a.href).hash, a]));
    const spy = [['#stream', '#stream'], ['#games', '#games'], ['#work', '#work'], ['#elsewhere', '#hi']].filter(([id]) => document.querySelector(id) && byHash.has(id === '#elsewhere' ? '#hi' : id));
    if (spy.length && document.body.classList.contains('home')) {
      const set = (a) => { if (a === current) return; current?.removeAttribute('aria-current'); current = a; current?.setAttribute('aria-current', 'true'); if (!nav.matches(':hover')) place(current); };
      const s = io((e) => { if (e.isIntersecting) set(e.target === document.querySelector('.hero') ? null : byHash.get(spy.find(([id]) => document.querySelector(id) === e.target)[1])); }, { rootMargin: '-45% 0px -50% 0px' });
      spy.forEach(([id]) => s.observe(document.querySelector(id)));
      s.observe(document.querySelector('.hero'));
    }
  }

  if (!mo) return;

  // ---- tiles: sheen + tilt (mouse and pen over a hover-capable screen) and the press state (any pointer) ----
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const TILT = 2.5;
  let cur = null, tgt = null, px = 0, py = 0, raf = 0;
  const leave = () => { if (cur) cur.classList.remove('is-tilt'); cur = null; };
  const frame = () => {
    raf = 0;
    if (tgt !== cur) { leave(); cur = tgt; if (cur) cur.classList.add('is-tilt'); }
    if (!cur) return;
    const r = cur.getBoundingClientRect(), w = cur.offsetWidth || r.width, h = cur.offsetHeight || r.height;   // offset size: unaffected by the tilt itself
    const nx = Math.max(-1, Math.min(1, (px - (r.left + r.width / 2)) / (w / 2))), ny = Math.max(-1, Math.min(1, (py - (r.top + r.height / 2)) / (h / 2)));
    const s = cur.style;
    s.setProperty('--mx', `${((nx + 1) * 50).toFixed(1)}%`); s.setProperty('--my', `${((ny + 1) * 50).toFixed(1)}%`);
    s.setProperty('--rx', `${(-ny * TILT).toFixed(2)}deg`); s.setProperty('--ry', `${(nx * TILT).toFixed(2)}deg`);
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !fine.matches) return;
    const t = e.target.closest?.('a.tile:not(.playing)') ?? null;
    px = e.clientX; py = e.clientY; tgt = t;
    if (!raf && (t || cur)) raf = requestAnimationFrame(frame);
  }, { passive: true });
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) { tgt = null; if (!raf) raf = requestAnimationFrame(frame); } }, { passive: true });
  let pressed = null;
  const release = () => { pressed?.classList.remove('is-press'); pressed = null; };
  document.addEventListener('pointerdown', (e) => { if (e.button > 0) return; const a = e.target.closest?.('a.tile:not(.playing), a.card'); if (a) { pressed = a; a.classList.add('is-press'); } }, { passive: true });
  for (const type of ['pointerup', 'pointercancel', 'dragstart']) document.addEventListener(type, release, { passive: true });
})();
