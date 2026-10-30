// My Current Fixations.
// - Builds the cards from window.FIXATIONS (scripts/fixations-data.js, which
//   is generated from data/fixations.xlsx), then each card's hearts
//   (data-rating, 0-5 in halves) and kind pill (data-kind). A cover's albedo
//   settings become data-albedo / data-src-light / data-src-dark.
// - Sizes each cover to the height of its text column, keeping the image's
//   aspect ratio (CSS cannot derive an image's height from a sibling).
// - Switches between All / Books / Movies / Shows / Games. The active pill is
//   mirrored in the URL hash (#books) so a filtered view can be linked to.
// - Exposes window.FixationsPage so scripts/fixations-edit.js can swap in
//   editable cards and have them sized and packed the same way.
(function(){
  var bar = document.getElementById('fixation-filters');
  var grid = document.getElementById('fixations-grid');
  var empty = document.getElementById('fixations-empty');
  if (!bar || !grid) return;

  // Same pixel heart as the footer, built from its pixel grid so a half heart
  // can fill just the left half (columns 0-2 and half of the middle column 3).
  var HEART_ROWS = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  function heartPath(maxX){
    var d = '';
    HEART_ROWS.forEach(function(row, y){
      for (var x = 0; x < row.length; x++) {
        if (row[x] !== '#' || x >= maxX) continue;
        var w = Math.min(1, maxX - x);
        d += 'M' + x + ' ' + y + 'h' + w + 'v1h-' + w + 'z';
      }
    });
    return d;
  }
  var HEART_FULL = heartPath(7), HEART_HALF = heartPath(3.5);
  function heartSvg(fill){
    var svg = '<svg class="footer-heart' + (fill === 1 ? ' is-on' : '') + '" viewBox="0 0 7 6" aria-hidden="true" focusable="false"><path d="' + HEART_FULL + '"/>';
    if (fill === 0.5) svg += '<path class="heart-half" d="' + HEART_HALF + '"/>';
    return svg + '</svg>';
  }
  function clampRating(value){
    return Math.max(0, Math.min(5, Math.round((parseFloat(value) || 0) * 2) / 2));
  }
  function heartsHtml(rating){
    var html = '';
    for (var i = 1; i <= 5; i++) html += heartSvg(i <= rating ? 1 : (i - 0.5 <= rating ? 0.5 : 0));
    return html;
  }
  var KINDS = {
    books:  { label: 'Book',  icon: 'images/fixations/books_ico.png' },
    movies: { label: 'Movie', icon: 'images/fixations/movies_ico.png' },
    shows:  { label: 'Show',  icon: 'images/fixations/tv_ico.png' },
    games:  { label: 'Game',  icon: 'images/fixations/games_ico.png' }
  };

  // --- Cards from the spreadsheet data ---
  function el(tag, className, text){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function buildCard(item){
    var card = el('article', 'fixation-card');
    card.dataset.kind = item.kind;
    card.dataset.rating = item.rating;
    if (item.image) {
      var img = el('img', 'fixation-cover');
      // albedo (set in the editor): flipped in the other theme, or a second
      // version for one theme that scripts/theme-toggle.js swaps in
      if (item.albedo) img.setAttribute('data-albedo', item.albedo);
      if (item.imageLight) img.setAttribute('data-src-light', item.imageLight);
      if (item.imageDark) img.setAttribute('data-src-dark', item.imageDark);
      img.src = item.image;
      img.alt = item.title;
      img.decoding = 'async';
      card.appendChild(img);
    }
    var body = el('div', 'fixation-body');
    body.appendChild(el('h3', 'fixation-title', item.title));
    var hearts = el('div', 'fixation-rating');
    var rating = clampRating(item.rating);
    hearts.innerHTML = heartsHtml(rating);
    hearts.setAttribute('role', 'img');
    hearts.setAttribute('aria-label', 'Rated ' + rating + ' out of 5');
    body.appendChild(hearts);
    if (item.description) body.appendChild(el('p', 'fixation-desc', item.description));
    var kind = KINDS[item.kind];
    if (kind) {
      var pill = el('span', 'fixation-pill');
      pill.innerHTML = '<img src="' + kind.icon + '" alt="" width="20" height="20" decoding="async">' + kind.label;
      body.appendChild(pill);
    }
    card.appendChild(body);
    return card;
  }
  (window.FIXATIONS || []).forEach(function(item){ grid.appendChild(buildCard(item)); });

  var buttons = Array.prototype.slice.call(bar.querySelectorAll('.filter-btn'));
  var filters = buttons.map(function(b){ return b.dataset.filter; });
  var currentKind = 'all';
  function getCards(){ return Array.prototype.slice.call(grid.querySelectorAll('.fixation-card')); }

  // --- Card size limits (not on phones, where the cover is a fixed-width
  //     strip and the text column fills the rest) ---
  // Each card has a max height (--fixation-max-height) and a max width
  // (--fixation-max-card-width, lowered to half the grid when that is still
  // roomy, so at least two cards sit side by side). Covers are never cropped.
  //   1. The text column starts as wide as the heading (a heading too long
  //      for the max width wraps instead) and the cover is as tall as the
  //      text, as wide as its image at that height.
  //   2. If that breaks a limit, the column widens to the narrowest width at
  //      which the card fits both.
  //   3. If no width does, the text is simply too long: the cover stops at
  //      the max height (lower if a wide image needs it to stay within the
  //      max width), sits at the top, and the text column runs on below it.
  // What happened is reported to FixationsPage.onCardSized so edit mode can
  // warn about cards over a limit.
  var wide = window.matchMedia('(min-width: 521px)');
  var MIN_TEXT = 200;
  var STEP = 8;
  function cssPx(name, fallback){
    return parseFloat(getComputedStyle(grid).getPropertyValue(name)) || fallback;
  }
  function measure(body, width){
    body.style.width = width === null ? '' : width + 'px';
    // edit-mode text boxes (title, description) grow with their text
    body.querySelectorAll('textarea').forEach(function(ta){
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
    return body.offsetHeight;
  }
  function limits(){
    var cs = getComputedStyle(grid);
    var gap = parseFloat(cs.getPropertyValue('--fixations-gap')) || 28;
    var avail = grid.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var maxW = Math.min(cssPx('--fixation-max-card-width', 580), avail);
    var half = Math.floor((avail - gap) / 2);
    if (half >= cssPx('--fixation-min-card-width', 440)) maxW = Math.min(maxW, half);
    return { maxH: cssPx('--fixation-max-height', 390), maxW: maxW };
  }
  // Cover width per pixel of height (the image's own aspect ratio)
  function coverAspect(cover){
    if (!cover) return 0;
    if (cover.tagName !== 'IMG') return 0;  // edit-mode placeholder: fixed width
    return cover.naturalWidth && cover.naturalHeight ? cover.naturalWidth / cover.naturalHeight : 2 / 3;
  }
  function fitCard(card, body, cover, lim){
    var border = card.offsetWidth - card.clientWidth;
    var aspect = coverAspect(cover);
    var fixedCover = cover && !aspect ? (cover.offsetWidth || 140) : 0;
    var room = lim.maxW - border - fixedCover;          // for text + an image cover
    function fitsWidth(bw, coverH){ return bw + aspect * coverH <= room; }

    card.classList.remove('fixation-title-wrap');
    var h = measure(body, null);
    var bw = body.offsetWidth;
    var coverH = h;
    var info = { titleWraps: false, overHeight: 0, overWidth: 0, maxH: lim.maxH, maxW: lim.maxW };

    if (h > lim.maxH || !fitsWidth(bw, h)) {
      // heading alone too wide for the card: let it wrap
      if (!fitsWidth(bw, Math.min(h, lim.maxH))) {
        card.classList.add('fixation-title-wrap');
        info.titleWraps = true;
        bw = MIN_TEXT;
      }
      // 2. narrowest column at which the card fits both limits
      var fits = null;
      for (var w = bw; w <= room; w += STEP) {
        var hw = measure(body, w);
        if (hw <= lim.maxH && fitsWidth(w, hw)) { fits = w; break; }
      }
      if (fits !== null) {
        bw = fits;
        h = coverH = measure(body, bw);
      } else {
        // 3. text too long: cover capped, column takes the rest of the width
        bw = Math.max(bw, Math.floor(room - aspect * lim.maxH));
        h = measure(body, bw);
        coverH = Math.min(lim.maxH, aspect ? (room - bw) / aspect : lim.maxH);
        info.overHeight = Math.max(0, h - lim.maxH);
      }
    }
    info.overWidth = Math.max(0, Math.round(bw + aspect * coverH - room));

    if (cover) {
      cover.style.height = Math.round(coverH) + 'px';
      if (cover.tagName === 'IMG') cover.style.width = 'auto';
    }
    return info;
  }
  function sizeCover(card){
    var cover = card.querySelector('.fixation-cover');
    var body = card.querySelector('.fixation-body');
    if (!body) return;
    if (!wide.matches) {
      card.classList.remove('fixation-title-wrap');
      measure(body, null);
      if (cover) { cover.style.height = ''; cover.style.width = ''; }
      return;
    }
    var info = fitCard(card, body, cover, limits());
    if (window.FixationsPage && window.FixationsPage.onCardSized) window.FixationsPage.onCardSized(card, info);
  }
  function sizeAll(){ getCards().forEach(sizeCover); schedulePack(); }

  // --- Packing: cards differ in width and height, so plain rows would leave
  //     holes under the shorter ones. Each card goes to the highest spot where
  //     it fits (skyline packing), with the same gap between cards
  //     horizontally and vertically; the block is then centred.
  //     The order is chosen for the best layout (see bestOrder): the
  //     spreadsheet order only breaks ties. In edit mode cards keep their
  //     saved order, so nothing jumps around while typing; saving reloads the
  //     normal view, which reorganises them. ---
  var packQueued = false;
  function schedulePack(){
    if (packQueued) return;
    packQueued = true;
    requestAnimationFrame(function(){ packQueued = false; pack(); });
  }

  // Places items ({w, h}) in the given order; returns positions and the score
  // (lower is better): first the total height, then how high up the cards
  // sit on average (fewer, smaller holes).
  function skyline(items, order, avail, gap){
    var sky = [{ x: 0, w: avail + gap, y: 0 }];
    var pos = new Array(items.length);
    var right = 0, bottom = 0, sumBottoms = 0;
    order.forEach(function(i){
      var w = items[i].w + gap, h = items[i].h;
      var best = null;
      sky.forEach(function(seg){
        var x = seg.x;
        if (x + w > avail + gap && x > 0) return;
        var y = 0;
        sky.forEach(function(s){ if (s.x < x + w && s.x + s.w > x) y = Math.max(y, s.y); });
        if (!best || y < best.y || (y === best.y && x < best.x)) best = { x: x, y: y };
      });
      pos[i] = best;
      right = Math.max(right, best.x + w - gap);
      bottom = Math.max(bottom, best.y + h);
      sumBottoms += best.y + h;
      // raise the skyline over [x, x + w)
      var next = [];
      sky.forEach(function(s){
        if (s.x + s.w <= best.x || s.x >= best.x + w) { next.push(s); return; }
        if (s.x < best.x) next.push({ x: s.x, w: best.x - s.x, y: s.y });
        if (s.x + s.w > best.x + w) next.push({ x: best.x + w, w: s.x + s.w - best.x - w, y: s.y });
      });
      next.push({ x: best.x, w: w, y: best.y + h + gap });
      next.sort(function(a, b){ return a.x - b.x; });
      sky = next;
    });
    return { pos: pos, right: right, bottom: bottom, score: bottom * 1e4 + sumBottoms / Math.max(1, items.length) };
  }

  // Best order found within a small time budget: a few starting orders
  // (as saved, tallest first, widest first, largest first, then seeded
  // shuffles, so the result is the same on every load), each improved by
  // moving single cards to other positions while that lowers the score.
  function bestOrder(items, avail, gap){
    var n = items.length;
    var saved = items.map(function(_, i){ return i; });
    if (n < 3) return saved;
    var deadline = performance.now() + 40;
    var seed = 20261013;
    function rand(){ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    function by(key){ return saved.slice().sort(function(a, b){ return key(items[b]) - key(items[a]) || a - b; }); }
    var starts = [saved, by(function(it){ return it.h; }), by(function(it){ return it.w; }), by(function(it){ return it.w * it.h; })];
    for (var k = 0; k < 6; k++) {
      var shuffled = saved.slice();
      for (var i = n - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
      starts.push(shuffled);
    }
    var best = saved, bestScore = skyline(items, saved, avail, gap).score;
    for (var st = 0; st < starts.length && performance.now() < deadline; st++) {
      var order = starts[st], score = skyline(items, order, avail, gap).score;
      var improved = true;
      while (improved && performance.now() < deadline) {
        improved = false;
        for (var from = 0; from < n && !improved; from++) {
          for (var to = 0; to < n && !improved; to++) {
            if (to === from) continue;
            var cand = order.slice();
            cand.splice(to, 0, cand.splice(from, 1)[0]);
            var cs = skyline(items, cand, avail, gap).score;
            if (cs < score - 0.5) { order = cand; score = cs; improved = true; }
          }
        }
      }
      if (score < bestScore - 0.5) { best = order; bestScore = score; }
    }
    return best;
  }

  function pack(){
    var cards = getCards();
    var visible = cards.filter(function(c){ return !c.classList.contains('card-hidden'); });
    if (!wide.matches) {
      grid.classList.remove('is-packed');
      grid.style.height = '';
      cards.forEach(function(c){ c.style.left = ''; c.style.top = ''; });
      return;
    }
    grid.classList.add('is-packed');
    var cs = getComputedStyle(grid);
    var gap = parseFloat(cs.getPropertyValue('--fixations-gap')) || 28;
    var padL = parseFloat(cs.paddingLeft) || 0;
    var avail = grid.clientWidth - padL - (parseFloat(cs.paddingRight) || 0);

    var items = visible.map(function(c){ return { w: c.offsetWidth, h: c.offsetHeight }; });
    var editing = !!grid.querySelector('.fixation-card.is-editing');
    var order = editing ? items.map(function(_, i){ return i; }) : bestOrder(items, avail, gap);
    var result = skyline(items, order, avail, gap);

    var offset = padL + Math.max(0, (avail - result.right) / 2);
    visible.forEach(function(card, i){
      card.style.left = (offset + result.pos[i].x) + 'px';
      card.style.top = result.pos[i].y + 'px';
    });
    grid.style.height = result.bottom + 'px';
  }

  // Watch every card (and its text column) so covers and packing follow any
  // change in size, including typing in edit mode.
  var ro = null;
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(function(entries){
      entries.forEach(function(e){
        if (e.target.classList.contains('fixation-body')) sizeCover(e.target.closest('.fixation-card'));
      });
      schedulePack();
    });
    ro.observe(grid);
  } else {
    window.addEventListener('resize', schedulePack);
  }
  function watchCards(){
    getCards().forEach(function(c){
      if (c._fixationsWatched) return;
      c._fixationsWatched = true;
      var b = c.querySelector('.fixation-body');
      if (ro) { if (b) ro.observe(b); ro.observe(c); }
      // (also re-sized when the theme swaps in a cover's other version)
      var img = c.querySelector('img.fixation-cover');
      if (img) img.addEventListener('load', function(){ sizeCover(c); schedulePack(); });
    });
  }
  if (wide.addEventListener) wide.addEventListener('change', sizeAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeAll);

  // --- Filtering (the "+" card in edit mode is never filtered out) ---
  function apply(kind){
    if (filters.indexOf(kind) === -1) kind = 'all';
    currentKind = kind;
    buttons.forEach(function(b){
      var active = b.dataset.filter === kind;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var shown = 0;
    getCards().forEach(function(c){
      if (c.classList.contains('fixation-add')) return;
      var match = kind === 'all' || c.dataset.kind === kind;
      c.classList.toggle('card-hidden', !match);
      if (match) shown++;
    });
    if (empty) empty.hidden = shown > 0 || !!grid.querySelector('.fixation-add');
    schedulePack();
    return kind;
  }

  bar.addEventListener('click', function(e){
    var btn = e.target.closest('.filter-btn');
    if (!btn) return;
    var kind = apply(btn.dataset.filter);
    try { history.replaceState(null, '', location.pathname + location.search + (kind === 'all' ? '' : '#' + kind)); } catch (_) {}
  });

  // Re-run everything after cards were added, removed or replaced.
  function refresh(){
    watchCards();
    apply(currentKind);
    sizeAll();
  }

  window.FixationsPage = {
    KINDS: KINDS,
    grid: grid,
    clampRating: clampRating,
    heartsHtml: heartsHtml,
    currentKind: function(){ return currentKind; },
    sizeCover: sizeCover,
    schedulePack: schedulePack,
    refresh: refresh
  };

  currentKind = (location.hash || '').slice(1).toLowerCase();
  refresh();
})();
