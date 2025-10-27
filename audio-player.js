// Grab elements
const audio = document.getElementById('my-audio');
const btn = document.getElementById('play-pause');

// Toggle play/pause on button click
btn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play();           // Play audio
    btn.textContent = '⏸︎'; // Change icon to pause
  } else {
    audio.pause();          // Pause audio
    btn.textContent = '♫'; // Change icon to play
  }
});
