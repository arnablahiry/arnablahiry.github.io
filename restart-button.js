const restartButton = document.getElementById("restart-button");
const photoContainer = document.getElementById("photo-container");
const introPhoto = document.getElementById("intro-photo");
const introText = document.getElementById("intro-text");

// Helper: reset intro animations to their initial state
function resetIntroAnimations() {
    if (photoContainer) {
        photoContainer.style.opacity = "0";
        photoContainer.style.transition = "none";
    }
    if (introPhoto) {
        introPhoto.style.opacity = "0";
        // remove any inline animation so the CSS animation-delay starts fresh
        introPhoto.style.animation = "";
        // re-apply the intended animation so it replays after the crawl finishes
        // small timeout to ensure DOM changes are applied
        setTimeout(() => {
            introPhoto.style.animation = "fadeInPhoto 2s ease forwards";
        }, 50);
    }
    if (introText) {
        introText.style.opacity = "0";
        introText.style.animation = "";
        setTimeout(() => {
            introText.style.animation = "fadeInText 2s ease forwards";
        }, 50);
    }
    // remove the visible class so links are not clickable immediately after restart
    try {
      const sec = document.querySelector('.intro-section');
      if (sec) sec.classList.remove('visible');
    } catch(e){}
}

restartButton.addEventListener("click", () => {
    // Get the current crawl element (in case it was replaced before)
    const crawl = document.getElementById("crawl");
    if (!crawl) return;

    // 1) Make sure intro section is reset immediately
    resetIntroAnimations();

    // 2) Robustly restart the crawl animation by replacing the node with a clone.
    // Cloning creates a fresh element so CSS animations will always start from the beginning.
    const newCrawl = crawl.cloneNode(true);

    // Optional: clear any inline styles that might have persisted
    newCrawl.style.removeProperty("animation");
    newCrawl.style.removeProperty("opacity");
    newCrawl.style.removeProperty("display");
    newCrawl.style.removeProperty("top");
    newCrawl.style.removeProperty("transform");

    // Replace the old element in the DOM
    crawl.parentNode.replaceChild(newCrawl, crawl);

    // Force a small reflow and ensure the CSS animation defined in .crawl runs
    // (The cloned element will have the same class and hence the same animation.)
    // Accessing offsetWidth forces layout.
    void newCrawl.offsetWidth;

    // Ensure it's visible
    newCrawl.style.display = "block";
    newCrawl.style.opacity = "1";

    // If you want to programmatically set the animation (instead of relying on CSS),
    // you can uncomment the following line to explicitly start it here:
    // newCrawl.style.animation = 'crawl 40s linear forwards';
});
// When restarting, re-enable the pause-scroll button (new crawl is running)
document.addEventListener('DOMContentLoaded', () => {
    // nothing here; keep for parity
});

// Also provide a helper to be called after restart to re-enable pause button
function onCrawlRestart(){
    const pause = document.getElementById('pause-scroll');
    if (pause){
        // prefer using the exposed helper if available
        if (window.pauseScroll && typeof window.pauseScroll.enable === 'function'){
            window.pauseScroll.enable();
        } else {
            pause.disabled = false;
            pause.classList.remove('disabled');
            pause.removeAttribute('aria-disabled');
            pause.textContent = '⏸';
        }
    }
}

// Try to call onCrawlRestart when restart button finishes its operation
restartButton.addEventListener('click', () => {
    // slight timeout to run after the replacement/mutation above
    setTimeout(onCrawlRestart, 120);
});
