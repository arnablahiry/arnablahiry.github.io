// talks-pdf-viewer.js — Full-screen PDF viewer inside expanded cards
// Uses pdf.js (loaded from CDN) to render one page at a time on a <canvas>.
// Arrow buttons inside the card navigate between pages.
(function(){
  'use strict';

  // ── pdf.js CDN bootstrap ──────────────────────────────────────────────
  var PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  var pdfjsLib = null;

  function ensurePdfJs(cb){
    if(pdfjsLib){ cb(); return; }
    import(PDFJS_CDN).then(function(mod){
      pdfjsLib = mod;
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      cb();
    }).catch(function(err){
      console.error('[talks-pdf-viewer] Failed to load pdf.js', err);
    });
  }

  // Active viewer state
  var state = {
    pdfDoc: null,
    currentPage: 1,
    rendering: false,
    pendingPage: null,
    clone: null,
    canvas: null,
    ctx: null,
    btnPrev: null,
    btnNext: null,
    pageInfo: null,
    pageContainer: null,
    keydownHandler: null,
    resizeHandler: null,
    transitionComplete: false
  };

  // ── Render a single page ──────────────────────────────────────────────
  function renderPage(num){
    if (!state.pdfDoc || !state.canvas) return;
    state.rendering = true;
    state.pdfDoc.getPage(num).then(function(page){
      if (!state.canvas) return; // check if cleaned up in the meantime
      
      // Compute scale so the page fills the available viewport inside the expanded card
      // In research.js, .project-clone has height: 92vh, width: 92vw.
      var containerH = state.pageContainer.clientHeight;
      var containerW = state.pageContainer.clientWidth;
      
      // Fallback to target fullscreen dimensions if container is currently animating (too small)
      if (!containerH || containerH < 150) {
        containerH = window.innerHeight * 0.92 - 120;
      }
      if (!containerW || containerW < 150) {
        containerW = window.innerWidth * 0.92 - 48;
      }
      
      var viewport = page.getViewport({ scale: 1 });
      var scaleH = containerH / viewport.height;
      var scaleW = containerW / viewport.width;
      var scale = Math.min(scaleH, scaleW);
      
      // Use device pixel ratio for crisp rendering
      var dpr = window.devicePixelRatio || 1;
      var scaledViewport = page.getViewport({ scale: scale * dpr });

      state.canvas.height = scaledViewport.height;
      state.canvas.width  = scaledViewport.width;
      state.canvas.style.width  = (scaledViewport.width / dpr) + 'px';
      state.canvas.style.height = (scaledViewport.height / dpr) + 'px';

      var renderContext = { canvasContext: state.ctx, viewport: scaledViewport };
      page.render(renderContext).promise.then(function(){
        state.rendering = false;
        
        if (state.transitionComplete && state.clone) {
          var viewer = state.clone.querySelector('.talks-card-pdf-viewer');
          if (viewer) viewer.classList.add('loaded');
        }

        if(state.pendingPage !== null){
          var p = state.pendingPage;
          state.pendingPage = null;
          renderPage(p);
        }
      });
    });
    updateUI();
  }

  function goToPage(num){
    state.currentPage = num;
    if(state.rendering){ state.pendingPage = num; updateUI(); return; }
    renderPage(num);
  }

  // ── UI Updates ────────────────────────────────────────────────────────
  function updateUI(){
    if(!state.pdfDoc) return;
    if(state.pageInfo) state.pageInfo.textContent = state.currentPage + ' / ' + state.pdfDoc.numPages;
    if(state.btnPrev) state.btnPrev.disabled = state.currentPage <= 1;
    if(state.btnNext) state.btnNext.disabled = state.currentPage >= state.pdfDoc.numPages;
  }

  // ── Open / Close ──────────────────────────────────────────────────────
  function initViewerForCard(clone){
    // Reset state
    state.clone = clone;
    state.canvas = clone.querySelector('.talks-card-pdf-viewer canvas');
    if (!state.canvas) return;
    
    state.ctx = state.canvas.getContext('2d');
    state.btnPrev = clone.querySelector('.talks-pdf-prev');
    state.btnNext = clone.querySelector('.talks-pdf-next');
    state.pageInfo = clone.querySelector('.talks-pdf-page-info');
    state.pageContainer = clone.querySelector('.talks-pdf-page-container');
    state.currentPage = 1;
    state.pdfDoc = null;
    state.rendering = false;
    state.pendingPage = null;
    state.transitionComplete = false;

    if (state.pageInfo) state.pageInfo.textContent = 'Loading…';
    if (state.btnPrev) state.btnPrev.disabled = true;
    if (state.btnNext) state.btnNext.disabled = true;

    var pdfUrl = clone.getAttribute('data-pdf');
    if(!pdfUrl) return;

    // Bind UI clicks
    if(state.btnPrev){
      state.btnPrev.addEventListener('click', function(e){
        e.stopPropagation();
        if(state.currentPage > 1) goToPage(state.currentPage - 1);
      });
    }
    if(state.btnNext){
      state.btnNext.addEventListener('click', function(e){
        e.stopPropagation();
        if(state.pdfDoc && state.currentPage < state.pdfDoc.numPages) goToPage(state.currentPage + 1);
      });
    }

    // Keyboard handlers
    state.keydownHandler = function(e){
      if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){
        e.preventDefault();
        if(state.currentPage > 1) goToPage(state.currentPage - 1);
      }
      if(e.key === 'ArrowRight' || e.key === 'ArrowDown'){
        e.preventDefault();
        if(state.pdfDoc && state.currentPage < state.pdfDoc.numPages) goToPage(state.currentPage + 1);
      }
    };
    document.addEventListener('keydown', state.keydownHandler);

    // Resize handler (re-render current page with updated viewport size)
    var resizeTimer = null;
    state.resizeHandler = function(){
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){
        if(state.pdfDoc) renderPage(state.currentPage);
      }, 150);
    };
    window.addEventListener('resize', state.resizeHandler);

    // Load PDF
    ensurePdfJs(function(){
      var loadingTask = pdfjsLib.getDocument(pdfUrl);
      loadingTask.promise.then(function(pdf){
        state.pdfDoc = pdf;
        renderPage(1);
        
        // Re-render after transition finishes to guarantee perfect sizing and crispness
        setTimeout(function(){
          state.transitionComplete = true;
          if (state.clone && state.pdfDoc) {
            renderPage(state.currentPage);
            var viewer = state.clone.querySelector('.talks-card-pdf-viewer');
            if (viewer) viewer.classList.add('loaded');
          }
        }, 550);
      }).catch(function(err){
        console.error('[talks-pdf-viewer] Error loading PDF:', err);
        if(state.pageInfo) state.pageInfo.textContent = 'Error loading PDF';
      });
    });
  }

  // ── Render Card Thumbnail Previews from PDF Page 1 ────────────────────
  function renderCardThumbnails(){
    if(!document.body.classList.contains('page-talks')) return;
    
    ensurePdfJs(function(){
      document.querySelectorAll('.project-card').forEach(function(card){
        var pdfUrl = card.getAttribute('data-pdf');
        if(!pdfUrl) return;
        
        var canvas = card.querySelector('canvas.project-image');
        if(!canvas) return;
        
        var ctx = canvas.getContext('2d');
        
        pdfjsLib.getDocument(pdfUrl).promise.then(function(pdf){
          pdf.getPage(1).then(function(page){
            var viewport = page.getViewport({ scale: 1 });
            var targetWidth = 800; // Sharp rendering
            var scale = targetWidth / viewport.width;
            var scaledViewport = page.getViewport({ scale: scale });
            
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            
            // Set dynamic aspect-ratio so layout matches PDF layout precisely
            canvas.style.aspectRatio = scaledViewport.width + ' / ' + scaledViewport.height;
            
            var renderContext = {
              canvasContext: ctx,
              viewport: scaledViewport
            };
            page.render(renderContext);
          });
        }).catch(function(err){
          console.error('[talks-pdf-viewer] Error rendering thumbnail for', pdfUrl, err);
        });
      });
    });
  }

  function cleanupViewer(){
    if(state.keydownHandler){
      document.removeEventListener('keydown', state.keydownHandler);
    }
    if(state.resizeHandler){
      window.removeEventListener('resize', state.resizeHandler);
    }
    state.pdfDoc = null;
    state.clone = null;
    state.canvas = null;
    state.ctx = null;
    state.btnPrev = null;
    state.btnNext = null;
    state.pageInfo = null;
    state.pageContainer = null;
    state.keydownHandler = null;
    state.resizeHandler = null;
    state.transitionComplete = false;
  }

  // ── Listen to Project Card Expand / Collapse Events ────────────────────
  document.addEventListener('DOMContentLoaded', function(){
    renderCardThumbnails();

    document.addEventListener('project-card:expanded', function(e){
      if(document.body.classList.contains('page-talks')){
        initViewerForCard(e.detail.clone);
      }
    });

    document.addEventListener('project-card:closed', function(e){
      if(document.body.classList.contains('page-talks')){
        cleanupViewer();
      }
    });
  });

})();
