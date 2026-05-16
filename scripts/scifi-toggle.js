(function () {
  var KEY = 'site:scifi';

  var PLANET_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4" fill="currentColor"/><ellipse cx="12" cy="12" rx="9.5" ry="3" stroke="currentColor" stroke-width="1.5" fill="none" transform="rotate(-28 12 12)"/></svg>';

  var btn = document.getElementById('scifi-toggle');
  if (!btn) return;

  var enabled = localStorage.getItem(KEY) === 'on';

  function updateUI() {
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.classList.toggle('active', enabled);
    btn.innerHTML = PLANET_SVG + '<span class="sr-only">' + (enabled ? 'Normal background' : 'Sci-fi background') + '</span>';
    document.documentElement.classList.toggle('scifi-enabled', enabled);

    // Swap sidebar box images to their scifi/normal variants
    var swappable = document.querySelectorAll('img[data-src-scifi]');
    for (var i = 0; i < swappable.length; i++) {
      var img = swappable[i];
      if (img.id === 'bg-image') continue; // handled separately by swapBg()
      var next = enabled ? img.dataset.srcScifi : img.dataset.srcNormal;
      if (next && img.getAttribute('src') !== next) img.setAttribute('src', next);
    }
  }

  updateUI();

  var _pendingNext = null;   // the in-flight overlay img element
  var _pendingTimer = null;  // cleanup timer handle
  var _pendingSrc   = null;  // destination src of the in-flight swap

  function swapBg() {
    var img = document.getElementById('bg-image');
    if (!img) return;
    var nextSrc = enabled ? (img.dataset.srcScifi || img.src) : (img.dataset.srcNormal || img.src);

    // Nothing to do if we're already at (or heading to) this src
    if (_pendingSrc === nextSrc) return;
    if (!_pendingSrc && img.getAttribute('src') === nextSrc) return;

    // Abort any in-flight transition so the new one starts clean
    if (_pendingNext) {
      clearTimeout(_pendingTimer);
      if (_pendingNext.parentNode) _pendingNext.parentNode.removeChild(_pendingNext);
      _pendingNext = null;
      _pendingTimer = null;
    }
    _pendingSrc = nextSrc;

    // Create incoming image element, styled identically to #bg-image, inserted
    // just after it in the DOM. Same z-index + later DOM order = visually on top.
    var next = document.createElement('img');
    next.style.cssText = 'position:fixed;top:50%;left:50%;min-width:100%;min-height:100%;'
      + 'width:auto;height:auto;transform:translate(-50%,-50%);object-fit:cover;'
      + 'z-index:-2;opacity:0;pointer-events:none;';
    next.setAttribute('alt', '');
    next.setAttribute('aria-hidden', 'true');
    img.parentNode.insertBefore(next, img.nextSibling);
    _pendingNext = next;

    function doFade() {
      if (next !== _pendingNext) return; // superseded by a newer swap
      next.style.transition = 'opacity 700ms ease';
      next.style.opacity = '1';
      _pendingTimer = setTimeout(function () {
        if (next !== _pendingNext) return;
        img.style.transition = 'none';
        img.setAttribute('src', nextSrc);
        if (next.parentNode) next.parentNode.removeChild(next);
        _pendingNext = null;
        _pendingTimer = null;
        _pendingSrc   = null;
      }, 750);
    }

    next.addEventListener('load',  function () { doFade(); }, { once: true });
    next.addEventListener('error', function () {
      if (next.parentNode) next.parentNode.removeChild(next);
      if (_pendingNext === next) { _pendingNext = null; _pendingSrc = null; }
    }, { once: true });
    next.src = nextSrc;
  }

  btn.addEventListener('click', function (e) {
    if (e && e.stopPropagation) {
      e.stopPropagation();
      e.stopImmediatePropagation && e.stopImmediatePropagation();
    }
    // Block toggling scifi off during home page intro only
    var isHomePage = document.body.classList.contains('page-home');
    var introRevealed = document.body.classList.contains('intro-revealed');
    if (isHomePage && !introRevealed && enabled) return;
    enabled = !enabled;
    try {
      if (enabled) localStorage.setItem(KEY, 'on');
      else localStorage.removeItem(KEY);
    } catch (_) {}
    swapBg();
    updateUI();
  });

  btn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
})();
