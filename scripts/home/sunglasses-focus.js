// Show sunglasses after at least 5 seconds of keyboard focus on the profile photo.
// Adds the class .sunglasses-ready to .photo-wrapper when focus lasts >= 5000ms.

(function(){
  const wrapper = document.querySelector('.photo-wrapper');
  if(!wrapper) return;
  const photo = wrapper.querySelector('.intro-photo');
  if(!photo) return;

  let focusTimer = null;
  const FOCUS_DELAY = 5000; // ms

  function startTimer(){
    // If already visible, do nothing
    if(wrapper.classList.contains('sunglasses-ready')) return;
    focusTimer = setTimeout(()=>{
      wrapper.classList.add('sunglasses-ready');
      focusTimer = null;
    }, FOCUS_DELAY);
  }

  function clearTimer(){
    if(focusTimer){
      clearTimeout(focusTimer);
      focusTimer = null;
    }
    // remove the class on blur
    wrapper.classList.remove('sunglasses-ready');
  }

  // Use focusin/focusout on wrapper to catch focus moves to children
  wrapper.addEventListener('focusin', (e)=>{
    // we only start timer if focus is on the photo itself (keyboard user)
    // but also allow if any child inside wrapper received focus
    startTimer();
  });

  wrapper.addEventListener('focusout', (e)=>{
    // clear timer and hide if focus leaves
    clearTimer();
  });

  // Safety: if user clicks (mouse) to focus, we don't start the delayed reveal.
  // Start the timer only for keyboard-originated focus events.
  // Unfortunately detecting keyboard vs mouse reliably is tricky; we use a small heuristic.
  let lastInteractionWasKeyboard = false;
  function onKeyDown(){ lastInteractionWasKeyboard = true; }
  function onMouseDown(){ lastInteractionWasKeyboard = false; }

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('mousedown', onMouseDown, true);

  // Enhanced startTimer to check lastInteractionWasKeyboard
  const origStart = startTimer;
  startTimer = function(){
    if(!lastInteractionWasKeyboard) return; // only react to keyboard focus
    origStart();
  };

  // Clean up on page hide/unload
  window.addEventListener('pagehide', () => {
    clearTimer();
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('mousedown', onMouseDown, true);
  });

})();
