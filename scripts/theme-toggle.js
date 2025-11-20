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
      if(btn){
        btn.setAttribute('aria-pressed','true');
        // Show a moon icon (indicates switching to dark) with an sr-only label
        btn.innerHTML = MOON_SVG + '<span class="sr-only">Dark</span>';
      }
    } else {
      document.body.classList.remove('light-mode');
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
