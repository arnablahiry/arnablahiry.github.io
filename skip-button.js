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

    // Staggered photo + text fade-in
    setTimeout(() => {
      introPhoto.style.transition = "opacity 1s ease";
      introPhoto.style.opacity = "1";
    }, 300);

    setTimeout(() => {
      introText.style.transition = "opacity 1s ease";
      introText.style.opacity = "1";
    }, 800);
  }, 300); // match fade duration
});
