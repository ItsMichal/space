// Page transitions (cross-document View Transitions; browsers without them just navigate). A tile or card that links to an
// internal page hands its picture and title to the destination's hero picture ([data-hero]) and h1, both named per
// document by the CSSOM: names are unique per page, so only the tile being left or returned to gets one.
// Loaded in the head (not deferred) so pagereveal is not missed. Playing in place and external links never reach this.
(() => {
  const NAMES = { media: 'hero-media', title: 'hero-title' };
  const path = (u) => { try { const x = new URL(u, location.href); return x.origin === location.origin ? x.pathname : null; } catch { return null; } };
  const tileFor = (p) => [...document.querySelectorAll('a[data-vt]')].find((a) => new URL(a.href).pathname === p);
  const named = new Set();
  const give = (el, name) => { if (el) { el.style.viewTransitionName = name; named.add(el); } };
  const clear = () => { named.forEach((el) => { el.style.viewTransitionName = ''; }); named.clear(); };
  const nameTile = (a) => {
    const kinds = a.dataset.vt.split(' ');
    if (kinds.includes('m')) give(a.querySelector('.tbg, .cm'), NAMES.media);
    give(a.querySelector('.tt, .ct'), NAMES.title);
  };
  const nameHero = () => { give(document.querySelector('[data-hero]'), NAMES.media); give(document.querySelector('.pg h1'), NAMES.title); };
  const arrange = (other) => { const t = other && tileFor(other); if (t) { nameTile(t); return true; } nameHero(); return false; };
  addEventListener('pageswap', (e) => { if (e.viewTransition) arrange(path(e.activation?.entry?.url)); });
  addEventListener('pagereveal', (e) => {
    if (!e.viewTransition) return;
    const from = path(globalThis.navigation?.activation?.from?.url);
    if (!from) return;
    const t = tileFor(from);
    if (t) { t.scrollIntoView({ block: 'nearest' }); nameTile(t); } else nameHero();
    e.viewTransition.finished.finally(clear);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) clear(); });
})();
