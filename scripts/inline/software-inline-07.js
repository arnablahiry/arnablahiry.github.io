        (function(){
            var slot = document.getElementById('snitch-slot');
            function loadAndCallback(cb){
                if (window.launchSnitch) { try{ cb(); }catch(e){} return; }
                var s = document.createElement('script');
                s.src = 'scripts/home/home-snitch.js';
                s.onload = function(){ try{ cb(); }catch(e){} };
                document.body.appendChild(s);
            }

            function openSnitchModal(){
                if (!slot) slot = document.getElementById('snitch-slot');
                if (!slot) return;

                // create overlay
                var overlay = document.createElement('div');
                overlay.className = 'snitch-modal';
                overlay.id = 'snitch-modal';

                // close button
                var closeBtn = document.createElement('button');
                closeBtn.className = 'snitch-modal-close';
                closeBtn.setAttribute('aria-label','Close');
                closeBtn.innerHTML = '✕';
                overlay.appendChild(closeBtn);

                // remember original slot position so we can restore it
                var origParent = slot.parentNode;
                var origNext = slot.nextSibling;

                // preserve scroll position to avoid jump
                var savedScrollY = window.scrollY || window.pageYOffset || 0;
                // use fixed-body approach to lock viewport in place
                document.body.style.position = 'fixed';
                document.body.style.top = '-' + savedScrollY + 'px';
                document.body.style.left = '0';
                document.body.style.right = '0';

                // append overlay and show it (visual only) without moving focus
                document.body.appendChild(overlay);
                requestAnimationFrame(function(){ overlay.classList.add('show'); });

                // move slot into overlay but keep it visually stable because body is fixed
                overlay.appendChild(slot);

                // start snitch immediately (or load script then start)
                loadAndCallback(function(){ try{ window.launchSnitch(); }catch(e){} });

                function close(){
                    try{ if (window.teardownSnitch) window.teardownSnitch(); }catch(e){}
                    // visually shrink/fade the slot then move it back for a smooth return
                    try{ slot.classList.add('snitch-closing'); }catch(e){}
                    // hide modal (fade out)
                    overlay.classList.remove('show');
                    // after transition, restore slot and cleanup
                    setTimeout(function(){
                        try{ if (origParent) origParent.insertBefore(slot, origNext); }catch(e){}
                        try{ slot.classList.remove('snitch-closing'); }catch(e){}
                        try{ overlay.remove(); }catch(e){}
                        // undo fixed-body scroll lock and restore scroll position
                        try{ document.body.style.position = ''; document.body.style.top = ''; document.body.style.left = ''; document.body.style.right = ''; window.scrollTo(0, savedScrollY); }catch(e){}
                    }, 260);
                }

                closeBtn.addEventListener('click', function(e){ e.stopPropagation(); close(); });
            }

            var btn = document.querySelector('#proj-snitch .snitch-launch');
            if (btn) btn.addEventListener('click', function(e){ e.stopPropagation(); openSnitchModal(); });
        })();
