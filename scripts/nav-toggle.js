document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  const btn = document.querySelector('.hamburger');
  const nav = document.querySelector('#site-nav');
  if (!header || !btn || !nav) return;
  const dropdowns = Array.from(nav.querySelectorAll('.nav-dropdown'));
  const root = document.documentElement;

  function syncMobileTitleLayout() {
    const isResponsive = window.matchMedia('(max-width: 1100px)').matches;
    const offsetExpr = 'calc(var(--site-header-offset) + env(safe-area-inset-top, 0px))';

    const offsetEls = document.querySelectorAll(
      '.memoirs-heading, .wild-india-heading, .section-travels-heading .padding-vertical-xlarge, .section-timeline-heading .padding-vertical-xlarge, body.page-about .about-hero'
    );
    offsetEls.forEach((el) => {
      if (isResponsive) {
        el.style.setProperty('padding-top', offsetExpr, 'important');
      } else {
        el.style.removeProperty('padding-top');
      }
    });
  }

  function syncHeaderOffsetVar() {
    const h = Math.ceil(header.getBoundingClientRect().height || 0);
    root.style.setProperty('--site-header-offset', (h + 10) + 'px');
    syncMobileTitleLayout();
  }

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
    syncHeaderOffsetVar();
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
      syncHeaderOffsetVar();
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
    syncHeaderOffsetVar();
  });

  window.addEventListener('resize', syncHeaderOffsetVar);
  new MutationObserver(syncHeaderOffsetVar).observe(header, {
    attributes: true,
    subtree: true,
    childList: true
  });
  syncHeaderOffsetVar();
});
