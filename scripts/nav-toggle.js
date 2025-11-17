document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  const btn = document.querySelector('.hamburger');
  const nav = document.querySelector('#site-nav');
  if (!header || !btn || !nav) return;

  function setOpen(open) {
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('open', open);
    header.classList.toggle('nav-open', open);
  }

  btn.addEventListener('click', () => {
    const isOpen = btn.classList.contains('open');
    setOpen(!isOpen);
  });

  // Close when a nav link is clicked
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setOpen(false);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!header.classList.contains('nav-open')) return;
    if (!header.contains(e.target)) setOpen(false);
  });
});
