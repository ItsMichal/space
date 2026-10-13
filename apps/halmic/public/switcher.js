// Logo switcher. Hover and focus opening is CSS. On touch (hover: none) the first tap on the h opens the menu instead of going home
// (aria-expanded, data-open); the pill holds Home and the portfolio link. A second tap on the h, a tap elsewhere, scroll or Escape closes it.
document.querySelectorAll('.xs').forEach((sw) => {
  const logo = sw.querySelector('.xs-logo');
  const row = sw.querySelector('.xs-row');
  const touch = matchMedia('(hover: none)');
  const sync = () => { if (touch.matches) logo.setAttribute('aria-expanded', sw.hasAttribute('data-open') ? 'true' : 'false'); else { logo.removeAttribute('aria-expanded'); sw.removeAttribute('data-open'); } };
  const open = () => { sw.setAttribute('data-open', ''); sw.removeAttribute('data-dismissed'); sync(); };
  const close = () => { if (!sw.hasAttribute('data-open')) return; sw.removeAttribute('data-open'); sync(); };
  const clear = () => sw.removeAttribute('data-dismissed');
  sync(); touch.addEventListener?.('change', sync);
  logo.addEventListener('click', (e) => {
    if (!touch.matches || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (sw.hasAttribute('data-open')) close(); else { open(); row.focus({ preventScroll: true }); }
  });
  document.addEventListener('pointerdown', (e) => { if (!sw.contains(e.target)) close(); });
  addEventListener('scroll', close, { passive: true });
  sw.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    close();
    if (!sw.hasAttribute('data-dismissed')) sw.setAttribute('data-dismissed', '');
    if (e.target !== logo) logo.focus({ preventScroll: true });
  });
  sw.addEventListener('pointerleave', clear);
  sw.addEventListener('focusout', (e) => { if (!sw.contains(e.relatedTarget)) { clear(); close(); } });
  row.addEventListener('focus', clear);
});
