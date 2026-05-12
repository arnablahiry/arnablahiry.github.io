  // Ensure all anchors open in a new tab and use safe rel attributes.
  (function(){
    function setAllAnchorTargets(){
      try{
        var anchors = document.querySelectorAll('a');
        anchors.forEach(function(a){
          // Skip anchors inside the main header navigation so header links
          // continue to navigate in the same tab.
          if(a.closest && a.closest('nav#site-nav')) return;
          // Skip internal anchors (hash links) so in-page navigation still works
          var href = a.getAttribute('href') || '';
          if(href.indexOf('#') === 0) return;

          // force target to _blank so external links open in a new tab
          a.setAttribute('target','_blank');
          // force safe rel attributes
          a.setAttribute('rel','noopener noreferrer');
        });
      }catch(e){ /* noop */ }
    }
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', setAllAnchorTargets);
    } else {
      setAllAnchorTargets();
    }
  })();
