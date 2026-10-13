// My Current Fixations.
// - Builds the cards from window.FIXATIONS (scripts/fixations-data.js, which
//   is generated from data/fixations.xlsx), then each card's hearts
//   (data-rating, 0-5 in halves) and kind pill (data-kind).
// - Sizes each cover to the height of its text column, keeping the image's
//   aspect ratio (CSS cannot derive an image's height from a sibling).
// - Switches between All / Books / Movies / Shows / Games. The active pill is
//   mirrored in the URL hash (#books) so a filtered view can be linked to.
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
  (window.FIXATIONS || []).forEach(function(item){
    var card = el('article', 'fixation-card');
    card.dataset.kind = item.kind;
    card.dataset.rating = item.rating;
    if (item.image) {
      var img = el('img', 'fixation-cover');
      img.src = item.image;
      img.alt = item.title;
      img.decoding = 'async';
      card.appendChild(img);
    }
    var body = el('div', 'fixation-body');
    body.appendChild(el('h3', 'fixation-title', item.title));
    body.appendChild(el('div', 'fixation-rating'));
    if (item.description) body.appendChild(el('p', 'fixation-desc', item.description));
    card.appendChild(body);
    grid.appendChild(card);
  });

  var buttons = Array.prototype.slice.call(bar.querySelectorAll('.filter-btn'));
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.fixation-card'));
  var filters = buttons.map(function(b){ return b.dataset.filter; });

  // --- Hearts and kind pill ---
  cards.forEach(function(card){
    var rating = Math.max(0, Math.min(5, Math.round((parseFloat(card.dataset.rating) || 0) * 2) / 2));
    var hearts = card.querySelector('.fixation-rating');
    if (hearts) {
      var html = '';
      for (var i = 1; i <= 5; i++) html += heartSvg(i <= rating ? 1 : (i - 0.5 <= rating ? 0.5 : 0));
      hearts.innerHTML = html;
      hearts.setAttribute('role', 'img');
      hearts.setAttribute('aria-label', 'Rated ' + rating + ' out of 5');
    }
    var kind = KINDS[card.dataset.kind];
    var body = card.querySelector('.fixation-body');
    if (kind && body && !body.querySelector('.fixation-pill')) {
      var pill = document.createElement('span');
      pill.className = 'fixation-pill';
      pill.innerHTML = '<img src="' + kind.icon + '" alt="" width="20" height="20" decoding="async">' + kind.label;
      body.appendChild(pill);
    }
  });

  // --- Cover height = text column height (not on phones, where the cover is
  //     a fixed-width strip and the text column fills the rest) ---
  var wide = window.matchMedia('(min-width: 521px)');
  function sizeCover(card){
    var cover = card.querySelector('.fixation-cover');
    var body = card.querySelector('.fixation-body');
    if (!cover || !body) return;
    if (!wide.matches) { cover.style.height = ''; cover.style.width = ''; return; }
    cover.style.height = body.offsetHeight + 'px';
    cover.style.width = 'auto';
  }
  function sizeAll(){ cards.forEach(sizeCover); schedulePack(); }

  // --- Packing: cards differ in width and height, so plain rows would leave
  //     holes under the shorter ones. Each card goes to the highest spot where
  //     it fits (skyline packing, in DOM order), with the same gap between
  //     cards horizontally and vertically; the block is then centred. ---
  var packQueued = false;
  function schedulePack(){
    if (packQueued) return;
    packQueued = true;
    requestAnimationFrame(function(){ packQueued = false; pack(); });
  }

  function pack(){
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

    // skyline: sorted segments covering [0, avail + gap), each with the y at
    // which the next card may start. Widths include the trailing gap.
    var sky = [{ x: 0, w: avail + gap, y: 0 }];
    var placed = [];
    visible.forEach(function(card){
      var w = card.offsetWidth + gap, h = card.offsetHeight;
      var best = null;
      sky.forEach(function(seg){
        var x = seg.x;
        if (x + w > avail + gap && x > 0) return;
        var y = 0;
        sky.forEach(function(s){ if (s.x < x + w && s.x + s.w > x) y = Math.max(y, s.y); });
        if (!best || y < best.y || (y === best.y && x < best.x)) best = { x: x, y: y };
      });
      placed.push({ card: card, x: best.x, y: best.y, w: w - gap, h: h });
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

    var right = 0, bottom = 0;
    placed.forEach(function(p){ right = Math.max(right, p.x + p.w); bottom = Math.max(bottom, p.y + p.h); });
    var offset = padL + Math.max(0, (avail - right) / 2);
    placed.forEach(function(p){
      p.card.style.left = (offset + p.x) + 'px';
      p.card.style.top = p.y + 'px';
    });
    grid.style.height = bottom + 'px';
  }

  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function(entries){
      entries.forEach(function(e){
        if (e.target.classList.contains('fixation-body')) sizeCover(e.target.closest('.fixation-card'));
      });
      schedulePack();
    });
    cards.forEach(function(c){
      var b = c.querySelector('.fixation-body');
      if (b) ro.observe(b);
      ro.observe(c);
    });
    ro.observe(grid);
  } else {
    window.addEventListener('resize', schedulePack);
  }
  cards.forEach(function(c){
    var img = c.querySelector('.fixation-cover');
    if (img && !img.complete) img.addEventListener('load', schedulePack);
  });
  if (wide.addEventListener) wide.addEventListener('change', sizeAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeAll);
  sizeAll();

  // --- Filtering ---
  function apply(kind){
    if (filters.indexOf(kind) === -1) kind = 'all';
    buttons.forEach(function(b){
      var active = b.dataset.filter === kind;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var shown = 0;
    cards.forEach(function(c){
      var match = kind === 'all' || c.dataset.kind === kind;
      c.classList.toggle('card-hidden', !match);
      if (match) shown++;
    });
    if (empty) empty.hidden = shown > 0;
    schedulePack();
    return kind;
  }

  bar.addEventListener('click', function(e){
    var btn = e.target.closest('.filter-btn');
    if (!btn) return;
    var kind = apply(btn.dataset.filter);
    try { history.replaceState(null, '', kind === 'all' ? location.pathname : '#' + kind); } catch (_) {}
  });

  apply((location.hash || '').slice(1).toLowerCase());
})();
