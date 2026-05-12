        // Wire the page theme hint to the main theme toggle (same logic as research page)
        (function(){
            var hint = document.getElementById('theme-hint');
            var toggle = document.getElementById('theme-toggle');
            if(!hint || !toggle) return;
            function syncVisibility(){
                if(document.body.classList && document.body.classList.contains('light-mode')){
                    hint.setAttribute('aria-hidden','true');
                } else {
                    hint.setAttribute('aria-hidden','false');
                }
            }
            syncVisibility();
            document.addEventListener('theme:lock-changed', syncVisibility);
            document.addEventListener('DOMContentLoaded', syncVisibility);
            hint.addEventListener('click', function(e){ e.stopPropagation(); try{ toggle.click(); }catch(_){ } });
            hint.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); hint.click(); } });
            window.addEventListener('load', function(){ try{ if(window.matchMedia && !window.matchMedia('(min-width: 769px)').matches) return; if(document.body.classList.contains('light-mode')) return; setTimeout(function(){ document.body.classList.add('show-theme-hint'); }, 260); }catch(_){}});
        })();
