const skipButton = document.getElementById("skip-button");
const crawl = document.getElementById("crawl");
const photoContainer = document.getElementById("photo-container");
const introSection = document.querySelector(".intro-section");
const introPhoto = document.querySelector(".intro-photo");
const introText = document.querySelector(".intro-text");

skipButton.addEventListener("click", () => {
  if (!crawl) return;

    // 🔹 Stop the CSS crawl animation immediately
    crawl.style.animation = "none";
    crawl.style.opacity = "1"; // ensure visible first

    // 🔹 Fade out smoothly (make it longer if you want)
    crawl.style.transition = "opacity 3s ease-in-out";
    requestAnimationFrame(() => {
        crawl.style.opacity = "0";
    });

    // 🔹 Disable automatic CSS delays on intro elements
    introSection.style.animation = "none";
    introPhoto.style.animation = "none";
    introText.style.animation = "none";

    // ✅ After fade is complete (2s)
    setTimeout(() => {
    // Hide crawl completely
    crawl.style.display = "none";

    // Stop any delayed CSS animations on photo/text
    introPhoto.style.animation = "none";
    introText.style.animation = "none";

    // Fade in photo container
    photoContainer.style.display = "flex";
    photoContainer.style.opacity = "0";
    photoContainer.style.transition = "opacity 1s ease";
    requestAnimationFrame(() => {
      photoContainer.style.opacity = "1";
    });

    // Staggered photo + text fade-in (photo first, then text slightly after)
    setTimeout(() => {
      introPhoto.style.transition = "opacity 1s ease";
      introPhoto.style.opacity = "1";
      // Mark the intro section visible now that the photo is being shown so
      // links and site navigation become clickable.
      try {
        const sec = document.querySelector('.intro-section');
        if (sec && !sec.classList.contains('visible')) sec.classList.add('visible');
      } catch(e){}
      // Gray out/disable the skip button once the photo is revealed
      disableSkipButton();
    }, 50);

    setTimeout(() => {
      introText.style.transition = "opacity 1s ease";
      introText.style.opacity = "1";
      // After the text transition completes, tell the intro scheduler that
      // the intro has been shown so it won't re-run later.
      if (window.pauseScroll && typeof window.pauseScroll.markIntroShown === 'function'){
        try {
          // mark both photo and text as shown, but don't force styles (allow the
          // transitions we just started to run normally)
          window.pauseScroll.markIntroShown({ photo: true, text: true, section: true, forceStyles: false });
        } catch(e){}
      }
      // Also clear any pending auto-stop timer (skip flow should own the final state)
      if (window.pauseScroll && typeof window.pauseScroll.clearAutoStop === 'function'){
        try { window.pauseScroll.clearAutoStop(); } catch(e){}
      }
    }, 350);
  }, 300); // match fade duration
});

// Helper to disable/gray the skip button and mark it aria-disabled
function disableSkipButton(){
  if (!skipButton) return;
  skipButton.disabled = true;
  skipButton.classList.add('disabled');
  skipButton.setAttribute('aria-disabled','true');
}

// If the photo appears via its CSS animation, listen for that and disable skip
if (introPhoto){
  introPhoto.addEventListener('animationend', (ev) => {
    // only react to opacity animation if named or if present
    disableSkipButton();
    // also disable the pause-scroll button if present
    const pause = document.getElementById('pause-scroll');
    if (pause){
      pause.disabled = true;
      pause.classList.add('disabled');
      pause.setAttribute('aria-disabled','true');
    }
  });
  // Also monitor transition end (for the skip-button flow using transitions)
  introPhoto.addEventListener('transitionend', (ev) => {
    if (ev.propertyName === 'opacity'){
      disableSkipButton();
      const pause = document.getElementById('pause-scroll');
      if (pause){
        pause.disabled = true;
        pause.classList.add('disabled');
        pause.setAttribute('aria-disabled','true');
      }
    }
  });
}
