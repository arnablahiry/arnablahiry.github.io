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
  // Place the close button at the top-right corner of the cloned card
  // (absolute positioning inside the clone). This keeps it visually fixed
  // to the expanded card even while the clone scrolls or the page moves.
  try{
    // Append to body and position fixed at the clone's top-right so the
    // button remains visually attached to the expanded card while the
    // page or the clone content scrolls. We'll update its coordinates
    // on scroll/resize/animation frames.
    document.body.appendChild(close);
      close.style.position = 'fixed';
    close.style.zIndex = '10003';

      // Create a theme toggle button that simply delegates to the main site toggle.
      var themeBtn = document.createElement('button');
      themeBtn.className = 'project-theme-toggle';
      themeBtn.setAttribute('aria-label','Toggle theme');
      try{
        var siteToggle = document.getElementById('theme-toggle');
        if(siteToggle && siteToggle.innerHTML && siteToggle.innerHTML.trim().length){
          // copy markup if available so visuals match the site toggle
          themeBtn.innerHTML = siteToggle.innerHTML;
          // observe the main toggle so we mirror icon changes when theme updates
          try{
            var mo = new MutationObserver(function(){
              try{ themeBtn.innerHTML = siteToggle.innerHTML; }catch(_){ }
            });
            mo.observe(siteToggle, { childList: true, subtree: true, characterData: true });
            themeBtn._siteToggleObserver = mo;
          }catch(_){ /* ignore observer failures */ }
        } else {
          // simple visible fallback
          themeBtn.textContent = '☼';
        }
      }catch(e){ themeBtn.textContent = '☼'; }
      // Click delegates to the site-wide toggle button if present; otherwise no-op
      themeBtn.addEventListener('click', function(e){
        e.stopPropagation && e.stopPropagation();
        var siteToggle = document.getElementById('theme-toggle');
        if(siteToggle && typeof siteToggle.click === 'function'){
          siteToggle.click();
        }
      });
      document.body.appendChild(themeBtn);

    function updateClosePosition(){
      try{
        var rect = clone.getBoundingClientRect();
        var btnW = (close.offsetWidth) || 40;
        var top = rect.top + 12; // 12px inset from clone top
        var left = rect.left + rect.width - btnW - 12; // align to clone right edge
        // clamp within viewport
        if(top < 8) top = 8;
        if(left < 8) left = 8;
        close.style.top = top + 'px';
        close.style.left = left + 'px';
        // position theme button to the left of the close button if present
        try{
          if(themeBtn && themeBtn.parentNode){
            var tbw = themeBtn.offsetWidth || 40;
            var spacing = 8; // gap between buttons
            var themeLeft = left - tbw - spacing;
            if(themeLeft < 8) themeLeft = 8;
            themeBtn.style.top = top + 'px';
            themeBtn.style.left = themeLeft + 'px';
          }
        }catch(e){}
      }catch(e){}
    }

    // update on common events and using RAF for smoothness during animations
    var rafHandle = null;
    function rafLoop(){ updateClosePosition(); rafHandle = requestAnimationFrame(rafLoop); }
    // start RAF loop
    rafHandle = requestAnimationFrame(rafLoop);
  window.addEventListener('resize', updateClosePosition);
  window.addEventListener('scroll', updateClosePosition, {passive: true});

    // store references so cleanup can remove listeners/raf
    close._updateClosePosition = updateClosePosition;
    close._rafHandle = rafHandle;
    close._scrollHandler = updateClosePosition;
    // store theme button refs for cleanup
    if(themeBtn){
      themeBtn._isProjectControl = true;
      close._themeBtn = themeBtn;
    }
  }catch(e){
    // fallback: append to body as fixed at a default corner
    close.style.position = 'fixed';
    close.style.top = '12px';
    close.style.right = '12px';
    close.style.zIndex = '10002';
    document.body.appendChild(close);
  }

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
    // fade in the close button and the theme toggle after a short delay for nicer UX
    setTimeout(function(){ 
      close.style.opacity = '1'; 
      try{ close.focus(); }catch(e){}
      try{ if(themeBtn){ themeBtn.style.opacity = '1'; } }catch(e){}
    }, 240);

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
      // Immediately hide both the close and theme buttons so they don't linger
      // on-screen after the card is closed.
      try{
        // ensure a quick opacity transition then hide
        if(close){ close.style.transition = close.style.transition || 'opacity 120ms ease'; close.style.opacity = '0'; }
        if(themeBtn){ themeBtn.style.transition = themeBtn.style.transition || 'opacity 120ms ease'; themeBtn.style.opacity = '0'; }
      }catch(e){}

      // Stop updating button positions right away to avoid visual drift
      try{ if(close && close._rafHandle) cancelAnimationFrame(close._rafHandle); }catch(e){}
      try{ window.removeEventListener('resize', close._scrollHandler || close._updateClosePosition); }catch(e){}
      try{ window.removeEventListener('scroll', close._scrollHandler || close._updateClosePosition); }catch(e){}

      // Remove the esc handler immediately so keyboard won't interact after close
      try{ document.removeEventListener('keydown', escHandler); }catch(e){}

      // Make the overlay non-interactive immediately so page elements become
      // clickable again even while the clone is animating. Keep the overlay
      // in the DOM so its fade-out transition remains visible; removal will
      // happen during the normal cleanup path.
      try{ if(overlay){ overlay.style.pointerEvents = 'none'; } }catch(e){}
      try{ document.body.classList.remove('project-modal-open'); }catch(e){}
      try{ document.body.style.overflow = ''; }catch(e){}

      // Remove the buttons from the DOM shortly after starting the fade so they
      // don't remain interactive. onFastRemove will tolerate them already
      // being removed.
      setTimeout(function(){
        try{ if(themeBtn && themeBtn.parentNode) themeBtn.remove(); }catch(_){ }
        try{ if(close && close.parentNode) close.remove(); }catch(_){ }
      }, 180);

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

  // Prepare a short transition for a fast zoom-out + fade. Use !important
  // via setProperty to override page-level rules (eg. .theme-animate ->
  // transition-duration:0ms !) that would otherwise cancel opacity fades.
  try{ clone.style.setProperty('transition', 'transform 220ms ease, opacity 220ms ease, border-radius 180ms ease', 'important'); }catch(e){ clone.style.transition = 'transform 220ms ease, opacity 220ms ease, border-radius 180ms ease'; }
  try{ overlay.style.setProperty('transition', 'opacity 180ms ease', 'important'); }catch(e){ overlay.style.transition = 'opacity 180ms ease'; }

      // Trigger the zoom-out & fade on the next frame for smoother compositing
      requestAnimationFrame(function(){
        overlay.style.opacity = '0';
        clone.style.opacity = '0';
        // scale down slightly to suggest a zoom-out
        clone.style.transformOrigin = 'center center';
        clone.style.transform = 'scale(0.92)';
      });

      // Remove and cleanup after the short transition. We provide a transitionend
      // handler plus a timed fallback in case transitionend doesn't fire
      // (interruptions, theme reflows, or browser quirks). Cleanup is idempotent.
      var _cleanupDone = false;
      function doCleanup(){
        if(_cleanupDone) return; _cleanupDone = true;
        try{ if(overlay && overlay.parentNode) overlay.remove(); }catch(_){ }
        try{ if(clone && clone.parentNode) clone.remove(); }catch(_){ }
        try{
          if(close){
            try{ if(close._rafHandle) cancelAnimationFrame(close._rafHandle); }catch(_){ }
            try{ window.removeEventListener('resize', close._scrollHandler || close._updateClosePosition); }catch(_){ }
            try{ window.removeEventListener('scroll', close._scrollHandler || close._updateClosePosition); }catch(_){ }
            try{ 
              if(close._themeBtn){ 
                try{ if(close._themeBtn._siteToggleObserver) close._themeBtn._siteToggleObserver.disconnect(); }catch(_){ }
                if(close._themeBtn.parentNode) close._themeBtn.remove(); 
              }
            }catch(_){ }
            try{ if(close.parentNode) close.remove(); }catch(_){ }
          }
        }catch(_){ }
        try{ card.style.visibility = card.dataset._origVisibility || ''; delete card.dataset._origVisibility; }catch(_){ }
        try{ document.body.style.overflow = ''; }catch(_){ }
        try{ if(document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); } catch(_){ }
        try{ document.body.classList.remove('project-modal-open'); }catch(_){ }
        // fade the toggles in, then clear our inline overrides after the fade
        try{
          var toggles = card.querySelectorAll('.project-toggle');
          toggles.forEach(function(t){ requestAnimationFrame(function(){ t.style.opacity = '1'; }); });
          setTimeout(function(){ try{ toggles.forEach(function(t){ t.style.transition = ''; t.style.opacity = ''; t.style.visibility = ''; t.style.pointerEvents = ''; }); }catch(_){ } }, 480);
        }catch(_){ }
        // Ensure escHandler removed (defensive)
        try{ document.removeEventListener('keydown', escHandler); }catch(_){ }
      }
      var onFastRemove = function tt(ev){
        if(!ev || (ev.propertyName === 'opacity' || ev.propertyName === 'transform')){
          clone.removeEventListener('transitionend', tt);
          doCleanup();
        }
      };
      clone.addEventListener('transitionend', onFastRemove);
      // fallback cleanup in case transitionend doesn't fire
      setTimeout(function(){ doCleanup(); }, 520);
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
  // Fade out hover visuals while the user is actively scrolling.
  // Add 'scrolling' class to body on scroll and remove it shortly after scrolling stops.
  (function(){
    var scrollTimer = null;
    function onScroll(){
      try{ document.body.classList.add('scrolling'); }catch(e){}
      if(scrollTimer) { clearTimeout(scrollTimer); }
      scrollTimer = setTimeout(function(){ try{ document.body.classList.remove('scrolling'); }catch(e){} }, 220);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();
})();
