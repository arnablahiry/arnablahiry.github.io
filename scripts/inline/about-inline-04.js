    // Prefetch strategy for gallery and mini-banner images:
    // - On hover/focus we eagerly load the specific image to avoid cold-cache
    //   delay when the user clicks.
    // - We also perform a deferred background prefetch of all gallery images
    //   using requestIdleCallback (or a timeout fallback) so the common case
    //   is cached without blocking load.
    (function(){
      const preloaded = new Set();
      function preload(src){
        if(!src || preloaded.has(src)) return;
        if(!/^images\/about\//.test(src)) return;
        preloaded.add(src);
        try{
          const img = new Image();
          img.src = src;
          if(img.decode) img.decode().catch(()=>{});
        }catch(e){ /* ignore */ }
      }

      function handlePrefetchEvent(e){
        const a = e.target.closest('.about-photo-grid .about-thumb, .about-mini-banner .about-thumb');
        if(!a) return;
        const href = a.getAttribute('href') || (a.querySelector('img') && a.querySelector('img').src);
        preload(href);
      }

      document.addEventListener('mouseover', handlePrefetchEvent, {passive:true});
      document.addEventListener('focusin', handlePrefetchEvent, {passive:true});

      // Keep full-size photos cold until intent is shown; thumbnails are loaded
      // by the page, and the original image is fetched on hover/focus/click.
    })();
