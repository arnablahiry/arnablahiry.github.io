// Grab elements
const audio = document.getElementById('my-audio');
const btn = document.getElementById('play-pause');

// Inline SVGs for music icon and crossed-music icon
const musicSvg = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M12 3v10.5A3.5 3.5 0 1 0 13.5 17V7h4V3h-5.5z" fill="currentColor" />
  </svg>`;

const musicCrossedSvg = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M12 3v10.5A3.5 3.5 0 1 0 13.5 17V7h4V3h-5.5z" fill="currentColor" />
    <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" transform="rotate(-12 12 12)" />
  </svg>`;

function renderPlayIcon() {
  if (!btn) return;
  btn.innerHTML = musicSvg;
  btn.setAttribute('aria-pressed', 'false');
}

function renderPlayingIcon() {
  if (!btn) return;
  btn.innerHTML = musicCrossedSvg;
  btn.setAttribute('aria-pressed', 'true');
}

// Safe attach: ensure elements exist
if (btn && audio) {
  // initialize icon according to current audio state
  if (audio.paused) renderPlayIcon(); else renderPlayingIcon();

  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      renderPlayingIcon();
    } else {
      audio.pause();
      renderPlayIcon();
    }
  });

  // Keep icon in sync if playback is changed externally
  audio.addEventListener('play', renderPlayingIcon);
  audio.addEventListener('pause', renderPlayIcon);
}
