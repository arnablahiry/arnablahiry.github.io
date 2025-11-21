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

  // preserve original border-radius and hide the original card to avoid duplication
  try{ var cs = window.getComputedStyle(card); clone.dataset.origBorderRadius = cs.borderRadius || ''; }catch(e){ clone.dataset.origBorderRadius = ''; }
  try{ card.dataset._origVisibility = card.style.visibility || ''; card.style.visibility = 'hidden'; }catch(e){}

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
  // keep background scroll enabled so the main scrollbar remains available
  // (do not set document.body.style.overflow = 'hidden')
  // mark modal open so we can suppress focus outlines
  document.body.classList.add('project-modal-open');

    // prepare hardware-accelerated properties for smoother animation
    clone.style.willChange = 'top, left, width, height, transform, opacity';
    clone.style.backfaceVisibility = 'hidden';
    var img = clone.querySelector('.project-image');
    if(img){ img.style.willChange = 'transform'; img.style.transform = 'translateZ(0)'; }

    // We use FLIP for the image so it visually expands from the thumbnail without a snap.
    // Measure original image rect (thumbnail) and compute final image rect inside the
    // expanded clone by temporarily applying the final clone styles.
    var origImgRect = null;
    try{
      var origImg = card.querySelector('.project-image');
      if(origImg) origImgRect = origImg.getBoundingClientRect();
    }catch(e){ origImgRect = null; }

    // compute final clone rect (fullscreen inset) but don't paint it yet
    var finalClone = { top: '4vh', left: '4vw', width: '92vw', height: '92vh', borderRadius: '12px' };

    // compute the cloned image rect in the final state by applying final styles off-screen
    var finalImgRect = null;
    try{
      // apply final layout to clone but keep it visually identical by measuring then reverting
      var prev = { top: clone.style.top, left: clone.style.left, width: clone.style.width, height: clone.style.height, borderRadius: clone.style.borderRadius };
      clone.style.top = finalClone.top; clone.style.left = finalClone.left; clone.style.width = finalClone.width; clone.style.height = finalClone.height; clone.style.borderRadius = finalClone.borderRadius;
      // force layout
      finalImgRect = (clone.querySelector('.project-image') || img).getBoundingClientRect();
      // revert to initial
      clone.style.top = prev.top; clone.style.left = prev.left; clone.style.width = prev.width; clone.style.height = prev.height; clone.style.borderRadius = prev.borderRadius;
    }catch(e){ finalImgRect = null; }

    // now prepare transitions and perform the FLIP animation
    // show overlay fade
    overlay.style.transition = 'opacity 260ms ease';
    requestAnimationFrame(function(){ overlay.style.opacity = '1'; });
    // fade in the close button after a short delay for nicer UX
    setTimeout(function(){ close.style.opacity = '1'; close.focus(); }, 240);

    // If we have both original and final image rects, animate the image using FLIP
    if(img && origImgRect && finalImgRect){
      // compute inverse transform that maps final -> initial
      var deltaX = origImgRect.left - finalImgRect.left;
      var deltaY = origImgRect.top - finalImgRect.top;
      var scaleX = origImgRect.width / finalImgRect.width;
      var scaleY = origImgRect.height / finalImgRect.height;
      img.style.transformOrigin = 'center center';
      // set the image to appear at the thumbnail position while clone is expanded
      img.style.transition = 'transform 520ms cubic-bezier(0.22,0.1,0.22,1)';
      img.style.transform = 'translate(' + deltaX + 'px,' + deltaY + 'px) scale(' + scaleX + ',' + scaleY + ')';

      // next frame, expand clone and animate image back to its natural size inside clone
      requestAnimationFrame(function(){
        clone.style.transition = 'top 520ms cubic-bezier(0.22,0.1,0.22,1), left 520ms cubic-bezier(0.22,0.1,0.22,1), width 520ms cubic-bezier(0.22,0.1,0.22,1), height 520ms cubic-bezier(0.22,0.1,0.22,1), border-radius 260ms ease, box-shadow 260ms ease';
        clone.style.top = finalClone.top; clone.style.left = finalClone.left; clone.style.width = finalClone.width; clone.style.height = finalClone.height; clone.style.borderRadius = finalClone.borderRadius;
        // animate image to identity
        img.style.transform = 'none';
      });
    } else {
      // fallback: simple expand
      requestAnimationFrame(function(){
        clone.style.transition = 'top 480ms cubic-bezier(0.22, 0.1, 0.22, 1), left 480ms cubic-bezier(0.22, 0.1, 0.22, 1), width 480ms cubic-bezier(0.22, 0.1, 0.22, 1), height 480ms cubic-bezier(0.22, 0.1, 0.22, 1), border-radius 260ms ease, box-shadow 260ms ease';
        clone.style.top = finalClone.top; clone.style.left = finalClone.left; clone.style.width = finalClone.width; clone.style.height = finalClone.height; clone.style.borderRadius = finalClone.borderRadius;
      });
    }

    function closeHandler(){
      // Quick UX: fade the overlay and scale the clone down while fading it out.
      try{ close.style.opacity = '0'; } catch(e){}

      // Make the original card visible immediately so it isn't blank while the clone fades.
      try{ card.style.visibility = card.dataset._origVisibility || ''; }catch(e){}
      // Also make the in-card controls visible but start them at 0 opacity
      // so we can fade them in after the clone is gone.
      try{
        var toggles = card.querySelectorAll('.project-toggle');
        toggles.forEach(function(t){
          t.style.visibility = 'visible';
          t.style.pointerEvents = 'auto';
          // slower fade-in (user requested) — ~420ms
          t.style.transition = 'opacity 420ms ease';
          t.style.opacity = '0';
        });
      }catch(e){}

      // Prepare a short transition for a fast zoom-out + fade
      clone.style.transition = 'transform 220ms ease, opacity 220ms ease, border-radius 180ms ease';
      overlay.style.transition = 'opacity 180ms ease';

      // Trigger the zoom-out & fade on the next frame for smoother compositing
      requestAnimationFrame(function(){
        overlay.style.opacity = '0';
        clone.style.opacity = '0';
        // scale down slightly to suggest a zoom-out
        clone.style.transformOrigin = 'center center';
        clone.style.transform = 'scale(0.92)';
      });

      // Remove and cleanup after the short transition
      var onFastRemove = function tt(ev){
        // Some browsers fire multiple transitionend events; remove when opacity or transform finishes
        if(ev && (ev.propertyName === 'opacity' || ev.propertyName === 'transform')){
          clone.removeEventListener('transitionend', tt);
          if(overlay && overlay.parentNode) overlay.remove();
          if(clone && clone.parentNode) clone.remove();
          try{ card.style.visibility = card.dataset._origVisibility || ''; delete card.dataset._origVisibility; }catch(e){}
          document.body.style.overflow = '';
          try{ if(document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); } catch(e){}
          document.body.classList.remove('project-modal-open');
          // fade the toggles in, then clear our inline overrides after the fade
          try{
            var toggles = card.querySelectorAll('.project-toggle');
            toggles.forEach(function(t){
              // trigger fade-in
              requestAnimationFrame(function(){ t.style.opacity = '1'; });
            });
            // after the fade completes, clear the inline styles so page CSS regains control
            setTimeout(function(){
              try{ toggles.forEach(function(t){ t.style.transition = ''; t.style.opacity = ''; t.style.visibility = ''; t.style.pointerEvents = ''; }); }catch(e){}
            }, 480);
          }catch(e){}
        }
      };
      clone.addEventListener('transitionend', onFastRemove);
      // detach keyboard handler
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
