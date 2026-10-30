// Edit mode for My Trip Blogs (local editor only, see scripts/edit-mode.js
// and scripts/edit-server.js).
//
// The posts live in tripblogs.html between the tripblogs-cards markers. In
// edit mode every card has an Edit button (clicking the card works too): it
// opens the post exactly as readers see it, and everything in it is typed
// into in place: the "PLACE · YEAR" line, the title, the teaser and the
// story. The toolbar pinned to the top has bold, italic, underline,
// strikethrough, section heading and "+ Photo"; hovering the cover shows a
// pencil to replace it.
// Photos: the text is one column, thought of as four. A photo is one to four
// of those columns wide (− / + on the photo) and keeps its aspect ratio; the
// narrower ones sit left or right with the text wrapping around them. Drag a
// photo up or down the story, and left or right; drop it on another photo
// to put the two side by side (a pair: as wide as both together, so two
// halves fill a row; "Move both" drags the pair). A new photo goes at the
// start of the story, one column wide, with a caption box under it. Every
// photo, the cover included, has the albedo control (◐).
// "+ New post" adds a card at the top; x on a card removes it. Closing a post
// keeps its changes; Save uploads new photos into images/trip_blogs/<post>/
// and rewrites only the posts that changed.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  if (!document.body.classList.contains('page-tripblogs')) return;
  var grid = document.getElementById('projects-grid');
  if (!grid) return;

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/avif';
  var FOLDER_RE = /^[a-z0-9][a-z0-9_-]*$/;
  var SIZE_LABEL = { 1: '¼', 2: '½', 3: '¾', 4: 'Full' };

  var posts = [];        // { src, gap, doc (the saved <article>, inert), live (its card), changed, removed, isNew }
  var tail = '';
  var pending = {};      // "tbp-N" -> File: new photos and covers, uploaded on save
  var albedo = {};       // data-tb-id of an <img> -> SiteAlbedo state
  var counter = 0;
  var dirty = false;
  var openClone = null;  // the post being edited, while it is open

  (window.SiteEditors = window.SiteEditors || []).push({
    start: start,
    save: save,
    isDirty: function(){ return dirty || !!openClone; }
  });

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }
  function I(n){ return new Array(n + 1).join(' '); }
  function button(cls, html, title, onClick){
    var b = el('button', cls, { type: 'button', title: title, 'aria-label': title });
    b.innerHTML = html;
    // keep the text selection (and caret) where it is
    b.addEventListener('mousedown', function(e){ e.preventDefault(); });
    b.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); onClick(e); });
    return b;
  }
  function pickFiles(multiple, then){
    var input = el('input', '', { type: 'file', accept: IMAGE_TYPES });
    if (multiple) input.multiple = true;
    input.addEventListener('change', function(){ if (input.files && input.files.length) then(Array.prototype.slice.call(input.files)); });
    input.click();
  }
  function addPending(file){
    var key = 'tbp-' + (++counter);
    pending[key] = file;
    return key;
  }

  // --- Reading the saved page ---
  var START = /<!-- tripblogs-cards:start[\s\S]*?-->\n?/;
  var END = /[ \t]*<!-- tripblogs-cards:end -->/;

  function splitArticles(region){
    var out = [], pos = 0;
    for (;;) {
      var a = region.indexOf('<article', pos);
      if (a === -1) break;
      var b = region.indexOf('</article>', a);
      if (b === -1) break;
      b += '</article>'.length;
      out.push({ gap: region.slice(pos, a), src: region.slice(a, b) });
      pos = b;
    }
    return { cards: out, tail: region.slice(pos) };
  }
  function parseArticle(src){
    var t = document.createElement('template');
    t.innerHTML = src;
    return t.content.querySelector('article');
  }

  function start(){
    return fetch('tripblogs.html', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('could not read tripblogs.html'); return r.text(); })
      .then(function(page){
        var s = page.match(START), e = page.match(END);
        if (!s || !e) throw new Error('tripblogs-cards markers not found in tripblogs.html');
        var parts = splitArticles(page.slice(s.index + s[0].length, e.index));
        tail = parts.tail;
        posts = parts.cards.map(function(c){ return { src: c.src, gap: c.gap, doc: parseArticle(c.src) }; });
        build();
      });
  }

  // --- The cards ---
  function build(){
    document.body.classList.add('tb-editing');
    grid.querySelectorAll('article.project-card').forEach(function(n){ n.remove(); });
    var bar = el('div', 'tb-new-bar');
    var add = el('button', 'tb-new-btn', { type: 'button' });
    add.textContent = '+ New post';
    add.addEventListener('click', newPost);
    bar.appendChild(add);
    grid.appendChild(bar);
    posts.forEach(function(p){ p.live = liveCard(p); grid.appendChild(p.live); });
    document.execCommand('defaultParagraphSeparator', false, 'p');
  }

  // A card shown from the post's current content, with Edit and remove
  function liveCard(p){
    var card = document.importNode(p.doc, true);
    card.setAttribute('tabindex', '0');
    var tools = el('div', 'tb-card-tools');
    var edit = button('tb-card-btn', PENCIL + '<span>Edit</span>', 'Edit this post', function(){ open(p); });
    var remove = button('tb-card-btn is-remove', CROSS, 'Remove this post', function(){
      var name = textOf(p.doc.querySelector('.blog-meta')) || 'this post';
      if (!confirm('Remove "' + name + '"?')) return;
      p.removed = true;
      p.live.remove();
      dirty = true;
    });
    tools.appendChild(edit);
    tools.appendChild(remove);
    card.appendChild(tools);
    card.addEventListener('click', function(e){ if (!e.target.closest('.tb-card-tools')) open(p); });
    card.addEventListener('keydown', function(e){
      if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(p); }
    });
    return card;
  }

  function newPost(){
    var n = ++counter;
    var src = [
      '<article class="project-card">',
      I(24) + '<img class="project-image" src="" alt="Cover photo" loading="lazy" decoding="async">',
      I(24) + '<div class="project-meta">',
      I(28) + '<div class="blog-meta"></div>',
      I(28) + '<p class="project-subtitle"></p>',
      I(24) + '</div>',
      I(24) + '<button class="project-toggle" aria-expanded="false" aria-controls="tripblog-new-' + n + '-desc">Read Story</button>',
      I(24) + '<div class="project-full" id="tripblog-new-' + n + '-desc" hidden>',
      I(28) + '<p></p>',
      I(24) + '</div>',
      I(20) + '</article>'].join('\n');
    var p = { src: src, gap: '\n\n' + I(20), doc: parseArticle(src), changed: true, isNew: true };
    var firstLive = posts.filter(function(q){ return !q.removed; })[0];
    posts.unshift(p);
    p.live = liveCard(p);
    grid.insertBefore(p.live, firstLive ? firstLive.live : null);
    dirty = true;
    open(p);
  }

  function open(p){
    if (openClone || !window.openProjectCard) return;
    window.openProjectCard(p.live);
  }

  function postFor(card){ return posts.filter(function(p){ return p.live === card; })[0]; }

  document.addEventListener('project-card:expanded', function(e){
    if (!document.body.classList.contains('tb-editing')) return;
    var p = postFor(e.detail.originalCard);
    if (p) makeEditable(e.detail.clone, p);
  });
  document.addEventListener('project-card:closed', function(e){
    if (!e.detail.clone || !e.detail.clone._tbPost) return;
    var p = e.detail.clone._tbPost;
    capture(e.detail.clone, p);
    if (e.detail.clone._tbDone) e.detail.clone._tbDone();
    openClone = null;
    var fresh = liveCard(p);
    if (p.live.parentNode) p.live.parentNode.replaceChild(fresh, p.live);
    p.live = fresh;
  });

  // --- Editing an opened post ---
  function textOf(node){ return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function markEmpty(node){
    var empty = !textOf(node) && !node.querySelector('img');
    node.classList.toggle('tb-empty', empty);
  }

  // a one-line field (place line, title, teaser, caption)
  function lineField(node, placeholder){
    node.contentEditable = 'true';
    node.setAttribute('data-placeholder', placeholder);
    node.spellcheck = true;
    markEmpty(node);
    node.addEventListener('input', function(){ markEmpty(node); });
    node.addEventListener('keydown', function(e){ if (e.key === 'Enter') e.preventDefault(); });
    node.addEventListener('paste', pastePlain);
  }
  function pastePlain(e){
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  }

  function makeEditable(clone, p){
    openClone = clone;
    clone._tbPost = p;
    clone.classList.add('tb-edit-clone');
    clone.querySelectorAll('.tb-card-tools').forEach(function(n){ n.remove(); });
    clone.addEventListener('input', function(){ dirty = true; });

    var meta = clone.querySelector('.project-meta');
    var place = meta.querySelector('.blog-meta');
    if (!place) { place = el('div', 'blog-meta'); meta.insertBefore(place, meta.firstChild); }
    var title = meta.querySelector('.project-title');
    if (!title) { title = el('h3', 'project-title'); meta.insertBefore(title, place.nextSibling); }
    var sub = meta.querySelector('.project-subtitle');
    if (!sub) { sub = el('p', 'project-subtitle'); meta.insertBefore(sub, title.nextSibling); }
    lineField(place, 'Place · Year');
    lineField(title, 'Title (optional: without one, the place line is the title)');
    lineField(sub, 'A one- or two-sentence teaser (also shown on the card)');

    var story = clone.querySelector('.project-full');
    story.contentEditable = 'true';
    story.spellcheck = true;
    if (!story.querySelector('p, h3, h4, ul, ol, blockquote, figure')) story.innerHTML = '<p><br></p>';
    var emptyStory = function(){ story.classList.toggle('tb-empty-story', !textOf(story) && !story.querySelector('figure')); };
    emptyStory();
    story.addEventListener('input', emptyStory);
    story.addEventListener('paste', pastePlain);
    story.addEventListener('keydown', function(e){
      // Enter at the very end of a heading starts a normal paragraph
      if (e.key === 'Enter' && !e.shiftKey && blockAt() && blockAt().tagName === 'H3') {
        setTimeout(function(){ var b = blockAt(); if (b && b.tagName === 'H3' && !textOf(b)) document.execCommand('formatBlock', false, 'p'); }, 0);
      }
    });
    story.querySelectorAll('figure').forEach(function(f){ setupFigure(f, story, clone); });
    story.querySelectorAll('.tb-pair').forEach(function(pair){ setupPair(pair, story, clone); });

    setupCover(clone);
    clone.insertBefore(toolbar(clone, story), clone.firstChild);
    setTimeout(function(){ (textOf(place) ? story : place).focus(); }, 600);
  }

  function setupCover(clone){
    var hero = clone.querySelector('.project-hero');
    var img = clone.querySelector('.project-image');
    if (!hero || !img) return;
    var st = albedoFor(img);
    var tools = el('div', 'tb-cover-tools');
    tools.appendChild(button('tb-mini', PENCIL + '&nbsp;Cover', 'Replace the cover photo', function(){
      pickFiles(false, function(files){
        img.setAttribute('data-pending', addPending(files[0]));
        img.src = URL.createObjectURL(files[0]);
        SiteAlbedo.replaced(st);
        dirty = true;
      });
    }));
    tools.appendChild(albedoButton(tools, img, st));
    hero.appendChild(tools);
  }

  function albedoFor(img){
    var id = img.getAttribute('data-tb-id');
    if (!id) { id = String(++counter); img.setAttribute('data-tb-id', id); }
    if (!albedo[id]) albedo[id] = SiteAlbedo.read(img);
    return albedo[id];
  }
  // ◐ opens the albedo control in a small panel next to the photo
  function albedoButton(tools, img, st){
    var pop = null;
    return button('tb-mini', '◐', 'Albedo: how this photo follows the light / dark theme', function(){
      if (pop) { pop.remove(); pop = null; tools.classList.remove('is-open'); return; }
      pop = el('div', 'tb-pop', { contenteditable: 'false' });
      pop.appendChild(SiteAlbedo.control(st, { compact: true, onChange: function(){
        SiteAlbedo.apply(img, st);
        dirty = true;
      } }));
      tools.appendChild(pop);
      tools.classList.add('is-open');
      setTimeout(function(){
        document.addEventListener('mousedown', function away(e){
          if (pop && (pop.contains(e.target) || tools.contains(e.target))) return;
          document.removeEventListener('mousedown', away, true);
          if (pop) { pop.remove(); pop = null; tools.classList.remove('is-open'); }
        }, true);
      }, 0);
    });
  }

  // --- Toolbar ---
  function toolbar(clone, story){
    var wrap = el('div', 'tb-toolbar-wrap', { contenteditable: 'false' });
    var bar = el('div', 'tb-toolbar', { role: 'toolbar', 'aria-label': 'Formatting' });
    var states = [];
    function inEditor(){
      var sel = window.getSelection();
      if (!sel.rangeCount) return false;
      var n = sel.anchorNode;
      n = n && n.nodeType === 3 ? n.parentNode : n;
      return !!(n && clone.contains(n) && n.closest('[contenteditable="true"]'));
    }
    function cmd(name, label, title){
      var b = button('tb-tool-btn', label, title, function(){
        if (!inEditor()) return;
        document.execCommand('styleWithCSS', false, false);
        document.execCommand(name, false, null);
        refresh();
        dirty = true;
      });
      states.push(function(){ b.classList.toggle('is-active', inEditor() && document.queryCommandState(name)); });
      bar.appendChild(b);
    }
    cmd('bold', '<b>B</b>', 'Bold (Ctrl+B)');
    cmd('italic', '<i>I</i>', 'Italic (Ctrl+I)');
    cmd('underline', '<u>U</u>', 'Underline (Ctrl+U)');
    cmd('strikeThrough', '<s>S</s>', 'Strikethrough');
    bar.appendChild(el('span', 'tb-tool-sep'));
    var heading = button('tb-tool-btn', 'H', 'Section heading (click again for normal text)', function(){
      var b = blockAt();
      if (!b || !story.contains(b)) return;
      document.execCommand('formatBlock', false, b.tagName === 'H3' ? 'p' : 'h3');
      refresh();
      dirty = true;
    });
    states.push(function(){ var b = blockAt(); heading.classList.toggle('is-active', !!(b && story.contains(b) && b.tagName === 'H3')); });
    bar.appendChild(heading);
    bar.appendChild(el('span', 'tb-tool-sep'));
    bar.appendChild(button('tb-tool-btn is-photo', '+ Photo', 'Add photos at the start of the story', function(){
      pickFiles(true, function(files){
        files.slice().reverse().forEach(function(f){ insertPhoto(f, story, clone); });
        story.scrollIntoView({ block: 'start', behavior: 'smooth' });
        dirty = true;
      });
    }));
    function refresh(){ states.forEach(function(s){ s(); }); }
    document.addEventListener('selectionchange', refresh);
    clone._tbDone = function(){ document.removeEventListener('selectionchange', refresh); };
    wrap.appendChild(bar);
    return wrap;
  }

  function blockAt(){
    var sel = window.getSelection();
    if (!sel.rangeCount) return null;
    var n = sel.anchorNode;
    n = n && n.nodeType === 3 ? n.parentNode : n;
    return n && n.closest ? n.closest('p, h3, h4, li, blockquote, div.project-full > *') : null;
  }

  // --- Photos ---
  // A "unit" is what sits in the story by itself: a photo, or a pair of
  // photos side by side (div.tb-pair). Widths count quarter columns.
  function widthOf(node){
    for (var w = 1; w <= 3; w++) if (node.classList.contains('tb-w' + w)) return w;
    return 4;
  }
  function sideOf(node){ return node.classList.contains('tb-right') ? 'right' : 'left'; }
  function pairOf(fig){ return fig.parentNode && fig.parentNode.classList && fig.parentNode.classList.contains('tb-pair') ? fig.parentNode : null; }
  // width and side of a unit in the story (full width has no side)
  function setLayout(unit, w, side){
    if (unit.tagName === 'FIGURE') unit.classList.add('tb-fig');
    unit.classList.remove('tb-w1', 'tb-w2', 'tb-w3', 'tb-w4', 'tb-left', 'tb-right');
    unit.classList.add('tb-w' + w);
    if (w < 4) unit.classList.add('tb-' + (side || 'left'));
  }
  // a pair's own width is the sum of its two photos'; one photo left = no pair
  function tidyPair(pair){
    if (!pair || !pair.parentNode) return;
    var figs = Array.prototype.filter.call(pair.children, function(n){ return n.tagName === 'FIGURE'; });
    var side = sideOf(pair);
    if (figs.length < 2) {
      if (figs[0]) { pair.parentNode.insertBefore(figs[0], pair); setLayout(figs[0], widthOf(figs[0]), side); }
      pair.remove();
      return;
    }
    figs.forEach(function(f){
      var w = widthOf(f);
      f.classList.remove('tb-w1', 'tb-w2', 'tb-w3', 'tb-w4', 'tb-left', 'tb-right');
      f.classList.add('tb-fig', 'tb-w' + w);
    });
    setLayout(pair, widthOf(figs[0]) + widthOf(figs[1]), side);
  }
  function refreshSizes(story){
    story.querySelectorAll('figure').forEach(function(f){ if (f._showSize) f._showSize(); });
  }
  // Puts the dragged photo beside another one; if the two don't fit in a
  // row, the dragged one is narrowed (and a full-width one halved).
  function makePair(target, fig, after, story, clone){
    var oldPair = pairOf(fig);
    var b = widthOf(target), a = widthOf(fig);
    if (b === 4) { a = a === 4 ? 2 : Math.min(a, 3); b = 4 - a; }
    else a = Math.min(a, 4 - b);
    var pair = el('div', 'tb-pair');
    story.insertBefore(pair, target);
    setLayout(pair, a + b, sideOf(target));
    setLayout(target, b, null);
    setLayout(fig, a, null);
    if (after) { pair.appendChild(target); pair.appendChild(fig); }
    else { pair.appendChild(fig); pair.appendChild(target); }
    tidyPair(pair);
    tidyPair(oldPair);
    setupPair(pair, story, clone);
    refreshSizes(story);
  }

  function insertPhoto(file, story, clone){
    var fig = el('figure', 'tb-fig tb-w1 tb-left');
    var img = el('img', '', { src: URL.createObjectURL(file), alt: '', loading: 'lazy', decoding: 'async' });
    img.setAttribute('data-pending', addPending(file));
    fig.appendChild(img);
    fig.appendChild(el('figcaption'));
    var id = String(++counter);
    img.setAttribute('data-tb-id', id);
    albedo[id] = SiteAlbedo.fresh();
    SiteAlbedo.apply(img, albedo[id]);
    story.insertBefore(fig, story.firstChild);
    setupFigure(fig, story, clone);
    story.classList.remove('tb-empty-story');
  }

  function setupFigure(fig, story, clone){
    fig.contentEditable = 'false';
    var img = fig.querySelector('img');
    if (!img) return;
    var cap = fig.querySelector('figcaption');
    if (!cap) { cap = el('figcaption'); fig.appendChild(cap); }
    lineField(cap, 'Add a caption…');
    var st = albedoFor(img);

    var missing = function(){
      if (img.getAttribute('data-pending')) return;
      fig.classList.add('is-missing');
      fig.setAttribute('data-missing', 'Missing: ' + (img.getAttribute('src') || 'no photo') + ' (replace it with the pencil)');
    };
    img.addEventListener('error', missing);
    if (img.complete && !img.naturalWidth) missing();
    img.addEventListener('load', function(){ fig.classList.remove('is-missing'); });

    var tools = el('div', 'tb-fig-tools', { contenteditable: 'false' });
    var size = el('span', 'tb-mini tb-size');
    var smaller = button('tb-mini', '−', 'Narrower (one column less)', function(){ resize(-1); });
    var larger = button('tb-mini', '+', 'Wider (one column more)', function(){ resize(1); });
    // in a pair, the two together are at most the full width
    function most(){
      var pair = pairOf(fig);
      if (!pair) return 4;
      var other = Array.prototype.filter.call(pair.children, function(n){ return n.tagName === 'FIGURE' && n !== fig; })[0];
      return 4 - (other ? widthOf(other) : 0);
    }
    function showSize(){
      var w = widthOf(fig);
      size.textContent = SIZE_LABEL[w];
      smaller.disabled = w === 1;
      larger.disabled = w >= most();
    }
    fig._showSize = showSize;
    function resize(d){
      var w = Math.max(1, Math.min(most(), widthOf(fig) + d));
      var pair = pairOf(fig);
      if (pair) { fig.classList.remove('tb-w1', 'tb-w2', 'tb-w3', 'tb-w4'); fig.classList.add('tb-w' + w); tidyPair(pair); }
      else setLayout(fig, w, sideOf(fig));
      refreshSizes(story);
      dirty = true;
    }
    tools.appendChild(button('tb-mini', PENCIL, 'Replace this photo', function(){
      pickFiles(false, function(files){
        img.setAttribute('data-pending', addPending(files[0]));
        img.src = URL.createObjectURL(files[0]);
        fig.classList.remove('is-missing');
        SiteAlbedo.replaced(st);
        dirty = true;
      });
    }));
    tools.appendChild(smaller);
    tools.appendChild(size);
    tools.appendChild(larger);
    tools.appendChild(albedoButton(tools, img, st));
    tools.appendChild(button('tb-mini is-remove', CROSS, 'Remove this photo', function(){
      var pair = pairOf(fig);
      fig.remove();
      tidyPair(pair);
      refreshSizes(story);
      dirty = true;
    }));
    fig.insertBefore(tools, fig.firstChild);
    showSize();
    dragUnit(fig, img, story, clone);
  }

  // a pair moves as one by its grip (dragging one of its photos takes that
  // photo out of the pair)
  function setupPair(pair, story, clone){
    pair.contentEditable = 'false';
    if (pair.querySelector(':scope > .tb-pair-tools')) return;
    var tools = el('div', 'tb-pair-tools', { contenteditable: 'false' });
    var grip = el('span', 'tb-mini tb-grip', { title: 'Drag to move both photos' });
    grip.textContent = '⠿ Move both';
    tools.appendChild(grip);
    pair.insertBefore(tools, pair.firstChild);
    dragUnit(pair, grip, story, clone);
  }

  // Drag a photo (by the photo) or a pair (by its grip). A dashed box shows
  // where it will land: before which paragraph, and on which side for the
  // narrower sizes. Over another photo, a bar on its left or right edge
  // means "put them side by side".
  function dragUnit(unit, handle, story, clone){
    var isFig = unit.tagName === 'FIGURE';
    handle.addEventListener('dragstart', function(e){ e.preventDefault(); });
    handle.addEventListener('pointerdown', function(e){
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      var x0 = e.clientX, y0 = e.clientY, dragging = false, drop = null, target = null;
      function blocks(){
        return Array.prototype.filter.call(story.children, function(n){ return n !== unit && n !== drop; });
      }
      function place(r, x, y, w, h, beside){
        drop.classList.toggle('is-beside', !!beside);
        drop.style.left = (x - r.left) + 'px';
        drop.style.top = (y - r.top) + 'px';
        drop.style.width = w + 'px';
        drop.style.height = h + 'px';
      }
      function find(ev){
        var r = story.getBoundingClientRect(), cs = getComputedStyle(story);
        var left = r.left + parseFloat(cs.paddingLeft), width = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        // over a lone photo: side by side with it
        if (isFig) {
          var over = Array.prototype.filter.call(story.querySelectorAll(':scope > figure'), function(f){
            if (f === unit) return false;
            var fr = f.getBoundingClientRect();
            return ev.clientX >= fr.left && ev.clientX <= fr.right && ev.clientY >= fr.top && ev.clientY <= fr.bottom;
          })[0];
          if (over) {
            var orr = over.getBoundingClientRect(), after = ev.clientX > orr.left + orr.width / 2;
            place(r, after ? orr.right - 3 : orr.left - 3, orr.top, 6, orr.height, true);
            return { beside: over, after: after };
          }
        }
        var list = blocks(), best = null;
        list.forEach(function(b){
          var top = b.getBoundingClientRect().top, d = Math.abs(ev.clientY - top);
          if (!best || d < best.d) best = { d: d, before: b, y: top };
        });
        if (list.length) {
          var bottom = list[list.length - 1].getBoundingClientRect().bottom;
          if (!best || Math.abs(ev.clientY - bottom) < best.d) best = { d: 0, before: null, y: bottom };
        } else {
          best = { before: null, y: r.top + parseFloat(cs.paddingTop) };
        }
        var w = widthOf(unit);
        best.side = w === 4 ? null : ev.clientX < left + width / 2 ? 'left' : 'right';
        var ur = unit.getBoundingClientRect();
        var boxW = w === 4 ? width : (width - 3 * parseFloat(getComputedStyle(story).getPropertyValue('--tb-gap') || 28)) * w / 4 + (w - 1) * parseFloat(getComputedStyle(story).getPropertyValue('--tb-gap') || 28);
        place(r, best.side === 'right' ? left + width - boxW : left, best.y, boxW, Math.min(ur.height, 320), false);
        return best;
      }
      function move(ev){
        if (!dragging) {
          if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 6) return;
          dragging = true;
          unit.classList.add('is-dragging');
          drop = el('div', 'tb-drop', { contenteditable: 'false' });
          story.appendChild(drop);
        }
        target = find(ev);
        // scroll the post when dragging near its top or bottom
        var cr = clone.getBoundingClientRect();
        if (ev.clientY < cr.top + 70) clone.scrollTop -= 14;
        else if (ev.clientY > cr.bottom - 70) clone.scrollTop += 14;
      }
      function up(){
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!dragging) return;
        unit.classList.remove('is-dragging');
        if (drop) drop.remove();
        if (!target) return;
        if (target.beside) {
          makePair(target.beside, unit, target.after, story, clone);
        } else {
          var oldPair = isFig ? pairOf(unit) : null;
          story.insertBefore(unit, target.before);
          if (target.side || !isFig || unit.classList.contains('tb-fig') || oldPair) setLayout(unit, widthOf(unit), target.side);
          tidyPair(oldPair);
          refreshSizes(story);
        }
        dirty = true;
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  // --- Back into the saved post ---
  function unwrap(n){ while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n); n.remove(); }
  function rename(n, tag){
    var m = document.createElement(tag);
    while (n.firstChild) m.appendChild(n.firstChild);
    n.parentNode.replaceChild(m, n);
    return m;
  }
  // Leaves only the content: no editor parts, no styles the browser added
  // while typing, the photos' own address (not the theme-swapped one)
  function clean(root){
    root.querySelectorAll('.tb-fig-tools, .tb-pair-tools, .tb-drop, .tb-pop, .tb-cover-tools, .tb-toolbar-wrap').forEach(function(n){ n.remove(); });
    root.querySelectorAll('span, font').forEach(unwrap);
    root.querySelectorAll('strike').forEach(function(n){ rename(n, 's'); });
    root.querySelectorAll('*').forEach(function(n){
      ['style', 'contenteditable', 'data-placeholder', 'data-missing', 'spellcheck'].forEach(function(a){ n.removeAttribute(a); });
      if (n.classList) {
        n.classList.remove('tb-empty', 'tb-empty-story', 'is-dragging', 'is-missing', 'is-open');
        if (!n.classList.length) n.removeAttribute('class');
      }
      if (n.tagName === 'IMG' && n.hasAttribute('data-src-base')) {
        n.setAttribute('src', n.getAttribute('data-src-base'));
        n.removeAttribute('data-src-base');
      }
    });
    return root;
  }
  function richHtml(node){ return clean(node.cloneNode(true)).innerHTML.replace(/\s+/g, ' ').replace(/(<br>\s*)+$/, '').trim(); }

  function capture(clone, p){
    var before = serialize(p.doc);
    var doc = p.doc, owner = doc.ownerDocument;
    var cimg = clone.querySelector('.project-image'), dimg = doc.querySelector('.project-image');
    if (cimg && dimg) {
      var c = clean(cimg.cloneNode(false));
      Array.prototype.slice.call(dimg.attributes).forEach(function(a){ dimg.removeAttribute(a.name); });
      Array.prototype.slice.call(c.attributes).forEach(function(a){ dimg.setAttribute(a.name, a.value); });
    }
    var meta = doc.querySelector('.project-meta');
    function field(sel, tag, keepEmpty, after){
      var from = clone.querySelector('.project-meta ' + sel);
      var to = meta.querySelector(sel);
      var html = from ? richHtml(from) : '';
      if (!html && !keepEmpty) { if (to) { var prev = to.previousSibling; if (prev && prev.nodeType === 3 && !prev.textContent.trim()) prev.remove(); to.remove(); } return; }
      if (!to) {
        to = owner.createElement(tag);
        to.className = sel.slice(1);
        var ref = after ? meta.querySelector(after) : null;
        meta.insertBefore(to, ref ? ref.nextSibling : meta.firstChild);
      }
      if (to.innerHTML.replace(/\s+/g, ' ').trim() !== html) to.innerHTML = html;
    }
    field('.blog-meta', 'div', true, null);
    field('.project-title', 'h3', false, '.blog-meta');
    field('.project-subtitle', 'p', true, '.project-title');
    var story = clean(clone.querySelector('.project-full').cloneNode(true));
    doc.querySelector('.project-full').innerHTML = story.innerHTML;
    if (serialize(doc) !== before) { p.changed = true; dirty = true; }
  }

  // --- Writing a post ---
  // The post's markup in the page's own layout (indentation, one paragraph
  // per block, photos as <figure> with the image and caption on their own
  // lines). Used to write changed posts, and to tell whether a post changed.
  function openTag(node){
    var c = node.cloneNode(false);
    ['data-tb-id'].forEach(function(a){ c.removeAttribute(a); });
    return c.outerHTML.replace(/<\/[a-z0-9]+>$/i, '').replace(/ hidden=""/, ' hidden');
  }
  function imgTag(img){
    var c = img.cloneNode(false);
    ['data-tb-id', 'style', 'data-src-base'].forEach(function(a){ c.removeAttribute(a); });
    return c.outerHTML;
  }
  function inline(html){ return html.replace(/\s+/g, ' ').replace(/(<br>|&nbsp;|\s)+$/, '').replace(/^(&nbsp;|\s)+/, ''); }

  function storyBlocks(full){
    var out = [], run = [];
    function flush(){
      var html = inline(run.map(function(n){ return n.nodeType === 3 ? n.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;') : n.outerHTML; }).join(''));
      if (html) out.push({ tag: 'p', html: html });
      run = [];
    }
    Array.prototype.forEach.call(full.childNodes, function(n){
      if (n.nodeType === 3) { if (n.textContent.trim()) run.push(n); else if (run.length) run.push(n); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName.toLowerCase();
      if (/^(p|div|h[1-6]|ul|ol|blockquote|figure|pre|table|hr)$/.test(tag)) {
        flush();
        if (tag === 'div') tag = n.classList.contains('tb-pair') ? 'pair' : 'p';
        out.push({ tag: tag, node: n, html: inline(n.innerHTML) });
      } else {
        run.push(n);
      }
    });
    flush();
    return out.filter(function(b){ return b.tag === 'figure' || b.tag === 'pair' || b.tag === 'hr' || b.tag === 'ul' || b.tag === 'ol' || b.html.replace(/<br>/g, '').trim(); });
  }

  function serialize(doc){
    var lines = [openTag(doc)];
    function figureLines(f, n){
      var im = f.querySelector('img'), cap = f.querySelector('figcaption');
      lines.push(I(n) + openTag(f));
      if (im) lines.push(I(n + 4) + imgTag(im));
      if (cap && inline(cap.innerHTML)) lines.push(I(n + 4) + '<figcaption>' + inline(cap.innerHTML) + '</figcaption>');
      lines.push(I(n) + '</figure>');
    }
    var img = doc.querySelector(':scope > .project-image');
    if (img) lines.push(I(24) + imgTag(img));
    var meta = doc.querySelector(':scope > .project-meta');
    if (meta) {
      lines.push(I(24) + openTag(meta));
      Array.prototype.forEach.call(meta.children, function(c){
        lines.push(I(28) + openTag(c) + inline(c.innerHTML) + '</' + c.tagName.toLowerCase() + '>');
      });
      lines.push(I(24) + '</div>');
    }
    var toggle = doc.querySelector(':scope > .project-toggle');
    if (toggle) lines.push(I(24) + toggle.outerHTML);
    var full = doc.querySelector(':scope > .project-full');
    if (full) {
      lines.push(I(24) + openTag(full));
      var blocks = storyBlocks(full);
      blocks.forEach(function(b, i){
        if (i) lines.push('');
        if (b.tag === 'figure') {
          figureLines(b.node, 28);
        } else if (b.tag === 'pair') {
          lines.push(I(28) + openTag(b.node));
          b.node.querySelectorAll(':scope > figure').forEach(function(f){ figureLines(f, 32); });
          lines.push(I(28) + '</div>');
        } else if (b.tag === 'p') {
          lines.push(I(28) + (b.node ? openTag(b.node).replace(/^<div/, '<p') : '<p>'), I(32) + b.html, I(28) + '</p>');
        } else if (b.tag === 'ul' || b.tag === 'ol') {
          lines.push(I(28) + openTag(b.node));
          Array.prototype.forEach.call(b.node.children, function(li){ lines.push(I(32) + '<li>' + inline(li.innerHTML) + '</li>'); });
          lines.push(I(28) + '</' + b.tag + '>');
        } else {
          lines.push(I(28) + openTag(b.node) + b.html + '</' + b.tag + '>');
        }
      });
      lines.push(I(24) + '</div>');
    }
    lines.push(I(20) + '</article>');
    return lines.join('\n');
  }

  // --- Save ---
  function slugify(s){
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }
  // The post's photo folder: the one its cover is in, else made from the
  // place line ("Crete, Greece · 2026" -> crete-greece-2026)
  function folderOf(p){
    if (p.folder) return p.folder;
    var srcs = Array.prototype.map.call(p.doc.querySelectorAll('img'), function(i){ return i.getAttribute('src') || ''; });
    for (var i = 0; i < srcs.length; i++) {
      var m = srcs[i].match(/^images\/trip_blogs\/([^/]+)\//);
      if (m && FOLDER_RE.test(m[1])) return (p.folder = m[1]);
    }
    var base = slugify(textOf(p.doc.querySelector('.blog-meta'))) || 'post';
    var used = posts.map(function(q){ return q.folder; });
    var name = base, n = 2;
    while (used.indexOf(name) !== -1) name = base + '-' + (n++);
    return (p.folder = name);
  }

  function upload(file, folder){
    return fetch('/__edit/cards/upload?page=tripblogs&folder=' + encodeURIComponent(folder) + '&name=' + encodeURIComponent(file.name), {
      method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/octet-stream' }, body: file
    }).then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j.src; }); });
  }

  function save(){
    // a post still open is saved as it is now
    if (openClone && openClone._tbPost) capture(openClone, openClone._tbPost);
    var live = posts.filter(function(p){ return !p.removed; });
    var jobs = [];
    live.forEach(function(p){
      p.doc.querySelectorAll('img').forEach(function(img){
        var key = img.getAttribute('data-pending');
        if (key && pending[key]) jobs.push(function(){
          return upload(pending[key], folderOf(p)).then(function(src){
            img.setAttribute('src', src);
            img.removeAttribute('data-pending');
            p.changed = true;
          });
        });
        var st = albedo[img.getAttribute('data-tb-id')];
        if (st && st.altFile) jobs.push(function(){
          return SiteAlbedo.upload(st, function(f){ return upload(f, folderOf(p)); }).then(function(){
            SiteAlbedo.apply(img, st);
            p.changed = true;
          });
        });
      });
    });
    return jobs.reduce(function(chain, job){ return chain.then(job); }, Promise.resolve()).then(function(){
      live.forEach(function(p){
        if (!p.isNew) return;
        var full = p.doc.querySelector('.project-full'), toggle = p.doc.querySelector('.project-toggle');
        var id = 'tripblog-' + folderOf(p) + '-desc';
        if (full) full.id = id;
        if (toggle) toggle.setAttribute('aria-controls', id);
      });
      var html = live.map(function(p, i){
        var gap = p.gap || '';
        if (i === 0) gap = gap.replace(/^\s*\n/, '');
        else if (gap.indexOf('\n') === -1) gap = '\n\n' + I(20);
        return gap + (p.changed ? serialize(p.doc) : p.src);
      }).join('') + (tail || '');
      return fetch('/__edit/cards/save', {
        method: 'POST',
        headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 'tripblogs', html: html })
      }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || r.statusText); }); });
    }).then(function(){ dirty = false; openClone = null; });
  }

  // for checking that unchanged posts round-trip
  window.TripBlogsEdit = { serialize: serialize, parseArticle: parseArticle };
})();
