// Force dark mode while the crawl/scroll animation is active, then restore
// the user's chosen theme when the crawl pauses or ends.
//
// Behavior summary:
// - If the crawl (element #crawl) has a running animation, set
//   body.dataset.themeLock = 'dark' and disable the theme toggle button.
// - When the crawl is paused/stopped, remove the lock, enable the toggle,
//   and synchronize the UI to the stored preference in localStorage.

document.addEventListener('DOMContentLoaded', () => {
  const intro = document.querySelector('.intro-section');
  const crawl = document.getElementById('crawl');
  const btn = document.getElementById('theme-toggle');
  if (!intro && !crawl) return;

  function disableToggle() {
    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  }
  function enableToggle() {
    if (!btn) return;
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
  }

  function syncStoredPrefToUI(){
    if (!btn) return;
    const stored = localStorage.getItem('site:theme') || 'dark';
    const isLight = document.body.classList.contains('light-mode');
    // If stored preference differs from current, toggle via the button so
    // the theme-toggle script's apply() and button icons stay in sync.
    if (stored === 'light' && !isLight) btn.click();
    if (stored === 'dark' && isLight) btn.click();
  }

  function setLock(active){
    if (active){
      document.body.dataset.themeLock = 'dark';
      disableToggle();
      // notify theme toggle code so it can re-apply (and force dark)
      try { document.dispatchEvent(new CustomEvent('theme:lock-changed')); } catch(e){}
    } else {
      delete document.body.dataset.themeLock;
      enableToggle();
      // ensure UI matches stored preference
      syncStoredPrefToUI();
      try { document.dispatchEvent(new CustomEvent('theme:lock-changed')); } catch(e){}
    }
  }

  // Determine whether the crawl element is actively animating.
  function crawlIsActive(){
    if (!crawl) return false;
    try {
      const cs = window.getComputedStyle(crawl);
      const name = (cs.animationName || '').split(',')[0].trim();
      const playState = (cs.animationPlayState || '').split(',')[0].trim();
      const duration = (cs.animationDuration || '').split(',')[0].trim();
      // Consider it active when it has a named animation, non-zero duration,
      // and is not paused.
      return name && name !== 'none' && duration !== '0s' && playState !== 'paused';
    } catch (e) {
      return false;
    }
  }

  // Primary updater: prefer intro visibility when present. If an intro
  // section exists, force dark while the intro is NOT visible (i.e. while
  // the scroll is on-screen) and remove the lock as soon as the intro
  // becomes visible. This avoids keeping dark mode active simply because
  // the crawl animation is still running.
  function updateLockFromState(){
    if (intro){
      // If intro exists, base lock solely on its visibility: lock when
      // not visible, unlock when visible.
      setLock(!intro.classList.contains('visible'));
      return;
    }
    // Fallback: no intro element present, fall back to crawl animation state
    if (crawl){
      setLock(crawlIsActive());
    }
  }

  // Initial application
  updateLockFromState();

  // Observe style attribute changes on the crawl element (pause/resume toggle
  // updates animation-play-state via inline style). Also observe class
  // changes on the intro element to detect when it becomes visible.
  if (crawl && typeof MutationObserver !== 'undefined'){
    const mo = new MutationObserver(() => updateLockFromState());
    mo.observe(crawl, { attributes: true, attributeFilter: ['style', 'class'] });
    // also listen for animationstart/animationend for extra signal coverage
    crawl.addEventListener('animationstart', ()=> setLock(true));
    crawl.addEventListener('animationend', ()=> setLock(false));
  }

  if (intro && typeof MutationObserver !== 'undefined'){
    const mo2 = new MutationObserver(() => updateLockFromState());
    mo2.observe(intro, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  // If the pause-scroll helper is present, wrap its setPauseState so we can
  // react immediately whenever other scripts pause/resume the crawl.
  try {
    if (window.pauseScroll && typeof window.pauseScroll.setPauseState === 'function'){
      const orig = window.pauseScroll.setPauseState.bind(window.pauseScroll);
      window.pauseScroll.setPauseState = function(paused, opts = {}){
        const res = orig(paused, opts);
        // paused=true means crawl is paused -> remove lock
        updateLockFromState();
        return res;
      };
    }
  } catch(e){ /* defensive: proceed without wrapping */ }

});


