  (function(){
    // Smooth scroll + scrollspy for CV contents
    var links = Array.prototype.slice.call(document.querySelectorAll('.cv-contents a'));
    var sections = links.map(function(l){ return document.getElementById(l.dataset.target); });
    if (!links.length || !sections.length) return;

    // click -> smooth scroll
    links.forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var id = a.dataset.target;
        var el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // update active state immediately
        links.forEach(function(x){ x.classList.toggle('active', x === a); });
      });
    });

    // Scrollspy: highlight the section currently near top of viewport
    var ticking = false;
    function onScroll(){
      if (ticking) return; ticking = true;
      requestAnimationFrame(function(){
        var topOffset = 140; // account for header
        var current = null;
        sections.forEach(function(s){
          if (!s) return;
          var r = s.getBoundingClientRect();
          if (r.top - topOffset <= 20) { current = s; }
        });
        if (!current) current = sections[0];
        links.forEach(function(a){
          var id = a.dataset.target;
          a.classList.toggle('active', current && current.id === id);
        });
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // initialize
    setTimeout(onScroll, 200);
  })();
