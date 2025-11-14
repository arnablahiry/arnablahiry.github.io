const pauseBtn = document.getElementById('pause-scroll');
let isPaused = false;

// SVG icons (inline) for consistent sizing across platforms
const pauseSvg = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect x="5" y="4" width="4" height="16" fill="currentColor" />
    <rect x="15" y="4" width="4" height="16" fill="currentColor" />
  </svg>`;

const playSvg = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <polygon points="6,4 20,12 6,20" fill="currentColor" />
  </svg>`;



// Track whether the icon change was initiated locally (by this script)
let _localIconUpdate = false;
let _lastIconState = 'pause'; // 'pause' or 'play'

function _setIconSafe(icon){
  if (!pauseBtn) return;
  _localIconUpdate = true;
  if (icon === 'pause'){
    pauseBtn.innerHTML = pauseSvg;
    _lastIconState = 'pause';
  } else {
    pauseBtn.innerHTML = playSvg;
    _lastIconState = 'play';
  }
  // reset the flag on the next tick so external changes can be detected afterwards
  setTimeout(()=> { _localIconUpdate = false; }, 0);
}

// replace direct render functions to use safe setter and update state
function renderPauseIconScroll(){ _setIconSafe('pause'); }
function renderPlayIconScroll(){ _setIconSafe('play'); }

// Prevent external scripts from changing the pause button's innerHTML directly.
// We override the `innerHTML` property on the specific button instance so
// only local updates (when _localIconUpdate is true) are allowed to set it.
if (pauseBtn){
  try {
    const protoDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML') || Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerHTML');
    if (protoDesc && protoDesc.get && protoDesc.set){
      Object.defineProperty(pauseBtn, 'innerHTML', {
        configurable: true,
        get() { return protoDesc.get.call(this); },
        set(v) {
          if (_localIconUpdate) return protoDesc.set.call(this, v);
          // ignore external attempts to set innerHTML
        }
      });
    }
  } catch (e){ /* defensive: if this fails, fall back to MutationObserver */ }
}

function getCrawl(){
  return document.getElementById('crawl');
}
// Intro scheduler: control intro/photo/text start times using a virtual clock
// so we can pause the timer while the crawl is paused. This ensures the
// intro never appears while paused and is delayed by the paused duration.
const _introEls = [];
let _introInitialized = false;
let _virtualStart = null; // timestamp when page started (ms)
let _pausedAccum = 0; // total ms paused so far
let _pauseStartTs = null; // if currently paused, ts when paused started
let _rafId = null;

function _parseTimeToSeconds(t){
  if (!t) return 0;
  t = (''+t).trim();
  if (t.endsWith('ms')) return parseFloat(t)/1000;
  if (t.endsWith('s')) return parseFloat(t);
  return parseFloat(t) || 0;
}

function _initIntroScheduler(){
  if (_introInitialized) return;
  _introInitialized = true;
  _virtualStart = Date.now();
  const section = document.querySelector('.intro-section');
  const photo = document.querySelector('.intro-photo');
  const text = document.querySelector('.intro-text');
  const elems = [section, photo, text].filter(Boolean);
  elems.forEach(el => {
    const cs = window.getComputedStyle(el);
    // skip if already visible
    if (parseFloat(cs.opacity) > 0) return;
  // capture computed animation properties and delay (take first value if comma-separated)
  const name = (cs.animationName || cs.getPropertyValue('animation-name') || '').split(',')[0].trim();
  const duration = (cs.animationDuration || cs.getPropertyValue('animation-duration') || '0s').split(',')[0].trim();
  const timing = (cs.animationTimingFunction || cs.getPropertyValue('animation-timing-function') || 'ease').split(',')[0].trim();
  const iteration = (cs.animationIterationCount || cs.getPropertyValue('animation-iteration-count') || '1').split(',')[0].trim();
  const direction = (cs.animationDirection || cs.getPropertyValue('animation-direction') || 'normal').split(',')[0].trim();
  const fill = (cs.animationFillMode || cs.getPropertyValue('animation-fill-mode') || 'forwards').split(',')[0].trim();
  const delay = (cs.animationDelay || cs.getPropertyValue('animation-delay') || '0s').split(',')[0].trim();
  const delaySec = _parseTimeToSeconds(delay);
    // store metadata (we'll reconstruct the shorthand when starting with delay 0 so it plays immediately)
    _introEls.push({ el, name, duration, timing, iteration, direction, fill, delaySec, relative: 0, started: false });
    // prevent automatic CSS animation from starting
    el.style.animation = 'none';
    el.style.opacity = el.style.opacity || '0';
  });
  // kick the RAF loop
  // sort by scheduled delay so we can preserve ordering and compute relative offsets
  _introEls.sort((a,b)=> a.delaySec - b.delaySec);
  if (_introEls.length){
    const base = _introEls[0].delaySec;
    _introEls.forEach(m => { m.relative = Math.max(0, m.delaySec - base); });
    _introEls._base = base;
  }
  _rafLoop();
}

