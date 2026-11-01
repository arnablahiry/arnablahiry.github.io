// In-place editing of an opened project card (the expanded view that
// scripts/research.js shows), shared by the trip blog editor
// (scripts/tripblogs-edit.js) and the Research / Software card editor
// (scripts/cards-edit.js). Local editor only.
//
//   var session = StoryEdit.attach(clone, {
//     fields: [{ sel: '.project-title', tag: 'h3', placeholder: 'Title', after: '.blog-meta' }, ...],
//     onDirty: fn
//   });
//   ...when the card closes: var r = session.capture(); session.done();
//   r.fields['.project-title'] -> its HTML; r.cover -> the cover <img> (a
//   new one carries data-pending="se-N", the file is StoryEdit.pending[key]);
//   r.story -> the text, cleaned (StoryEdit.storyLines(r.story, indent)
//   writes it in the pages' layout).
//
// In the opened card: the fields and the text are typed into in place; a
// toolbar pinned to the top has bold, italic, underline, strikethrough,
// section heading and "+ Photo"; hovering the cover shows a pencil.
// Photos: the text is one column, thought of as four. A photo is one to four
// of those columns wide (− / +), keeps its aspect ratio, and the narrower
// ones sit left or right with the text wrapping around them. Drag a photo
// up or down, and left or right; drop it on another photo to put the two
// side by side (a pair, as wide as both: two halves fill a row; "Move both"
// drags the pair). Every photo, the cover included, has the albedo control.
// Blocks that are not plain text or a photo (code, equations set apart,
// screenshot wrappers, tables...) are shown as they are and kept exactly as
// written; "HTML" on one edits its source.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/avif';
  var SIZE_LABEL = { 1: '¼', 2: '½', 3: '¾', 4: 'Full' };

  var pending = {};   // "se-N" -> File: new photos and covers, uploaded by the page's editor on save
  var albedo = {};    // data-tb-id of an <img> -> SiteAlbedo state
  var counter = 0;

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
    var key = 'se-' + (++counter);
    pending[key] = file;
    return key;
  }
  function textOf(node){ return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }
  // an <img>'s albedo state, kept across openings by its data-tb-id
  function albedoFor(img){
    var id = img.getAttribute('data-tb-id');
    if (!id) { id = 'a' + (++counter); img.setAttribute('data-tb-id', id); }
    if (!albedo[id]) albedo[id] = SiteAlbedo.read(img);
    return albedo[id];
  }
  // lets a page share a state it already shows elsewhere (the card editor's cover)
  function register(img, state){
    var id = 'a' + (++counter);
    img.setAttribute('data-tb-id', id);
    albedo[id] = state;
  }

  // What a top-level block of the text is
  var TEXT_RE = /^(P|H[1-6]|UL|OL|BLOCKQUOTE)$/;
  function isPhoto(n){
    if (n.tagName !== 'FIGURE' || n.querySelectorAll('img').length !== 1) return false;
    return Array.prototype.every.call(n.children, function(c){ return c.tagName === 'IMG' || c.tagName === 'FIGCAPTION' || c.classList.contains('tb-fig-tools'); });
  }
  function kindOf(n){
    if (n.nodeType !== 1) return 'inline';
    if (isPhoto(n)) return 'photo';
    if (n.classList.contains('tb-pair')) return 'pair';
    if (TEXT_RE.test(n.tagName) && !n.querySelector('img, iframe, video, table, pre, figure, div, script, svg, canvas, mjx-container, button, input')) return 'text';
    if (/^(B|I|U|S|EM|STRONG|A|CODE|SPAN|SUP|SUB|BR|SMALL|MARK|KBD)$/.test(n.tagName)) return 'inline';
    return 'lock';
  }

  function attach(clone, opts){
    opts = opts || {};
    var dirty = function(){ if (opts.onDirty) opts.onDirty(); };
    var stash = {};         // data-se-lock -> the block's own HTML
    clone.classList.add('tb-edit-clone');
    clone.addEventListener('input', dirty);
    // the cover's and the text's own inline styles, as written: opening the
    // card animates its blocks with inline styles, and any change to a style
    // makes the browser rewrite all of it ("0" becomes "0px")
    clone.querySelectorAll('.project-image, .project-full [style]').forEach(function(n){
      n.setAttribute('data-se-style', n.getAttribute('style') || '');
    });
    document.execCommand('defaultParagraphSeparator', false, 'p');

    var meta = clone.querySelector('.project-meta');
    (opts.fields || []).forEach(function(f){
      if (!meta) return;
      var node = meta.querySelector(f.sel);
      if (!node) {
        node = el(f.tag, f.sel.slice(1));
        var ref = f.after ? meta.querySelector(f.after) : null;
        meta.insertBefore(node, ref ? ref.nextSibling : meta.firstChild);
      }
      lineField(node, f.placeholder);
    });

    var story = clone.querySelector('.project-full');
    story.contentEditable = 'true';
    story.spellcheck = true;
    if (!story.querySelector('p, h1, h2, h3, h4, ul, ol, blockquote, figure, div, pre, table')) story.innerHTML = '<p><br></p>';
    var emptyStory = function(){ story.classList.toggle('tb-empty-story', !textOf(story) && !story.querySelector('figure, img')); };
    emptyStory();
    story.addEventListener('input', emptyStory);
    story.addEventListener('paste', pastePlain);
    story.addEventListener('keydown', function(e){
      // Enter on an empty heading turns it back into a paragraph
      if (e.key === 'Enter' && !e.shiftKey && blockAt() && blockAt().tagName === 'H3') {
        setTimeout(function(){ var b = blockAt(); if (b && b.tagName === 'H3' && !textOf(b)) document.execCommand('formatBlock', false, 'p'); }, 0);
      }
    });
    Array.prototype.slice.call(story.children).forEach(function(n){
      var k = kindOf(n);
      if (k === 'photo') setupFigure(n, story, clone, dirty);
      else if (k === 'pair') {
        n.querySelectorAll(':scope > figure').forEach(function(f){ setupFigure(f, story, clone, dirty); });
        setupPair(n, story, clone);
      } else if (k === 'lock') setupLock(n, stash, dirty);
    });

    setupCover(clone, dirty);
    var bar = toolbar(clone, story, dirty);
    clone.insertBefore(bar.node, clone.firstChild);
    var first = meta && meta.querySelector('[contenteditable="true"]');
    setTimeout(function(){ (first && !textOf(first) ? first : story).focus(); }, 600);

    return {
      capture: function(){
        var out = { fields: {}, cover: null, story: null };
        (opts.fields || []).forEach(function(f){
          var n = meta && meta.querySelector(f.sel);
          out.fields[f.sel] = n ? richHtml(n) : '';
        });
        var cimg = clone.querySelector('.project-image');
        if (cimg) out.cover = clean(cimg.cloneNode(false));
        var copy = clean(story.cloneNode(true));
        copy.querySelectorAll('[data-se-lock]').forEach(function(n){
          var t = document.createElement('template');
          t.innerHTML = stash[n.getAttribute('data-se-lock')];
          n.parentNode.replaceChild(t.content, n);
        });
        out.story = copy;
        return out;
      },
      done: bar.done
    };
  }

  // a one-line field (title, subtitle, place line, caption)
  function markEmpty(node){ node.classList.toggle('tb-empty', !textOf(node) && !node.querySelector('img')); }
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

  function setupCover(clone, dirty){
    var hero = clone.querySelector('.project-hero');
    var img = clone.querySelector('.project-image');
    if (!hero || !img) return;
    var st = albedoFor(img);
    var tools = el('div', 'tb-cover-tools');
    tools.appendChild(button('tb-mini', PENCIL + '&nbsp;Cover', 'Replace the cover', function(){
      pickFiles(false, function(files){
        img.setAttribute('data-pending', addPending(files[0]));
        img.src = URL.createObjectURL(files[0]);
        SiteAlbedo.replaced(st);
        dirty();
      });
    }));
    tools.appendChild(albedoButton(tools, img, st, dirty));
    hero.appendChild(tools);
  }

  // ◐ opens the albedo control in a small panel next to the photo
  function albedoButton(tools, img, st, dirty){
    var pop = null;
    function close(){ if (pop) { pop.remove(); pop = null; tools.classList.remove('is-open'); } }
    return button('tb-mini', '◐', 'Albedo: how this photo follows the light / dark theme', function(){
      if (pop) { close(); return; }
      pop = el('div', 'tb-pop', { contenteditable: 'false' });
      pop.appendChild(SiteAlbedo.control(st, { compact: true, onChange: function(){ SiteAlbedo.apply(img, st); dirty(); } }));
      tools.appendChild(pop);
      tools.classList.add('is-open');
      setTimeout(function(){
        document.addEventListener('mousedown', function away(e){
          if (pop && (pop.contains(e.target) || tools.contains(e.target))) return;
          document.removeEventListener('mousedown', away, true);
          close();
        }, true);
      }, 0);
    });
  }

  // --- Toolbar ---
  function blockAt(){
    var sel = window.getSelection();
    if (!sel.rangeCount) return null;
    var n = sel.anchorNode;
    n = n && n.nodeType === 3 ? n.parentNode : n;
    return n && n.closest ? n.closest('p, h1, h2, h3, h4, li, blockquote') : null;
  }
  function toolbar(clone, story, dirty){
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
        dirty();
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
      dirty();
    });
    states.push(function(){ var b = blockAt(); heading.classList.toggle('is-active', !!(b && story.contains(b) && b.tagName === 'H3')); });
    bar.appendChild(heading);
    bar.appendChild(el('span', 'tb-tool-sep'));
    bar.appendChild(button('tb-tool-btn is-photo', '+ Photo', 'Add photos at the start of the text', function(){
      pickFiles(true, function(files){
        files.slice().reverse().forEach(function(f){ insertPhoto(f, story, clone, dirty); });
        story.scrollIntoView({ block: 'start', behavior: 'smooth' });
        dirty();
      });
    }));
    function refresh(){ states.forEach(function(s){ s(); }); }
    document.addEventListener('selectionchange', refresh);
    wrap.appendChild(bar);
    return { node: wrap, done: function(){ document.removeEventListener('selectionchange', refresh); } };
  }

  // --- Blocks kept as written ---
  function render(block){
    if (window.hljs) block.querySelectorAll('pre code').forEach(function(c){ try { hljs.highlightElement(c); } catch (_) {} });
    var M = window.MathJax;
    if (M && M.typesetPromise) ((M.startup && M.startup.promise) || Promise.resolve()).then(function(){ return M.typesetPromise([block]); }).catch(function(){});
  }
  function setupLock(block, stash, dirty){
    var id = 'l' + (++counter);
    stash[id] = block.outerHTML;
    block.setAttribute('data-se-lock', id);
    block.contentEditable = 'false';
    block.classList.add('tb-lock');
    var tools = el('div', 'tb-lock-tools', { contenteditable: 'false' });
    tools.appendChild(button('tb-mini', '&lt;/&gt; HTML', 'Edit the HTML of this block', function(){ editHtml(); }));
    tools.appendChild(button('tb-mini is-remove', CROSS, 'Remove this block', function(){ block.remove(); dirty(); }));
    block.insertBefore(tools, block.firstChild);
    render(block);

    function editHtml(){
      if (block.nextSibling && block.nextSibling.classList && block.nextSibling.classList.contains('tb-html-edit')) return;
      var panel = el('div', 'tb-html-edit', { contenteditable: 'false' });
      var area = el('textarea', 'tb-html-area', { spellcheck: 'false' });
      area.value = stash[id];
      var row = el('div', 'tb-html-row');
      var apply = el('button', 'tb-mini', { type: 'button' }); apply.textContent = 'Apply';
      var cancel = el('button', 'tb-mini', { type: 'button' }); cancel.textContent = 'Cancel';
      row.appendChild(apply); row.appendChild(cancel);
      panel.appendChild(area); panel.appendChild(row);
      block.parentNode.insertBefore(panel, block.nextSibling);
      area.style.height = Math.min(480, Math.max(120, area.scrollHeight + 4)) + 'px';
      area.focus();
      cancel.addEventListener('click', function(){ panel.remove(); });
      apply.addEventListener('click', function(){
        var t = document.createElement('template');
        t.innerHTML = area.value.trim();
        var nodes = Array.prototype.filter.call(t.content.childNodes, function(n){ return n.nodeType === 1; });
        if (nodes.length !== 1) { alert('Keep it to one block (one outer element).'); return; }
        block.parentNode.replaceChild(nodes[0], block);
        panel.remove();
        setupLock(nodes[0], stash, dirty);
        dirty();
      });
    }
  }

  // --- Photos ---
  // A "unit" is what sits in the text by itself: a photo, or a pair of
  // photos side by side (div.tb-pair). Widths count quarter columns.
  function widthOf(node){
    for (var w = 1; w <= 3; w++) if (node.classList.contains('tb-w' + w)) return w;
    return 4;
  }
  function sideOf(node){ return node.classList.contains('tb-right') ? 'right' : 'left'; }
  function pairOf(fig){ return fig.parentNode && fig.parentNode.classList && fig.parentNode.classList.contains('tb-pair') ? fig.parentNode : null; }
  // width and side of a unit in the text (full width has no side)
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

  function insertPhoto(file, story, clone, dirty){
    var fig = el('figure', 'tb-fig tb-w1 tb-left');
    var img = el('img', '', { src: URL.createObjectURL(file), alt: '', loading: 'lazy', decoding: 'async' });
    img.setAttribute('data-pending', addPending(file));
    fig.appendChild(img);
    fig.appendChild(el('figcaption'));
    var id = 'a' + (++counter);
    img.setAttribute('data-tb-id', id);
    albedo[id] = SiteAlbedo.fresh();
    SiteAlbedo.apply(img, albedo[id]);
    story.insertBefore(fig, story.firstChild);
    setupFigure(fig, story, clone, dirty);
    story.classList.remove('tb-empty-story');
  }

  function setupFigure(fig, story, clone, dirty){
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
      dirty();
    }
    tools.appendChild(button('tb-mini', PENCIL, 'Replace this photo', function(){
      pickFiles(false, function(files){
        img.setAttribute('data-pending', addPending(files[0]));
        img.src = URL.createObjectURL(files[0]);
        fig.classList.remove('is-missing');
        SiteAlbedo.replaced(st);
        dirty();
      });
    }));
    tools.appendChild(smaller);
    tools.appendChild(size);
    tools.appendChild(larger);
    tools.appendChild(albedoButton(tools, img, st, dirty));
    tools.appendChild(button('tb-mini is-remove', CROSS, 'Remove this photo', function(){
      var pair = pairOf(fig);
      fig.remove();
      tidyPair(pair);
      refreshSizes(story);
      dirty();
    }));
    fig.insertBefore(tools, fig.firstChild);
    showSize();
    dragUnit(fig, img, story, clone, dirty);
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
    dragUnit(pair, grip, story, clone, function(){ clone.dispatchEvent(new Event('input')); });
  }

  // Drag a photo (by the photo) or a pair (by its grip). A dashed box shows
  // where it will land: before which block, and on which side for the
  // narrower sizes. Over another photo, a bar on its left or right edge
  // means "put them side by side".
  function dragUnit(unit, handle, story, clone, dirty){
    var isFig = unit.tagName === 'FIGURE';
    handle.addEventListener('dragstart', function(e){ e.preventDefault(); });
    handle.addEventListener('pointerdown', function(e){
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      var x0 = e.clientX, y0 = e.clientY, dragging = false, drop = null, target = null;
      function blocks(){
        return Array.prototype.filter.call(story.children, function(n){ return n !== unit && n !== drop && !n.classList.contains('tb-html-edit'); });
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
          var over = Array.prototype.filter.call(story.querySelectorAll(':scope > figure.tb-fig, :scope > figure:not([data-se-lock])'), function(f){
            if (f === unit || !isPhoto(f)) return false;
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
        var w = widthOf(unit), gap = parseFloat(cs.getPropertyValue('--tb-gap')) || 28;
        best.side = w === 4 ? null : ev.clientX < left + width / 2 ? 'left' : 'right';
        var boxW = w === 4 ? width : (width - 3 * gap) * w / 4 + (w - 1) * gap;
        place(r, best.side === 'right' ? left + width - boxW : left, best.y, boxW, Math.min(unit.getBoundingClientRect().height, 320), false);
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
        // scroll the card when dragging near its top or bottom
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
        dirty();
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  // --- Back to markup ---
  function unwrap(n){ while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n); n.remove(); }
  function rename(n, tag){
    var m = document.createElement(tag);
    while (n.firstChild) m.appendChild(n.firstChild);
    n.parentNode.replaceChild(m, n);
    return m;
  }
  // Leaves only the content: no editor parts, no styles the browser added
  // while typing (or research.js while opening), the photos' own address
  // (not the theme-swapped one). Blocks kept as written are put back from
  // their copy afterwards (capture), so nothing here touches them.
  function clean(root){
    root.querySelectorAll('.tb-fig-tools, .tb-pair-tools, .tb-lock-tools, .tb-html-edit, .tb-drop, .tb-pop, .tb-cover-tools, .tb-toolbar-wrap').forEach(function(n){ n.remove(); });
    root.querySelectorAll('strike').forEach(function(n){ rename(n, 's'); });
    var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
    all.forEach(function(n){
      if (n.closest && n.closest('[data-se-lock]') && !n.hasAttribute('data-se-lock')) return;
      ['contenteditable', 'data-placeholder', 'data-missing', 'spellcheck'].forEach(function(a){ n.removeAttribute(a); });
      var own = n.getAttribute('data-se-style');
      if (own) n.setAttribute('style', own); else n.removeAttribute('style');
      n.removeAttribute('data-se-style');
      if (n.classList) {
        n.classList.remove('tb-empty', 'tb-empty-story', 'is-dragging', 'is-missing', 'is-open', 'tb-lock', 'tb-edit-clone');
        if (!n.classList.length) n.removeAttribute('class');
      }
      if (n.tagName === 'IMG' && n.hasAttribute('data-src-base')) {
        n.setAttribute('src', n.getAttribute('data-src-base'));
        n.removeAttribute('data-src-base');
      }
    });
    // spans and fonts the browser made while typing (no attributes left)
    root.querySelectorAll('span, font').forEach(function(n){ if (!n.attributes.length && !(n.closest('[data-se-lock]'))) unwrap(n); });
    return root;
  }
  function inline(html){ return html.replace(/\s+/g, ' ').replace(/(<br>|&nbsp;|\s)+$/, '').replace(/^(&nbsp;|\s)+/, ''); }
  function richHtml(node){ return inline(clean(node.cloneNode(true)).innerHTML); }

  function openTag(node){
    var c = node.cloneNode(false);
    c.removeAttribute('data-tb-id');
    return c.outerHTML.replace(/<\/[a-z0-9-]+>$/i, '').replace(/ hidden=""/, ' hidden');
  }
  function imgTag(img){
    var c = img.cloneNode(false);
    ['data-tb-id', 'data-src-base'].forEach(function(a){ c.removeAttribute(a); });
    return c.outerHTML;
  }

  // The text in the pages' layout: one block after another with a blank line
  // between, paragraphs with their text on its own line, photos as <figure>
  // with the image and caption on their own lines, pairs around their two
  // figures; any other block exactly as written.
  function storyLines(full, n){
    var lines = [], run = [];
    function add(block){ if (lines.length) lines.push(''); block.forEach(function(l){ lines.push(l); }); }
    function flush(){
      var html = inline(run.map(function(x){ return x.nodeType === 3 ? x.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;') : x.outerHTML; }).join(''));
      if (html) add([I(n) + '<p>', I(n + 4) + html, I(n) + '</p>']);
      // a <br> on its own between blocks is spacing: kept
      else run.forEach(function(x){ if (x.nodeType === 1 && x.tagName === 'BR') add([I(n) + '<br>']); });
      run = [];
    }
    function figure(f, k){
      var im = f.querySelector('img'), cap = f.querySelector('figcaption');
      var out = [I(k) + openTag(f)];
      if (im) out.push(I(k + 4) + imgTag(im));
      if (cap && inline(cap.innerHTML)) out.push(I(k + 4) + '<figcaption>' + inline(cap.innerHTML) + '</figcaption>');
      out.push(I(k) + '</figure>');
      return out;
    }
    Array.prototype.forEach.call(full.childNodes, function(x){
      if (x.nodeType === 3) { if (x.textContent.trim() || run.length) run.push(x); return; }
      if (x.nodeType !== 1) return;
      var k = kindOf(x);
      if (k === 'inline') { run.push(x); return; }
      flush();
      var tag = x.tagName.toLowerCase();
      if (k === 'photo') add(figure(x, n));
      else if (k === 'pair') {
        var out = [I(n) + openTag(x)];
        x.querySelectorAll(':scope > figure').forEach(function(f){ out = out.concat(figure(f, n + 4)); });
        add(out.concat([I(n) + '</div>']));
      } else if (k === 'text') {
        if (tag === 'ul' || tag === 'ol') {
          var items = Array.prototype.map.call(x.children, function(li){ return I(n + 4) + '<li>' + inline(li.innerHTML) + '</li>'; });
          if (items.length) add([I(n) + openTag(x)].concat(items, [I(n) + '</' + tag + '>']));
        } else if (inline(x.innerHTML).replace(/<br>/g, '').trim()) {
          add(tag === 'p' ? [I(n) + openTag(x), I(n + 4) + inline(x.innerHTML), I(n) + '</p>'] : [I(n) + openTag(x) + inline(x.innerHTML) + '</' + tag + '>']);
        }
      } else {
        add([I(n) + x.outerHTML]);
      }
    });
    flush();
    return lines;
  }

  window.StoryEdit = {
    attach: attach,
    pending: pending,
    albedo: albedo,
    register: register,
    storyLines: storyLines,
    inline: inline,
    openTag: openTag,
    imgTag: imgTag
  };
})();
