// Logo switcher: only the Escape latch. Opening is CSS (hover, :focus-visible); the link is always a real link in the tree.
document.querySelectorAll('.xs').forEach((sw) => {
  const logo = sw.querySelector('.xs-logo');
  const row = sw.querySelector('.xs-row');
  const clear = () => sw.removeAttribute('data-dismissed');
  sw.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || sw.hasAttribute('data-dismissed')) return;
    sw.setAttribute('data-dismissed', '');
    if (e.target !== logo) logo.focus({ preventScroll: true });
  });
  sw.addEventListener('pointerleave', clear);
  sw.addEventListener('focusout', (e) => { if (!sw.contains(e.relatedTarget)) clear(); });
  row.addEventListener('focus', clear);
});
