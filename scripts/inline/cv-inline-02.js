  (function(){
    // Smooth scroll + scrollspy for CV contents
    var links = Array.prototype.slice.call(document.querySelectorAll('.cv-contents a'));
    var sections = links.map(function(l){ return document.getElementById(l.dataset.target); });
    if (!links.length || !sections.length) return;

    // click -> smooth scroll
    links.forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var el = document.getElementById(a.dataset.target);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        links.forEach(function(x){ x.classList.toggle('active', x === a); });
      });
    });

    function setActive(id){
      links.forEach(function(a){
        a.classList.toggle('active', a.dataset.target === id);
      });
    }

    // Initialize to first section
    if (sections[0]) setActive(sections[0].id);

    // Use IntersectionObserver: the topmost intersecting section wins.
    // rootMargin shrinks the root box so only the upper viewport band triggers.
    if ('IntersectionObserver' in window){
      var visible = new Set();
      var observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        // Pick the topmost section that is currently visible
        var best = null;
        sections.forEach(function(s){
          if (s && visible.has(s)){
            if (!best || s.getBoundingClientRect().top < best.getBoundingClientRect().top) best = s;
          }
        });
        if (best) setActive(best.id);
      }, { rootMargin: '-80px 0px -40% 0px', threshold: 0 });
      sections.forEach(function(s){ if (s) observer.observe(s); });
    } else {
      // Fallback: scroll event on both window and document
      var ticking = false;
      function onScroll(){
        if (ticking) return; ticking = true;
        requestAnimationFrame(function(){
          var topOffset = 140;
          var current = null;
          sections.forEach(function(s){
            if (!s) return;
            if (s.getBoundingClientRect().top - topOffset <= 20) current = s;
          });
          if (!current) current = sections[0];
          if (current) setActive(current.id);
          ticking = false;
        });
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      setTimeout(onScroll, 200);
    }
  })();
