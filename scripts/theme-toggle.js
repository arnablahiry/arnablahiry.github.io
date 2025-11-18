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
  }

  // Initialize from storage (default dark)
  const stored = localStorage.getItem(KEY) || 'dark';
  apply(stored);

  // If there's a toggle button on this page, wire it up. If not, we still
  // applied the stored theme above so pages without a toggle reflect the
  // chosen preference.
  if(!btn) return;

  btn.addEventListener('click', function(){
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
