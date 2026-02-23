document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('timeline-heading-trigger');
  const viewer = document.getElementById('timeline-heading-viewer');
  const closeBtn = document.getElementById('timeline-heading-close');

  if (!trigger || !viewer || !closeBtn) return;

  let lastFocused = null;

  function openViewer() {
    lastFocused = document.activeElement;
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.blur();
    document.body.classList.add('timeline-heading-open');
    closeBtn.focus({ preventScroll: true });
  }

  function closeViewer() {
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.blur();
    document.body.classList.remove('timeline-heading-open');
    if (lastFocused && typeof lastFocused.focus === 'function' && lastFocused !== trigger) {
      lastFocused.focus({ preventScroll: true });
    }
  }

  trigger.addEventListener('click', openViewer);
  closeBtn.addEventListener('click', closeViewer);

  viewer.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-close-timeline-heading="true"]')) {
      closeViewer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewer.classList.contains('open')) {
      closeViewer();
    }
  });
});
