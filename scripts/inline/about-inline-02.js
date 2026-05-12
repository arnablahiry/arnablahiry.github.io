    // Lightbox for gallery images in about page — animated expansion from thumbnail
    (function(){
      const overlay = document.getElementById('lightbox');
      if(!overlay) return;
      const imgEl = overlay.querySelector('.lightbox-image');
      const captionEl = overlay.querySelector('.lightbox-caption');
      const closeBtn = overlay.querySelector('.lightbox-close');
  let lastActive = null;
  let currentAnchor = null;
  // store scroll position to prevent page jump when locking scroll
  let _savedScrollY = 0;
  // keep a reference to the current expanding clone so we can use it as
  // the visible lightbox image (user requested to "keep the clone").
  let currentClone = null;
      let openingAnchor = null;
      // Scroll lock that keeps the scrollbar visible but prevents scrolling.
      // We use event listeners to cancel scroll/wheel/touchmove/keys while the
      // overlay is open. This preserves the visual scrollbar but makes it
      // inactive.
      function _preventScroll(e){ e.preventDefault(); }
      function _preventKey(e){
        // prevent PageUp/PageDown/Space/Arrow keys/Home/End from scrolling
        const keys = ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '];
        if(keys.includes(e.key)) e.preventDefault();
      }
      function lockScrollPassive(){
        window.addEventListener('wheel', _preventScroll, { passive: false });
        window.addEventListener('touchmove', _preventScroll, { passive: false });
        window.addEventListener('keydown', _preventKey, { passive: false });
      }
      function unlockScrollPassive(){
        window.removeEventListener('wheel', _preventScroll, { passive: false });
        window.removeEventListener('touchmove', _preventScroll, { passive: false });
        window.removeEventListener('keydown', _preventKey, { passive: false });
      }

      // Restore focus to the triggering element but blur it shortly after so
      // :focus styles (zoom/overlay) on thumbnails don't persist after close.
      function restoreFocusThenBlur(el){
        try{
          if(el && typeof el.focus === 'function'){
            el.focus();
            // blur quickly so the visual :focus state doesn't remain.
            setTimeout(()=>{ try{ if(el && typeof el.blur === 'function') el.blur(); }catch(e){} }, 40);
          }
        }catch(e){}
      }

      function openLightboxFromThumb(anchor){
        const thumbImg = anchor.querySelector('img');
        if(!thumbImg) return;
  lastActive = document.activeElement;
  currentAnchor = anchor;
  // mark the anchor so its overlay label can be hidden during expand
  openingAnchor = anchor;
  anchor.classList.add('lightbox-opening');

        // clone thumbnail and animate to centered modal size
        const rect = thumbImg.getBoundingClientRect();
        const clone = thumbImg.cloneNode(true);
        clone.className = 'lightbox-clone';
        Object.assign(clone.style, {
          position: 'fixed',
          left: rect.left + 'px',
          top: rect.top + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px',
          margin: 0,
          transition: 'all 360ms cubic-bezier(.22,.8,.22,1)',
          zIndex: 410000,
          borderRadius: window.getComputedStyle(thumbImg).borderRadius || '8px',
          objectFit: 'cover'
        });
        document.body.appendChild(clone);

    // show overlay immediately so it fades in organically while the
    // thumbnail expands. Keep the clone above the overlay (higher z-index)
    // so the expansion appears seamless.
  overlay.removeAttribute('aria-hidden');
  overlay.setAttribute('data-state', 'open');

        // compute target size (fit within viewport but not full-bleed)
        // Preload the final image and compute the target size using its
        // natural aspect ratio so the clone expands directly to the image's
        // final dimensions (matching the lightbox constraints) without
        // snapping.
        const finalSrc = anchor.getAttribute('href') || thumbImg.src;
        const pre = new Image();
        pre.src = finalSrc;

        function fitToConstraints(aspect){
          // CSS constraints: panel max-width 88vw, image max-height 84vh
          const maxW = Math.round(window.innerWidth * 0.88);
          const maxH = Math.round(window.innerHeight * 0.84);
          let w = Math.min(maxW, Math.round(rect.width * 3));
          let h = Math.round(w / aspect);
          if(h > maxH){ h = maxH; w = Math.round(h * aspect); }
          return { w, h, left: Math.round((window.innerWidth - w) / 2), top: Math.round((window.innerHeight - h) / 2) };
        }

        function startCloneAnimWithAspect(aspect){
          aspect = aspect || (rect.width / rect.height) || 1;
          const tgt = fitToConstraints(aspect);
          // ensure the clone (which we will keep as the visible image) is
          // sized to the final target rect so the expansion morphs into
          // the exact final dimensions.
          clone.style.left = rect.left + 'px';
          clone.style.top = rect.top + 'px';
          // kickoff in the next frame to allow DOM paint
          requestAnimationFrame(()=>{
            clone.style.left = tgt.left + 'px';
            clone.style.top = tgt.top + 'px';
            clone.style.width = tgt.w + 'px';
            clone.style.height = tgt.h + 'px';
            clone.style.borderRadius = '12px';
          });
        }

        if(pre.complete && pre.naturalWidth){
          startCloneAnimWithAspect(pre.naturalWidth / pre.naturalHeight);
        } else {
          pre.onload = function(){ startCloneAnimWithAspect(pre.naturalWidth / pre.naturalHeight); };
          pre.onerror = function(){ startCloneAnimWithAspect(); };
        }

        // Wire up coordinated reveal: we need both the clone animation and
        // the image load to complete before we swap the clone out for the
        // real image. This avoids any snapping or visual mismatch.
        let _cloneDone = false;
        let _imgLoaded = false;
        function showImageWhenReady(){
          if(!_cloneDone || !_imgLoaded) return;
          // Both the clone expansion and the final image decode are done.
          // We've already replaced the clone.src with the final image, so
          // nothing else is required — just restore state and focus.
          if(openingAnchor){ openingAnchor.classList.remove('lightbox-opening'); openingAnchor = null; }
          // focus close button now that overlay is visible
          closeBtn.focus();
        }

        // Preload final image (decode if possible). When it's ready we will
        // set the overlay image (`imgEl`) src and crossfade the clone out so
        // the main image becomes visible. The clone remains in the DOM
        // (faded) so it can still be used as the source for the contraction
        // animation when closing.
        captionEl.textContent = '';
        // ensure overlay image starts hidden so we can crossfade it in
        try{ imgEl.style.opacity = '0'; }catch(e){}
        imgEl.src = '';
        const finalImg = new Image();
        finalImg.src = finalSrc;
        function _onFinalReady(){
          _imgLoaded = true;
          // Point the real lightbox image at the decoded asset. We'll wait
          // for it to be decoded/loaded and then crossfade the clone.
          imgEl.src = finalSrc;

          function _reveal(){
            // crossfade: reveal the real image and fade the clone out. Keep
            // the clone element in DOM (but make it pointer-events:none)
            // so the contraction animation can be created from it later.
            try{
              requestAnimationFrame(()=>{
                // show the overlay image (CSS also provides transitions)
                imgEl.style.opacity = '1';
                // fade the clone but keep it in DOM
                clone.classList.add('lightbox-clone-faded');
              });
            }catch(e){/* ignore */}
            if(openingAnchor){ openingAnchor.classList.remove('lightbox-opening'); openingAnchor = null; }
            // focus the close button once reveal is complete
            closeBtn.focus();
          }

          // Prefer decode on the overlay img if available; otherwise wait for load
          if('decode' in HTMLImageElement.prototype && !imgEl.complete){
            imgEl.decode().then(_reveal).catch(_reveal);
          } else if(imgEl.complete){
            _reveal();
          } else {
            imgEl.addEventListener('load', function _l(){ imgEl.removeEventListener('load', _l); _reveal(); });
            imgEl.addEventListener('error', function _e(){ imgEl.removeEventListener('error', _e); _reveal(); });
          }
        }
        if('decode' in HTMLImageElement.prototype){
          finalImg.decode().then(_onFinalReady).catch(_onFinalReady);
        } else {
          finalImg.addEventListener('load', function _l(){ finalImg.removeEventListener('load', _l); _onFinalReady(); });
          finalImg.addEventListener('error', function _e(){ finalImg.removeEventListener('error', _e); _onFinalReady(); });
        }

        // Keep the scrollbar visible but prevent scrolling by cancelling
        // scroll/wheel/touch/key events.
        lockScrollPassive();
        overlay.setAttribute('data-state', 'open');
        overlay.removeAttribute('aria-hidden');

        currentClone = clone;
        clone.addEventListener('transitionend', function handler(){
          clone.removeEventListener('transitionend', handler);
          _cloneDone = true;
          showImageWhenReady();
        });
      }

      function closeLightbox(){
        // If we have the originating thumbnail, animate a contraction back to it
        try{
          if(currentAnchor && currentClone && currentClone.src){
            const thumb = currentAnchor.querySelector('img');
            if(thumb){
              const start = currentClone.getBoundingClientRect();
              const end = thumb.getBoundingClientRect();
              const contraction = currentClone.cloneNode(true);
              Object.assign(contraction.style, {
                position: 'fixed',
                left: start.left + 'px',
                top: start.top + 'px',
                width: start.width + 'px',
                height: start.height + 'px',
                margin: 0,
                transition: 'all 360ms cubic-bezier(.22,.8,.22,1)',
                zIndex: 400000,
                borderRadius: window.getComputedStyle(thumb).borderRadius || '8px',
                objectFit: 'cover'
              });
              // Ensure the contraction clone is visible even if the persistent
              // clone had been faded out during viewing. Inline style wins
              // over any faded class.
              contraction.style.opacity = '1';
              contraction.style.transition = contraction.style.transition + ', opacity 220ms ease';
              document.body.appendChild(contraction);
              // hide overlay immediately so user sees clone animating
              overlay.removeAttribute('data-state');
              overlay.setAttribute('aria-hidden', 'true');
              // ensure any opening class is cleared so inline overlays restore
              if(currentAnchor && currentAnchor.classList){ currentAnchor.classList.remove('lightbox-opening'); }
              // animate contraction to thumbnail position
              requestAnimationFrame(()=>{
                contraction.style.left = end.left + 'px';
                contraction.style.top = end.top + 'px';
                contraction.style.width = end.width + 'px';
                contraction.style.height = end.height + 'px';
              });
              contraction.addEventListener('transitionend', function handler(){
                contraction.removeEventListener('transitionend', handler);
                contraction.remove();
                // unlock passive scroll prevention
                unlockScrollPassive();
                // remove the persistent clone used as the lightbox image
                if(currentClone && currentClone.parentNode) currentClone.remove();
                currentClone = null;
                captionEl.textContent = '';
                restoreFocusThenBlur(lastActive);
              });
              currentAnchor = null;
              return;
            }
          }
        }catch(err){ console.warn('lightbox close animation error', err); }

  overlay.removeAttribute('data-state');
  overlay.setAttribute('aria-hidden', 'true');
  // unlock passive scroll prevention if still active
  unlockScrollPassive();
  // remove any persistent clone used as the lightbox image
  if(currentClone && currentClone.parentNode) currentClone.remove();
  currentClone = null;
    // clear any opening class left behind
    if(openingAnchor){ openingAnchor.classList.remove('lightbox-opening'); openingAnchor = null; }
    if(currentAnchor && currentAnchor.classList){ currentAnchor.classList.remove('lightbox-opening'); currentAnchor = null; }
        // clear src after animation for memory
        setTimeout(()=>{ imgEl.src = ''; captionEl.textContent = ''; }, 320);
        restoreFocusThenBlur(lastActive);
      }

      // click delegation for gallery thumbnails — use expansion animation for grid items
      document.addEventListener('click', function(e){
        const a = e.target.closest('.about-photo-grid .about-thumb');
        if(a){
          e.preventDefault();
          openLightboxFromThumb(a);
        }
      });

      // clicking overlay outside content closes
      overlay.addEventListener('click', function(e){
        if(e.target === overlay) closeLightbox();
      });
      closeBtn.addEventListener('click', closeLightbox);
  // ESC to close
  window.addEventListener('keydown', function(e){ if(e.key === 'Escape' && overlay.getAttribute('data-state') === 'open') closeLightbox(); });
    })();
