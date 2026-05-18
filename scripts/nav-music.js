(function () {
  var MUSIC_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 3v10.5A3.5 3.5 0 1 0 13.5 17V7h4V3h-5.5z" fill="currentColor"/></svg>';
  var MUTED_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 3v10.5A3.5 3.5 0 1 0 13.5 17V7h4V3h-5.5z" fill="currentColor"/><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  var KEY_PLAYING = 'music:playing';
  var KEY_TIME    = 'music:time';
  var CROSS_VOL   = 0.35;

  function init() {
    var btn   = document.getElementById('nav-music-toggle');
    var audio = document.getElementById('my-audio');
    if (!btn || !audio) return;

    var isHomePage = !!document.getElementById('audio-player');

    // --- Restore state from previous page ---
    var wasPlaying = false;
    try { wasPlaying = sessionStorage.getItem(KEY_PLAYING) === 'true'; } catch (_) {}
    var savedTime = 0;
    try { savedTime = parseFloat(sessionStorage.getItem(KEY_TIME) || '0') || 0; } catch (_) {}

    // One-shot flag set when auto-skip is toggled off
    var playOnLoad = false;
    try {
      playOnLoad = localStorage.getItem('audio:playOnLoad') === 'on';
      if (playOnLoad) localStorage.removeItem('audio:playOnLoad');
    } catch (_) {}

    // When auto-skip is persistently off, music should always play on every load
    var autoSkipOff = false;
    try { autoSkipOff = localStorage.getItem('auto:skip') === 'off'; } catch (_) {}

    audio.volume = isHomePage ? 1 : CROSS_VOL;

    if (wasPlaying || playOnLoad || autoSkipOff) {
      function startPlayback() {
        if (savedTime > 0 && !playOnLoad) {
          try { audio.currentTime = savedTime; } catch (_) {}
        }
        audio.play().catch(function () {});
      }
      if (audio.readyState >= 1) {
        startPlayback();
      } else {
        audio.addEventListener('loadedmetadata', startPlayback, { once: true });
      }
    }

    // --- Save state before navigating away ---
    function saveState() {
      try {
        sessionStorage.setItem(KEY_PLAYING, (!audio.paused).toString());
        sessionStorage.setItem(KEY_TIME, audio.currentTime.toString());
      } catch (_) {}
    }

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
      saveState();
    }, true);

    window.addEventListener('beforeunload', saveState);

    // --- UI helpers ---
    function renderPlaying() {
      btn.innerHTML = MUSIC_SVG + '<span class="sr-only">Stop music</span>';
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('active');
    }
    function renderStopped() {
      btn.innerHTML = MUTED_SVG + '<span class="sr-only">Play music</span>';
      btn.setAttribute('aria-pressed', 'false');
      btn.classList.remove('active');
    }

    audio.addEventListener('play', renderPlaying);
    audio.addEventListener('pause', renderStopped);
    audio.addEventListener('pause', function () {
      try { sessionStorage.setItem(KEY_PLAYING, 'false'); } catch (_) {}
    });
    audio.addEventListener('play', function () {
      try { sessionStorage.setItem(KEY_PLAYING, 'true'); } catch (_) {}
    });

    if (audio.paused) renderStopped(); else renderPlaying();

    btn.addEventListener('click', function (e) {
      if (e && e.stopPropagation) {
        e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      }
      if (audio.paused) {
        audio.play().catch(function () {});
      } else {
        audio.pause();
      }
    });

    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
