/* Inline snitch launcher (migrated from index.html)
   Mounts the snitch into #snitch-slot only on index, when auto-skip is OFF
   and the intro/photo section has become visible. Behavior is scoped and
   intentionally lightweight. */
(function(){
    const slot = document.getElementById('snitch-slot');
    const photoContainer = document.getElementById('photo-container');
    const header = document.querySelector('header');
    // Allow this module to run on pages without the home-only `photoContainer`.
    // The auto-init logic will only run where `photoContainer` exists; however
    // we still need `slot` and `header` to be present to initialize the snitch.
    if (!slot || !header) return;

    // shared state for the currently active snitch instance. Stored here so
    // other pages can call teardown and so we can cancel timers/raf handlers.
    let SNITCH_STATE = null;

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

        // If we don't have a photoContainer (i.e., not the index page), skip
        // the auto-init observation logic and leave initialization to callers
        // (for example, the explicit launcher button on other pages).
        if (!photoContainer){
            return;
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
        if (SNITCH_STATE) return; // already created
        // ensure slot exists
        if (!slot) return;
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

        // initialize state
        SNITCH_STATE = {
            slot: slot,
            img: img,
            driftRaf: null,
            smoothRaf: null,
            dartTimeout: null,
            movementChecker: null,
            slowTimeout: null,
            movementTracking: false,
            movementStart: 0,
            lastMove: 0,
            slowTriggered: false,
            animating: false,
            slowMode: false,
            mouseEnabled: true,
            onClickHandler: null,
            progressWrap: null,
            progressBar: null,
            handlers: {}
        };

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
            if (SNITCH_STATE.smoothRaf) cancelAnimationFrame(SNITCH_STATE.smoothRaf);
            SNITCH_STATE.animating = true;
            const start = performance.now();
            const sx = x, sy = y;
            function step(now){
                const t = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - t, 3);
                prevX = x; prevY = y;
                x = sx + (tx - sx) * eased;
                y = sy + (ty - sy) * eased;
                updateImgPos();
                if (t < 1) SNITCH_STATE.smoothRaf = requestAnimationFrame(step);
                else { SNITCH_STATE.animating = false; SNITCH_STATE.smoothRaf = null; }
            }
            SNITCH_STATE.smoothRaf = requestAnimationFrame(step);
        }

        // drift
        function randomDrift(){
            if (!SNITCH_STATE.animating){
                prevX = x; prevY = y;
                x += (Math.random() - 0.5) * speed;
                y += (Math.random() - 0.5) * speed;
                [x, y] = clampToBounds(x, y);
                updateImgPos();
                checkCornerAndFlee();
            }
            SNITCH_STATE.driftRaf = requestAnimationFrame(randomDrift);
        }
        SNITCH_STATE.driftRaf = requestAnimationFrame(randomDrift);

        function scheduleRandomDart(){
            const delay = SNITCH_STATE.slowMode ? (20000 + (Math.random() * 10000 - 5000)) : (500 + Math.random() * 1200);
            SNITCH_STATE.dartTimeout = setTimeout(()=>{
                const angle = Math.random() * Math.PI * 2;
                const effective = SNITCH_STATE.slowMode ? (dartDistance * 0.25) : dartDistance;
                const dx = Math.cos(angle) * effective;
                const dy = Math.sin(angle) * effective;
                const [tx, ty] = clampToBounds(x + dx, y + dy);
                const dur = SNITCH_STATE.slowMode ? 800 : 220;
                smoothMoveTo(tx, ty, dur);
                setTimeout(checkCornerAndFlee, dur + 40);
                scheduleRandomDart();
            }, delay);
        }
        scheduleRandomDart();

        // proximity flee: listen globally so other UI (audio buttons, overlays)
        // can sit above the slot and still receive clicks. Compute mouse
        // position relative to the slot rect on every move.
        // proximity flee handler
        function handleProximity(ev){
            if (!SNITCH_STATE || !SNITCH_STATE.mouseEnabled) return;
            const rect = slot.getBoundingClientRect();
            const mx = ev.clientX - rect.left;
            const my = ev.clientY - rect.top;
            const dx = x - mx; const dy = y - my; const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < fleeDistance){
                const ux = dx / (dist || 1), uy = dy / (dist || 1);
                const [tx, ty] = clampToBounds(x + ux * dartDistance, y + uy * dartDistance);
                const dur = SNITCH_STATE.slowMode ? 500 : 260;
                smoothMoveTo(tx, ty, dur);
                setTimeout(checkCornerAndFlee, dur + 40);
            }
        }
        SNITCH_STATE.handlers.proximity = handleProximity;
        document.addEventListener('mousemove', handleProximity);

        // movement-tracking to enable slow mode after 20s continuous mouse movement
        SNITCH_STATE.movementTracking = false; SNITCH_STATE.movementStart = 0; SNITCH_STATE.lastMove = 0; SNITCH_STATE.slowTriggered = false;
        // create progress UI
        const progressWrap = document.createElement('div');
        progressWrap.className = 'snitch-progress';
        const progressBar = document.createElement('div');
        progressBar.className = 'snitch-progress-bar';
        progressWrap.appendChild(progressBar);
        slot.appendChild(progressWrap);
        SNITCH_STATE.progressWrap = progressWrap; SNITCH_STATE.progressBar = progressBar;

        function handleMovement(e){
            const now = Date.now(); SNITCH_STATE.lastMove = now;
            if (SNITCH_STATE.slowTriggered) return;
            if (!SNITCH_STATE.movementTracking){
                SNITCH_STATE.movementTracking = true; SNITCH_STATE.movementStart = now;
                // show progress bar
                SNITCH_STATE.progressWrap.classList.add('show');
                SNITCH_STATE.movementChecker = setInterval(()=>{
                    const now2 = Date.now();
                    // if pause >1s, reset
                    if (now2 - SNITCH_STATE.lastMove > 1000){
                        SNITCH_STATE.movementTracking = false; SNITCH_STATE.movementStart = 0;
                        SNITCH_STATE.progressBar.style.width = '0%';
                        SNITCH_STATE.progressWrap.classList.remove('show');
                        clearInterval(SNITCH_STATE.movementChecker); SNITCH_STATE.movementChecker = null; return;
                    }
                    // compute fraction toward 20s
                    const fraction = Math.max(0, Math.min(1, (now2 - SNITCH_STATE.movementStart) / 20000));
                    SNITCH_STATE.progressBar.style.width = Math.round(fraction * 100) + '%';
                    if (fraction >= 1){
                        SNITCH_STATE.slowTriggered = true; SNITCH_STATE.movementTracking = false;
                        clearInterval(SNITCH_STATE.movementChecker); SNITCH_STATE.movementChecker = null;
                        SNITCH_STATE.progressBar.style.width = '100%';
                        startSlowMode(30000);
                        // hide progress after a short delay
                        setTimeout(()=> SNITCH_STATE.progressWrap.classList.remove('show'), 500);
                    }
                }, 120);
            }
        }
        SNITCH_STATE.handlers.movement = handleMovement;
        document.addEventListener('mousemove', handleMovement);

    function startSlowMode(durationMs){
            // Enter slow (clickable) mode: keep proximity fleeing enabled, but
            // make the image clickable so users can interact. Do not disable
            // mouseEnabled here so the snitch still responds to proximity.
            SNITCH_STATE.slowMode = true;
            img.style.pointerEvents = 'auto';
            img.style.cursor = 'pointer';
            // bring the image above other UI so it can be clicked
            img.style.zIndex = 1000025;
            // use a shared handler so we can remove it early if "play again" is clicked
            SNITCH_STATE.onClickHandler = () => { img.style.transform = 'scale(1.08)'; setTimeout(()=>img.style.transform='', 160); showWinBox(); };
            img.addEventListener('click', SNITCH_STATE.onClickHandler);

            // track timeout so we can cancel it if needed
            SNITCH_STATE.slowTimeout = setTimeout(()=>{
                SNITCH_STATE.slowMode = false;
                img.style.pointerEvents = 'none';
                img.style.cursor = '';
                img.style.zIndex = '';
                if (SNITCH_STATE.onClickHandler) img.removeEventListener('click', SNITCH_STATE.onClickHandler);
                SNITCH_STATE.onClickHandler = null;
                SNITCH_STATE.slowTimeout = null;
            }, durationMs);
        }

        // Disable slow mode immediately (used by the "Play again" button)
        function disableSlowModeNow(){
            if (!SNITCH_STATE || !SNITCH_STATE.slowMode) return;
            SNITCH_STATE.slowMode = false;
            img.style.pointerEvents = 'none';
            img.style.cursor = '';
            img.style.zIndex = '';
            if (SNITCH_STATE.onClickHandler) img.removeEventListener('click', SNITCH_STATE.onClickHandler);
            SNITCH_STATE.onClickHandler = null;
            if (SNITCH_STATE.slowTimeout){ clearTimeout(SNITCH_STATE.slowTimeout); SNITCH_STATE.slowTimeout = null; }
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
                SNITCH_STATE.slowTriggered = false;
                SNITCH_STATE.movementTracking = false;
                SNITCH_STATE.movementStart = 0;
                SNITCH_STATE.lastMove = 0;
                if (SNITCH_STATE.movementChecker){ clearInterval(SNITCH_STATE.movementChecker); SNITCH_STATE.movementChecker = null; }
                try { SNITCH_STATE.progressBar.style.width = '0%'; } catch(e){}
                try { SNITCH_STATE.progressWrap.classList.remove('show'); } catch(e){}
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
            if (SNITCH_STATE && SNITCH_STATE.smoothRaf) cancelAnimationFrame(SNITCH_STATE.smoothRaf);
            SNITCH_STATE.animating = false;
            x = tx; y = ty; updateImgPos();
            img.style.transform = 'scale(1.06)';
            setTimeout(()=> img.style.transform = '', 140);
        }

        // keep bounds up to date on resize/scroll
        function handleResize(){ bounds = getBounds(); }
        SNITCH_STATE.handlers.resize = handleResize;
        window.addEventListener('resize', handleResize);

        // expose a cleanup function that cancels timers and removes UI so other
        // pages (or the overlay close button) can teardown the snitch.
        function cleanup(){
            try{
                // stop RAFs and timers
                if (SNITCH_STATE.driftRaf) cancelAnimationFrame(SNITCH_STATE.driftRaf);
                if (SNITCH_STATE.smoothRaf) cancelAnimationFrame(SNITCH_STATE.smoothRaf);
                if (SNITCH_STATE.dartTimeout) clearTimeout(SNITCH_STATE.dartTimeout);
                if (SNITCH_STATE.movementChecker) clearInterval(SNITCH_STATE.movementChecker);
                if (SNITCH_STATE.slowTimeout) clearTimeout(SNITCH_STATE.slowTimeout);
                // remove event listeners
                if (SNITCH_STATE.handlers.proximity) document.removeEventListener('mousemove', SNITCH_STATE.handlers.proximity);
                if (SNITCH_STATE.handlers.movement) document.removeEventListener('mousemove', SNITCH_STATE.handlers.movement);
                if (SNITCH_STATE.handlers.resize) window.removeEventListener('resize', SNITCH_STATE.handlers.resize);
                // remove progress UI
                try{ if (SNITCH_STATE.progressWrap && SNITCH_STATE.progressWrap.parentNode) SNITCH_STATE.progressWrap.parentNode.removeChild(SNITCH_STATE.progressWrap); }catch(e){}
                // remove runner
                try{ const r = slot.querySelector('#snitch-runner'); if (r) r.remove(); }catch(e){}
                // remove any win boxes appended to body
                try{ Array.from(document.querySelectorAll('.snitch-win')).forEach(n=>n.remove()); }catch(e){}
                // hide slot
                try{ slot.classList.remove('snitch-appear'); slot.style.display = 'none'; slot.setAttribute('aria-hidden','true'); }catch(e){}
            }catch(e){}
            SNITCH_STATE = null;
            try{ window.teardownSnitch = null; }catch(e){}
        }

        try{ window.teardownSnitch = cleanup; }catch(e){}
    }

    // Expose a callable launcher so other pages can trigger the exact same
    // snitch initialization programmatically (used by the Softwares page).
    try { window.launchSnitch = initSnitch; } catch (e) { /* noop */ }
    try { if (!window.teardownSnitch) window.teardownSnitch = null; } catch(e){}

})();
