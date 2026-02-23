document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('meme-hidden-trigger');
  const viewer = document.getElementById('meme-viewer');
  const closeBtn = document.getElementById('meme-viewer-close');

  if (!trigger || !viewer || !closeBtn) return;

  let lastFocused = null;

  function openViewer() {
    lastFocused = document.activeElement;
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('meme-viewer-open');
    closeBtn.focus({ preventScroll: true });
  }

  function closeViewer() {
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('meme-viewer-open');
    const target = (lastFocused && typeof lastFocused.focus === 'function') ? lastFocused : trigger;
    target.focus({ preventScroll: true });
  }

  trigger.addEventListener('click', openViewer);
  closeBtn.addEventListener('click', closeViewer);

  viewer.addEventListener('click', (e) => {
    if (e.target && e.target.matches('[data-close-meme="true"]')) {
      closeViewer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && viewer.classList.contains('open')) {
      closeViewer();
    }
  });
});
