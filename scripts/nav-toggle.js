document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  const btn = document.querySelector('.hamburger');
  const nav = document.querySelector('#site-nav');
  if (!header || !btn || !nav) return;
  const dropdowns = Array.from(nav.querySelectorAll('.nav-dropdown'));

  function closeDropdowns() {
    dropdowns.forEach((dropdown) => {
      const toggle = dropdown.querySelector('.nav-dropdown-toggle');
      dropdown.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function setOpen(open) {
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('open', open);
    header.classList.toggle('nav-open', open);
    if (!open) closeDropdowns();
  }

  btn.addEventListener('click', () => {
    const isOpen = btn.classList.contains('open');
    setOpen(!isOpen);
  });

  // Close when a nav link is clicked
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));

  dropdowns.forEach((dropdown) => {
    const toggle = dropdown.querySelector('.nav-dropdown-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains('open');
      closeDropdowns();
      if (willOpen) {
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      setOpen(false);
      closeDropdowns();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (header.contains(e.target)) return;
    if (header.classList.contains('nav-open')) setOpen(false);
    closeDropdowns();
  });
});
