/* Inline snitch launcher (migrated from index.html)
   Mounts the snitch into #snitch-slot only on index, when auto-skip is OFF
   and the intro/photo section has become visible. Behavior is scoped and
   intentionally lightweight. */
(function(){
    const slot = document.getElementById('snitch-slot');
    const photoContainer = document.getElementById('photo-container');
    const header = document.querySelector('header');
    if (!slot || !photoContainer || !header) return;

    // keep the slot hidden by default until all visibility conditions are met
    // (photo visible + pause button grayed). This prevents any early flashes.
    try { slot.style.opacity = '0'; slot.style.display = 'none'; slot.setAttribute('aria-hidden','true'); } catch(e){}

    function isAutoSkipOff(){
        try { return localStorage.getItem('auto:skip') === 'off'; } catch(e){ return false; }
    }

    function placeSlotUnderHeader(){
        const h = header.getBoundingClientRect();
        // place slot directly under header; slot height uses remaining viewport height
        slot.style.top = Math.round(h.bottom + 8) + 'px';
        slot.style.left = '0';
        slot.style.height = (window.innerHeight - h.bottom - 12) + 'px';
    }
    placeSlotUnderHeader();
    window.addEventListener('resize', placeSlotUnderHeader);

    // Only initialize snitch when auto-skip is OFF and the intro/site-links
    // have become visible. We wait for the intro to finish (photoContainer
    // acquiring the `visible` class) to avoid showing the snitch during the
    // initial crawl/intro animation.
    function tryInit(){
        if (!isAutoSkipOff()) return; // remain inactive when auto-skip is ON

        // Helper: detect whether the pause button has been grayed out (disabled)
        function isPauseGrayed(){
            const pause = document.getElementById('pause-scroll');
            if (!pause) return false;
            if (pause.classList && pause.classList.contains('disabled')) return true;
            if (pause.hasAttribute && pause.hasAttribute('disabled')) return true;
            try {
                const s = window.getComputedStyle(pause);
                const op = parseFloat(s && s.opacity) || 1;
                if (op <= 0.55) return true; // treat low opacity as 'grayed'
            } catch(e){}
            return false;
        }

        // If the intro has already been marked visible AND the pause button is grayed,
        // initialize immediately.
        if (photoContainer.classList && photoContainer.classList.contains('visible') && isPauseGrayed()){
            initSnitch();
            return;
        }

        // Watch for the intro gaining the `visible` class. Use a MutationObserver
        // because the class is toggled by other scripts when the intro finishes.
        const mo = new MutationObserver((mutations)=>{
            if (photoContainer.classList && photoContainer.classList.contains('visible') && isPauseGrayed()){
                mo.disconnect();
                if (pauseObserver) pauseObserver.disconnect();
                initSnitch();
            }
        });
        mo.observe(photoContainer, { attributes: true, attributeFilter: ['class'] });

        // As a safety fallback, also observe intersection (in case the page
        // doesn't toggle the class but the element scrolls into view).
        const io = new IntersectionObserver((entries)=>{
            entries.forEach(en=>{
                if (en.isIntersecting && isPauseGrayed()) {
                    io.disconnect();
                    mo.disconnect();
                    if (pauseObserver) pauseObserver.disconnect();
                    initSnitch();
                }
            });
        }, { threshold: 0.35 });
        io.observe(photoContainer);

        // Observe the pause button for class/attribute changes so we can initialize
        // as soon as it becomes grayed out. If it already matches the condition,
        // init will occur via the photo observers above.
        const pause = document.getElementById('pause-scroll');
        let pauseObserver = null;
        if (pause){
            pauseObserver = new MutationObserver((muts)=>{
                if (isPauseGrayed() && (photoContainer.classList && photoContainer.classList.contains('visible'))){
                    if (io) io.disconnect();
                    if (mo) mo.disconnect();
                    pauseObserver.disconnect();
                    initSnitch();
                }
            });
            pauseObserver.observe(pause, { attributes: true, attributeFilter: ['class','disabled','style'] });
        }
    }

    // If storage changes (rare) we can also attempt init on storage events
    window.addEventListener('storage', (e)=>{ if (e.key==='auto:skip') tryInit(); });

    // run on DOMContentLoaded too
    document.addEventListener('DOMContentLoaded', tryInit);

    // --- create snitch behavior (lightweight copy of test harness, scoped) ---
    function initSnitch(){
        if (slot.querySelector('#snitch-runner')) return; // already created
        // reveal the slot for accessibility, but animate in via CSS so it
        // appears smoothly (fade, deblur, scale). Remove direct opacity
        // writes so CSS animation controls the appearance.
        slot.style.display = 'block';
        slot.setAttribute('aria-hidden','false');
        placeSlotUnderHeader();
        // ensure class is toggled on the next animation frame so the
        // keyframe animation runs reliably.
        slot.classList.remove('snitch-appear');
        requestAnimationFrame(()=> requestAnimationFrame(()=> slot.classList.add('snitch-appear')));

        const img = document.createElement('img');
        img.id = 'snitch-runner';
        img.src = 'images/hp/snitch.png';
        img.alt = '';
        img.style.left = '8px';
        img.style.top = '8px';
        slot.appendChild(img);

        // bounds relative to slot
        function getBounds(){
            const r = slot.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height };
        }

        let bounds = getBounds();
    const EDGE_PADDING = 64; // large padding so the snitch does not reach page edges
    // start well inside the padded area
    let x = EDGE_PADDING + 12, y = EDGE_PADDING + 12;
        let prevX = x, prevY = y;
        let animating = false, smoothRaf = null;
    let slowMode = false, mouseEnabled = true;
    // handler and timeout references so we can cancel/cleanup slow-mode early
    let onClickHandler = null;
    let slowTimeout = null;
        const speed = 0.9, fleeDistance = 100, dartDistance = 120;

        function clampToBounds(nx, ny){
            const b = getBounds();
            const maxX = Math.max(0, b.width - img.width);
            const maxY = Math.max(0, b.height - img.height);
            const minX = EDGE_PADDING;
            const minY = EDGE_PADDING;
            const maxClampX = Math.max(minX, maxX - EDGE_PADDING);
            const maxClampY = Math.max(minY, maxY - EDGE_PADDING);
            return [ Math.max(minX, Math.min(maxClampX, nx)), Math.max(minY, Math.min(maxClampY, ny)) ];
        }

        function updateImgPos(){
            img.style.left = Math.round(x) + 'px';
            img.style.top = Math.round(y) + 'px';
        }

        function smoothMoveTo(tx, ty, duration = 220){
            if (smoothRaf) cancelAnimationFrame(smoothRaf);
            animating = true;
            const start = performance.now();
            const sx = x, sy = y;
            function step(now){
                const t = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - t, 3);
                prevX = x; prevY = y;
                x = sx + (tx - sx) * eased;
                y = sy + (ty - sy) * eased;
                updateImgPos();
                if (t < 1) smoothRaf = requestAnimationFrame(step);
                else { animating = false; smoothRaf = null; }
            }
            smoothRaf = requestAnimationFrame(step);
        }

        // drift
        function randomDrift(){
            if (!animating){
                prevX = x; prevY = y;
                x += (Math.random() - 0.5) * speed;
                y += (Math.random() - 0.5) * speed;
                [x, y] = clampToBounds(x, y);
                updateImgPos();
                checkCornerAndFlee();
            }
            requestAnimationFrame(randomDrift);
        }
        randomDrift();

        function scheduleRandomDart(){
            const delay = slowMode ? (20000 + (Math.random() * 10000 - 5000)) : (500 + Math.random() * 1200);
            setTimeout(()=>{
                const angle = Math.random() * Math.PI * 2;
                const effective = slowMode ? (dartDistance * 0.25) : dartDistance;
                const dx = Math.cos(angle) * effective;
                const dy = Math.sin(angle) * effective;
                const [tx, ty] = clampToBounds(x + dx, y + dy);
                const dur = slowMode ? 800 : 220;
                smoothMoveTo(tx, ty, dur);
                setTimeout(checkCornerAndFlee, dur + 40);
                scheduleRandomDart();
            }, delay);
        }
        scheduleRandomDart();

        // proximity flee: listen globally so other UI (audio buttons, overlays)
        // can sit above the slot and still receive clicks. Compute mouse
        // position relative to the slot rect on every move.
        document.addEventListener('mousemove', (ev) => {
            if (!mouseEnabled) return;
            const rect = slot.getBoundingClientRect();
            const mx = ev.clientX - rect.left;
            const my = ev.clientY - rect.top;
            // if mouse is outside slot bounds, still compute distance (we allow
            // the snitch to flee even when cursor is outside the slot area)
            const dx = x - mx; const dy = y - my; const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < fleeDistance){
                const ux = dx / (dist || 1), uy = dy / (dist || 1);
                const [tx, ty] = clampToBounds(x + ux * dartDistance, y + uy * dartDistance);
                const dur = slowMode ? 500 : 260;
                smoothMoveTo(tx, ty, dur);
                setTimeout(checkCornerAndFlee, dur + 40);
            }
        });

        // movement-tracking to enable slow mode after 20s continuous mouse movement
        let movementTracking=false, movementStart=0, lastMove=0, movementChecker=null, slowTriggered=false;
        // create progress UI
        const progressWrap = document.createElement('div');
        progressWrap.className = 'snitch-progress';
        const progressBar = document.createElement('div');
        progressBar.className = 'snitch-progress-bar';
        progressWrap.appendChild(progressBar);
        slot.appendChild(progressWrap);

        document.addEventListener('mousemove', (e)=>{
            const now = Date.now(); lastMove = now;
            if (slowTriggered) return;
            if (!movementTracking){
                movementTracking=true; movementStart=now;
                // show progress bar
                progressWrap.classList.add('show');
                movementChecker = setInterval(()=>{
                    const now2 = Date.now();
                    // if pause >1s, reset
                    if (now2 - lastMove > 1000){
                        movementTracking=false; movementStart=0;
                        progressBar.style.width = '0%';
                        progressWrap.classList.remove('show');
                        clearInterval(movementChecker); movementChecker=null; return;
                    }
                    // compute fraction toward 20s
                    const fraction = Math.max(0, Math.min(1, (now2 - movementStart) / 20000));
                    progressBar.style.width = Math.round(fraction * 100) + '%';
                    if (fraction >= 1){
                        slowTriggered=true; movementTracking=false;
                        clearInterval(movementChecker); movementChecker=null;
                        progressBar.style.width = '100%';
                        startSlowMode(30000);
                        // hide progress after a short delay
                        setTimeout(()=> progressWrap.classList.remove('show'), 500);
                    }
                }, 120);
            }
        });

        function startSlowMode(durationMs){
            // Enter slow (clickable) mode: keep proximity fleeing enabled, but
            // make the image clickable so users can interact. Do not disable
            // mouseEnabled here so the snitch still responds to proximity.
            slowMode = true;
            img.style.pointerEvents = 'auto';
            img.style.cursor = 'pointer';
            // bring the image above other UI so it can be clicked
            img.style.zIndex = 1000025;
            // use a shared handler so we can remove it early if "play again" is clicked
            onClickHandler = () => { img.style.transform = 'scale(1.08)'; setTimeout(()=>img.style.transform='', 160); showWinBox(); };
            img.addEventListener('click', onClickHandler);

            // track timeout so we can cancel it if needed
            slowTimeout = setTimeout(()=>{
                slowMode = false;
                img.style.pointerEvents = 'none';
                img.style.cursor = '';
                img.style.zIndex = '';
                if (onClickHandler) img.removeEventListener('click', onClickHandler);
                onClickHandler = null;
                slowTimeout = null;
            }, durationMs);
        }

        // Disable slow mode immediately (used by the "Play again" button)
        function disableSlowModeNow(){
            if (!slowMode) return;
            slowMode = false;
            img.style.pointerEvents = 'none';
            img.style.cursor = '';
            img.style.zIndex = '';
            if (onClickHandler) img.removeEventListener('click', onClickHandler);
            onClickHandler = null;
            if (slowTimeout){ clearTimeout(slowTimeout); slowTimeout = null; }
        }

        // Show an animated win box near the snitch
        function showWinBox(){
            // remove any existing box
            const prev = slot.querySelector('.snitch-win');
            if (prev) prev.remove();

            const box = document.createElement('div');
            box.className = 'snitch-win';

            const line = document.createElement('div');
            line.className = 'hint-line';
            // requested content with a line break; wrap points for styling
            line.innerHTML = 'Congratulations! <br> You won <span class="snitch-points">150 points!!</span>';
            box.appendChild(line);

            // Play again button
            const btn = document.createElement('button');
            btn.className = 'snitch-play-again';
            btn.textContent = 'Play again';
            box.appendChild(btn);

            // append to body so it sits above other UI and receives pointer events
            document.body.appendChild(box);

            // position under the snitch image using viewport coordinates
            const rect = slot.getBoundingClientRect();
            const bx = Math.round(rect.left + x);
            const by = Math.round(rect.top + y + img.height + 8);
            // clamp to viewport
            const vpw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            const vph = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
            const left = Math.max(8, Math.min(vpw - box.offsetWidth - 8, bx));
            const top = Math.max(8, Math.min(vph - box.offsetHeight - 8, by));
            box.style.position = 'fixed';
            box.style.left = left + 'px';
            box.style.top = top + 'px';

            // animate in
            requestAnimationFrame(()=> box.classList.add('show'));

            // Play again behaviour: disable slow mode immediately
            const onPlay = () => {
                // instantly cancel slow-mode and reset the movement/progress
                // tracking so the user can trigger slow-mode again.
                disableSlowModeNow();
                // reset movement/progress state so the loading bar can re-appear
                slowTriggered = false;
                movementTracking = false;
                movementStart = 0;
                lastMove = 0;
                if (movementChecker){ clearInterval(movementChecker); movementChecker = null; }
                try { progressBar.style.width = '0%'; } catch(e){}
                try { progressWrap.classList.remove('show'); } catch(e){}
                // remove the win box after the hide animation
                box.classList.remove('show');
                setTimeout(()=> box.remove(), 160);
            };
            btn.addEventListener('click', onPlay);
            // Do NOT auto-hide the box — it should remain until Play again is pressed.
        }

        // corner bounce: reflect incoming vector (mirror direction) and instantly jump
        function checkCornerAndFlee(){
            const rect = slot.getBoundingClientRect();
            const maxX = Math.max(0, rect.width - img.width);
            const maxY = Math.max(0, rect.height - img.height);
            const margin = EDGE_PADDING;
            const atLeft = x <= margin;
            const atRight = x >= (maxX - margin);
            const atTop = y <= margin;
            const atBottom = y >= (maxY - margin);
            if (!(atLeft || atRight || atTop || atBottom)) return;

            // incoming vector
            let inDx = x - prevX, inDy = y - prevY;
            let inDist = Math.sqrt(inDx*inDx + inDy*inDy);
            if (inDist < 1){ const cx = atLeft?0:(atRight?maxX:x); const cy = atTop?0:(atBottom?maxY:y); inDx = x - cx; inDy = y - cy; inDist = Math.sqrt(inDx*inDx + inDy*inDy) || 1; }
            const ux = -inDx / inDist; const uy = -inDy / inDist;
            const fleeAmount = Math.max(dartDistance, fleeDistance) * 1.2;
            const [tx, ty] = clampToBounds(x + ux * fleeAmount, y + uy * fleeAmount);
            if (smoothRaf) cancelAnimationFrame(smoothRaf); animating=false; x = tx; y = ty; updateImgPos(); img.style.transform='scale(1.06)'; setTimeout(()=>img.style.transform='',140);
        }

        // keep bounds up to date on resize/scroll
        window.addEventListener('resize', ()=>{ bounds = getBounds(); });
    }

})();
