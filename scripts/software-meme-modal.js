document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('software-meme-trigger');
  const viewer = document.getElementById('software-meme-viewer');
  const closeBtn = document.getElementById('software-meme-close');

  if (!trigger || !viewer || !closeBtn) return;

  let lastFocused = null;

  function openViewer() {
    lastFocused = document.activeElement;
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.blur();
    document.body.classList.add('software-meme-open');
    closeBtn.focus({ preventScroll: true });
  }

  function closeViewer() {
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.blur();
    document.body.classList.remove('software-meme-open');
    if (lastFocused && typeof lastFocused.focus === 'function' && lastFocused !== trigger) {
      lastFocused.focus({ preventScroll: true });
    }
  }

  trigger.addEventListener('click', openViewer);
  closeBtn.addEventListener('click', closeViewer);

  viewer.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-close-software-meme="true"]')) {
      closeViewer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewer.classList.contains('open')) {
      closeViewer();
    }
  });
});