function _rafLoop(){
  _rafId = requestAnimationFrame(()=>{
    const now = Date.now();
    const virtualElapsedMs = now - _virtualStart - _pausedAccum;
    const virtualElapsedSec = virtualElapsedMs / 1000;
    // ensure we have a base scheduled time
    const base = _introEls._base || 0;
    // last started virtual-second timestamp to avoid large gaps
    if (typeof _introEls._lastStarted === 'undefined') _introEls._lastStarted = null;
    const MAX_GAP = 0.8; // seconds: maximum allowed gap between sequential intro items
    _introEls.forEach(meta => {
      if (meta.started) return;
      const scheduled = (base + meta.relative);
      // desired start time is scheduled; but cap to lastStarted + MAX_GAP to avoid long gaps
      let effectiveStart = scheduled;
      if (_introEls._lastStarted !== null){
        effectiveStart = Math.min(scheduled, _introEls._lastStarted + MAX_GAP);
      }
      if (virtualElapsedSec >= effectiveStart){
        if (meta.name && meta.name !== 'none'){
          const anim = `${meta.name} ${meta.duration} ${meta.timing} 0s ${meta.iteration} ${meta.direction} ${meta.fill}`;
          meta.el.style.animation = anim;
          meta.el.style.animationDelay = '0s';
        } else {
          meta.el.style.removeProperty('animation');
        }
        // When any intro element starts, mark the intro section as visible
        try {
          const sectionEl = document.querySelector('.intro-section');
          if (sectionEl && !sectionEl.classList.contains('visible')){
            sectionEl.classList.add('visible');
          }
        } catch(e){}
        meta.started = true;
        _introEls._lastStarted = Math.max(_introEls._lastStarted || 0, virtualElapsedSec);
      }
    });
    // keep looping until all started
    if (_introEls.some(m => !m.started)) _rafLoop(); else _rafId = null;
  });
}

function _pauseVirtualClock(){
  if (_pauseStartTs !== null) return; // already paused
  _pauseStartTs = Date.now();
}

function _resumeVirtualClock(){
  if (_pauseStartTs === null) return;
  _pausedAccum += (Date.now() - _pauseStartTs);
  _pauseStartTs = null;
}

// Initialize scheduler on DOM ready
if (document.readyState === 'complete' || document.readyState === 'interactive'){
  setTimeout(_initIntroScheduler, 20);
} else {
  document.addEventListener('DOMContentLoaded', _initIntroScheduler);
}

/**
 * Set the paused state of the crawl.
 * @param {boolean} paused - true to pause the crawl, false to resume
 * @param {object} [opts] - options
 * @param {boolean} [opts.updateIcon=false] - whether to update the pause/play icon
 *   Note: by default external callers SHOULD NOT change the icon. Only the
 *   user clicking the pause button will pass updateIcon=true.
 */
function setPauseState(paused, opts = {}){
  const { updateIcon = false } = opts;
  const crawl = getCrawl();
  isPaused = !!paused;
  if (!crawl) return;
  // use animation-play-state if present; otherwise toggle inline style
  crawl.style.animationPlayState = isPaused ? 'paused' : 'running';
  // pause or resume the virtual intro clock so intro timers stop while paused
  if (isPaused){
    _pauseVirtualClock();
  } else {
    _resumeVirtualClock();
  }
  if (pauseBtn && updateIcon){
    if (isPaused) renderPlayIconScroll(); else renderPauseIconScroll();
    if (isPaused){
      pauseBtn.classList.remove('active');
      pauseBtn.setAttribute('aria-pressed','true');
    } else {
      pauseBtn.classList.add('active');
      pauseBtn.setAttribute('aria-pressed','false');
    }
  }
}

function togglePause(){
  // toggle triggered by user click -> update the icon
  setPauseState(!isPaused, { updateIcon: true });
}

function disablePauseButton(){
  if (!pauseBtn) return;
  pauseBtn.disabled = true;
  pauseBtn.classList.add('disabled');
  pauseBtn.setAttribute('aria-disabled','true');
}

function enablePauseButton(){
  if (!pauseBtn) return;
  pauseBtn.disabled = false;
  pauseBtn.classList.remove('disabled');
  pauseBtn.removeAttribute('aria-disabled');
  // default to showing pause icon (running state)
  renderPauseIcon();
  isPaused = false;
  const crawl = getCrawl();
  if (crawl) crawl.style.animationPlayState = 'running';
}

