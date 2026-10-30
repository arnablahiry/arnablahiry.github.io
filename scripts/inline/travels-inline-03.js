    /* ======================================================
       TRAVEL DATA — edit this section
       ISO numeric codes: https://en.wikipedia.org/wiki/ISO_3166-1_numeric
    ====================================================== */
const VISITS = (window.TRAVEL_DATABASE_COUNTRIES && typeof window.TRAVEL_DATABASE_COUNTRIES === 'object')
    ? window.TRAVEL_DATABASE_COUNTRIES
    : {};

    /* ====================================================== STATS */
    // Recomputed by refreshVisits() when the travel editor changes VISITS
    const visitedIds = new Set();
    let continentSet = new Set();
    let totalPlaces = 0;
    function computeVisits() {
        visitedIds.clear();
        Object.keys(VISITS).forEach(id => visitedIds.add(Number(id)));
        continentSet = new Set(Object.values(VISITS).map(v => v.continent).filter(Boolean));
        totalPlaces = Object.values(VISITS).reduce((s, v) => s + v.places.length, 0);
    }
    computeVisits();

    function statValues() {
        return {
            'stat-countries': visitedIds.size,
            'stat-places': totalPlaces + 20,
            'stat-continents': continentSet.size
        };
    }

    function animateCount(el, target) {
        let n = 0;
        const step = Math.ceil(target / 30);
        const t = setInterval(() => { n = Math.min(n + step, target); el.textContent = n; if (n >= target) clearInterval(t); }, 30);
    }
    const statsEl = document.querySelector('.travels-stats');
    let statsAnimated = false;
    const statsObserver = new IntersectionObserver(entries => {
        if (statsAnimated || !entries[0].isIntersecting) return;
        statsAnimated = true;
        const values = statValues();
        Object.keys(values).forEach(id => animateCount(document.getElementById(id), values[id]));
        statsObserver.disconnect();
    }, { threshold: 0.3 });
    statsObserver.observe(statsEl);

    /* ====================================================== GLOBE */
    const canvas  = document.getElementById('globe-canvas');
    const ctx     = canvas.getContext('2d');
    const tooltip = document.getElementById('map-tooltip');
    const detail  = document.getElementById('travel-detail');
    const hint    = document.getElementById('globe-hint');
    const globeWrap = document.getElementById('globe-wrap');
    const globeContainer = document.getElementById('globe-container');
    const countryMapPanel = document.getElementById('country-map-panel');
    const countryMapTitle = document.getElementById('country-map-title');
    const countryMapEmpty = document.getElementById('country-map-empty');
    const countryMapViewport = document.getElementById('country-map-viewport');
    const focusPhotoGrid = document.getElementById('focus-photo-grid');
    const countryMapBackBtn = document.getElementById('country-map-back');
    const lightboxEl = document.getElementById('photo-lightbox');
    const lightboxImgEl = document.getElementById('lightbox-image');
    const lightboxCaptionEl = document.getElementById('lightbox-caption');
    const lightboxCreditImageEl = document.getElementById('lightbox-credit-image');
    const lightboxCreditNameEl = document.getElementById('lightbox-credit-name');
    const lightboxCloseEl = document.getElementById('lightbox-close');
    const lightboxPrevEl = document.getElementById('lightbox-prev');
    const lightboxNextEl = document.getElementById('lightbox-next');
    if (detail && detail.parentElement !== document.body) document.body.appendChild(detail);

    let worldGeo = null;
    // Map layers, each item with a bounding circle ({ c: [lon, lat], r: radians })
    // so whatever is on the far side of the globe is skipped while drawing
    let countryShapes = [], landShapes = [], lakeShapes = [], borderLines = [];
    let visibleCountries = [];   // drawn in the last frame (for hit testing)
    let hoveredId = null, isDragging = false;
    let hoveredPin = null;   // { x, y, r, id, pin } under the pointer
    let pinScreen = [];      // pins drawn in the last frame, for hit testing
    let autoRotate = true, autoTimer = null;
    let userPaused = false;   // the pause/play button; autoRotate covers drags, focus, etc.
    let spinShown = null;     // whether the button currently shows the globe turning
    let W, H, R;
    let currentScale = 1;
    let isPinching = false;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let touchRotateOrigin = null;
    let touchRotateStart = null;
    let suppressTap = false;
    let introActive = true;
    let introStartTs = null;
    let detailReturnScrollY = null;
    let focusAnimToken = 0;
    let pendingOpenToken = 0;
    let isDetailOpen = false;
    let focusedCountryId = null;
    let focusedCountryBlend = 1;
    let selectedCountryName = '';
    let focusReturnRotate = null;
    let isUnfocusing = false;
    let isCountrySwitching = false;
    let countrySwapToken = 0;
    let countryTitleTimer = null;
    let countryTitleAnimToken = 0;
    let photoMeasureNodes = null;
    let lightboxPhotos = [];
    let lightboxIndex = 0;
    const COUNTRY_FOCUS_SCROLL_MS = 2200;
    const COUNTRY_TITLE_FADE_MS = Math.max(500, Math.round(COUNTRY_FOCUS_SCROLL_MS * 0.7));
    const INTRO_MS = 1200;
    const INTRO_FAST_SPIN = 2.8;
    const INTRO_NORMAL_SPIN = 0.10;
    // The intro spin lands on India; the slow rotation carries on from there
    const START_VIEW = { lng: 78.9, lat: 21.3 };

    // Degrees the intro has turned after a fraction t of INTRO_MS: the spin
    // (in degrees per 60 fps frame) eases from INTRO_FAST_SPIN down to
    // INTRO_NORMAL_SPIN, integrated over time so every frame rate lands in
    // the same place
    function introTurn(t) {
        const framesPerMs = 60 / 1000;
        const easedArea = t - (1 - Math.pow(1 - t, 4)) / 4;   // ∫ 1-(1-s)³ ds from 0 to t
        return framesPerMs * INTRO_MS * (INTRO_FAST_SPIN * t + (INTRO_NORMAL_SPIN - INTRO_FAST_SPIN) * easedArea);
    }
    const INTRO_START_LON = -START_VIEW.lng - introTurn(1);
    const DEFAULT_GLOBE_SCALE = 1;
    // the atmosphere's band between the globe and the (round) canvas edge
    const ATMOSPHERE_PX = 14;
    const MIN_GLOBE_SCALE = 0.45;
    const MAX_GLOBE_SCALE = 3.5;
    const TRAVEL_DEFAULT_CREDIT = 'Arnab';
    const TRAVEL_DEFAULT_CREDIT_IMAGE = 'images/pfp_no_pixel.jpeg';

    const proj  = d3.geoOrthographic().clipAngle(90).precision(0.3);
    const gpath = d3.geoPath(proj, ctx);

    function isLight() { return document.body.classList.contains('light-mode'); }

    function C() {
        const l = isLight();
        return {
            ocean:         l ? '#c6dff3' : '#0c1118',
            land:          l ? '#e9f2fb' : '#1c1f27',
            landStroke:    l ? '#6f90ad' : '#282c36',
            // visited countries: faint tint + gold border; places: glowing pins
            visitedFill:        l ? 'rgba(201, 152, 18, 0.12)' : 'rgba(254, 218, 74, 0.06)',
            visitedFillHover:   l ? 'rgba(201, 152, 18, 0.22)' : 'rgba(254, 218, 74, 0.13)',
            visitedFillFocused: l ? 'rgba(201, 152, 18, 0.30)' : 'rgba(254, 218, 74, 0.20)',
            visitedStroke:      l ? 'rgba(143, 100, 0, 0.70)'  : 'rgba(254, 218, 74, 0.55)',
            visitedStrokeHover: l ? 'rgba(143, 100, 0, 1)'     : 'rgba(255, 232, 154, 0.95)',
            visitedGlow:        l ? 'rgba(150, 100, 0, 0.45)'  : 'rgba(254, 218, 74, 0.55)',
            pinCore:            l ? '#a87400' : '#fff4c8',
            pinRing:            l ? 'rgba(255, 255, 255, 0.95)' : 'rgba(254, 218, 74, 0.95)',
            pinGlow:            l ? '196, 136, 0' : '254, 218, 74',
            graticule:     l ? 'rgba(43, 72, 102, 0.14)' : 'rgba(255,255,255,0.035)',
            borderStroke:  l ? 'rgba(74, 104, 132, 0.34)' : 'rgba(255,255,255,0.12)',
            atmoCore:      l ? 'rgba(186, 220, 246, 0.24)' : 'rgba(98,164,255,0.16)',
            atmoMid:       l ? 'rgba(186, 220, 246, 0.11)' : 'rgba(64,128,240,0.10)',
            atmoOuter:     l ? 'rgba(186, 220, 246, 0.00)' : 'rgba(64,128,240,0.00)',
            outline:       l ? 'rgba(0,0,0,0.08)'        : 'rgba(255,255,255,0.05)',
        };
    }

    function setCountryFocusProgress(value, opacityValue) {
        if (!globeWrap) return;
        const p = Math.max(0, Math.min(1, Number(value) || 0));
        const op = Math.max(0, Math.min(1, Number(opacityValue)));
        globeWrap.style.setProperty('--country-focus-progress', p.toFixed(4));
        globeWrap.style.setProperty('--country-opacity-progress', (Number.isFinite(op) ? op : p).toFixed(4));
    }

    function setSize(keepZoom) {
        const wrap    = document.getElementById('globe-wrap');
        const isPhone = window.matchMedia('(max-width: 600px)').matches;
        const naturalBase = Math.min(wrap.clientWidth, window.innerHeight * 0.84, 820);
        const natural = isPhone ? (naturalBase * 0.9) : (naturalBase * 0.88);
        if (!keepZoom) currentScale = DEFAULT_GLOBE_SCALE;
        const sz = Math.round(natural * currentScale);
        W = H = sz;
        canvas.width  = sz * devicePixelRatio;
        canvas.height = sz * devicePixelRatio;
        canvas.style.width  = sz + 'px';
        canvas.style.height = sz + 'px';
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        R = sz / 2 - ATMOSPHERE_PX;
        proj.scale(R).translate([sz / 2, sz / 2]);
        if (globeWrap) globeWrap.style.setProperty('--globe-size-px', `${sz}px`);
    }

    function syncTravelsHeaderOffset() {
        const headerEl = document.querySelector('header');
        if (!headerEl) return;
        const h = Math.ceil(headerEl.getBoundingClientRect().height || 0);
        const offset = (h + 10) + 'px';
        document.documentElement.style.setProperty('--site-header-offset', offset);
        document.body.style.setProperty('--travels-header-offset', offset);
    }

    function getHeaderHeightPx() {
        const headerEl = document.querySelector('header');
        if (!headerEl) return 0;
        return Math.max(0, Math.ceil(headerEl.getBoundingClientRect().height || 0));
    }

    function draw() {
        const c    = C();
        const curR = proj.scale();
        const [cx, cy] = proj.translate();
        ctx.clearRect(0, 0, W, H);

        // atmosphere glow — soft bloom, not a hard ring
        const ag = ctx.createRadialGradient(cx, cy, curR * 0.28, cx, cy, curR * 1.58);
        ag.addColorStop(0.00, c.atmoCore);
        ag.addColorStop(0.62, c.atmoMid);
        ag.addColorStop(1.00, c.atmoOuter);
        ctx.save();
        if (!isLight()) ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.arc(cx, cy, curR * 1.58, 0, 2 * Math.PI);
        ctx.fillStyle = ag;
        ctx.fill();
        ctx.restore();

        // ocean + shadow
        ctx.save();
        ctx.shadowColor   = isLight() ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.60)';
        ctx.shadowBlur    = 32;
        ctx.shadowOffsetY = 8;
        ctx.beginPath(); gpath({ type: 'Sphere' });
        ctx.fillStyle = c.ocean; ctx.fill();
        ctx.restore();

        // graticule
        ctx.beginPath(); gpath(d3.geoGraticule()());
        ctx.strokeStyle = c.graticule; ctx.lineWidth = 0.4; ctx.stroke();

        if (!worldGeo) return;

        const r0 = proj.rotate();
        const center = [-r0[0], -r0[1]];
        const facing = (item) => d3.geoDistance(item.c, center) - item.r < Math.PI / 2;
        // borders are stroked a few dozen lines at a time, for the same reason
        const strokeLines = (list) => {
            const shown = list.filter(facing);
            for (let i = 0; i < shown.length; i += 40) {
                ctx.beginPath();
                gpath({ type: 'MultiLineString', coordinates: shown.slice(i, i + 40).map(l => l.coords) });
                ctx.stroke();
            }
        };

        // land: the countries merged into landmasses, so each coast is
        // filled and outlined in one pass and inner borders aren't filled twice
        ctx.fillStyle = c.land;
        ctx.strokeStyle = c.landStroke; ctx.lineWidth = 0.3;
        landShapes.filter(facing).forEach(s => { ctx.beginPath(); gpath(s.feature); ctx.fill(); ctx.stroke(); });
        visibleCountries = countryShapes.filter(facing).map(s => s.feature);

        // a faint tint on visited countries (filled one by one: canvas paths
        // get slow to build when they hold very many shapes)
        const focusBlend = Math.max(0, Math.min(1, focusedCountryBlend));
        const visitedShapes = visibleCountries.filter(f => visitedIds.has(+f.id));
        visitedShapes.forEach(f => {
            const id = +f.id;
            ctx.beginPath(); gpath(f);
            ctx.fillStyle = focusedCountryId === id
                ? d3.interpolateRgb(c.visitedFill, c.visitedFillFocused)(focusBlend)
                : (hoveredId === id ? c.visitedFillHover : c.visitedFill);
            ctx.fill();
        });

        // lakes, in the ocean's colour
        ctx.fillStyle = c.ocean;
        ctx.strokeStyle = c.landStroke; ctx.lineWidth = 0.3;
        lakeShapes.filter(facing).forEach(s => { ctx.beginPath(); gpath(s.feature); ctx.fill(); ctx.stroke(); });

        // borders between countries
        ctx.strokeStyle = c.borderStroke;
        ctx.lineWidth = isLight() ? 0.55 : 0.45;
        strokeLines(borderLines);

        // visited borders on top, glowing when hovered/focused
        visitedShapes.forEach(f => {
            const id = +f.id;
            const lit = hoveredId === id || focusedCountryId === id;
            ctx.save();
            ctx.beginPath(); gpath(f);
            if (lit) {
                ctx.shadowColor = c.visitedGlow;
                ctx.shadowBlur = 10;
            }
            ctx.strokeStyle = lit ? c.visitedStrokeHover : c.visitedStroke;
            ctx.lineWidth = lit ? 1.4 : 0.9;
            ctx.stroke();
            ctx.restore();
        });

        drawPins(c);

        // outline ring
        ctx.beginPath(); gpath({ type: 'Sphere' });
        ctx.strokeStyle = c.outline; ctx.lineWidth = 0.85; ctx.stroke();
    }

    // One pin per place with coordinates: a soft glow, then a dot (city) or
    // a ring (whole region). Pins fade out towards the globe's edge.
    function drawPins(c) {
        const r = proj.rotate();
        const center = [-r[0], -r[1]];
        const base = Math.max(2.4, Math.min(5, proj.scale() / 105));
        const light = isLight();
        const drawn = [];
        Object.keys(VISITS).forEach(key => {
            const id = Number(key);
            const pins = VISITS[key] && VISITS[key].pins;
            if (!pins || !pins.length) return;
            pins.forEach(pin => {
                const ll = [pin.lng, pin.lat];
                const dist = d3.geoDistance(ll, center);
                if (!(dist < Math.PI / 2)) return;
                const p = proj(ll);
                if (!p) return;
                const hov = !!(hoveredPin && hoveredPin.pin === pin);
                const grow = hov ? 1.5 : ((focusedCountryId === id || hoveredId === id) ? 1.18 : 1);
                drawn.push({
                    x: p[0], y: p[1], id, pin, hov,
                    r: base * grow * (pin.type === 'region' ? 1.35 : 1),
                    fade: Math.min(1, (Math.PI / 2 - dist) / 0.14)
                });
            });
        });

        // glows first, so a dot is never washed out by its neighbour's glow
        ctx.save();
        if (!light) ctx.globalCompositeOperation = 'screen';
        drawn.forEach(d => {
            const reach = d.r * (d.hov ? 5.5 : 4.2);
            const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, reach);
            g.addColorStop(0, `rgba(${c.pinGlow}, ${(light ? 0.42 : 0.55) * d.fade})`);
            g.addColorStop(0.35, `rgba(${c.pinGlow}, ${(light ? 0.16 : 0.22) * d.fade})`);
            g.addColorStop(1, `rgba(${c.pinGlow}, 0)`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(d.x, d.y, reach, 0, 2 * Math.PI); ctx.fill();
        });
        ctx.restore();

        drawn.forEach(d => {
            ctx.globalAlpha = d.fade;
            ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 2 * Math.PI);
            if (d.pin.type === 'region') {
                ctx.fillStyle = `rgba(${c.pinGlow}, 0.25)`; ctx.fill();
                ctx.strokeStyle = c.pinCore; ctx.lineWidth = 1.6; ctx.stroke();
            } else {
                ctx.fillStyle = c.pinCore; ctx.fill();
                ctx.strokeStyle = c.pinRing; ctx.lineWidth = 1; ctx.stroke();
            }
        });
        ctx.globalAlpha = 1;
        pinScreen = drawn;
    }

    function hideCountryMapPanel() {
        if (!countryMapPanel || !globeWrap) return;
        if (countryTitleTimer) {
            clearTimeout(countryTitleTimer);
            countryTitleTimer = null;
        }
        countryMapPanel.classList.remove('title-visible');
        if (countryMapTitle) {
            countryMapTitle.style.opacity = '0';
            countryMapTitle.style.transform = 'translateY(2px)';
        }
        countryMapPanel.classList.remove('open');
        countryMapPanel.setAttribute('aria-hidden', 'true');
        globeWrap.classList.remove('country-map-active');
        selectedCountryName = '';
        if (countryMapTitle) countryMapTitle.textContent = 'Travel Photos';
        if (countryMapEmpty) countryMapEmpty.style.display = '';
        if (focusPhotoGrid) {
            focusPhotoGrid.style.opacity = '1';
            focusPhotoGrid.innerHTML = '';
        }
        if (countryMapViewport) countryMapViewport.style.height = '';
    }

    function animateCountryTitle(visible, duration = COUNTRY_TITLE_FADE_MS) {
        if (!countryMapTitle) return;
        const token = ++countryTitleAnimToken;
        const target = visible ? 1 : 0;
        const start = Math.max(0, Math.min(1, parseFloat(window.getComputedStyle(countryMapTitle).opacity) || 0));
        const delta = target - start;
        const startTs = performance.now();

        function step(now) {
            if (token !== countryTitleAnimToken) return;
            const t = Math.min(1, (now - startTs) / Math.max(1, duration));
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const v = start + (delta * eased);
            countryMapTitle.style.opacity = String(v);
            countryMapTitle.style.transform = `translateY(${(1 - v) * 2}px)`;
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                if (visible) countryMapPanel.classList.add('title-visible');
                else countryMapPanel.classList.remove('title-visible');
            }
        }
        requestAnimationFrame(step);
    }

    function getTravelPhotoMeta(country, photoEntry, index, fallbackCaption) {
        const src = (photoEntry && typeof photoEntry === 'object') ? photoEntry.src : photoEntry;
        if (!src) return null;
        const thumbSrc = (photoEntry && typeof photoEntry === 'object' && photoEntry.thumbSrc)
            ? photoEntry.thumbSrc
            : src;
        const caption = (photoEntry && typeof photoEntry === 'object')
            ? (photoEntry.desc || photoEntry.caption || fallbackCaption)
            : fallbackCaption;
        const credit = (photoEntry && typeof photoEntry === 'object' && photoEntry.credit)
            ? photoEntry.credit
            : TRAVEL_DEFAULT_CREDIT;
        const creditImage = (photoEntry && typeof photoEntry === 'object' && photoEntry.creditImage)
            ? photoEntry.creditImage
            : TRAVEL_DEFAULT_CREDIT_IMAGE;
        const albedo = (photoEntry && typeof photoEntry === 'object') ? photoEntry : {};
        return {
            src, thumbSrc, caption, credit, creditImage,
            albedo: albedo.albedo || '',
            srcLight: albedo.srcLight || '', srcDark: albedo.srcDark || '',
            thumbLight: albedo.thumbLight || '', thumbDark: albedo.thumbDark || ''
        };
    }

    // Albedo (site editor, see scripts/travel-database.js): data-albedo and
    // the second versions (data-src-light / data-src-dark) of a photo on its
    // <img>; css/utils.css flips and scripts/theme-toggle.js swaps them.
    // `thumb`: the <img> shows the thumbnail. No meta clears them (the
    // lightbox <img> is reused for every photo).
    function setPhotoAlbedo(img, meta, thumb) {
        if (!img) return;
        const attrs = {
            'data-albedo': meta ? meta.albedo : '',
            'data-src-light': meta ? ((thumb && meta.thumbLight) || meta.srcLight) : '',
            'data-src-dark': meta ? ((thumb && meta.thumbDark) || meta.srcDark) : ''
        };
        Object.keys(attrs).forEach((name) => {
            if (attrs[name]) img.setAttribute(name, attrs[name]);
            else img.removeAttribute(name);
        });
    }

    function renderLightboxFrame() {
        if (!lightboxPhotos.length || !lightboxImgEl || !lightboxCaptionEl || !lightboxCreditImageEl || !lightboxCreditNameEl) return;
        const frame = lightboxPhotos[lightboxIndex];
        setPhotoAlbedo(lightboxImgEl, frame, false);
        lightboxImgEl.src = frame.src;
        lightboxCaptionEl.textContent = frame.caption || '';
        lightboxCreditImageEl.src = frame.creditImage || TRAVEL_DEFAULT_CREDIT_IMAGE;
        lightboxCreditImageEl.alt = frame.credit || TRAVEL_DEFAULT_CREDIT;
        lightboxCreditNameEl.textContent = frame.credit || TRAVEL_DEFAULT_CREDIT;
        // Edit mode (scripts/travel-edit.js, local editor only)
        if (window.TravelEdit) window.TravelEdit.decorateLightbox(frame, lightboxCaptionEl, lightboxCreditNameEl, lightboxCreditImageEl);
    }

    function openLightboxAt(photos, index) {
        if (!lightboxEl || !Array.isArray(photos) || !photos.length) return;
        lightboxPhotos = photos.slice();
        lightboxIndex = Math.max(0, Math.min(Number(index) || 0, lightboxPhotos.length - 1));
        renderLightboxFrame();
        lightboxEl.classList.remove('closing');
        lightboxEl.classList.remove('open');
        void lightboxEl.offsetWidth;
        lightboxEl.classList.add('open');
        lightboxEl.setAttribute('aria-hidden', 'false');
        document.body.classList.add('travel-lightbox-open');
    }

    function nextLightboxPhoto() {
        if (!lightboxPhotos.length) return;
        lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
        renderLightboxFrame();
    }

    function prevLightboxPhoto() {
        if (!lightboxPhotos.length) return;
        lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
        renderLightboxFrame();
    }

    function closeLightbox() {
        if (!lightboxEl) return;
        if (lightboxEl.classList.contains('closing')) return;
        const finalize = () => {
            lightboxEl.classList.remove('open');
            lightboxEl.classList.remove('closing');
            lightboxEl.setAttribute('aria-hidden', 'true');
            setPhotoAlbedo(lightboxImgEl, null);
            if (lightboxImgEl) lightboxImgEl.src = '';
            if (lightboxCaptionEl) lightboxCaptionEl.textContent = '';
            if (lightboxCreditNameEl) lightboxCreditNameEl.textContent = '';
            lightboxPhotos = [];
            lightboxIndex = 0;
            document.body.classList.remove('travel-lightbox-open');
        };
        const onEnd = (event) => {
            if (event && event.target !== lightboxEl) return;
            if (event && event.animationName !== 'travel-lightbox-backdrop-out') return;
            lightboxEl.removeEventListener('animationend', onEnd);
            finalize();
        };
        lightboxEl.addEventListener('animationend', onEnd);
        lightboxEl.classList.remove('open');
        lightboxEl.classList.add('closing');
        setTimeout(() => {
            lightboxEl.removeEventListener('animationend', onEnd);
            if (lightboxEl.classList.contains('closing')) finalize();
        }, 280);
    }

    function computePhotoViewportHeight(itemCount) {
        if (!focusPhotoGrid) return null;
        const count = Math.max(1, Number(itemCount) || 1);
        const cols = 4;
        const rows = Math.max(1, Math.ceil(count / cols));
        const firstCard = focusPhotoGrid.querySelector('.photo-card');
        const liveGridStyles = window.getComputedStyle(focusPhotoGrid);
        const liveGap = parseFloat(liveGridStyles.rowGap || liveGridStyles.gap || '0') || 0;
        const livePadTop = parseFloat(liveGridStyles.paddingTop || '0') || 0;
        const livePadBottom = parseFloat(liveGridStyles.paddingBottom || '0') || 0;
        const liveCardSize = firstCard ? firstCard.getBoundingClientRect().height : 0;

        let cardSize = liveCardSize;
        let gap = liveGap;
        let padTop = livePadTop;
        let padBottom = livePadBottom;

        if (!Number.isFinite(cardSize) || cardSize <= 0) {
            const measured = measurePhotoCardGeometry();
            if (!measured) return null;
            cardSize = measured.cardSize;
            gap = measured.gap;
            padTop = measured.padTop;
            padBottom = measured.padBottom;
        }

        const totalHeight = padTop + padBottom + (rows * cardSize) + (Math.max(0, rows - 1) * gap);
        return Math.ceil(totalHeight);
    }

    function updatePhotoViewportHeight(itemCount) {
        if (!countryMapViewport) return;
        const totalHeight = computePhotoViewportHeight(itemCount);
        if (!Number.isFinite(totalHeight) || totalHeight <= 0) return;
        countryMapViewport.style.height = `${totalHeight}px`;
    }

    function estimateExpandedPanelWidth() {
        const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
        const isPhone = window.matchMedia('(max-width: 600px)').matches;
        const baseTarget = Math.min(viewportW * (isPhone ? 0.9 : 0.48), isPhone ? 420 : 760);
        if (isPhone) return Math.max(0, baseTarget);
        if (!globeWrap || !canvas) return Math.max(0, baseTarget);

        const wrapW = globeWrap.clientWidth || viewportW;
        const globeW = parseFloat(canvas.style.width) || canvas.getBoundingClientRect().width || 0;
        const available = Math.max(0, wrapW - globeW - 6);
        return Math.max(0, Math.min(baseTarget, available || baseTarget));
    }

    function ensurePhotoMeasureNodes() {
        if (photoMeasureNodes && photoMeasureNodes.host && document.body.contains(photoMeasureNodes.host)) {
            return photoMeasureNodes;
        }
        const host = document.createElement('div');
        host.style.position = 'absolute';
        host.style.left = '-99999px';
        host.style.top = '0';
        host.style.visibility = 'hidden';
        host.style.pointerEvents = 'none';
        host.style.zIndex = '-1';

        const shell = document.createElement('div');
        shell.className = 'country-map-shell';
        shell.style.padding = '2px';

        const viewport = document.createElement('div');
        viewport.id = 'country-map-viewport-measure';
        viewport.style.position = 'relative';
        viewport.style.width = '100%';
        viewport.style.height = 'auto';
        viewport.style.overflow = 'visible';
        viewport.style.border = '1px solid transparent';
        viewport.style.borderRadius = '0';
        viewport.style.background = 'transparent';

        const grid = document.createElement('div');
        grid.className = 'focus-photo-grid';
        grid.style.height = 'auto';
        grid.style.overflow = 'visible';

        const card = document.createElement('div');
        card.className = 'photo-card';
        grid.appendChild(card);
        viewport.appendChild(grid);
        shell.appendChild(viewport);
        host.appendChild(shell);
        document.body.appendChild(host);

        photoMeasureNodes = { host, shell, grid, card };
        return photoMeasureNodes;
    }

    function measurePhotoCardGeometry() {
        const width = estimateExpandedPanelWidth();
        if (!Number.isFinite(width) || width <= 0) return null;
        const nodes = ensurePhotoMeasureNodes();
        if (!nodes || !nodes.shell || !nodes.grid || !nodes.card) return null;

        nodes.shell.style.width = `${width}px`;
        const gridStyles = window.getComputedStyle(nodes.grid);
        const gap = parseFloat(gridStyles.rowGap || gridStyles.gap || '0') || 0;
        const padTop = parseFloat(gridStyles.paddingTop || '0') || 0;
        const padBottom = parseFloat(gridStyles.paddingBottom || '0') || 0;
        const cardSize = nodes.card.getBoundingClientRect().height;
        if (!Number.isFinite(cardSize) || cardSize <= 0) return null;

        return { cardSize, gap, padTop, padBottom };
    }

    function renderCountryPhotoGrid(countryId, opts = {}) {
        if (!focusPhotoGrid) return;
        const v = VISITS[countryId];
        const photos = (v && Array.isArray(v.photos)) ? v.photos : [];
        focusPhotoGrid.innerHTML = '';
        const lightboxMeta = [];

        const renderList = photos.length ? photos : [null];
        renderList.forEach((photo, i) => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            const fallbackPlace = (v && v.places && v.places[i % v.places.length]) || 'Travel memory';
            const fallbackDesc = `${(v && v.name) || 'Country'} · ${fallbackPlace} (${i + 1})`;
            const meta = getTravelPhotoMeta(v, photo, i, fallbackDesc);

            if (meta && meta.src) {
                card.classList.add('has-photo');
                card.dataset.src = meta.src;
                const photoIndex = lightboxMeta.push(meta) - 1;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'photo-card-button';
                const img = document.createElement('img');
                img.alt = `${(v && v.name) || 'Country'} ${i + 1}`;
                setPhotoAlbedo(img, meta, !!window.viewportLazy && !!meta.thumbSrc && meta.thumbSrc !== meta.src);
                if (window.viewportLazy) {
                    window.viewportLazy.observe(img, { root: focusPhotoGrid, src: meta.thumbSrc || meta.src });
                } else {
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.src = meta.src;
                }
                btn.appendChild(img);
                btn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    openLightboxAt(lightboxMeta, photoIndex);
                });
                card.appendChild(btn);
            } else {
                card.classList.add('photo-placeholder');
                card.innerHTML = `<span class=\"placeholder-icon\">📷</span><span class=\"placeholder-text\">Photo ${i + 1}</span>`;
            }
            focusPhotoGrid.appendChild(card);
        });
        const editExtra = window.TravelEdit ? window.TravelEdit.decorateGrid(focusPhotoGrid, countryId) : 0;

        if (!opts.skipHeightUpdate) updatePhotoViewportHeight(renderList.length + editExtra);

        if (countryMapTitle && v) countryMapTitle.textContent = `${v.name} Photos`;
        if (countryMapEmpty) countryMapEmpty.style.display = 'none';
    }

    function showCountryMapPanel(id) {
        if (!countryMapPanel || !globeWrap || !VISITS[id]) return;
        selectedCountryName = VISITS[id].name;
        renderCountryPhotoGrid(id);
        if (countryTitleTimer) {
            clearTimeout(countryTitleTimer);
            countryTitleTimer = null;
        }
        countryMapPanel.classList.remove('title-visible');
        if (countryMapTitle) {
            countryMapTitle.style.opacity = '0';
            countryMapTitle.style.transform = 'translateY(2px)';
        }
        if (focusPhotoGrid) {
            focusPhotoGrid.style.opacity = '1';
        }
        if (countryMapViewport) {
            countryMapViewport.style.setProperty('--country-grid-height-ms', `${COUNTRY_FOCUS_SCROLL_MS}ms`);
        }
        countryMapPanel.style.setProperty('--country-title-fade-ms', `${COUNTRY_TITLE_FADE_MS}ms`);
        setCountryFocusProgress(0);
        globeWrap.classList.add('country-map-active');
        countryMapPanel.setAttribute('aria-hidden', 'false');
        countryMapPanel.classList.add('open');
        // Title fade-in should happen in the second half of box appearance.
        countryTitleTimer = setTimeout(() => {
            countryTitleTimer = null;
            if (countryMapPanel && countryMapPanel.classList.contains('open') && focusedCountryId === id) {
                animateCountryTitle(true, COUNTRY_TITLE_FADE_MS);
            }
        }, COUNTRY_FOCUS_SCROLL_MS / 2);
    }

    /* pause/play button; the choice is remembered, and without one,
       reduced-motion devices start paused */
    const spinToggle = document.getElementById('globe-spin-toggle');
    const SPIN_PREF_KEY = 'travels-globe-paused';

    function setUserPaused(paused, remember) {
        userPaused = paused;
        if (spinToggle) {
            spinToggle.classList.toggle('is-paused', paused);
            const label = paused ? 'Play globe rotation' : 'Pause globe rotation';
            spinToggle.setAttribute('aria-label', label);
            spinToggle.title = paused ? 'Play rotation' : 'Pause rotation';
        }
        if (remember) {
            try { localStorage.setItem(SPIN_PREF_KEY, paused ? '1' : '0'); } catch (_) {}
        }
    }

    {
        let stored = null;
        try { stored = localStorage.getItem(SPIN_PREF_KEY); } catch (_) {}
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setUserPaused(stored === null ? reduced : stored === '1', false);
    }

    if (spinToggle) {
        spinToggle.addEventListener('click', () => {
            setUserPaused(!userPaused, true);
            if (!userPaused && !focusedCountryId && !isDetailOpen) {
                // play right away, not after the post-drag pause
                clearTimeout(autoTimer);
                autoRotate = true;
            }
        });
    }

    /* auto-rotation */
    // While it spins, a globe that was dragged to another tilt turns back to
    // the usual one (START_VIEW.lat, no roll) at the spin's own speed,
    // slowing over the last TILT_LANDING degrees so it settles rather than stops
    const TILT_LANDING = 2;
    function towards(value, target) {
        const diff = target - value;
        if (Math.abs(diff) < 0.01) return target;
        const step = INTRO_NORMAL_SPIN * Math.min(1, Math.abs(diff) / TILT_LANDING);
        return value + Math.sign(diff) * Math.min(Math.abs(diff), step);
    }

    requestAnimationFrame(function frame() {
        if (introActive) {
            if (introStartTs === null) introStartTs = performance.now();
            const t = Math.min(1, (performance.now() - introStartTs) / INTRO_MS);
            const eased = 1 - Math.pow(1 - t, 3);
            const r = proj.rotate();
            proj.rotate([INTRO_START_LON + introTurn(t), r[1], r[2]]);
            canvas.style.opacity = String(eased);
            draw();
            if (t >= 1) {
                introActive = false;
                canvas.style.opacity = '1';
            }
        }
        const spinning = !introActive && autoRotate && !userPaused && !isDetailOpen && !focusedCountryId;
        if (spinning) {
            const r = proj.rotate();
            proj.rotate([r[0] + INTRO_NORMAL_SPIN, towards(r[1], -START_VIEW.lat), towards(r[2], 0)]);
            draw();
        }
        if (spinToggle && spinning !== spinShown) {
            spinShown = spinning;
            spinToggle.classList.toggle('is-spinning', spinning);
        }
        requestAnimationFrame(frame);
    });

    function pauseAuto(ms = 3500) {
        autoRotate = false;
        clearTimeout(autoTimer);
        autoTimer = setTimeout(() => {
            if (!focusedCountryId && !isDetailOpen) autoRotate = true;
        }, ms);
    }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function shortestAngleDelta(from, to) {
        return ((to - from + 540) % 360) - 180;
    }

    function waitMs(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function animateElementOpacity(el, targetOpacity, duration, token) {
        if (!el) return Promise.resolve();
        const target = Math.max(0, Math.min(1, Number(targetOpacity) || 0));
        const start = Math.max(0, Math.min(1, parseFloat(window.getComputedStyle(el).opacity) || 0));
        const delta = target - start;
        if (Math.abs(delta) < 0.001) {
            el.style.opacity = String(target);
            return Promise.resolve();
        }
        const startTs = performance.now();
        return new Promise(resolve => {
            function tick(now) {
                if (token !== countrySwapToken) { resolve(); return; }
                const t = Math.min(1, (now - startTs) / Math.max(1, duration));
                const eased = easeInOutCubic(t);
                el.style.opacity = String(start + (delta * eased));
                if (t < 1) requestAnimationFrame(tick);
                else resolve();
            }
            requestAnimationFrame(tick);
        });
    }

    function animateViewportHeightTo(targetHeight, duration, token) {
        if (!countryMapViewport) return Promise.resolve();
        const target = Number(targetHeight);
        if (!Number.isFinite(target) || target <= 0) return Promise.resolve();
        const inlineStart = parseFloat(countryMapViewport.style.height);
        const rectStart = countryMapViewport.getBoundingClientRect().height;
        const start = (Number.isFinite(inlineStart) && inlineStart > 0)
            ? inlineStart
            : (Number.isFinite(rectStart) && rectStart > 0 ? rectStart : target);
        const delta = target - start;
        if (Math.abs(delta) < 0.5) {
            countryMapViewport.style.height = `${Math.round(target)}px`;
            return Promise.resolve();
        }
        const startTs = performance.now();
        return new Promise(resolve => {
            function tick(now) {
                if (token !== countrySwapToken) { resolve(); return; }
                const t = Math.min(1, (now - startTs) / Math.max(1, duration));
                const eased = easeInOutCubic(t);
                const h = start + (delta * eased);
                countryMapViewport.style.height = `${h.toFixed(2)}px`;
                if (t < 1) requestAnimationFrame(tick);
                else {
                    countryMapViewport.style.height = `${Math.round(target)}px`;
                    resolve();
                }
            }
            requestAnimationFrame(tick);
        });
    }

    function smoothScrollTo(targetTop, duration = 1250) {
        const startTop = window.pageYOffset || window.scrollY || 0;
        const delta = targetTop - startTop;
        if (Math.abs(delta) < 2) return Promise.resolve();
        const startTs = performance.now();
        return new Promise(resolve => {
            function step(now) {
                const t = Math.min(1, (now - startTs) / duration);
                const eased = easeInOutCubic(t);
                window.scrollTo(0, startTop + (delta * eased));
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            }
            requestAnimationFrame(step);
        });
    }

    function slowScrollToGlobeCenter(duration = COUNTRY_FOCUS_SCROLL_MS, animationToken = pendingOpenToken) {
        if (!globeContainer) return Promise.resolve();
        const startTop = window.pageYOffset || window.scrollY || 0;
        const startTs = performance.now();
        return new Promise(resolve => {
            function step(now) {
                if (animationToken !== pendingOpenToken) { resolve(); return; }
                const rect = globeContainer.getBoundingClientRect();
                const centerY = window.pageYOffset + rect.top + (rect.height / 2);
                const headerH = getHeaderHeightPx();
                const usableH = Math.max(0, window.innerHeight - headerH);
                const targetCenterInViewport = headerH + (usableH / 2);
                const targetTop = Math.max(0, centerY - targetCenterInViewport);
                const t = Math.min(1, (now - startTs) / Math.max(1, duration));
                const eased = easeInOutCubic(t);
                window.scrollTo(0, startTop + ((targetTop - startTop) * eased));
                if (t < 1) requestAnimationFrame(step);
                else {
                    window.scrollTo(0, targetTop);
                    resolve();
                }
            }
            requestAnimationFrame(step);
        });
    }

    function animateFocusOnFeature(feature, duration = COUNTRY_FOCUS_SCROLL_MS, onProgress) {
        if (!feature) return Promise.resolve();
        const centroid = d3.geoCentroid(feature);
        if (!centroid || centroid.length < 2) return Promise.resolve();

        const targetLon = centroid[0];
        const targetLat = centroid[1];
        const startRot = proj.rotate().slice();
        const startScale = currentScale;
        const deltaScale = DEFAULT_GLOBE_SCALE - startScale;
        const targetRot = [
            -targetLon,
            Math.max(-80, Math.min(80, -targetLat)),
            0
        ];
        const deltaLon = shortestAngleDelta(startRot[0], targetRot[0]);
        const deltaLat = targetRot[1] - startRot[1];

        const token = ++focusAnimToken;
        const startTs = performance.now();
        if (onProgress) onProgress(0);
        return new Promise(resolve => {
            function tick(now) {
                if (token !== focusAnimToken) { resolve(); return; }
                const t = Math.min(1, (now - startTs) / duration);
                const eased = easeInOutCubic(t);
                if (onProgress) onProgress(eased);
                currentScale = startScale + (deltaScale * eased);
                setSize(true);
                proj.rotate([
                    startRot[0] + (deltaLon * eased),
                    startRot[1] + (deltaLat * eased),
                    0
                ]);
                draw();
                if (t < 1) {
                    requestAnimationFrame(tick);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(tick);
        });
    }

    function animateRotateTo(targetRotate, duration = COUNTRY_FOCUS_SCROLL_MS, onProgress) {
        if (!targetRotate || targetRotate.length < 3) return Promise.resolve();
        const startRot = proj.rotate().slice();
        const deltaLon = shortestAngleDelta(startRot[0], targetRotate[0]);
        const deltaLat = targetRotate[1] - startRot[1];
        const deltaGamma = shortestAngleDelta(startRot[2], targetRotate[2]);
        const token = ++focusAnimToken;
        const startTs = performance.now();
        if (onProgress) onProgress(0);
        return new Promise(resolve => {
            function tick(now) {
                if (token !== focusAnimToken) { resolve(); return; }
                const t = Math.min(1, (now - startTs) / duration);
                const eased = easeInOutCubic(t);
                if (onProgress) onProgress(eased);
                proj.rotate([
                    startRot[0] + (deltaLon * eased),
                    startRot[1] + (deltaLat * eased),
                    startRot[2] + (deltaGamma * eased)
                ]);
                draw();
                if (t < 1) requestAnimationFrame(tick);
                else resolve();
            }
            requestAnimationFrame(tick);
        });
    }

    function backToGlobe() {
        if (!focusedCountryId || isDetailOpen || isUnfocusing) return;
        isUnfocusing = true;
        countrySwapToken += 1;
        isCountrySwitching = false;
        clearTimeout(autoTimer);
        autoRotate = false;
        if (countryTitleTimer) {
            clearTimeout(countryTitleTimer);
            countryTitleTimer = null;
        }
        // Fade out the title first-half while closing animation starts.
        animateCountryTitle(false, COUNTRY_TITLE_FADE_MS);
        const runClose = () => {
            const targetRotate = focusReturnRotate ? focusReturnRotate.slice() : proj.rotate().slice();
            const returnY = detailReturnScrollY !== null ? Math.max(0, detailReturnScrollY) : (window.pageYOffset || window.scrollY || 0);
            const rotateBack = animateRotateTo(targetRotate, COUNTRY_FOCUS_SCROLL_MS, (progress) => {
                const p = Math.max(0, Math.min(1, 1 - progress));
                focusedCountryBlend = p;
                // Faster fade-out while preserving the same close motion timing.
                setCountryFocusProgress(p, p * p * p);
            });
            const scrollBack = smoothScrollTo(returnY, COUNTRY_FOCUS_SCROLL_MS);

            Promise.all([rotateBack, scrollBack]).then(() => {
                focusedCountryId = null;
                focusedCountryBlend = 1;
                setCountryFocusProgress(0);
                hideCountryMapPanel();
                window.scrollTo(0, returnY);
                focusReturnRotate = null;
                detailReturnScrollY = null;
                isUnfocusing = false;
                autoRotate = true;
                const r = proj.rotate();
                proj.rotate([r[0] + INTRO_NORMAL_SPIN, r[1], r[2]]);
                draw();
            });
        };

        runClose();
    }

    async function switchFocusedCountry(nextId, feature) {
        if (!focusedCountryId || !feature || !VISITS[nextId] || nextId === focusedCountryId || isDetailOpen || isUnfocusing) return;
        const token = ++countrySwapToken;
        isCountrySwitching = true;
        clearTimeout(autoTimer);
        autoRotate = false;
        if (countryTitleTimer) {
            clearTimeout(countryTitleTimer);
            countryTitleTimer = null;
        }

        const rotateMs = COUNTRY_FOCUS_SCROLL_MS;
        const fadeOutMs = Math.max(500, Math.round(rotateMs * 0.5));
        const fadeInMs = Math.max(500, Math.round(rotateMs * 0.5));
        let heightAnimPromise = Promise.resolve();
        if (countryMapViewport) {
            countryMapViewport.style.setProperty('--country-grid-height-ms', `${rotateMs}ms`);
            const nextCount = (Array.isArray(VISITS[nextId].photos) && VISITS[nextId].photos.length)
                ? VISITS[nextId].photos.length
                : 1;
            const nextHeight = computePhotoViewportHeight(nextCount);
            if (Number.isFinite(nextHeight) && nextHeight > 0) {
                heightAnimPromise = animateViewportHeightTo(nextHeight, rotateMs, token);
            }
        }

        const fadeOutPromise = focusPhotoGrid
            ? animateElementOpacity(focusPhotoGrid, 0, fadeOutMs, token)
            : waitMs(fadeOutMs);
        animateCountryTitle(false, fadeOutMs);

        focusedCountryId = nextId;
        focusedCountryBlend = 0;

        const rotatePromise = animateFocusOnFeature(feature, rotateMs, (progress) => {
            if (token !== countrySwapToken) return;
            focusedCountryBlend = progress;
            setCountryFocusProgress(1, 1);
        });

        await fadeOutPromise;
        if (token !== countrySwapToken) return;

        renderCountryPhotoGrid(nextId, { skipHeightUpdate: true });
        if (focusPhotoGrid) focusPhotoGrid.style.opacity = '0';
        const fadeInPromise = focusPhotoGrid
            ? animateElementOpacity(focusPhotoGrid, 1, fadeInMs, token)
            : waitMs(fadeInMs);
        animateCountryTitle(true, fadeInMs);

        await Promise.all([rotatePromise, fadeInPromise, heightAnimPromise]);
        if (token !== countrySwapToken) return;
        focusedCountryBlend = 1;
        setCountryFocusProgress(1, 1);
        isCountrySwitching = false;
    }

    function focusCountryAndOpen(id, feature) {
        const token = ++pendingOpenToken;
        clearTimeout(autoTimer);
        pauseAuto();
        detailReturnScrollY = window.scrollY || window.pageYOffset || 0;
        focusReturnRotate = proj.rotate().slice();
        focusedCountryId = id;
        focusedCountryBlend = 0;
        showCountryMapPanel(id);
        slowScrollToGlobeCenter(COUNTRY_FOCUS_SCROLL_MS, token);
        animateFocusOnFeature(feature, COUNTRY_FOCUS_SCROLL_MS, (progress) => {
            if (token !== pendingOpenToken) return;
            focusedCountryBlend = progress;
            // Slow fade-in: ramp opacity more gradually during appearance.
            setCountryFocusProgress(progress, progress * progress);
        }).then(() => {
            if (token !== pendingOpenToken) return;
            focusedCountryBlend = 1;
            setCountryFocusProgress(1);
            if (hint) hint.style.opacity = '0';
        });
    }

    function ptFrom(e) {
        const rect = canvas.getBoundingClientRect();
        const src  = e.touches ? e.touches[0] : e;
        return [src.clientX - rect.left, src.clientY - rect.top];
    }

    function touchDistance(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.hypot(dx, dy);
    }

    // Pointer position -> canvas drawing coordinates (the container may be
    // scaled down by CSS while a country is focused)
    function canvasPoint([x, y]) {
        const rect = canvas.getBoundingClientRect();
        const baseW = parseFloat(canvas.style.width) || canvas.clientWidth || rect.width;
        const baseH = parseFloat(canvas.style.height) || canvas.clientHeight || rect.height;
        const scaleX = rect.width > 0 ? (baseW / rect.width) : 1;
        const scaleY = rect.height > 0 ? (baseH / rect.height) : 1;
        return [x * scaleX, y * scaleY];
    }

    function countryAt(pt) {
        if (!worldGeo) return null;
        const inv = proj.invert(canvasPoint(pt));
        if (!inv) return null;
        return visibleCountries.find(f => { try { return d3.geoContains(f, inv); } catch (_) { return false; } });
    }

    function pinAt(pt) {
        const [x, y] = canvasPoint(pt);
        let best = null, bestDist = Infinity;
        pinScreen.forEach(d => {
            const dist = Math.hypot(d.x - x, d.y - y);
            if (dist <= Math.max(7, d.r + 4) && dist < bestDist) { best = d; bestDist = dist; }
        });
        return best;
    }

    // The map shape of a country, or for one too small for this map (e.g.
    // Singapore) the points of its pins, so it can still be focused
    function featureFor(id) {
        const f = worldGeo && worldGeo.features.find(x => +x.id === id);
        if (f) return f;
        const pins = VISITS[id] && VISITS[id].pins;
        return pins && pins.length ? { type: 'MultiPoint', coordinates: pins.map(p => [p.lng, p.lat]) } : null;
    }

    // What a click/tap lands on: a pin first, then a country
    function targetAt(pt) {
        const pin = pinAt(pt);
        if (pin) return { id: pin.id, feature: featureFor(pin.id) };
        const f = countryAt(pt);
        return f ? { id: +f.id, feature: f } : null;
    }

    /* ---- drag (mouse) ---- */
    canvas.addEventListener('mousedown', e => {
        if (focusedCountryId) return;
        isDragging = false;
        pauseAuto();
        const p0 = ptFrom(e);
        const r0 = proj.rotate();
        canvas.style.cursor = 'grabbing';
        function mv(ev) {
            const p1 = ptFrom(ev);
            const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging = true;
            proj.rotate([r0[0] + dx * 0.28, Math.max(-80, Math.min(80, r0[1] - dy * 0.28)), r0[2]]);
            draw();
        }
        function up() {
            canvas.style.cursor = 'grab';
            window.removeEventListener('mousemove', mv);
            window.removeEventListener('mouseup', up);
            setTimeout(() => { isDragging = false; }, 10); // reset AFTER click fires
        }
        window.addEventListener('mousemove', mv);
        window.addEventListener('mouseup', up);
    });

    /* ---- touch: one-finger rotate + two-finger pinch zoom ---- */
    canvas.addEventListener('touchstart', e => {
        if (focusedCountryId) return;
        pauseAuto();
        if (e.touches.length >= 2) {
            e.preventDefault();
            isPinching = true;
            isDragging = true;
            suppressTap = true;
            pinchStartDist = touchDistance(e.touches[0], e.touches[1]) || 1;
            pinchStartScale = currentScale;
            touchRotateOrigin = null;
            touchRotateStart = null;
            return;
        }
        if (e.touches.length === 1) {
            e.preventDefault();
            isPinching = false;
            isDragging = false;
            touchRotateOrigin = ptFrom(e);
            touchRotateStart = proj.rotate().slice();
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        if (e.touches.length >= 2) {
            e.preventDefault();
            const dist = touchDistance(e.touches[0], e.touches[1]) || pinchStartDist || 1;
            if (!isPinching) {
                isPinching = true;
                pinchStartDist = dist;
                pinchStartScale = currentScale;
            }
            const factor = dist / Math.max(1, pinchStartDist);
            currentScale = Math.max(MIN_GLOBE_SCALE, Math.min(MAX_GLOBE_SCALE, pinchStartScale * factor));
            setSize(true);
            draw();
            isDragging = true;
            suppressTap = true;
            return;
        }

        if (e.touches.length === 1 && !isPinching) {
            if (!touchRotateOrigin || !touchRotateStart) {
                touchRotateOrigin = ptFrom(e);
                touchRotateStart = proj.rotate().slice();
            }
            e.preventDefault();
            const p1 = ptFrom(e);
            const dx = p1[0] - touchRotateOrigin[0];
            const dy = p1[1] - touchRotateOrigin[1];
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                isDragging = true;
                suppressTap = true;
            }
            proj.rotate([touchRotateStart[0] + dx * 0.28, Math.max(-80, Math.min(80, touchRotateStart[1] - dy * 0.28)), touchRotateStart[2]]);
            draw();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        if (e.touches.length === 1 && isPinching) {
            // Continue with one-finger rotate after pinch ends with one finger still down.
            isPinching = false;
            const t = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            touchRotateOrigin = [t.clientX - rect.left, t.clientY - rect.top];
            touchRotateStart = proj.rotate().slice();
            return;
        }
        if (e.touches.length === 0) {
            isPinching = false;
            touchRotateOrigin = null;
            touchRotateStart = null;
            setTimeout(() => { isDragging = false; }, 10);
        }
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
        isPinching = false;
        touchRotateOrigin = null;
        touchRotateStart = null;
        isDragging = false;
    }, { passive: true });

    /* ---- zoom ---- */
    // Only over the globe and its atmosphere; elsewhere (the canvas corners,
    // which the round canvas hides) the wheel scrolls the page as usual
    function onGlobe(pt) {
        const [x, y] = canvasPoint(pt);
        const [cx, cy] = proj.translate();
        return Math.hypot(x - cx, y - cy) <= proj.scale() + ATMOSPHERE_PX;
    }

    // A wheel/trackpad gesture belongs to whatever it started on, until it
    // stops (a short gap between events, which includes trackpad momentum):
    // one that starts on the globe keeps zooming, without scrolling the page,
    // even once the globe has shrunk out from under the pointer or hit its
    // zoom limit; one that starts as a page scroll keeps scrolling when the
    // globe slides under the pointer.
    const WHEEL_GESTURE_GAP_MS = 250;
    let wheelOwner = null;   // 'globe' | 'page' for the gesture in progress
    let wheelEndTimer = null;

    window.addEventListener('wheel', e => {
        clearTimeout(wheelEndTimer);
        wheelEndTimer = setTimeout(() => { wheelOwner = null; }, WHEEL_GESTURE_GAP_MS);
        if (!wheelOwner) {
            wheelOwner = (e.target === canvas && !focusedCountryId && onGlobe(ptFrom(e))) ? 'globe' : 'page';
        }
        if (wheelOwner !== 'globe') return;
        e.preventDefault();
        if (focusedCountryId) return;
        pauseAuto();
        const factor = e.deltaY > 0 ? 0.90 : 1.11;
        currentScale = Math.max(MIN_GLOBE_SCALE, Math.min(MAX_GLOBE_SCALE, currentScale * factor));
        setSize(true);
        draw();
    }, { passive: false });

    /* ---- hover ---- */
    canvas.addEventListener('mousemove', e => {
        if (isDragging) { tooltip.classList.remove('visible'); return; }
        const p = ptFrom(e);
        const pin = pinAt(p);
        const f = pin ? null : countryAt(p);
        const id = pin ? pin.id : (f ? +f.id : null);
        const pinChanged = (pin ? pin.pin : null) !== (hoveredPin ? hoveredPin.pin : null);
        hoveredPin = pin;
        if (id !== hoveredId || pinChanged) { hoveredId = id; draw(); }
        if (pin) {
            const place = pin.pin;
            canvas.style.cursor = 'pointer';
            tooltip.querySelector('.tooltip-country').textContent = VISITS[pin.id].name;
            const ul = tooltip.querySelector('.tooltip-places');
            ul.innerHTML = '';
            const li = document.createElement('li');
            li.textContent = place.region && place.region !== place.name ? `${place.name} · ${place.region}` : place.name;
            ul.appendChild(li);
            tooltip.querySelector('.tooltip-hint').textContent = 'click to focus map →';
        } else if (f) {
            const isVisited = visitedIds.has(id);
            canvas.style.cursor = isVisited ? 'pointer' : 'grab';
            const countryName = isVisited ? VISITS[id].name : (f.properties && (f.properties.name || f.properties.NAME)) || 'Unknown';
            tooltip.querySelector('.tooltip-country').textContent = countryName;
            const ul = tooltip.querySelector('.tooltip-places');
            ul.innerHTML = '';
            if (isVisited) {
                if (Array.isArray(VISITS[id].places) && VISITS[id].places.length) {
                    VISITS[id].places.forEach(c => {
                        const li = document.createElement('li');
                        li.textContent = c;
                        ul.appendChild(li);
                    });
                } else {
                    const li = document.createElement('li');
                    li.textContent = 'No places added yet';
                    ul.appendChild(li);
                }
            }
            tooltip.querySelector('.tooltip-hint').textContent = isVisited ? 'click to focus map →' : 'Not visited yet!';
        }
        if (pin || f) {
            const cr = document.getElementById('globe-container').getBoundingClientRect();
            let tx = e.clientX - cr.left + 16, ty = e.clientY - cr.top - 10;
            const tw = tooltip.offsetWidth || 160, th = tooltip.offsetHeight || 100;
            if (tx + tw > cr.width  - 8) tx = e.clientX - cr.left - tw - 16;
            if (ty + th > cr.height - 8) ty = e.clientY - cr.top  - th - 10;
            tooltip.style.left = tx + 'px'; tooltip.style.top = ty + 'px';
            tooltip.setAttribute('aria-hidden', 'false');
            tooltip.classList.add('visible');
        } else {
            canvas.style.cursor = 'grab';
            tooltip.classList.remove('visible');
            tooltip.setAttribute('aria-hidden', 'true');
        }
    });

    canvas.addEventListener('mouseleave', () => { hoveredId = null; hoveredPin = null; tooltip.classList.remove('visible'); draw(); });

    /* ---- click ---- */
    function openTarget(target) {
        const nextId = target ? target.id : null;
        const isVisited = !!(target && visitedIds.has(nextId));
        if (focusedCountryId) {
            if (isVisited && nextId !== focusedCountryId) {
                switchFocusedCountry(nextId, target.feature);
            } else if (!isVisited) {
                backToGlobe();
            }
            return;
        }
        if (isVisited) focusCountryAndOpen(nextId, target.feature);
    }

    canvas.addEventListener('click', e => {
        if (isDragging) return;
        openTarget(targetAt(ptFrom(e)));
    });

    canvas.addEventListener('touchend', e => {
        if (isDragging || isPinching || suppressTap) {
            suppressTap = false;
            return;
        }
        const t = e.changedTouches[0], r = canvas.getBoundingClientRect();
        openTarget(targetAt([t.clientX - r.left, t.clientY - r.top]));
    });

    /* dismiss hint */
    ['mousedown', 'touchstart'].forEach(ev => canvas.addEventListener(ev, () => { if (hint) hint.style.opacity = '0'; }, { once: true }));

    /* ====================================================== DETAIL PANEL */
    function openDetail(id, opts = {}) {
        if (!opts.preserveReturnScroll) {
            detailReturnScrollY = window.scrollY || window.pageYOffset || 0;
        }
        const v = VISITS[id];
        const selectedPlace = opts.place || null;
        const scopedPhotos = Array.isArray(opts.photos) ? opts.photos : null;
        const photosToRender = scopedPhotos !== null ? scopedPhotos : (Array.isArray(v.photos) ? v.photos : []);
        detail.querySelector('.detail-country-name').textContent = v.name;
        detail.querySelector('.detail-places-list').textContent  = selectedPlace
            ? selectedPlace
            : ((Array.isArray(v.places) && v.places.length) ? v.places.join(' · ') : 'No places added yet');
        const grid = document.getElementById('detail-photos'); grid.innerHTML = '';
        const lightboxMeta = [];
        const renderList = photosToRender.length ? photosToRender : [null];
        renderList.forEach((photo, i) => {
            const card = document.createElement('div'); card.className = 'photo-card';
            const fallbackPlace = selectedPlace || ((v.places && v.places[i % v.places.length]) || 'Travel memory');
            const fallbackDesc = `${v.name} · ${fallbackPlace} (${i + 1})`;
            const meta = getTravelPhotoMeta(v, photo, i, fallbackDesc);
            if (meta && meta.src) {
                card.classList.add('has-photo');
                card.dataset.src = meta.src;
                const photoIndex = lightboxMeta.push(meta) - 1;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'photo-card-button';
                const img = document.createElement('img');
                img.alt = v.name + ' ' + (i + 1);
                setPhotoAlbedo(img, meta, !!window.viewportLazy && !!meta.thumbSrc && meta.thumbSrc !== meta.src);
                if (window.viewportLazy) {
                    window.viewportLazy.observe(img, { root: grid, src: meta.thumbSrc || meta.src });
                } else {
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.src = meta.src;
                }
                btn.appendChild(img);
                btn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    openLightboxAt(lightboxMeta, photoIndex);
                });
                card.appendChild(btn);
            } else {
                card.classList.add('photo-placeholder');
                card.innerHTML = '<span class="placeholder-icon">📷</span><span class="placeholder-text">Photo ' + (i + 1) + '</span>';
            }
            card.style.animationDelay = (i * 55) + 'ms'; grid.appendChild(card);
        });
        if (window.TravelEdit) window.TravelEdit.decorateGrid(grid, id);
        detail.classList.remove('closing');
        detail.setAttribute('aria-hidden', 'false');
        // reflow to restart keyframe animation on repeated opens
        void detail.offsetWidth;
        detail.classList.add('open');
        document.body.classList.add('travel-detail-open');
        isDetailOpen = true;
        autoRotate = false;
        clearTimeout(autoTimer);
    }

    document.querySelector('.detail-close').addEventListener('click', () => {
        if (!detail.classList.contains('open') || detail.classList.contains('closing')) return;
        detail.classList.remove('open');
        detail.classList.add('closing');
        isDetailOpen = false;
        autoRotate = false;
        focusedCountryId = null;
        focusedCountryBlend = 1;
        focusReturnRotate = null;
        hideCountryMapPanel();
        draw();

        const finalizeClose = () => {
            detail.classList.remove('closing');
            detail.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('travel-detail-open');
            detail.removeEventListener('animationend', onCloseAnimationEnd);
        };
        const onCloseAnimationEnd = (ev) => {
            if (ev && ev.animationName !== 'travel-detail-out') return;
            finalizeClose();
        };
        detail.addEventListener('animationend', onCloseAnimationEnd);
        setTimeout(finalizeClose, 460);

        if (detailReturnScrollY !== null) {
            const returnY = detailReturnScrollY;
            detailReturnScrollY = null;
            smoothScrollTo(returnY, COUNTRY_FOCUS_SCROLL_MS).then(() => {
                if (!isDetailOpen) autoRotate = true;
            });
        } else {
            autoRotate = true;
        }
    });

    /* ====================================================== INIT */
    syncTravelsHeaderOffset();
    setSize(false);
    proj.rotate([INTRO_START_LON, -START_VIEW.lat, 0]);
    canvas.style.opacity = '0';
    canvas.style.cursor = 'grab';
    draw();

    window.addEventListener('resize', () => { syncTravelsHeaderOffset(); setSize(false); draw(); });
    window.addEventListener('resize', () => {
        if (focusedCountryId && countryMapPanel && countryMapPanel.classList.contains('open')) {
            renderCountryPhotoGrid(focusedCountryId);
        } else if (countryMapViewport) {
            countryMapViewport.style.height = '';
        }
    });
    if (countryMapBackBtn) countryMapBackBtn.addEventListener('click', backToGlobe);
    if (lightboxCloseEl) {
        lightboxCloseEl.addEventListener('click', closeLightbox);
        lightboxCloseEl.addEventListener('click', (event) => event.stopPropagation());
    }
    if (lightboxPrevEl) {
        lightboxPrevEl.addEventListener('click', prevLightboxPhoto);
        lightboxPrevEl.addEventListener('click', (event) => event.stopPropagation());
    }
    if (lightboxNextEl) {
        lightboxNextEl.addEventListener('click', nextLightboxPhoto);
        lightboxNextEl.addEventListener('click', (event) => event.stopPropagation());
    }
    if (lightboxEl) {
        lightboxEl.addEventListener('click', (event) => {
            if (event.target === lightboxEl) closeLightbox();
        });
    }
    // Hooks for the travel editor (scripts/travel-edit.js)
    // After VISITS changed: recount the stats and redraw
    function refreshVisits() {
        computeVisits();
        if (statsAnimated) {
            const values = statValues();
            Object.keys(values).forEach(id => { document.getElementById(id).textContent = values[id]; });
        }
        if (hoveredPin && !(VISITS[hoveredPin.id] && VISITS[hoveredPin.id].pins.includes(hoveredPin.pin))) hoveredPin = null;
        draw();
    }

    // Turn the globe to a place ({lat, lng}) or a country ({id}), and hold
    // still for a while so it can be looked at
    function lookAt(target) {
        if (!target || focusedCountryId || isDetailOpen || introActive) return;
        let ll = null;
        if (Number.isFinite(target.lat) && Number.isFinite(target.lng)) ll = [target.lng, target.lat];
        else if (target.id != null) {
            const f = featureFor(Number(target.id));
            if (f) ll = d3.geoCentroid(f);
        }
        if (!ll && target.fallback) ll = target.fallback;
        if (!ll) return;
        pauseAuto(9000);
        animateRotateTo([-ll[0], Math.max(-80, Math.min(80, -ll[1])), 0], 1100);
    }

    function highlight(id) {
        if (focusedCountryId) return;
        hoveredId = id == null ? null : Number(id);
        hoveredPin = null;
        draw();
    }

    window.TravelPage = {
        openLightbox: openLightboxAt,
        focusGrid: focusPhotoGrid,
        updateFocusGridHeight: updatePhotoViewportHeight,
        refreshVisits: refreshVisits,
        lookAt: lookAt,
        highlight: highlight,
        // false for countries too small for the globe's map (pins only)
        hasShape: (id) => !worldGeo || worldGeo.features.some(f => +f.id === Number(id))
    };
    document.addEventListener('keydown', (e) => {
        if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;
        const lightboxOpen = !!(lightboxEl && lightboxEl.classList.contains('open'));
        if (e.key === 'Escape' && lightboxOpen) {
            closeLightbox();
            return;
        }
        if ((e.key === 'ArrowRight' || e.key === 'Right') && lightboxOpen) {
            nextLightboxPhoto();
            return;
        }
        if ((e.key === 'ArrowLeft' || e.key === 'Left') && lightboxOpen) {
            prevLightboxPhoto();
            return;
        }
        if (e.key === 'Escape' && focusedCountryId && !isDetailOpen) backToGlobe();
    });
    new MutationObserver(() => {
        syncTravelsHeaderOffset();
        draw();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const headerEl = document.querySelector('header');
    if (headerEl) {
        new MutationObserver(syncTravelsHeaderOffset).observe(headerEl, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    // Smallest circle-ish bound around a shape: its centroid, and the
    // furthest of its points from it
    function boundingCircle(geometry, points) {
        const c = d3.geoCentroid(geometry);
        let r = 0;
        points.forEach(p => { r = Math.max(r, d3.geoDistance(c, p)); });
        return { c, r };
    }

    function pointsOf(geometry) {
        const out = [];
        const walk = (a) => { if (typeof a[0] === 'number') out.push(a); else a.forEach(walk); };
        if (geometry && geometry.coordinates) walk(geometry.coordinates);
        return out;
    }

    function shapesOf(collection) {
        return collection.features.map(feature => Object.assign({ feature }, boundingCircle(feature, pointsOf(feature.geometry || feature))));
    }

    function linesOf(mesh) {
        return mesh.coordinates.map(coords => Object.assign({ coords }, boundingCircle({ type: 'LineString', coordinates: coords }, coords)));
    }

    // Natural Earth 1:50m countries and large lakes, simplified for the globe
    // (data/world-map.json, built by npm run travel:map)
    d3.json('data/world-map.json').then(world => {
        const countries = world.objects.countries;
        worldGeo = topojson.feature(world, countries);
        countryShapes = shapesOf(worldGeo);
        const land = topojson.merge(world, countries.geometries);
        landShapes = shapesOf({ features: land.coordinates.map(rings => ({ type: 'Polygon', coordinates: rings })) });
        lakeShapes = shapesOf(topojson.feature(world, world.objects.lakes));
        borderLines = linesOf(topojson.mesh(world, countries, (a, b) => a !== b));
        draw();
    }).catch(() => {
        document.getElementById('globe-wrap').innerHTML = '<p style="color:#888;text-align:center;padding:80px">Globe failed to load — check network settings.</p>';
    });
