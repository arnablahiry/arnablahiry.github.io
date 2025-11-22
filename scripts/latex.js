window.MathJax = {
    tex: {
        inlineMath: [['$','$'], ['\\(','\\)']],
        displayMath: [['$$','$$'], ['\\[','\\]']]
    },
    options: {
        skipHtmlTags: ['script','noscript','style','textarea','pre']
    },
    startup: {
        /* Run after MathJax initializes. We'll call the defaultReady
            to finish setup, then recolor any SVG math to match the
            current site theme. We also observe changes so newly
            rendered math and theme toggles are handled. */
        ready: function () {
            MathJax.startup.defaultReady();

            function recolorMath() {
                try {
                    var isLight = document.documentElement.classList.contains('light-mode') || document.body.classList.contains('light-mode');
                    var svgSelectors = document.querySelectorAll('.MathJax_SVG svg, .mjx-svg svg');
                    svgSelectors.forEach(function(svg){
                        // For each element inside the SVG, prefer setting attributes
                        // so inline presentation attributes are overridden explicitly.
                        svg.querySelectorAll('*').forEach(function(el){
                            try{
                                if(el.hasAttribute('fill')) el.setAttribute('fill', isLight ? '#000' : '#fff');
                                if(el.hasAttribute('stroke')) el.setAttribute('stroke', isLight ? '#000' : '#fff');
                                // also clear inline style fragments that can set color
                                if(el.style){
                                    if(el.style.fill) el.style.fill = isLight ? '#000' : '#fff';
                                    if(el.style.stroke) el.style.stroke = isLight ? '#000' : '#fff';
                                }
                            }catch(e){}
                        });
                        // ensure the outer svg inherits color too
                        try{ svg.style.color = isLight ? '#000' : '#fff'; }catch(e){}
                    });
                } catch(e) { console.warn('recolorMath error', e); }
            }

            // Initial recolor pass after startup
            recolorMath();

            // Watch for theme toggles (class changes on <html> or <body>)
            var themeObserver = new MutationObserver(function(){ recolorMath(); });
            themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
            themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

            // Watch for newly inserted math and recolor as it appears
            var domObserver = new MutationObserver(function(m){
                // lightweight: recolor on any subtree changes (MathJax will add nodes)
                recolorMath();
            });
            domObserver.observe(document.body, { childList: true, subtree: true });
        }
    }
};