if (pauseBtn){
  pauseBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    togglePause();
  });
}

// Watch for unexpected external changes to the pause button's DOM and
// restore the last known local state if they occur.
if (pauseBtn && typeof MutationObserver !== 'undefined'){
  const mo = new MutationObserver((mutations) => {
    // If we just updated the icon locally, ignore these mutations
    if (_localIconUpdate) return;
    // Otherwise, restore the last intended icon
    _setIconSafe(_lastIconState);
  });
  mo.observe(pauseBtn, { childList: true, characterData: true, subtree: true });
}

// Expose helpers so other scripts (restart/skip) can call them by querying window
window.pauseScroll = {
  disable: disablePauseButton,
  enable: enablePauseButton,
  // Expose setPauseState but by default do NOT change the icon unless explicitly requested
  setPauseState
};

// Mark the intro as shown so the intro scheduler won't re-run or restart animations.
// Accepts an options object to mark specific intro elements without forcibly
// overriding styles (so manual transitions can still play):
//   { section: true, photo: true, text: true, forceStyles: false }
function _markIntroShown(opts = {}){
  const { section = true, photo = true, text = true, forceStyles = false } = opts;
  // ensure scheduler has at least attempted initialization
  try { _initIntroScheduler(); } catch(e){}
  // stop RAF loop
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  // mark requested intro metas as started
  _introEls.forEach(meta => {
    try {
      const el = meta.el;
      if (!el) return;
      const isSection = el.classList && el.classList.contains('intro-section');
      const isPhoto = el.classList && el.classList.contains('intro-photo');
      const isText = el.classList && el.classList.contains('intro-text');
      if ((isSection && section) || (isPhoto && photo) || (isText && text)){
        meta.started = true;
        if (forceStyles){
          meta.el.style.animation = 'none';
          meta.el.style.animationDelay = '0s';
          meta.el.style.opacity = '1';
        }
      }
    } catch(e){}
  });
  // clear virtual clock bookkeeping
  _introEls._lastStarted = null;
}

// expose to other scripts
window.pauseScroll.markIntroShown = _markIntroShown;

// --- Auto-stop behavior: stop the crawl 10s after the intro photo + section appear ---
let _autoStopTimer = null;
let _introStartedFlags = { section: false, photo: false };

function _clearAutoStop(){ if (_autoStopTimer){ clearTimeout(_autoStopTimer); _autoStopTimer = null; } }

function _stopCrawlCompletely(){
  const crawl = getCrawl();
  if (!crawl) return;
  // remove the animation so it never restarts; also ensure it's not running
  crawl.style.animation = 'none';
  crawl.style.animationPlayState = 'paused';
}

function _maybeScheduleAutoStop(){
  if (_autoStopTimer) return; // already scheduled
  if (_introStartedFlags.section && _introStartedFlags.photo){
    // schedule a real-time 10s delay from when both appeared
    _autoStopTimer = setTimeout(()=>{
      _stopCrawlCompletely();
      _autoStopTimer = null;
    }, 10000);
  }
}

function _attachIntroAutoStopListeners(){
  const section = document.querySelector('.intro-section');
  const photo = document.querySelector('.intro-photo');
  if (section){
    // if it's already visible (animation already applied), mark as started
    const cs = window.getComputedStyle(section);
    if (parseFloat(cs.opacity) > 0){ _introStartedFlags.section = true; }
    section.addEventListener('animationstart', ()=>{
      _introStartedFlags.section = true;
      _maybeScheduleAutoStop();
    }, { once: true });
  }
  if (photo){
    const cs2 = window.getComputedStyle(photo);
    if (parseFloat(cs2.opacity) > 0){ _introStartedFlags.photo = true; }
    photo.addEventListener('animationstart', ()=>{
      _introStartedFlags.photo = true;
      _maybeScheduleAutoStop();
    }, { once: true });
  }
  // if both were already visible, schedule immediately
  _maybeScheduleAutoStop();

  // If the restart button is clicked we should cancel any pending auto-stop
  const restartBtn = document.getElementById('restart-button');
  if (restartBtn) restartBtn.addEventListener('click', _clearAutoStop);
}

if (document.readyState === 'complete' || document.readyState === 'interactive'){
  setTimeout(_attachIntroAutoStopListeners, 20);
} else {
  document.addEventListener('DOMContentLoaded', _attachIntroAutoStopListeners);
}

// expose clearAutoStop so other scripts can cancel it if needed
window.pauseScroll.clearAutoStop = _clearAutoStop;
