    // Ensure mini-banner anchors don't remain visually focused when the user
    // returns from an external tab. This blurs any focused mini-banner link
    // on click and when the page regains focus/visibility.
    (function(){
      try{
        const miniAnchors = Array.from(document.querySelectorAll('.about-mini-banner a.about-thumb'));
        if(!miniAnchors.length) return;

        miniAnchors.forEach(a => {
          a.addEventListener('click', function(){
            // blur immediately to avoid leaving :focus styles on return
            try{ this.blur(); }catch(e){}
            // ensure activeElement isn't still the anchor shortly after
            setTimeout(()=>{ try{ if(document.activeElement === this) this.blur(); }catch(e){} }, 60);
          }, {passive:true});
        });

        function _blurIfMiniFocused(){
          try{
            const ae = document.activeElement;
            if(!ae) return;
            if(ae.matches && ae.matches('.about-mini-banner a.about-thumb')){
              ae.blur();
            }
          }catch(e){/* ignore */}
        }

        window.addEventListener('focus', _blurIfMiniFocused);
        document.addEventListener('visibilitychange', function(){ if(!document.hidden) _blurIfMiniFocused(); });
      }catch(e){ console.warn('mini-banner blur wiring failed', e); }
    })();
