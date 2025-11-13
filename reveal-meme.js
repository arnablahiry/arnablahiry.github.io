// reveal-meme.js
// Accessible reveal: clicking the button reveals the image; clicking the image hides it again.
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('meme-overlay');
  const btn = document.getElementById('reveal-btn');
  const img = document.getElementById('meme-image');
  const wrapper = document.getElementById('meme-wrapper');

  if (!overlay || !btn || !img || !wrapper) return;

  // Ensure the image is keyboard-focusable so keyboard users can hide it
  if (!img.hasAttribute('tabindex')) img.setAttribute('tabindex', '0');

  function updateButton(revealed) {
    // revealed === true means overlay is hidden and image is visible
    btn.setAttribute('aria-pressed', String(revealed));
    btn.textContent = revealed ? 'Hide Meme ;)' : 'Reveal Meme ;)' ;
  }

  function setRevealed(showImage) {
    if (showImage) {
      overlay.classList.add('revealed');
      updateButton(true);
    } else {
      overlay.classList.remove('revealed');
      updateButton(false);
    }
  }

  // Toggle when the button is clicked
  btn.addEventListener('click', () => {
    const currentlyRevealed = overlay.classList.contains('revealed');
    setRevealed(!currentlyRevealed);
  });

  // Keyboard support for the button (Enter/Space)
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });

  // Clicking the image when it's revealed should hide it again (i.e., show overlay)
  img.addEventListener('click', () => {
    if (overlay.classList.contains('revealed')) {
      setRevealed(false);
    }
  });

  // Keyboard support for image: Enter/Space toggles hide when image is focused
  img.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && overlay.classList.contains('revealed')) {
      e.preventDefault();
      setRevealed(false);
    }
  });

  // Initialize button state
  updateButton(overlay.classList.contains('revealed'));
});

