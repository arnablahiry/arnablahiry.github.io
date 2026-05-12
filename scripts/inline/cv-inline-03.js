  // When returning to this page (back/forward or visibility change), some
  // browsers restore focus on the previously-activated link which leaves the
  // banner visually zoomed (we rely on :focus to trigger zoom). Blur any
  // banner-related focused element on pageshow/visibilitychange so the image
  // returns to its normal state unless the user actively focuses it again.
  (function(){
    function blurBannerFocus(){
      try{
        var a = document.activeElement;
        if(!a) return;
        if(a.classList && (a.classList.contains('banner-link') || a.classList.contains('split-link'))){
          a.blur();
        }
      }catch(e){ /* noop */ }
    }
    window.addEventListener('pageshow', function(){ setTimeout(blurBannerFocus, 10); }, false);
    document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible'){ setTimeout(blurBannerFocus, 10); } });
  })();
