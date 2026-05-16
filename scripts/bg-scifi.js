(function () {
  try {
    var img = document.getElementById('bg-image');
    if (!img) return;
    var normal = img.getAttribute('src') || '';
    var scifi = normal.replace('_bg.jpeg', '_scifi.jpeg').replace('background.jpeg', 'background_scifi.jpeg');
    img.dataset.srcNormal = normal;
    img.dataset.srcScifi = scifi;

    function applyScifiMode(enabled) {
      if (!img) return;
      if (enabled) {
        img.setAttribute('src', scifi);
      } else {
        img.setAttribute('src', normal);
      }
    }

    function checkAndApplyScifiMode() {
      applyScifiMode(localStorage.getItem('site:scifi') === 'on');
    }

    // Check initial state
    checkAndApplyScifiMode();

    // Listen for storage changes (from other tabs)
    window.addEventListener('storage', function (e) {
      if (e.key === 'site:scifi') {
        checkAndApplyScifiMode();
      }
    });

    // Re-check when the page becomes visible again (back button, tab switch)
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        checkAndApplyScifiMode();
      }
    });

    // Also re-check on pageshow in case back button is used
    window.addEventListener('pageshow', function () {
      checkAndApplyScifiMode();
    });
  } catch (e) {}
})();
