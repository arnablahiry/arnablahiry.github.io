        // Wire the research page theme hint to the main theme toggle.
        (function(){
            var hint = document.getElementById('theme-hint');
            var toggle = document.getElementById('theme-toggle');
            if(!hint || !toggle) return;
            // Ensure the hint is hidden from assistive tech when light-mode is active
            function syncVisibility(){
                if(document.body.classList && document.body.classList.contains('light-mode')){
                    hint.setAttribute('aria-hidden','true');
                } else {
                    hint.setAttribute('aria-hidden','false');
                }
            }
            syncVisibility();
            // Keep visibility in sync when theme changes
            document.addEventListener('theme:lock-changed', syncVisibility);
            document.addEventListener('DOMContentLoaded', syncVisibility);

            hint.addEventListener('click', function(e){
                e.stopPropagation();
                // Delegate to the existing theme-toggle button so behavior and
                // persistence remain consistent across the site.
                try{ toggle.click(); }catch(_){ }
            });
            hint.addEventListener('keydown', function(e){
                if(e.key === 'Enter' || e.key === ' '){
                    e.preventDefault();
                    hint.click();
                }
            });

            // After the page has fully loaded (images/fonts/etc), add a body
            // class that triggers the CSS animation so the hint fades/slides in
            // from the top. This uses `window.load` to ensure all resources
            // have rendered before the subtle entrance occurs.
            window.addEventListener('load', function(){
                try{
                    // desktop-only
                    if(window.matchMedia && !window.matchMedia('(min-width: 769px)').matches) return;
                    // only in dark mode
                    if(document.body.classList.contains('light-mode')) return;
                    // small timeout to ensure layout/paints are complete
                    setTimeout(function(){ 
                        // Add the flag that triggers the CSS animations. The CSS
                        // itself handles the delayed fade-out after ~5s using
                        // animation delay (no JS timers required to hide it).
                        document.body.classList.add('show-theme-hint');
                    }, 260);
                }catch(_){/* ignore */}
            });
            // When the CSS 'theme-hint-out' animation finishes, make the
            // hint non-interactive so it cannot be clicked or focused again.
            hint.addEventListener('animationend', function(e){
                try{
                    if(e && e.animationName === 'theme-hint-out'){
                        // mark visually hidden and inert
                        hint.classList.add('theme-hint-hidden');
                        hint.style.pointerEvents = 'none';
                        hint.setAttribute('aria-hidden','true');
                        // remove from tab order
                        try{ hint.tabIndex = -1; }catch(_){ }
                    }
                }catch(_){ }
            });
        })();
