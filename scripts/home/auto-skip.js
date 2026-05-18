document.addEventListener('DOMContentLoaded', () => {
  const KEY = 'auto:skip';
  const btn = document.getElementById('auto-skip-button');
  const skipBtn = document.getElementById('skip-button');

  // Default: enabled when no explicit pref set (first visit -> enabled)
  const stored = localStorage.getItem(KEY);
  // If no explicit pref set, default to enabled and persist that choice
  let enabled = (stored === null) ? true : (stored === 'on');
  if (stored === null) {
    try { localStorage.setItem(KEY, 'on'); } catch (e){}
  }

  // Skip crawl if auto-skip is on, OR if scifi mode is off (crawl is a scifi-only feature)
  const scifiEnabled = localStorage.getItem('site:scifi') === 'on';
  if ((enabled || !scifiEnabled) && skipBtn) {
    setTimeout(() => {
      try { skipBtn.click(); } catch (e){}
    }, 100);
  }

  if (!btn) return;

  function updateUI(){
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.title = enabled ? 'Auto-skip enabled (click to disable)' : 'Auto-skip disabled (click to enable)';
    if (enabled) btn.classList.add('active'); else btn.classList.remove('active');
  }

  updateUI();

  // Reflect the enabled state in the document so CSS can style other controls
  try { document.body.classList.toggle('auto-skip-enabled', enabled); } catch (e) {}
  try { document.body.classList.toggle('travel-overlay-active', !enabled); } catch (e) {}

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

  // Make audio controls non-interactive to mouse when auto-skip is enabled.
  // This is intentionally minimal: we only toggle pointer-events on the
  // control elements and any wrapping anchor so mouse clicks don't work.
  function updateAudioPointerEvents(enabledFlag){
    try{
      const ids = ['restart-button','skip-button','pause-scroll','play-pause'];
      ids.forEach((id)=>{
        const el = document.getElementById(id);
        if(!el) return;
        if(enabledFlag){
          try{ el.style.pointerEvents = 'none'; }catch(e){}
        } else {
          try{ el.style.pointerEvents = ''; }catch(e){}
        }
        try{ const a = el.closest('a'); if(a) { a.style.pointerEvents = enabledFlag ? 'none' : ''; } }catch(e){}
      });
    }catch(e){}
  }

  // apply initial pointer-events state
  updateAudioPointerEvents(enabled);

  // Create an invisible overlay that sits on top of #audio-controls and
  // intercepts mouse interactions. This is used when auto-skip is enabled
  // so the four controls underneath cannot be clicked by mouse.
  function ensureAudioControlsOverlay(){
    try{
      const container = document.getElementById('audio-controls');
      if(!container) return null;
      let overlay = document.getElementById('audio-controls-overlay');
      if(!overlay){
        overlay = document.createElement('div');
        overlay.id = 'audio-controls-overlay';
        // position to cover the whole audio-controls container
        overlay.style.position = 'absolute';
        overlay.style.left = '0';
        overlay.style.top = '7vh';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.background = 'transparent';
        overlay.style.zIndex = '9999999';
        overlay.style.display = 'none';
        // ensure overlay captures pointer events
        overlay.style.pointerEvents = 'auto';
        // append as the first child so it sits above the buttons
        container.appendChild(overlay);
      }
      return overlay;
    }catch(e){ return null; }
  }

  function toggleAudioControlsOverlay(enabledFlag){
    try{
      const overlay = ensureAudioControlsOverlay();
      if(!overlay) return;
      overlay.style.display = enabledFlag ? 'block' : 'none';
    }catch(e){}
  }

  // apply initial overlay state
  toggleAudioControlsOverlay(enabled);

  btn.addEventListener('click', () => {
    enabled = !enabled;
    try {
      if (enabled) localStorage.setItem(KEY, 'on'); else localStorage.setItem(KEY, 'off');
    } catch (e){}
    updateUI();
    try { document.body.classList.toggle('auto-skip-enabled', enabled); } catch (e){}
    try {
      if (!enabled) {
        // auto-skip OFF: switch to dark mode and auto-play music on reload
        try { localStorage.setItem('site:theme', 'dark'); } catch (e) {}
        try { document.documentElement.classList.remove('light-mode'); } catch (e) {}
        try { localStorage.setItem('audio:playOnLoad', 'on'); } catch (e) {}
      } else {
        // auto-skip ON: stop music immediately and suppress it after reload
        try { localStorage.removeItem('audio:playOnLoad'); } catch (e) {}
        try {
          const aud = document.getElementById('my-audio');
          if (aud && !aud.paused) aud.pause();
          sessionStorage.setItem('music:playing', 'false');
        } catch (e) {}
      }
    } catch (e){}

    // update memes immediately to reflect the new preference, then reload
    // so the change is persistent across navigation.
    updateMemesFromAutoSkip(enabled);
    // reflect pointer-events change immediately
    updateAudioPointerEvents(enabled);
    // show/hide the overlay immediately
    toggleAudioControlsOverlay(enabled);
    try { document.body.classList.toggle('travel-overlay-active', !enabled); } catch (e) {}
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
