// research.js — open a project card into a fullscreen animated card and close it
(function(){
  function openFullscreenFromCard(card){
    var rect = card.getBoundingClientRect();
    // clone the card so we can animate it independently
    var clone = card.cloneNode(true);
    clone.classList.add('project-clone');
    // style to match original position
    clone.style.position = 'fixed';
    clone.style.top = rect.top + 'px';
    clone.style.left = rect.left + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.margin = '0';
    clone.style.zIndex = 9999;
    // ensure details and full content are visible inside clone and scrollable
    var contentBlocks = clone.querySelectorAll('.project-details, .project-full');
    contentBlocks.forEach(function(block){
      block.hidden = false;
      block.style.maxHeight = 'none';
      block.style.overflow = 'auto';
      block.style.padding = '12px 16px 20px 16px';
    });

  // add overlay dim behind the clone
  var overlay = document.createElement('div');
  overlay.className = 'project-overlay';
  overlay.style.opacity = '0';
  overlay.style.zIndex = 9998;
  document.body.appendChild(overlay);

  // add a close button
  var close = document.createElement('button');
  close.className = 'project-close';
  close.setAttribute('aria-label','Close project');
  close.innerHTML = '✕';
  clone.appendChild(close);

    document.body.appendChild(clone);
    // prevent background scroll while modal open
    document.body.style.overflow = 'hidden';
  // mark modal open so we can suppress focus outlines
  document.body.classList.add('project-modal-open');

    // prepare hardware-accelerated properties for smoother animation
    clone.style.willChange = 'top, left, width, height, transform, opacity';
    clone.style.backfaceVisibility = 'hidden';
    var img = clone.querySelector('.project-image');
    if(img){ img.style.willChange = 'transform'; img.style.transform = 'translateZ(0)'; }

    // animate to fullscreen with a slight inset
    requestAnimationFrame(function(){
      clone.style.top = '4vh';
      clone.style.left = '4vw';
      clone.style.width = '92vw';
      clone.style.height = '92vh';
      clone.style.borderRadius = '12px';
    });

  // fade in overlay then animate clone
  requestAnimationFrame(function(){ overlay.style.transition = 'opacity 260ms ease'; overlay.style.opacity = '1'; });
  // fade in the close button after a short delay for nicer UX
  setTimeout(function(){ close.style.opacity = '1'; close.focus(); }, 240);

    function closeHandler(){
      // fade out the close button and gently scale the image to reduce layout jump
      try{ close.style.opacity = '0'; } catch(e){}
      if(img){ img.style.transform = 'scale(0.98)'; }
      // animate back to original rect on next frame for smoother compositing
      requestAnimationFrame(function(){
        clone.style.top = rect.top + 'px';
        clone.style.left = rect.left + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.borderRadius = '';
        overlay.style.opacity = '0';
      });
      // restore scrolling
      document.body.style.overflow = '';
      // remove clone and overlay after transition
      clone.addEventListener('transitionend', function tt(){
          clone.removeEventListener('transitionend', tt);
          if(overlay && overlay.parentNode) overlay.remove();
          clone.remove();
          // clear any focused element so no yellow outline remains
          try{ if(document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); } catch(e){}
          // remove modal-open class
          document.body.classList.remove('project-modal-open');
      });
      document.removeEventListener('keydown', escHandler);
    }

  close.addEventListener('click', closeHandler);
  // clicking overlay closes
  overlay.addEventListener('click', closeHandler);

    function escHandler(e){ if(e.key === 'Escape'){ closeHandler(); }}
    document.addEventListener('keydown', escHandler);
  }

  document.addEventListener('DOMContentLoaded', function(){
    // open when clicking the button
    document.querySelectorAll('.project-toggle').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var card = btn.closest('.project-card');
        if(!card) return;
        openFullscreenFromCard(card);
      });
    });

    // open when clicking the whole card (exclude clicks on interactive elements)
    document.querySelectorAll('.project-card').forEach(function(card){
      // make the card keyboard-focusable
      card.setAttribute('tabindex','0');
      card.addEventListener('click', function(e){
        var target = e.target;
        // ignore clicks on buttons/links inside the card
        if(target.closest('button') || target.closest('a')) return;
        openFullscreenFromCard(card);
      });
      card.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          openFullscreenFromCard(card);
        }
      });
    });
  });
})();
