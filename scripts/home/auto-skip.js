document.addEventListener('DOMContentLoaded', () => {
  const KEY = 'auto:skip';
  const btn = document.getElementById('auto-skip-button');
  const skipBtn = document.getElementById('skip-button');
  if (!btn) return;

  // Default: enabled when no explicit pref set (first visit -> enabled)
  const stored = localStorage.getItem(KEY);
  // If no explicit pref set, default to enabled and persist that choice
  let enabled = (stored === null) ? true : (stored === 'on');
  if (stored === null) {
    try { localStorage.setItem(KEY, 'on'); } catch (e){}
  }

  function updateUI(){
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.title = enabled ? 'Auto-skip enabled (click to disable)' : 'Auto-skip disabled (click to enable)';
    if (enabled) btn.classList.add('active'); else btn.classList.remove('active');
  }

  updateUI();

  // Reflect the enabled state in the document so CSS can style other controls
  try { document.body.classList.toggle('auto-skip-enabled', enabled); } catch (e) {}

  // Update meme overlays according to auto-skip state:
  // - when auto-skip is enabled -> memes should be blurred (overlay visible)
  // - when auto-skip is disabled -> memes should be unblurred (overlay.revealed)
  function updateMemesFromAutoSkip(enabledFlag){
    try{
      const overlays = document.querySelectorAll('.meme-overlay');
      overlays.forEach((ov)=>{
        const wrapper = ov.closest('.meme-wrapper') || ov.parentElement;
        const btn = wrapper ? wrapper.querySelector('.reveal-btn') : null;
        if (enabledFlag){
          // auto-skip ON -> keep memes blurred (remove 'revealed')
          ov.classList.remove('revealed');
          if (btn) { btn.setAttribute('aria-pressed','false'); btn.textContent = 'Reveal meme ;)' }
        } else {
          // auto-skip OFF -> unblur all memes (add 'revealed')
          ov.classList.add('revealed');
          if (btn) { btn.setAttribute('aria-pressed','true'); btn.textContent = 'Hide Meme ;)' }
        }
      });
    }catch(e){}
  }

  // initialize memes to match current enabled state
  updateMemesFromAutoSkip(enabled);

  // If enabled, try to click the skip button shortly after load so skip runs
  if (enabled && skipBtn){
    setTimeout(() => {
      try { skipBtn.click(); } catch (e){}
    }, 100);
  }

  btn.addEventListener('click', () => {
    enabled = !enabled;
    try {
      if (enabled) localStorage.setItem(KEY, 'on'); else localStorage.setItem(KEY, 'off');
    } catch (e){}
    updateUI();
    try { document.body.classList.toggle('auto-skip-enabled', enabled); } catch (e){}
    // If auto-skip was just disabled, request the audio player to click
    // the music button after the reload so sound will start by default.
    try {
      if (!enabled) {
        localStorage.setItem('audio:playOnLoad', 'on');
        // Also set site theme to dark when auto-skip is disabled so the
        // experience becomes immersive by default.
        try { localStorage.setItem('site:theme', 'dark'); } catch (e) {}
        try { document.documentElement.classList.remove('light-mode'); } catch (e) {}
      } else {
        localStorage.removeItem('audio:playOnLoad');
      }
    } catch (e){}

    // update memes immediately to reflect the new preference, then reload
    // so the change is persistent across navigation.
    updateMemesFromAutoSkip(enabled);
    try { window.location.reload(); } catch (e){}
  });

  // Forward clicks and keyboard activation from the hint to the auto-skip button
  try {
    const hintEl = document.getElementById('immersive-hint');
    if (hintEl) {
      hintEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { btn.focus(); btn.click(); } catch (ee){}
      });
      hintEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          try { btn.focus(); btn.click(); } catch (ee){}
        }
      });
    }
  } catch (e) {}

  // Note: immersive hint is implemented in HTML/CSS (static in index.html); JS no longer injects it.
});
