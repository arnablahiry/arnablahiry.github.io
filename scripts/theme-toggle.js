// General theme toggle used across pages. Looks for a button with id `theme-toggle`
// and toggles `body.classList` between 'light-mode' (light) and no class (dark).
// Persists the chosen theme to localStorage under key 'site:theme'.

(function(){
  const KEY = 'site:theme';
  const btn = document.getElementById('theme-toggle');
  
  // Inline SVG icons (inherit currentColor)
  const SUN_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></g></svg>';
  const MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>';

  function apply(theme){
    // If a page requests the theme to be locked to dark (e.g. homepage while
    // an intro/crawl is running) respect that lock and force dark mode.
    if(document.body && document.body.dataset && document.body.dataset.themeLock === 'dark'){
      theme = 'dark';
    }

    // Preserve nav-open state (if header/menu is currently open) so toggling
    // the theme won't unexpectedly close the mobile nav. We'll reapply the
    // header 'nav-open' class and hamburger state after changing the theme.
    const header = document.querySelector('header');
    const hamburger = document.querySelector('.hamburger');
    const wasNavOpen = header && header.classList.contains('nav-open');

    if(theme === 'light'){
      document.body.classList.add('light-mode');
      try{ document.documentElement.classList.add('light-mode'); }catch(_){ }
      if(btn){
        btn.setAttribute('aria-pressed','true');
        // Show a moon icon (indicates switching to dark) with an sr-only label
        btn.innerHTML = MOON_SVG + '<span class="sr-only">Dark</span>';
      }
    } else {
      document.body.classList.remove('light-mode');
      try{ document.documentElement.classList.remove('light-mode'); }catch(_){ }
      if(btn){
        btn.setAttribute('aria-pressed','false');
        // Show a sun icon (indicates switching to light) with an sr-only label
        btn.innerHTML = SUN_SVG + '<span class="sr-only">Light</span>';
      }
    }

    // Reapply nav-open if it was set before the theme change. This ensures the
    // open navigation remains visible across theme toggles.
    if(wasNavOpen && header){
      header.classList.add('nav-open');
      if(hamburger){
        hamburger.classList.add('open');
        hamburger.setAttribute('aria-expanded','true');
      }
    }
  }

  // Re-apply stored theme when other parts of the app signal the lock state
  // changed (e.g. homepage crawl started/stopped). The apply() function
  // above will honor body.dataset.themeLock === 'dark' and force dark when
  // required.
  document.addEventListener('theme:lock-changed', () => {
    const stored = localStorage.getItem(KEY) || 'dark';
    apply(stored);
  });

  // Initialize from storage (default dark)
  const stored = localStorage.getItem(KEY) || 'dark';
  apply(stored);

  // Albedo: images with a second version for one theme (data-src-light /
  // data-src-dark, set in the site editor) show it in that theme and their
  // own src otherwise (remembered in data-src-base; a page that sets a new
  // src sets a new base). Flipping images with data-albedo is done in
  // css/utils.css.
  const ALT = 'img[data-src-light], img[data-src-dark]';
  // addresses compared without ?query (the local editor's live reload adds one)
  const bare = function(u){ return u == null ? null : String(u).split('?')[0]; };
  function swapImage(img){
    const light = document.body.classList.contains('light-mode');
    const src = img.getAttribute('src') || '';
    if (!src) return;   // a page clearing an image (e.g. a closed lightbox)
    const L = img.getAttribute('data-src-light'), D = img.getAttribute('data-src-dark');
    let base = img.getAttribute('data-src-base');
    if (base == null || [base, L, D].map(bare).indexOf(bare(src)) === -1) { base = src; img.setAttribute('data-src-base', base); }
    const want = (light ? L : D) || base;
    if (want && bare(src) !== bare(want)) img.setAttribute('src', want);
  }
  function swapThemeImages(root){
    if (root.matches && root.matches(ALT)) swapImage(root);
    if (root.querySelectorAll) root.querySelectorAll(ALT).forEach(swapImage);
  }
  swapThemeImages(document);
  new MutationObserver(function(records){
    records.forEach(function(r){
      if (r.type === 'attributes') {
        if (r.target === document.body) swapThemeImages(document);
        else if (r.target.matches && r.target.matches(ALT)) swapImage(r.target);
        return;
      }
      r.addedNodes.forEach(function(n){ if (n.nodeType === 1) swapThemeImages(n); });
    });
  }).observe(document.body, { attributes: true, attributeFilter: ['class', 'src', 'data-src-light', 'data-src-dark'], childList: true, subtree: true });

  // If there's a toggle button on this page, wire it up. If not, we still
  // applied the stored theme above so pages without a toggle reflect the
  // chosen preference.
  if(!btn) return;

  btn.addEventListener('click', function(e){
    // Prevent this click from bubbling to document-level handlers that may
    // close the navigation (the site has a document click listener which
    // closes the nav on outside clicks). Stopping propagation ensures the
    // theme toggle won't inadvertently trigger a nav-close.
    if(e && typeof e.stopPropagation === 'function'){
      e.stopPropagation();
      e.stopImmediatePropagation && e.stopImmediatePropagation();
    }

    // If theme is locked (homepage during crawl), ignore clicks
    if(document.body && document.body.dataset && document.body.dataset.themeLock === 'dark') return;

    const next = document.body.classList.contains('light-mode') ? 'dark' : 'light';
    // Add a short-lived class that enables theme-related transitions.
    // This ensures stored/theme-on-load changes remain instantaneous,
    // and only user-initiated toggles animate.
    try{
      document.documentElement.classList.add('theme-animate');
      // Remove after the expected longest transition (600ms) + buffer
      setTimeout(()=>{
        document.documentElement.classList.remove('theme-animate');
      }, 800);
    }catch(_){/* ignore */}

    localStorage.setItem(KEY, next);
    apply(next);
  });

  // Allow keyboard activation (Enter/Space) when focused
  btn.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      btn.click();
    }
  });
})();
