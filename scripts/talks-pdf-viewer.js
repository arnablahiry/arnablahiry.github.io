// talks-pdf-viewer.js — Full-screen PDF viewer inside expanded cards
// Uses pdf.js (loaded from CDN, on demand) to render slides on a <canvas>.
//
// Loading strategy: card thumbnails are pre-rendered posters (see
// scripts/generate-talk-thumbnails.js), so no PDF is touched until a card is
// opened. On open the whole deck is downloaded behind a "Loading…" cover, page
// one is rendered, and the remaining pages are rendered into an in-memory cache
// in the background. Navigation blits a cached page onto the visible canvas, so
// flipping quickly never blanks the slide.
(function(){
  'use strict';

  // ── pdf.js CDN bootstrap ──────────────────────────────────────────────
  var PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  var pdfjsLib = null;
  var pdfjsPromise = null;

  function ensurePdfJs(){
    if(pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = import(PDFJS_CDN).then(function(mod){
      pdfjsLib = mod;
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return mod;
    }).catch(function(err){
      console.error('[talks-pdf-viewer] Failed to load pdf.js', err);
      pdfjsPromise = null;
      throw err;
    });
    return pdfjsPromise;
  }

  // Memory ceiling for pre-rendered pages; pages furthest from the current one
  // are dropped first. Small screens get a smaller budget.
  function cacheBudget(){
    return (window.innerWidth < 900 ? 96 : 320) * 1024 * 1024;
  }

  // Active viewer state
  var state = null;

  function freshState(){
    return {
      pdfDoc: null,
      currentPage: 1,
      ready: false,          // document downloaded and first page on screen
      cache: new Map(),      // pageNum -> offscreen canvas at the current scale
      cacheBytes: 0,
      scaleKey: '',
      renderTask: null,      // in-flight pdf.js RenderTask
      renderingPage: null,
      inFlight: new Map(),   // pageNum -> Promise<canvas>
      prefetched: new Set(),  // pages the background pass has already done
      prefetching: false,
      generation: 0,         // bumped on rescale/cleanup to discard stale work
      settled: false,        // true once the card's own expand animation has finished
      settleTimer: null,
      firstPageStarted: false,
      clone: null,
      canvas: null,
      ctx: null,
      viewerEl: null,
      btnPrev: null,
      btnNext: null,
      pageInfo: null,
      pageContainer: null,
      overlay: null,
      overlayText: null,
      overlayTimer: null,
      keydownHandler: null,
      resizeHandler: null
    };
  }

  // ── Loading cover ─────────────────────────────────────────────────────
  function showOverlay(message, immediate){
    if(!state || !state.overlay) return;
    state.overlayText.textContent = message;
    if(state.overlayTimer){ clearTimeout(state.overlayTimer); state.overlayTimer = null; }
    if(immediate){
      state.overlay.classList.add('visible');
    } else {
      // Brief renders should not flash a cover; only show it if we are slow.
      state.overlayTimer = setTimeout(function(){
        if(state && state.overlay) state.overlay.classList.add('visible');
      }, 120);
    }
  }

  function hideOverlay(){
    if(!state || !state.overlay) return;
    if(state.overlayTimer){ clearTimeout(state.overlayTimer); state.overlayTimer = null; }
    state.overlay.classList.remove('visible');
  }

  // ── Scale / geometry ──────────────────────────────────────────────────
  function containerSize(){
    var h = state.pageContainer ? state.pageContainer.clientHeight : 0;
    var w = state.pageContainer ? state.pageContainer.clientWidth : 0;
    // The clone animates to 92vh x 92vw; fall back to that while it is small.
    if(!h || h < 150) h = window.innerHeight * 0.92 - 120;
    if(!w || w < 150) w = window.innerWidth * 0.92 - 48;
    return { w: w, h: h };
  }

  function viewportFor(page){
    var box = containerSize();
    var base = page.getViewport({ scale: 1 });
    var scale = Math.min(box.h / base.height, box.w / base.width);
    var dpr = window.devicePixelRatio || 1;
    return page.getViewport({ scale: scale * dpr });
  }

  function currentScaleKey(){
    var box = containerSize();
    var dpr = window.devicePixelRatio || 1;
    return Math.round(box.w) + 'x' + Math.round(box.h) + '@' + dpr;
  }

  // ── Page cache ────────────────────────────────────────────────────────
  function cachePut(num, canvas){
    var bytes = canvas.width * canvas.height * 4;
    state.cache.set(num, canvas);
    state.cacheBytes += bytes;

    while(state.cacheBytes > cacheBudget() && state.cache.size > 3){
      var victim = null, victimDist = -1;
      state.cache.forEach(function(_, page){
        var dist = Math.abs(page - state.currentPage);
        if(dist > victimDist){ victimDist = dist; victim = page; }
      });
      if(victim === null || victim === state.currentPage) break;
      var dropped = state.cache.get(victim);
      state.cacheBytes -= dropped.width * dropped.height * 4;
      state.cache.delete(victim);
    }
  }

  function clearCache(){
    state.cache.clear();
    state.cacheBytes = 0;
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  // Renders a page into its own offscreen canvas. The visible canvas is only
  // ever written by blit(), so it never sits blank while a render is running.
  function renderToCache(num, gen){
    if(state.cache.has(num)) return Promise.resolve(state.cache.get(num));
    if(state.inFlight.has(num)) return state.inFlight.get(num);

    var job = state.pdfDoc.getPage(num).then(function(page){
      if(!state || state.generation !== gen) return null;

      var viewport = viewportFor(page);
      var off = document.createElement('canvas');
      off.width = viewport.width;
      off.height = viewport.height;

      var task = page.render({ canvasContext: off.getContext('2d'), viewport: viewport });
      state.renderTask = task;
      state.renderingPage = num;

      return task.promise.then(function(){
        if(!state || state.generation !== gen) return null;
        cachePut(num, off);
        return off;
      });
    }).catch(function(err){
      // Cancellations and teardown-time rejections are expected, not failures.
      if(!state || state.generation !== gen) return null;
      if(err && err.name === 'RenderingCancelledException') return null;
      console.error('[talks-pdf-viewer] Error rendering page', num, err);
      return null;
    }).then(function(result){
      if(state) state.inFlight.delete(num);
      return result;
    });

    state.inFlight.set(num, job);
    return job;
  }

  // Copies a cached page onto the visible canvas in one shot.
  function blit(canvas){
    var dpr = window.devicePixelRatio || 1;
    if(state.canvas.width !== canvas.width || state.canvas.height !== canvas.height){
      state.canvas.width = canvas.width;
      state.canvas.height = canvas.height;
      state.canvas.style.width = (canvas.width / dpr) + 'px';
      state.canvas.style.height = (canvas.height / dpr) + 'px';
    }
    state.ctx.drawImage(canvas, 0, 0);
  }

  function showPage(num){
    if(!state || !state.pdfDoc) return;
    state.currentPage = num;
    updateUI();

    var cached = state.cache.get(num);
    if(cached){
      hideOverlay();
      blit(cached);
      queuePrefetch();
      return;
    }

    // Not rendered yet: dim what is on screen rather than clearing it.
    showOverlay('Loading…', false);
    var gen = state.generation;
    // Let the wanted page jump ahead of background work.
    if(state.renderTask && state.renderingPage !== num){
      try { state.renderTask.cancel(); } catch(e){}
    }
    renderToCache(num, gen).then(function(canvas){
      if(!state || state.generation !== gen) return;
      if(canvas && state.currentPage === num){
        hideOverlay();
        blit(canvas);
      }
      queuePrefetch();
    });
  }

  function goToPage(num){
    if(!state || !state.ready || !state.pdfDoc) return;
    if(num < 1 || num > state.pdfDoc.numPages) return;
    showPage(num);
  }

  // ── Background pre-render of the rest of the deck ──────────────────────
  function queuePrefetch(){
    if(!state || !state.pdfDoc || state.prefetching) return;
    state.prefetching = true;

    var gen = state.generation;
    var next = null;
    // Nearest-first, biased forward, so flipping ahead is always ready. Pages
    // already done once are skipped even if the budget has since evicted them,
    // so a deck larger than the cache cannot loop re-rendering itself.
    for(var d = 1; d <= state.pdfDoc.numPages && next === null; d++){
      var ahead = state.currentPage + d;
      var behind = state.currentPage - d;
      if(ahead <= state.pdfDoc.numPages && !state.cache.has(ahead) && !state.prefetched.has(ahead)) next = ahead;
      else if(behind >= 1 && !state.cache.has(behind) && !state.prefetched.has(behind)) next = behind;
    }

    if(next === null){ state.prefetching = false; return; }

    var target = next;
    renderToCache(target, gen).then(function(){
      if(!state || state.generation !== gen) return;
      state.prefetched.add(target);
      state.prefetching = false;
      // Yield to the UI between pages so navigation stays responsive.
      requestAnimationFrame(function(){
        if(state && state.generation === gen) queuePrefetch();
      });
    });
  }

  // ── UI Updates ────────────────────────────────────────────────────────
  function updateUI(){
    if(!state || !state.pdfDoc) return;
    if(state.pageInfo) state.pageInfo.textContent = state.currentPage + ' / ' + state.pdfDoc.numPages;
    if(state.btnPrev) state.btnPrev.disabled = !state.ready || state.currentPage <= 1;
    if(state.btnNext) state.btnNext.disabled = !state.ready || state.currentPage >= state.pdfDoc.numPages;
  }

  // ── Open / Close ──────────────────────────────────────────────────────
  function initViewerForCard(clone){
    state = freshState();
    state.clone = clone;
    state.canvas = clone.querySelector('.talks-card-pdf-viewer canvas');
    if(!state.canvas){ state = null; return; }

    state.ctx = state.canvas.getContext('2d');
    state.btnPrev = clone.querySelector('.talks-pdf-prev');
    state.btnNext = clone.querySelector('.talks-pdf-next');
    state.pageInfo = clone.querySelector('.talks-pdf-page-info');
    state.pageContainer = clone.querySelector('.talks-pdf-page-container');

    // Loading cover, built here so the markup stays in one place.
    state.overlay = document.createElement('div');
    state.overlay.className = 'talks-pdf-loading';
    state.overlay.setAttribute('role', 'status');
    state.overlayText = document.createElement('span');
    state.overlayText.className = 'talks-pdf-loading-text';
    state.overlay.appendChild(state.overlayText);
    if(state.pageContainer) state.pageContainer.appendChild(state.overlay);

    if(state.pageInfo) state.pageInfo.textContent = '–';
    if(state.btnPrev) state.btnPrev.disabled = true;
    if(state.btnNext) state.btnNext.disabled = true;

    // The viewer (and its loading cover) stays hidden — opacity is 0 until
    // the ".loaded" class is added — until the card's own zoom-in animation
    // has finished. Revealing it any earlier is what used to cause a "snap":
    // the container is still mid-transition, so a page rendered against its
    // size at that instant is wrong, and swapping in the correctly-sized
    // render once the deck loads made it visibly jump.
    state.viewerEl = clone.querySelector('.talks-card-pdf-viewer');

    var pdfUrl = clone.getAttribute('data-pdf');
    if(!pdfUrl) return;

    // research.js animates the clone's top/left/width/height over 520ms
    // (480ms on its no-FLIP fallback path), starting one rAF after the
    // clone is appended. 620ms comfortably outlasts either.
    state.settleTimer = setTimeout(settleViewer, 620);

    // Bind UI clicks
    if(state.btnPrev){
      state.btnPrev.addEventListener('click', function(e){
        e.stopPropagation();
        goToPage(state.currentPage - 1);
      });
    }
    if(state.btnNext){
      state.btnNext.addEventListener('click', function(e){
        e.stopPropagation();
        goToPage(state.currentPage + 1);
      });
    }

    state.keydownHandler = function(e){
      if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){
        e.preventDefault();
        goToPage(state.currentPage - 1);
      }
      if(e.key === 'ArrowRight' || e.key === 'ArrowDown'){
        e.preventDefault();
        goToPage(state.currentPage + 1);
      }
    };
    document.addEventListener('keydown', state.keydownHandler);

    // Resize: the cached pages are scale-specific, so drop them and rebuild.
    var resizeTimer = null;
    state.resizeHandler = function(){
      if(resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){
        if(!state || !state.pdfDoc) return;
        if(currentScaleKey() === state.scaleKey) return;
        rescale();
      }, 200);
    };
    window.addEventListener('resize', state.resizeHandler);

    // Download the whole deck in the background — it can overlap the zoom
    // animation — but the first page is only ever rendered once settled, so
    // it is always sized against the card's final, resting dimensions.
    ensurePdfJs().then(function(){
      var loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
      loadingTask.onProgress = function(p){
        if(!state || state.ready) return;
        if(p && p.total){
          var pct = Math.min(99, Math.round((p.loaded / p.total) * 100));
          state.overlayText.textContent = 'Loading… ' + pct + '%';
        }
      };
      return loadingTask.promise;
    }).then(function(pdf){
      if(!state) return;
      state.pdfDoc = pdf;
      state.overlayText.textContent = 'Loading…';
      maybeRenderFirstPage();
    }).catch(function(err){
      console.error('[talks-pdf-viewer] Error loading PDF:', err);
      if(state) state.loadError = true;
      if(state && state.overlayText) state.overlayText.textContent = 'Could not load this presentation.';
      if(state && state.settled) showOverlay('Could not load this presentation.', true);
    });
  }

  // Called once the card has finished its own zoom-in animation. Reveals the
  // viewer (which brings the loading cover with it) and, if the deck has
  // already downloaded, renders page 1 immediately; otherwise the cover just
  // sits there showing progress until the download's .then() calls this.
  function settleViewer(){
    if(!state || state.settled) return;
    state.settled = true;
    if(state.viewerEl) state.viewerEl.classList.add('loaded');
    if(state.loadError){
      showOverlay(state.overlayText.textContent, true);
    } else if(!state.ready){
      showOverlay(state.overlayText.textContent || 'Loading…', true);
    }
    maybeRenderFirstPage();
  }

  function maybeRenderFirstPage(){
    if(!state || !state.settled || !state.pdfDoc || state.firstPageStarted) return;
    state.firstPageStarted = true;
    state.scaleKey = currentScaleKey();
    renderToCache(1, state.generation).then(function(canvas){
      if(!state || !state.pdfDoc) return;
      if(canvas) blit(canvas);
      state.ready = true;
      hideOverlay();
      updateUI();
      queuePrefetch();
    });
  }

  // Re-render at a new size, keeping the old frame visible until the new one
  // of the current page is ready.
  function rescale(){
    if(!state || !state.pdfDoc) return;
    if(state.renderTask){ try { state.renderTask.cancel(); } catch(e){} }
    state.generation += 1;
    state.inFlight.clear();
    state.prefetched.clear();
    state.prefetching = false;
    clearCache();
    state.scaleKey = currentScaleKey();

    var gen = state.generation;
    var page = state.currentPage;
    renderToCache(page, gen).then(function(canvas){
      if(!state || state.generation !== gen) return;
      if(canvas && state.currentPage === page) blit(canvas);
      queuePrefetch();
    });
  }

  function cleanupViewer(){
    if(!state) return;
    if(state.renderTask){ try { state.renderTask.cancel(); } catch(e){} }
    if(state.overlayTimer) clearTimeout(state.overlayTimer);
    if(state.settleTimer) clearTimeout(state.settleTimer);
    if(state.keydownHandler) document.removeEventListener('keydown', state.keydownHandler);
    if(state.resizeHandler) window.removeEventListener('resize', state.resizeHandler);
    if(state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    state.generation += 1;
    clearCache();
    if(state.pdfDoc){ try { state.pdfDoc.destroy(); } catch(e){} }
    state = null;
  }

  // ── Listen to Project Card Expand / Collapse Events ────────────────────
  document.addEventListener('DOMContentLoaded', function(){
    if(!document.body.classList.contains('page-talks')) return;

    // Warm the pdf.js module (a few hundred KB) on intent, not on page load.
    var warmed = false;
    function warm(){
      if(warmed) return;
      warmed = true;
      ensurePdfJs().catch(function(){});
    }
    document.querySelectorAll('.project-card[data-pdf]').forEach(function(card){
      card.addEventListener('mouseenter', warm, { once: true });
      card.addEventListener('touchstart', warm, { once: true, passive: true });
    });

    document.addEventListener('project-card:expanded', function(e){
      initViewerForCard(e.detail.clone);
    });

    document.addEventListener('project-card:closed', function(){
      cleanupViewer();
    });
  });

})();
