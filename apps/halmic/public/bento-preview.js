// The bento preview (/bento-preview/, noindex): the layout editor frames this page and posts it an arrangement, { type: 'halmic-bento', sections }
// with each section's clusters as resolve() in layout.mjs returns them. This draws it the way build.mjs draws the home page, from the real tile
// markup the build left in <template>s, and posts back its height and the id of any tile clicked. Nothing here navigates: a click only picks.
(() => {
  const data = JSON.parse(document.getElementById('bp-data').textContent);
  const root = document.getElementById('bp');
  const T = {};
  for (const t of document.querySelectorAll('template')) for (const k of ['tile', 'flex', 'more']) if (t.dataset[k]) T[`${k}:${t.dataset[k]}`] = t;
  let parent = null;
  const post = (m) => parent?.postMessage(m, '*');
  const el = (tag, cls, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  // a tile from its template, or a plain box naming it when the build has no such tile (an id the editor knows but this build does not)
  const tileOf = (kind, id, cls) => {
    const t = T[`${kind}:${id}`];
    const n = t ? t.content.firstElementChild.cloneNode(true) : Object.assign(el('div', 'tile tpaper'), { textContent: id });
    for (const c of cls.split(' ').filter(Boolean)) n.classList.add(c);
    n.dataset.pick = id;
    return n;
  };
  const cluster = (c) => {
    const d = el('div', 'cl', { role: 'group', 'aria-label': c.name ?? '' });
    for (const x of c.tiles) d.append(tileOf('tile', x.id, data.cls[x.size] ?? ''));
    if (c.flex) {
      // the flex tile fills the last row: the same fx classes build.mjs gives it
      const fx = [4, 3, 2].map((k, i) => { const n = c.tiles.reduce((s, x) => s + (data.sizes[x.size]?.[i] ?? 1), 0); return `fx${k}-${k - (n % k)}`; }).join(' ');
      const f = tileOf('flex', c.flex.id, fx);
      f.setAttribute('data-flex', '');
      d.append(f);
    }
    return d;
  };
  const draw = (sections) => {
    root.replaceChildren(...sections.map((s) => {
      const sec = el('div', 'bsec', { id: s.id });
      if (s.title) {
        const sh = el('div', 'sh'), h = el('h2');
        h.textContent = s.title;
        sh.append(h);
        if (T[`more:${s.id}`]) sh.append(T[`more:${s.id}`].content.cloneNode(true));
        sec.append(sh);
      }
      const bq = el('div', 'bq'), b = el('div', `bento ${data.sections[s.id] ?? ''}`);
      b.append(...s.clusters.map(cluster));
      bq.append(b);
      sec.append(bq);
      return sec;
    }));
  };
  addEventListener('message', (e) => {
    if (e.data?.type !== 'halmic-bento' || !Array.isArray(e.data.sections)) return;
    parent = e.source;
    draw(e.data.sections);
    post({ type: 'halmic-bento-height', height: document.documentElement.scrollHeight });
  });
  new ResizeObserver(() => post({ type: 'halmic-bento-height', height: document.documentElement.scrollHeight })).observe(document.body);
  document.addEventListener('click', (e) => {
    e.preventDefault();
    const t = e.target.closest('[data-pick]');
    if (t) post({ type: 'halmic-bento-pick', id: t.dataset.pick });
  }, true);
  // tell the frame's opener this page is ready for an arrangement
  if (window.parent !== window) window.parent.postMessage({ type: 'halmic-bento-ready' }, '*');
})();
