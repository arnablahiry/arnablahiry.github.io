// Edit mode for My Trip Blogs (local editor only, see scripts/edit-mode.js
// and scripts/edit-server.js).
//
// The posts live in tripblogs.html between the tripblogs-cards markers. In
// edit mode every card has an Edit button (clicking the card works too): it
// opens the post exactly as readers see it, and everything in it is typed
// into in place: the "PLACE · YEAR" line, the title, the teaser and the
// story, with photos sized and placed by dragging (scripts/story-edit.js
// does the editing; its header has the details). "+ New post" adds a card
// at the top; x on a card removes it. Closing a post keeps its changes; Save
// uploads new photos into images/trip_blogs/<post>/ and rewrites only the
// posts that changed.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  if (!document.body.classList.contains('page-tripblogs')) return;
  var grid = document.getElementById('projects-grid');
  if (!grid) return;

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var FOLDER_RE = /^[a-z0-9][a-z0-9_-]*$/;

  var posts = [];        // { src, gap, doc (the saved <article>, inert), live (its card), changed, removed, isNew }
  var tail = '';
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
    e.detail.clone._tbSession.done();
    openClone = null;
    var fresh = liveCard(p);
    if (p.live.parentNode) p.live.parentNode.replaceChild(fresh, p.live);
    p.live = fresh;
  });

  // --- Editing an opened post (scripts/story-edit.js does the editing) ---
  function textOf(node){ return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }

  function makeEditable(clone, p){
    openClone = clone;
    clone._tbPost = p;
    clone.querySelectorAll('.tb-card-tools').forEach(function(n){ n.remove(); });
    clone._tbSession = StoryEdit.attach(clone, {
      fields: [
        { sel: '.blog-meta', tag: 'div', placeholder: 'Place · Year' },
        { sel: '.project-title', tag: 'h3', placeholder: 'Title (optional: without one, the place line is the title)', after: '.blog-meta' },
        { sel: '.project-subtitle', tag: 'p', placeholder: 'A one- or two-sentence teaser (also shown on the card)', after: '.project-title' }
      ],
      onDirty: function(){ dirty = true; }
    });
  }

  // --- Back into the saved post ---
  function capture(clone, p){
    var before = serialize(p.doc);
    var r = clone._tbSession.capture();
    var doc = p.doc, owner = doc.ownerDocument;
    var dimg = doc.querySelector('.project-image');
    if (r.cover && dimg) {
      Array.prototype.slice.call(dimg.attributes).forEach(function(a){ dimg.removeAttribute(a.name); });
      Array.prototype.slice.call(r.cover.attributes).forEach(function(a){ dimg.setAttribute(a.name, a.value); });
    }
    var meta = doc.querySelector('.project-meta');
    function field(sel, tag, keepEmpty, after){
      var to = meta.querySelector(sel);
      var html = r.fields[sel] || '';
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
    doc.querySelector('.project-full').innerHTML = r.story.innerHTML;
    if (serialize(doc) !== before) { p.changed = true; dirty = true; }
  }

  // --- Writing a post ---
  // The post's markup in the page's own layout (indentation, the story as
  // StoryEdit.storyLines writes it). Used to write changed posts, and to
  // tell whether a post changed.
  function serialize(doc){
    var S = window.StoryEdit;
    var lines = [S.openTag(doc)];
    var img = doc.querySelector(':scope > .project-image');
    if (img) lines.push(I(24) + S.imgTag(img));
    var meta = doc.querySelector(':scope > .project-meta');
    if (meta) {
      lines.push(I(24) + S.openTag(meta));
      Array.prototype.forEach.call(meta.children, function(c){
        lines.push(I(28) + S.openTag(c) + S.inline(c.innerHTML) + '</' + c.tagName.toLowerCase() + '>');
      });
      lines.push(I(24) + '</div>');
    }
    var toggle = doc.querySelector(':scope > .project-toggle');
    if (toggle) lines.push(I(24) + toggle.outerHTML);
    var full = doc.querySelector(':scope > .project-full');
    if (full) lines = lines.concat([I(24) + S.openTag(full)], S.storyLines(full, 28), [I(24) + '</div>']);
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
        if (key && StoryEdit.pending[key]) jobs.push(function(){
          return upload(StoryEdit.pending[key], folderOf(p)).then(function(src){
            img.setAttribute('src', src);
            img.removeAttribute('data-pending');
            p.changed = true;
          });
        });
        var st = StoryEdit.albedo[img.getAttribute('data-tb-id')];
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
