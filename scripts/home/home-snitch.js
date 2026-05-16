/* Snitch launcher: mounts the catch-the-snitch minigame into #snitch-slot.
   The game starts only when the user clicks the #snitch-launch-btn button. */
(function(){
    const slot = document.getElementById('snitch-slot');
    const header = document.querySelector('header');
    if (!slot || !header) return;

    let SNITCH_STATE = null;

    try { slot.style.opacity = '0'; slot.style.display = 'none'; slot.setAttribute('aria-hidden','true'); } catch(e){}

    function placeSlotUnderHeader(){
        const h = header.getBoundingClientRect();
        // place slot directly under header; slot height uses remaining viewport height
        slot.style.top = Math.round(h.bottom + 8) + 'px';
        slot.style.left = '0';
        slot.style.height = (window.innerHeight - h.bottom - 12) + 'px';
    }
    placeSlotUnderHeader();
    window.addEventListener('resize', placeSlotUnderHeader);

    // Wire up the launch button: click starts the game; click again stops it
    function bindLaunchButton(){
        const btn = document.getElementById('snitch-launch-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (SNITCH_STATE) {
                if (typeof window.teardownSnitch === 'function') window.teardownSnitch();
            } else {
                initSnitch();
            }
        });
    }
    if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', bindLaunchButton);
    } else {
        bindLaunchButton();
    }

    // --- create snitch behavior (lightweight copy of test harness, scoped) ---
    function initSnitch(){
        if (SNITCH_STATE) return; // already created
        // ensure slot exists
        if (!slot) return;
        try { document.body.classList.add('snitch-active'); } catch(e){}

        // Stop SW music if playing (audio-player.js listens to the pause event and syncs its icon)
        try { const swAudio = document.getElementById('my-audio'); if (swAudio && !swAudio.paused) swAudio.pause(); } catch(e){}

        // Create HP theme audio + button (only when the audio element exists — home page only)
        const hpMusicSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 3v10.5A3.5 3.5 0 1 0 13.5 17V7h4V3h-5.5z" fill="currentColor"/></svg>`;
        const hpMusicCrossedSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M12 3v10.5A3.5 3.5 0 1 0 13.5 17V7h4V3h-5.5z" fill="currentColor"/><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" transform="rotate(-12 12 12)"/></svg>`;

        const hpAudio = document.getElementById('hp-audio');
        let hpBtn = null;

        if (hpAudio) {
            hpBtn = document.createElement('button');
            hpBtn.id = 'hp-music-btn';
            hpBtn.setAttribute('aria-label', 'Toggle Harry Potter theme');
            hpBtn.setAttribute('aria-pressed', 'false');
            hpBtn.title = 'Harry Potter theme';
            hpBtn.innerHTML = hpMusicSvg;
            document.body.appendChild(hpBtn);

            hpBtn.addEventListener('click', () => {
                if (hpAudio.paused) { hpAudio.play().catch(()=>{}); }
                else { hpAudio.pause(); }
            });
            hpAudio.addEventListener('play',  () => { hpBtn.innerHTML = hpMusicCrossedSvg; hpBtn.setAttribute('aria-pressed','true'); });
            hpAudio.addEventListener('pause', () => { hpBtn.innerHTML = hpMusicSvg;        hpBtn.setAttribute('aria-pressed','false'); });

            // fade in to resting opacity
            requestAnimationFrame(() => { hpBtn.style.opacity = '0.5'; });
        }

        // Software-page-only: create HP audio, music button (full size), and instructions text
        let swHpAudio = null, swHpBtn = null, instrDiv = null;
        if (document.body.classList.contains('page-software')) {
            swHpAudio = document.createElement('audio');
            swHpAudio.src = 'audio/hptheme.mp3';
            swHpAudio.loop = true;
            document.body.appendChild(swHpAudio);

            swHpBtn = document.createElement('button');
            swHpBtn.id = 'hp-music-btn';
            swHpBtn.setAttribute('aria-label', 'Toggle Harry Potter theme');
            swHpBtn.setAttribute('aria-pressed', 'false');
            swHpBtn.title = 'Harry Potter theme';
            swHpBtn.innerHTML = hpMusicSvg;
            swHpBtn.style.width = '8vh';
            swHpBtn.style.height = '8vh';
            swHpBtn.style.opacity = '0';
            swHpBtn.style.zIndex = '100520';
            document.body.appendChild(swHpBtn);

            swHpBtn.addEventListener('click', () => {
                if (swHpAudio.paused) { swHpAudio.play().catch(()=>{}); }
                else { swHpAudio.pause(); }
            });
            swHpAudio.addEventListener('play',  () => { swHpBtn.innerHTML = hpMusicCrossedSvg; swHpBtn.setAttribute('aria-pressed','true'); });
            swHpAudio.addEventListener('pause', () => { swHpBtn.innerHTML = hpMusicSvg;        swHpBtn.setAttribute('aria-pressed','false'); });

            requestAnimationFrame(() => { swHpBtn.style.opacity = '1'; });

            instrDiv = document.createElement('div');
            instrDiv.id = 'snitch-instructions';
            instrDiv.style.cssText = 'position:fixed;bottom:calc(3rem + 8vh + 0.9rem);right:2.8vw;font-family:"Abaddon Light",sans-serif;font-size:0.85rem;color:rgba(255,248,220,0.9);text-align:center;opacity:0;transition:opacity 0.6s ease;z-index:100520;max-width:360px;line-height:1.5;pointer-events:none;';
            instrDiv.innerHTML = 'Chase the golden snitch with your mouse.<br>The bar fills the longer you pursue it —<br>faster the more relentless you are.<br>When it\'s full, the snitch slows down.<br><em style="color:gold;">Click it to catch it and win 150 points!</em>';
            document.body.appendChild(instrDiv);
            requestAnimationFrame(() => { instrDiv.style.opacity = '1'; });
        }

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
            hpAudio: hpAudio,
            hpBtn: hpBtn,
            swHpAudio: swHpAudio,
            swHpBtn: swHpBtn,
            instrDiv: instrDiv,
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
        const EDGE_PADDING = 80;
        const WALL_WARN = EDGE_PADDING * 2.2; // start redirecting well before the hard edge
        let x = EDGE_PADDING + 40, y = EDGE_PADDING + 40;
        let prevX = x, prevY = y;
        const speed = 0.5;
        const fleeDistance = 180;  // trigger flee much earlier
        const dartDistance = 240;  // flee much farther

        function getBoundsLimits(){
            const b = getBounds();
            const maxX = Math.max(0, b.width - img.width);
            const maxY = Math.max(0, b.height - img.height);
            const minX = EDGE_PADDING;
            const minY = EDGE_PADDING;
            return { minX, minY, maxX: Math.max(minX, maxX - EDGE_PADDING), maxY: Math.max(minY, maxY - EDGE_PADDING), rawMaxX: maxX, rawMaxY: maxY };
        }

        function clampToBounds(nx, ny){
            const { minX, minY, maxX, maxY } = getBoundsLimits();
            return [ Math.max(minX, Math.min(maxX, nx)), Math.max(minY, Math.min(maxY, ny)) ];
        }

        function updateImgPos(){
            img.style.left = Math.round(x) + 'px';
            img.style.top = Math.round(y) + 'px';
        }

        function smoothMoveTo(tx, ty, duration = 180){
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

        // Rotate a unit vector by `angle` radians
        function rotateVec(ux, uy, angle){
            const c = Math.cos(angle), s = Math.sin(angle);
            return [ux * c - uy * s, ux * s + uy * c];
        }

        // Given a desired flee direction (ux,uy), deflect it away from nearby walls
        // and return a safe target point dartDist away.
        function safeFleeTarget(ux, uy, dartDist){
            const { minX, minY, maxX, maxY, rawMaxX, rawMaxY } = getBoundsLimits();

            // Wall proximity flags (using WALL_WARN zone)
            const nearLeft   = x - minX   < WALL_WARN;
            const nearRight  = maxX - x   < WALL_WARN;
            const nearTop    = y - minY    < WALL_WARN;
            const nearBottom = maxY - y    < WALL_WARN;

            // If fleeing toward a wall, flip that axis
            if (nearLeft   && ux < 0) ux = Math.abs(ux);
            if (nearRight  && ux > 0) ux = -Math.abs(ux);
            if (nearTop    && uy < 0) uy = Math.abs(uy);
            if (nearBottom && uy > 0) uy = -Math.abs(uy);

            // Corner: near two walls → aim for center with jitter
            const inCorner = (nearLeft || nearRight) && (nearTop || nearBottom);
            if (inCorner){
                const cx = rawMaxX / 2, cy = rawMaxY / 2;
                let cdx = cx - x, cdy = cy - y;
                const cdist = Math.sqrt(cdx*cdx + cdy*cdy) || 1;
                ux = cdx / cdist;
                uy = cdy / cdist;
                // random angle offset ±50° so it's not predictably straight to center
                const [rx, ry] = rotateVec(ux, uy, (Math.random() - 0.5) * 1.75);
                ux = rx; uy = ry;
            } else {
                // add ±35° jitter for erratic movement
                const [rx, ry] = rotateVec(ux, uy, (Math.random() - 0.5) * 1.2);
                ux = rx; uy = ry;
            }

            // re-normalize after adjustments
            const len = Math.sqrt(ux*ux + uy*uy) || 1;
            ux /= len; uy /= len;

            return clampToBounds(x + ux * dartDist, y + uy * dartDist);
        }

        // Proactive wall flee: called every drift frame; triggers a fast redirect
        // whenever the snitch drifts into the warn zone.
        function proactiveWallFlee(){
            const { minX, minY, maxX, maxY } = getBoundsLimits();
            const nearLeft   = x - minX  < WALL_WARN;
            const nearRight  = maxX - x  < WALL_WARN;
            const nearTop    = y - minY   < WALL_WARN;
            const nearBottom = maxY - y   < WALL_WARN;
            if (!(nearLeft || nearRight || nearTop || nearBottom)) return;

            // Build repulsion vector away from all nearby walls
            let rx = 0, ry = 0;
            if (nearLeft)   rx += 1;
            if (nearRight)  rx -= 1;
            if (nearTop)    ry += 1;
            if (nearBottom) ry -= 1;

            // Fallback: no clear direction (exact center) → pick random outward
            if (rx === 0 && ry === 0){ rx = (Math.random() - 0.5); ry = (Math.random() - 0.5); }

            const rlen = Math.sqrt(rx*rx + ry*ry) || 1;
            rx /= rlen; ry /= rlen;

            const [tx, ty] = safeFleeTarget(rx, ry, dartDistance * 1.3);
            smoothMoveTo(tx, ty, SNITCH_STATE.slowMode ? 1400 : 380);
        }

        // drift
        function randomDrift(){
            if (!SNITCH_STATE.animating){
                prevX = x; prevY = y;
                x += (Math.random() - 0.5) * speed;
                y += (Math.random() - 0.5) * speed;
                [x, y] = clampToBounds(x, y);
                updateImgPos();
                proactiveWallFlee();
            }
            SNITCH_STATE.driftRaf = requestAnimationFrame(randomDrift);
        }
        SNITCH_STATE.driftRaf = requestAnimationFrame(randomDrift);

        function scheduleRandomDart(){
            const delay = SNITCH_STATE.slowMode ? (20000 + (Math.random() * 10000 - 5000)) : (400 + Math.random() * 900);
            SNITCH_STATE.dartTimeout = setTimeout(()=>{
                const angle = Math.random() * Math.PI * 2;
                const effective = SNITCH_STATE.slowMode ? (dartDistance * 0.08) : dartDistance;
                const [tx, ty] = safeFleeTarget(Math.cos(angle), Math.sin(angle), effective);
                const dur = SNITCH_STATE.slowMode ? 1600 : 750;
                smoothMoveTo(tx, ty, dur);
                scheduleRandomDart();
            }, delay);
        }
        scheduleRandomDart();

        // proximity flee — cancel any ongoing move and immediately redirect
        function handleProximity(ev){
            if (!SNITCH_STATE || !SNITCH_STATE.mouseEnabled) return;
            const rect = slot.getBoundingClientRect();
            const mx = ev.clientX - rect.left;
            const my = ev.clientY - rect.top;
            const dx = x - mx; const dy = y - my;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < fleeDistance){
                // scale flee distance by proximity: much closer = much farther flee
                const factor = 1 + 1.2 * (1 - dist / fleeDistance);
                const ux = dx / (dist || 1), uy = dy / (dist || 1);
                const slowFactor = SNITCH_STATE.slowMode ? 0.25 : 1;
                const [tx, ty] = safeFleeTarget(ux, uy, dartDistance * factor * slowFactor);
                const dur = SNITCH_STATE.slowMode ? 1100 : 280;
                smoothMoveTo(tx, ty, dur);
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
                    // accelerating fill: slow at first, faster the longer you chase
                    const raw = Math.max(0, Math.min(1, (now2 - SNITCH_STATE.movementStart) / 14000));
                    const fraction = raw * raw;
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
                // stop HP music and remove its button
                try{ if (SNITCH_STATE.hpAudio) SNITCH_STATE.hpAudio.pause(); }catch(e){}
                try{ if (SNITCH_STATE.hpBtn) SNITCH_STATE.hpBtn.remove(); }catch(e){}
                // software-page-only elements
                try{ if (SNITCH_STATE.swHpAudio) { SNITCH_STATE.swHpAudio.pause(); SNITCH_STATE.swHpAudio.remove(); } }catch(e){}
                try{ if (SNITCH_STATE.swHpBtn) SNITCH_STATE.swHpBtn.remove(); }catch(e){}
                try{ if (SNITCH_STATE.instrDiv) SNITCH_STATE.instrDiv.remove(); }catch(e){}
                // hide slot
                try{ slot.classList.remove('snitch-appear'); slot.style.display = 'none'; slot.setAttribute('aria-hidden','true'); }catch(e){}
                try { document.body.classList.remove('snitch-active'); } catch(e){}
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
