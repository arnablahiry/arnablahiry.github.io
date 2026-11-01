// Edit mode for the Research and Software cards (local editor only, see
// scripts/edit-mode.js and scripts/edit-server.js).
//
// The cards live in research.html / software.html between the
// <page>-cards markers. Edit mode reads them from the saved file and shows
// them as readers see them, each with:
//   - Edit (clicking the card works too): opens the card exactly as readers
//     see it, and the title, subtitle, cover and text are typed into in
//     place, with photos sized and placed by dragging (scripts/story-edit.js;
//     code, equations set apart and the like stay as written, with their
//     HTML editable). Closing it keeps the changes;
//   - Details: the card as a form:
//     the cover (hover, click to replace), title and subtitle (inline HTML
//     allowed, e.g. <b>N</b>);
//     Software only: category (personal / collaboration) and type (science,
//     fun) for the filters and tag chips, badges, and icon links: the
//     default buttons (GitHub, docs, PyPI, website, Zenodo; empty = no icon)
//     plus any number of others ("+ Button"); every button's icon can be
//     replaced (hover it, click), and an uploaded icon is cropped to a
//     centred circle;
//     the expanded text as HTML source, with "+ Figure" (pick an image; it is
//     inserted at the cursor and uploaded on save) and "Preview" (renders it,
//     equations and code included); under it, every figure in the text with
//     its own albedo control;
//     under the cover and each figure, the albedo control (SiteAlbedo in
//     scripts/edit-mode.js): flip it with the theme, or keep it and add a
//     version for the other theme;
//   - move earlier / later, remove; "+ New card" adds one at the top.
// Save rewrites only the cards that were edited; the others are written back
// exactly as they were.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  var PAGE = document.body.classList.contains('page-research') ? 'research'
    : document.body.classList.contains('page-software') ? 'software' : null;
  var grid = document.getElementById('projects-grid');
  if (!PAGE || !grid) return;
  var SOFTWARE = PAGE === 'software';
  var FILE = PAGE + '.html';

  var ICONS = [
    { kind: 'github',    label: 'GitHub',    icon: 'images/icons/github_software.svg',  alt: 'GitHub',    aria: 'GitHub repository' },
    { kind: 'docs',      label: 'Docs',      icon: 'images/icons/sphinx_software.png',  alt: 'Sphinx',    aria: 'documentation' },
    { kind: 'pypi',      label: 'PyPI',      icon: 'images/icons/pypi_software.png',    alt: 'PyPI',      aria: 'PyPI package' },
    { kind: 'website',   label: 'Website',   icon: 'images/icons/website_software.svg', alt: 'Website',   aria: 'website' },
    { kind: 'zenodo',    label: 'Zenodo',    icon: 'images/icons/Zenodo.png',           alt: 'Zenodo',    aria: 'Zenodo record' }
  ];
  var IMAGE_TYPES = 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/avif';
  function iconKind(src){
    var f = String(src || '').split('/').pop();
    for (var i = 0; i < ICONS.length; i++) if (ICONS[i].icon.split('/').pop() === f) return ICONS[i].kind;
    return null;
  }

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var LEFT = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M9 3L5 7l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var RIGHT = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var BODY_MARK = '<!--CARD-BODY-->';
  var dirty = false;
  var list = null, head = '', tail = '';
  var pendingImages = {};   // "__pending-image-N__" -> { file, url }
  var pendingCount = 0;
  var urlKey = {};          // the in-memory address of a pending image -> its "__pending-image-N__"
  var uploaded = {};        // "__pending-image-N__" -> where it was saved
  var openEdit = null;      // the card open in place: { card, session, base }

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }
  function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function I(n){ return new Array(n + 1).join(' '); }
  function addPending(file, url){
    var key = '__pending-image-' + (++pendingCount) + '__';
    pendingImages[key] = { file: file, url: url || URL.createObjectURL(file) };
    urlKey[pendingImages[key].url] = key;
    return key;
  }
  // a button on a card or in the opened card; keeps the text selection
  function cardButton(cls, html, title, onClick){
    var b = el('button', cls, { type: 'button', title: title, 'aria-label': title });
    b.innerHTML = html;
    b.addEventListener('mousedown', function(e){ e.preventDefault(); });
    b.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); onClick(e); });
    return b;
  }
  function iconButton(icon, className, label, onClick){
    var b = el('button', className, { type: 'button', title: label, 'aria-label': label });
    b.innerHTML = icon;
    b.addEventListener('click', function(e){ e.preventDefault(); onClick(); });
    return b;
  }

  (window.SiteEditors = window.SiteEditors || []).push({
    start: start,
    save: save,
    isDirty: function(){ return dirty || !!openEdit; }
  });

  // --- Reading the saved page ---
  var START = new RegExp('<!-- ' + PAGE + '-cards:start[\\s\\S]*?-->\\n?');
  var END = new RegExp('[ \\t]*<!-- ' + PAGE + '-cards:end -->');

  // Splits the region into the articles (each with the text before it) and
  // whatever follows the last one.
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

  // Start / end offsets of the inside of <div class="project-full" ...>.
  function bodyRange(src){
    var open = src.search(/<div[^>]*class="[^"]*\bproject-full\b[^"]*"[^>]*>/);
    if (open === -1) return null;
    var from = src.indexOf('>', open) + 1;
    var depth = 1, re = /<div\b|<\/div>/g, m;
    re.lastIndex = from;
    while ((m = re.exec(src))) {
      depth += m[0] === '</div>' ? -1 : 1;
      if (depth === 0) return { from: from, to: m.index };
    }
    return null;
  }

  function parseArticle(src){
    var t = document.createElement('template');
    t.innerHTML = src;
    return t.content.querySelector('article');
  }

  function readCard(src){
    var a = parseArticle(src);
    var img = a.querySelector('.project-image');
    var title = a.querySelector('.project-title');
    var sub = a.querySelector('.project-subtitle');
    var range = bodyRange(src);
    var card = {
      src: src,
      image: img ? img.getAttribute('src') : '',
      albedo: window.SiteAlbedo ? (img ? SiteAlbedo.read(img) : SiteAlbedo.fresh()) : null,
      title: title ? title.innerHTML.trim() : '',
      subtitle: sub ? sub.innerHTML.replace(/\s+/g, ' ').trim() : '',
      body: range ? src.slice(range.from, range.to) : '',
      tags: (a.getAttribute('data-tags') || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean),
      badges: [],
      icons: []   // every icon link, in page order: { src, href, alt }
    };
    a.querySelectorAll('.project-badges a').forEach(function(l){
      var i = l.querySelector('img');
      card.badges.push({ img: i ? i.getAttribute('src') : '', alt: i ? i.getAttribute('alt') || '' : '', href: l.getAttribute('href') || '' });
    });
    a.querySelectorAll('.project-icons .project-icon-link').forEach(function(l){
      var i = l.querySelector('img');
      card.icons.push({ src: i ? i.getAttribute('src') || '' : '', href: l.getAttribute('href') || '', alt: i ? i.getAttribute('alt') || '' : '' });
    });
    return card;
  }

  function start(){
    return fetch(FILE, { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('could not read ' + FILE); return r.text(); })
      .then(function(page){
        var s = page.match(START), e = page.match(END);
        if (!s || !e) throw new Error(PAGE + '-cards markers not found in ' + FILE);
        var parts = splitArticles(page.slice(s.index + s[0].length, e.index));
        tail = parts.tail;
        build(parts.cards.map(function(c){ var card = readCard(c.src); card.gap = c.gap; return card; }));
      });
  }

  // --- The cards ---
  // Each card's state is its form (the Details panel, kept in `list`, which
  // is shown as a panel over the page with one form at a time); the card in
  // the grid (form._live) is drawn from it.
  function build(cards){
    document.body.classList.add('tb-editing');
    grid.querySelectorAll('article.project-card').forEach(function(n){ n.remove(); });
    var bar = el('div', 'tb-new-bar');
    var add = el('button', 'tb-new-btn', { type: 'button' });
    add.textContent = '+ New card';
    add.addEventListener('click', function(){
      var c = cardElement(newCard());
      c._changed = true;
      var first = forms()[0];
      list.insertBefore(c, first || null);
      c._live = liveCard(c);
      grid.insertBefore(c._live, first ? first._live : null);
      laidOut();
      dirty = true;
      open(c);
    });
    bar.appendChild(add);
    list = el('div', 'ce-list ce-panel');
    list.hidden = true;
    list.addEventListener('click', function(e){ if (e.target === list) closeDetails(); });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && !list.hidden && !document.querySelector('.project-clone')) closeDetails();
    });
    document.body.appendChild(list);
    grid.insertBefore(bar, grid.firstChild);
    cards.forEach(function(c){
      var f = cardElement(c);
      list.appendChild(f);
      f._live = liveCard(f);
      grid.appendChild(f._live);
    });
    laidOut();
    document.execCommand('defaultParagraphSeparator', false, 'p');
  }
  function forms(){ return Array.prototype.slice.call(list.querySelectorAll(':scope > .ce-card')); }

  // The card as it would be saved, images not saved yet shown from memory
  function shownHtml(card){
    var savedImage = card.dataset.image;
    if (card._file && card._url) card.dataset.image = card._url;
    var html = rebuild(card);
    card.dataset.image = savedImage;
    Object.keys(pendingImages).forEach(function(k){ html = html.split(k).join(pendingImages[k].url); });
    return html;
  }

  // The card in the grid, with Edit, Details, move and remove
  function liveCard(card){
    var a = document.importNode(parseArticle(shownHtml(card)), true);
    a.setAttribute('tabindex', '0');
    // the cover's albedo is the one the form shows under the cover
    var img = a.querySelector('.project-image');
    if (img && card._data.albedo && window.StoryEdit) StoryEdit.register(img, card._data.albedo);
    var tools = el('div', 'tb-card-tools');
    if (window.StoryEdit) tools.appendChild(cardButton('tb-card-btn', PENCIL + '<span>Edit</span>', 'Edit this card in place', function(){ open(card); }));
    tools.appendChild(cardButton('tb-card-btn', '<span>Details</span>',
      SOFTWARE ? 'Category, badges, icon links and the HTML source' : 'The card as a form, with its HTML source', function(){ details(card); }));
    tools.appendChild(cardButton('tb-card-btn is-round', LEFT, 'Move earlier', function(){ move(card, -1); }));
    tools.appendChild(cardButton('tb-card-btn is-round', RIGHT, 'Move later', function(){ move(card, 1); }));
    tools.appendChild(cardButton('tb-card-btn is-remove', CROSS, 'Remove this card', function(){
      var name = card.querySelector('.ce-title').value.replace(/<[^>]+>/g, '').trim();
      if (!confirm('Remove ' + (name ? '"' + name + '"' : 'this card') + '?')) return;
      card._live.remove();
      card.remove();
      dirty = true;
    }));
    a.appendChild(tools);
    a.addEventListener('click', function(e){
      if (e.target.closest('.tb-card-tools')) return;
      e.preventDefault();   // links on the card don't leave the editor
      open(card);
    });
    a.addEventListener('keydown', function(e){
      if (e.target === a && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(card); }
    });
    return a;
  }
  function refreshLive(card){
    if (!card._live) return;
    var fresh = liveCard(card);
    if (card._live.parentNode) card._live.parentNode.replaceChild(fresh, card._live);
    card._live = fresh;
    laidOut();
  }
  // the page sizes some parts of the cards once they are on it (Software:
  // the badges, to the height of the tag chips)
  function laidOut(){ if (window.syncProjectBadges) window.syncProjectBadges(); }

  function move(card, d){
    var all = forms(), i = all.indexOf(card), other = all[i + d];
    if (!other) return;
    if (d < 0) { list.insertBefore(card, other); grid.insertBefore(card._live, other._live); }
    else { list.insertBefore(other, card); grid.insertBefore(other._live, card._live); }
    dirty = true;
  }

  // --- Details: the card's form, over the page ---
  function details(card){
    if (openEdit) return;
    forms().forEach(function(f){ f.classList.toggle('is-open', f === card); });
    list.hidden = false;
    list.scrollTop = 0;
    document.body.classList.add('ce-panel-open');
    card.querySelectorAll('textarea:not(.ce-body)').forEach(autoGrow);
  }
  function closeDetails(){
    var card = list.querySelector(':scope > .ce-card.is-open');
    list.hidden = true;
    document.body.classList.remove('ce-panel-open');
    if (card) { card.classList.remove('is-open'); refreshLive(card); }
  }

  function newCard(){
    var ids = Array.prototype.map.call(list.querySelectorAll('.ce-card'), function(c){ return c._data.src; }).join(' ');
    var n = 1;
    if (!SOFTWARE) { while (ids.indexOf('id="proj-' + n + '"') !== -1) n++; }
    var src = SOFTWARE
      ? [
        '<article class="project-card" data-tags="end-to-end, science">',
        I(24) + '<img class="project-image" src="" alt="Project banner" loading="lazy" decoding="async">',
        I(24) + '<div class="project-meta">',
        I(28) + '<h3 class="project-title"></h3>',
        I(28) + '<p class="project-subtitle"></p>',
        I(28) + '<div class="project-tags"></div>',
        I(24) + '</div>',
        I(24) + '<div class="project-full" hidden>' + BODY_MARK + '</div>',
        I(20) + '</article>'].join('\n')
      : [
        '<article class="project-card" id="proj-' + n + '">',
        I(24) + '<img class="project-image" src="" alt="Project image" loading="lazy" decoding="async">',
        I(24) + '<div class="project-meta">',
        I(28) + '<h3 class="project-title"></h3>',
        I(28) + '<p class="project-subtitle"></p>',
        I(24) + '</div>',
        I(24) + '<button class="project-toggle" aria-expanded="false" aria-controls="proj-' + n + '-desc">Learn more</button>',
        I(24) + '<div class="project-full" id="proj-' + n + '-desc" hidden>' + BODY_MARK + '</div>',
        I(20) + '</article>'].join('\n');
    var card = readCard(src.replace(BODY_MARK, ''));
    card.src = src.replace(BODY_MARK, '');
    card.gap = '\n\n' + I(20);
    card.body = '\n' + I(28) + '<p></p>\n' + I(24);
    if (SOFTWARE) card.tags = ['end-to-end', 'science'];
    if (card.albedo) card.albedo = SiteAlbedo.fresh();
    return card;
  }

  function field(labelText, input, hint){
    var wrap = el('label', 'ce-field');
    var l = el('span', 'ce-label');
    l.textContent = labelText;
    wrap.appendChild(l);
    wrap.appendChild(input);
    if (hint) { var h = el('span', 'ce-hint'); h.textContent = hint; wrap.appendChild(h); }
    return wrap;
  }

  function cardElement(data){
    var card = el('section', 'ce-card');
    card._data = data;
    card._changed = false;
    card.dataset.image = data.image || '';
    function changed(){ card._changed = true; dirty = true; }

    // cover
    var cover = el('div', 'ce-cover', { role: 'button', tabindex: '0', title: 'Change image' });
    var img = el('img', '', { alt: '' });
    if (data.image) img.src = data.image; else cover.classList.add('is-empty');
    cover.appendChild(img);
    var overlay = el('span', 'ce-cover-overlay');
    overlay.innerHTML = PENCIL;
    cover.appendChild(overlay);
    var file = el('input', '', { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/avif', hidden: '' });
    cover.appendChild(file);
    cover.addEventListener('click', function(e){ if (e.target !== file) file.click(); });
    cover.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', function(){
      var f = file.files && file.files[0];
      if (!f) return;
      card._file = f;
      if (card._url) URL.revokeObjectURL(card._url);
      card._url = URL.createObjectURL(f);
      img.src = card._url;
      cover.classList.remove('is-empty');
      if (data.albedo) SiteAlbedo.replaced(data.albedo);
      changed();
    });
    var coverCol = el('div', 'ce-cover-col');
    coverCol.appendChild(cover);
    if (data.albedo) coverCol.appendChild(SiteAlbedo.control(data.albedo, { onChange: changed }));
    card.appendChild(coverCol);

    var form = el('div', 'ce-form');
    var top = el('div', 'ce-top');
    var heading = el('span', 'ce-panel-title');
    heading.textContent = 'Card details';
    top.appendChild(heading);
    var tools = el('div', 'ce-tools');
    var doneBtn = el('button', 'ce-mini-btn ce-done', { type: 'button' });
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', closeDetails);
    tools.appendChild(doneBtn);
    top.appendChild(tools);
    form.appendChild(top);

    function textBox(cls, value, placeholder, multiline){
      var t = multiline ? el('textarea', 'ce-input ' + cls, { rows: '1', placeholder: placeholder })
                        : el('input', 'ce-input ' + cls, { type: 'text', placeholder: placeholder });
      t.value = value || '';
      t.addEventListener('input', function(){ changed(); if (multiline && !t.classList.contains('ce-body')) autoGrow(t); });
      return t;
    }
    form.appendChild(field('Title', textBox('ce-title', data.title, 'Title (inline HTML allowed)', true)));
    form.appendChild(field('Subtitle', textBox('ce-subtitle', data.subtitle, 'One or two lines shown on the card', true)));

    if (SOFTWARE) {
      // category + type -> data-tags and tag chips (the page filters use them)
      var cat = el('select', 'ce-input ce-category');
      [['end-to-end', 'Personal / End-to-end'], ['collaboration', 'Collaboration / Contributions']].forEach(function(o){
        var opt = el('option', '', { value: o[0] }); opt.textContent = o[1]; cat.appendChild(opt);
      });
      cat.value = data.tags.indexOf('collaboration') !== -1 ? 'collaboration' : 'end-to-end';
      cat.addEventListener('change', changed);
      var types = el('div', 'ce-types');
      ['science', 'fun'].forEach(function(t){
        var l = el('label', 'ce-check');
        var cb = el('input', 'ce-type', { type: 'checkbox', value: t });
        cb.checked = data.tags.indexOf(t) !== -1;
        cb.addEventListener('change', changed);
        l.appendChild(cb);
        l.appendChild(document.createTextNode(' ' + t.charAt(0).toUpperCase() + t.slice(1)));
        types.appendChild(l);
      });
      var catRow = el('div', 'ce-row');
      catRow.appendChild(cat);
      catRow.appendChild(types);
      form.appendChild(field('Category and type', catRow));

      // badges
      var badges = el('div', 'ce-badges');
      function badgeRow(b){
        var row = el('div', 'ce-badge-row');
        var prev = el('img', 'ce-badge-preview', { alt: '' });
        if (b.img) prev.src = b.img;
        var imgIn = textBox('ce-badge-img', b.img, 'Badge image URL (e.g. https://img.shields.io/badge/…)');
        imgIn.addEventListener('input', function(){ prev.src = imgIn.value; });
        var hrefIn = textBox('ce-badge-href', b.href, 'Link');
        row._alt = b.alt || 'Badge';
        row.appendChild(prev);
        row.appendChild(imgIn);
        row.appendChild(hrefIn);
        row.appendChild(iconButton(CROSS, 'ce-tool ce-tool-remove', 'Remove badge', function(){ row.remove(); changed(); }));
        return row;
      }
      data.badges.forEach(function(b){ badges.appendChild(badgeRow(b)); });
      var addBadge = el('button', 'ce-mini-btn', { type: 'button' });
      addBadge.textContent = '+ Badge';
      addBadge.addEventListener('click', function(){ badges.insertBefore(badgeRow({ img: '', href: '' }), addBadge); changed(); });
      badges.appendChild(addBadge);
      form.appendChild(field('Badges', badges));

      // icon links: a row per default button (its link, if the card has one),
      // then the card's other buttons; row._index is the link's position in
      // the saved card (-1 = new)
      var icons = el('div', 'ce-icons');
      var taken = {};
      function iconRow(o){
        var row = el('div', 'ce-icon-row');
        row._kind = o.kind || null;
        row._index = o.index;
        row.dataset.src = o.src || '';
        var pick = el('div', 'ce-icon-pick', { role: 'button', tabindex: '0', title: 'Change icon' });
        var im = el('img', 'ce-icon-img', { alt: '' });
        if (o.src) im.src = o.src; else pick.classList.add('is-empty');
        var over = el('span', 'ce-cover-overlay');
        over.innerHTML = PENCIL;
        var f = el('input', '', { type: 'file', accept: IMAGE_TYPES, hidden: '' });
        pick.appendChild(im);
        pick.appendChild(over);
        pick.appendChild(f);
        pick.addEventListener('click', function(e){ if (e.target !== f) f.click(); });
        pick.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.click(); } });
        f.addEventListener('change', function(){
          var file = f.files && f.files[0];
          f.value = '';
          if (!file) return;
          circleCrop(file).then(function(cropped){
            row._file = cropped;
            if (row._url) URL.revokeObjectURL(row._url);
            row._url = URL.createObjectURL(cropped);
            im.src = row._url;
            pick.classList.remove('is-empty');
            changed();
          }).catch(function(err){ alert('Could not read that image: ' + err.message); });
        });
        row.appendChild(pick);
        if (row._kind) {
          var name = el('span', 'ce-icon-name'); name.textContent = o.label; row.appendChild(name);
        } else {
          row.appendChild(textBox('ce-icon-label', o.label, 'Name (e.g. CosmoStat)'));
        }
        row.appendChild(textBox('ce-icon-href', o.href, 'URL'));
        if (row._kind) row.appendChild(el('span'));
        else row.appendChild(iconButton(CROSS, 'ce-tool ce-tool-remove', 'Remove button', function(){ row.remove(); changed(); }));
        return row;
      }
      ICONS.forEach(function(I){
        var at = -1;
        data.icons.forEach(function(ic, i){ if (at === -1 && !taken[i] && iconKind(ic.src) === I.kind) at = i; });
        if (at !== -1) taken[at] = true;
        icons.appendChild(iconRow({ kind: I.kind, label: I.label, index: at, src: at !== -1 ? data.icons[at].src : I.icon, href: at !== -1 ? data.icons[at].href : '' }));
      });
      data.icons.forEach(function(ic, i){
        if (!taken[i]) icons.appendChild(iconRow({ label: ic.alt, index: i, src: ic.src, href: ic.href }));
      });
      var addIcon = el('button', 'ce-mini-btn', { type: 'button' });
      addIcon.textContent = '+ Button';
      addIcon.addEventListener('click', function(){
        var row = iconRow({ label: '', index: -1, src: '', href: '' });
        icons.insertBefore(row, addIcon);
        changed();
        row.querySelector('.ce-icon-pick').click();
      });
      icons.appendChild(addIcon);
      form.appendChild(field('Icon links (empty URL = no button; hover an icon to change it)', icons));
    }

    // expanded text
    var bodyTools = el('div', 'ce-body-tools');
    // shown without the indentation every line shares in the page source;
    // it is put back on save
    var dd = dedent(data.body);
    card._indent = dd.indent;
    var body = textBox('ce-body', dd.text, 'HTML of the expanded card', true);
    body.spellcheck = false;
    var figBtn = el('button', 'ce-mini-btn', { type: 'button' }); figBtn.textContent = '+ Figure';
    var figFile = el('input', '', { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/avif', hidden: '' });
    figBtn.addEventListener('click', function(){ figFile.click(); });
    figFile.addEventListener('change', function(){
      var f = figFile.files && figFile.files[0];
      if (!f) return;
      var key = addPending(f);
      var snippet = SOFTWARE
        ? '<div class="image-wrapper no-invert">\n    <img src="' + key + '" alt="" loading="lazy" decoding="async">\n</div>\n<p style="text-align:center;"><em>Caption</em></p>\n'
        : '<figure style="text-align: center; margin: 20px 0;">\n    <img src="' + key + '" alt="" style="max-width: 100%; height: auto;" loading="lazy" decoding="async">\n    <figcaption>Fig. Caption</figcaption>\n</figure>\n';
      var at = body.selectionStart || body.value.length;
      var lineStart = body.value.lastIndexOf('\n', at - 1) + 1;
      var indent = (body.value.slice(lineStart).match(/^[ \t]*/) || [''])[0];
      var onBlankLine = !body.value.slice(lineStart, at).trim();
      snippet = snippet.replace(/\n(?!$)/g, '\n' + indent);
      if (!onBlankLine) snippet = '\n' + indent + snippet;
      else if (at - lineStart < indent.length) at = lineStart + indent.length;
      // text after the cursor on this line keeps its indentation
      var lineEnd = body.value.indexOf('\n', at);
      if (body.value.slice(at, lineEnd === -1 ? undefined : lineEnd).trim()) snippet += indent;
      body.value = body.value.slice(0, at) + snippet + body.value.slice(at);
      body.focus();
      body.selectionStart = body.selectionEnd = at + snippet.length;
      figFile.value = '';
      renderFigures();
      changed();
    });
    var prevBtn = el('button', 'ce-mini-btn', { type: 'button' }); prevBtn.textContent = 'Preview';
    prevBtn.title = 'Open this card exactly as it will look on the page';
    prevBtn.addEventListener('click', function(){ preview(card); });
    bodyTools.appendChild(figBtn);
    bodyTools.appendChild(figFile);
    bodyTools.appendChild(prevBtn);

    // What came back from the card opened in place (r) against how it was
    // when it opened or was last saved (base). Run on close and on save, so
    // a photo not saved yet keeps one placeholder however often it runs.
    card._apply = function(r, base){
      var S = window.StoryEdit;
      [['.project-title', '.ce-title'], ['.project-subtitle', '.ce-subtitle']].forEach(function(f){
        var v = r.fields[f[0]] || '';
        if (v === (base.fields[f[0]] || '')) return;
        var t = card.querySelector(f[1]);
        t.value = v;
        autoGrow(t);
        changed();
      });
      var key = r.cover && r.cover.getAttribute('data-pending');
      if (key && S.pending[key] && key !== card._coverKey) {
        card._coverKey = key;
        card._file = S.pending[key];
        if (card._url) URL.revokeObjectURL(card._url);
        card._url = r.cover.getAttribute('src');
        img.src = card._url;
        cover.classList.remove('is-empty');
        changed();
      }
      var ctl = coverCol.querySelector('.albedo-ctl');
      if (ctl && ctl.refresh) ctl.refresh();
      if (data.albedo && SiteAlbedo.changed(data.albedo)) changed();
      // new photos and new second versions wait in pendingImages, like "+ Figure"
      card._keys = card._keys || {};
      r.story.querySelectorAll('img').forEach(function(im){
        var dp = im.getAttribute('data-pending');
        if (dp && S.pending[dp]) {
          if (!card._keys[dp]) card._keys[dp] = addPending(S.pending[dp], im.getAttribute('src'));
          im.setAttribute('src', card._keys[dp]);
          im.removeAttribute('data-pending');
        }
        var st = S.albedo[im.getAttribute('data-tb-id')];
        if (st && st.altFile) {
          st.alt = addPending(st.altFile, st.altUrl);
          st.altFile = null;
          SiteAlbedo.apply(im, st);
        }
      });
      // written at the page's indentation (blocks kept as written carry it),
      // then shown without it like the rest of the text box
      function text(story){
        var out = dedent(S.storyLines(story, card._indent != null ? card._indent : 28).join('\n')).text;
        Object.keys(urlKey).forEach(function(u){ out = out.split(u).join(urlKey[u]); });
        Object.keys(uploaded).forEach(function(k){ out = out.split(k).join(uploaded[k]); });
        return out;
      }
      var now = text(r.story);
      if (now !== text(base.story)) {
        body.value = now;
        renderFigures();
        changed();
      }
    };
    var bodyWrap = el('div', 'ce-body-wrap');
    bodyWrap.appendChild(bodyTools);
    bodyWrap.appendChild(body);

    // every <img> in the text, each with its albedo control; a control
    // rewrites only the data-albedo / data-src-* attributes of its own tag
    // (a new second version waits in pendingImages like a new figure)
    var figs = el('div', 'ce-figs');
    var figTimer = 0;
    function imgTags(){
      var out = [], re = /<img\b[^>]*>/gi, m;
      while ((m = re.exec(body.value))) out.push({ at: m.index, tag: m[0] });
      return out;
    }
    function shown(src){ return src && pendingImages[src] ? pendingImages[src].url : src; }
    function setTagAttrs(n, st){
      var t = imgTags()[n];
      if (!t) return;
      var a = SiteAlbedo.attrs(st), tag = t.tag;
      Object.keys(a).forEach(function(k){
        tag = tag.replace(new RegExp('\\s' + k + '="[^"]*"', 'i'), '');
        if (a[k]) tag = tag.replace(/\s*\/?>$/, function(end){ return ' ' + k + '="' + esc(a[k]) + '"' + end; });
      });
      body.value = body.value.slice(0, t.at) + tag + body.value.slice(t.at + t.tag.length);
    }
    function renderFigures(){
      if (!window.SiteAlbedo) return;
      figs.innerHTML = '';
      imgTags().forEach(function(t, n){
        var tpl = document.createElement('template');
        tpl.innerHTML = t.tag;
        var tagImg = tpl.content.querySelector('img');
        var st = SiteAlbedo.read(tagImg);
        if (st.alt && pendingImages[st.alt]) st.altUrl = pendingImages[st.alt].url;
        var item = el('div', 'ce-fig');
        item.appendChild(el('img', 'ce-fig-thumb', { src: shown(tagImg.getAttribute('src')) || '', alt: '' }));
        item.appendChild(SiteAlbedo.control(st, { compact: true, onChange: function(){
          if (st.altFile) {
            st.alt = addPending(st.altFile, st.altUrl);
            st.altFile = null;
          }
          setTagAttrs(n, st);
          changed();
        } }));
        figs.appendChild(item);
      });
      figs.hidden = !figs.children.length;
    }
    body.addEventListener('input', function(){ clearTimeout(figTimer); figTimer = setTimeout(renderFigures, 400); });
    renderFigures();
    bodyWrap.appendChild(figs);
    form.appendChild(field('Expanded text (HTML)', bodyWrap));

    card.appendChild(form);
    setTimeout(function(){ card.querySelectorAll('textarea:not(.ce-body)').forEach(autoGrow); }, 0);
    return card;
  }

  // Lines that start inside a <pre> block: their spaces are part of the code,
  // so they are never dedented or reindented
  function preLines(lines){
    var inside = false;
    return lines.map(function(l){
      var was = inside;
      var open = l.lastIndexOf('<pre'), close = l.lastIndexOf('</pre>');
      if (open > close) inside = true; else if (close !== -1) inside = false;
      return was;
    });
  }
  function dedent(text){
    var lines = text.split('\n');
    var pre = preLines(lines);
    lines = lines.map(function(l, i){ return pre[i] ? l : l.replace(/^[ \t]+/, function(w){ return w.replace(/\t/g, '    '); }); });
    var indent = Infinity;
    lines.forEach(function(l, i){ if (!pre[i] && l.trim()) indent = Math.min(indent, l.match(/^ */)[0].length); });
    if (indent === Infinity) indent = 28;
    var out = lines.map(function(l, i){ return pre[i] ? l : l.slice(Math.min(indent, l.match(/^ */)[0].length)); });
    while (out.length && !out[0].trim()) out.shift();
    while (out.length && !out[out.length - 1].trim()) out.pop();
    return { indent: indent, text: out.join('\n') + '\n' };
  }
  function reindent(text, indent){
    var pad = new Array(indent + 1).join(' ');
    var lines = text.replace(/\s+$/, '').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    var pre = preLines(lines);
    return '\n' + lines.map(function(l, i){ return pre[i] ? l : l.trim() ? pad + l : ''; }).join('\n') + '\n' + new Array(Math.max(0, indent - 4) + 1).join(' ');
  }

  // Crops an image to the circle centred on it (transparent outside), as a
  // PNG at most 256px across
  function circleCrop(file){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){
        var w = img.naturalWidth, h = img.naturalHeight;
        var side = w && h ? Math.min(w, h) : 256;
        var size = Math.min(side, 256);
        var c = document.createElement('canvas');
        c.width = c.height = size;
        var ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        if (w && h) ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
        else ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob(function(blob){
          if (!blob) return reject(new Error('could not crop it'));
          var stem = file.name.replace(/\.[^.]+$/, '') || 'icon';
          resolve(new File([blob], stem + '.png', { type: 'image/png' }));
        }, 'image/png');
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('not an image')); };
      img.src = url;
    });
  }

  function autoGrow(t){
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
  }

  // --- Writing a card back ---
  // removes a node together with the indentation in front of it
  function removeWithSpace(node){
    var prev = node.previousSibling;
    if (prev && prev.nodeType === 3 && !prev.textContent.trim()) prev.remove();
    node.remove();
  }

  // appends a child on its own line, before the parent's closing indentation
  function appendIndented(parent, node, indent){
    var last = parent.lastChild;
    var closing = last && last.nodeType === 3 && !last.textContent.trim() ? last : null;
    parent.insertBefore(document.createTextNode('\n' + new Array(indent + 1).join(' ')), closing);
    parent.insertBefore(node, closing);
    if (!closing) parent.appendChild(document.createTextNode('\n' + new Array(indent - 3).join(' ')));
  }

  function rebuild(card){
    var data = card._data;
    var range = bodyRange(data.src);
    var src = range ? data.src.slice(0, range.from) + BODY_MARK + data.src.slice(range.to) : data.src;
    var a = parseArticle(src);
    var q = function(s){ return card.querySelector(s); };

    var img = a.querySelector('.project-image');
    if (img) img.setAttribute('src', card.dataset.image);
    if (img && data.albedo && SiteAlbedo.changed(data.albedo)) SiteAlbedo.apply(img, data.albedo);
    var title = a.querySelector('.project-title');
    if (title) title.innerHTML = q('.ce-title').value.trim();
    var sub = a.querySelector('.project-subtitle');
    if (sub) sub.innerHTML = q('.ce-subtitle').value.trim();

    if (SOFTWARE) {
      var meta = a.querySelector('.project-meta');
      // Only the parts that actually changed are rewritten, so untouched
      // markup (and its formatting) stays as it was.
      var tags = [q('.ce-category').value];
      card.querySelectorAll('.ce-type').forEach(function(cb){ if (cb.checked) tags.push(cb.value); });
      var tagBox = a.querySelector('.project-tags');
      var chipCount = tagBox ? tagBox.querySelectorAll('.tag-chip').length : 0;
      if (tags.join(',') !== data.tags.join(',') || chipCount !== tags.length) {
        a.setAttribute('data-tags', tags.join(', '));
        if (!tagBox && meta) { tagBox = document.createElement('div'); tagBox.className = 'project-tags'; appendIndented(meta, tagBox, 28); }
        var labels = { 'end-to-end': 'End-to-end', collaboration: 'Collaboration / Contributions', science: 'Science', fun: 'Fun' };
        var chips = tagBox.querySelectorAll('.tag-chip');
        var anchor = chips.length ? chips[0] : tagBox.firstChild;
        var indent = chips.length && chips[0].previousSibling && chips[0].previousSibling.nodeType === 3 ? chips[0].previousSibling.textContent : '\n' + new Array(33).join(' ');
        if (!chips.length) { tagBox.appendChild(document.createTextNode('\n' + new Array(29).join(' '))); anchor = tagBox.lastChild; }
        tags.forEach(function(t){
          var chip = document.createElement('span');
          chip.className = 'tag-chip';
          chip.textContent = labels[t];
          if (!chips.length) tagBox.insertBefore(document.createTextNode(indent), anchor);
          tagBox.insertBefore(chip, anchor);
          if (chips.length && indent) tagBox.insertBefore(document.createTextNode(indent), anchor);
        });
        Array.prototype.forEach.call(chips, removeWithSpace);
      }

      // badges
      var rows = Array.prototype.map.call(card.querySelectorAll('.ce-badge-row'), function(r){
        return { img: r.querySelector('.ce-badge-img').value.trim(), href: r.querySelector('.ce-badge-href').value.trim(), alt: r._alt };
      }).filter(function(b){ return b.img; });
      var sameBadges = rows.length === data.badges.length && rows.every(function(b, i){ return b.img === data.badges[i].img && b.href === data.badges[i].href; });
      if (!sameBadges && tagBox) {
        var badgeBox = tagBox.querySelector('.project-badges');
        if (rows.length) {
          if (!badgeBox) { badgeBox = document.createElement('div'); badgeBox.className = 'project-badges'; badgeBox.setAttribute('aria-hidden', 'true'); tagBox.appendChild(badgeBox); }
          badgeBox.innerHTML = rows.map(function(b){
            var im = '<img src="' + esc(b.img) + '" alt="' + esc(b.alt) + '" loading="lazy" decoding="async">';
            return '\n' + new Array(37).join(' ') + (b.href ? '<a href="' + esc(b.href) + '" target="_blank" rel="noopener">' + im + '</a>' : im);
          }).join('') + '\n' + new Array(33).join(' ');
        } else if (badgeBox) {
          removeWithSpace(badgeBox);
        }
      }

      // icon links: existing ones are updated in place (only what changed),
      // emptied or removed ones are dropped, new ones are added at the end
      var iconBox = a.querySelector('.project-icons');
      var links = iconBox ? Array.prototype.slice.call(iconBox.querySelectorAll('.project-icon-link')) : [];
      var kept = {};
      var short = q('.ce-title').value.replace(/<[^>]+>/g, '').split('[')[0].replace(/\s+/g, ' ').trim();
      card.querySelectorAll('.ce-icon-row').forEach(function(row){
        var href = row.querySelector('.ce-icon-href').value.trim();
        var src = row.dataset.src;
        var I = row._kind && ICONS.filter(function(x){ return x.kind === row._kind; })[0];
        var name = I ? I.alt : row.querySelector('.ce-icon-label').value.trim();
        var link = row._index >= 0 ? links[row._index] : null;
        if (!href || !src) return;
        if (link) {
          kept[row._index] = true;
          var old = data.icons[row._index], im = link.querySelector('img');
          if (href !== old.href) link.setAttribute('href', href);
          if (im && src !== old.src) im.setAttribute('src', src);
          if (im && !I && name !== old.alt) { im.setAttribute('alt', name || 'Link'); link.setAttribute('aria-label', short + ' ' + (name || 'link')); }
          return;
        }
        if (!iconBox && meta) { iconBox = document.createElement('div'); iconBox.className = 'project-icons'; appendIndented(meta, iconBox, 28); }
        var last = iconBox.lastChild;
        var trailing = last && last.nodeType === 3 ? last : null;
        var t = document.createElement('template');
        t.innerHTML = '<a class="project-icon-link" href="' + esc(href) + '" aria-label="' + esc(short + ' ' + (I ? I.aria : name || 'link')) + '" target="_blank" rel="noopener"><img class="project-icon" src="' + esc(src) + '" alt="' + esc(name || 'Link') + '" loading="lazy" decoding="async"></a>';
        iconBox.insertBefore(document.createTextNode('\n' + new Array(33).join(' ')), trailing);
        iconBox.insertBefore(t.content.firstChild, trailing);
        if (!trailing) iconBox.appendChild(document.createTextNode('\n' + new Array(29).join(' ')));
      });
      links.forEach(function(l, i){ if (!kept[i]) removeWithSpace(l); });
      if (iconBox && !iconBox.querySelector('.project-icon-link')) removeWithSpace(iconBox);
    }

    var html = a.outerHTML.replace(/ hidden=""/g, ' hidden');
    var bodyText = reindent(q('.ce-body').value, card._indent != null ? card._indent : 28);
    return html.indexOf(BODY_MARK) !== -1 ? html.replace(BODY_MARK, function(){ return bodyText; }) : html;
  }

  // --- Editing in place: the card opened and typed into ---
  // The card opens with the page's own expand code, not typeset, so
  // equations stay editable TeX; StoryEdit turns it into the editor. Closing
  // it brings the title, subtitle, cover and text back into the card's form.
  function open(card){
    if (openEdit || !window.openProjectCard || !window.StoryEdit) return;
    var live = card._live;
    document.addEventListener('project-card:expanded', function opened(e){
      if (!e.detail || e.detail.originalCard !== live) return;
      document.removeEventListener('project-card:expanded', opened);
      var clone = e.detail.clone;
      clone.querySelectorAll('.tb-card-tools').forEach(function(n){ n.remove(); });
      var session = StoryEdit.attach(clone, {
        fields: [
          { sel: '.project-title', tag: 'h3', placeholder: 'Title' },
          { sel: '.project-subtitle', tag: 'p', placeholder: 'Subtitle (also shown on the card)', after: '.project-title' }
        ],
        onDirty: function(){ dirty = true; }
      });
      openEdit = { card: card, session: session, base: session.capture() };
    });
    document.addEventListener('project-card:closed', function done(e){
      if (!e.detail || e.detail.originalCard !== live) return;
      document.removeEventListener('project-card:closed', done);
      if (openEdit && openEdit.card === card) {
        syncOpen();
        openEdit.session.done();
        openEdit = null;
      }
      refreshLive(card);
    });
    window.openProjectCard(live);
  }
  // the open card's changes, into its form
  function syncOpen(){
    if (!openEdit) return;
    openEdit.card._apply(openEdit.session.capture(), openEdit.base);
    openEdit.base = openEdit.session.capture();
  }

  // --- Preview: the real expanded card ---
  // Builds the card as it would be saved (unsaved cover and figures shown from
  // memory), places it over the editor card's cover and opens it with the
  // page's own expand code, so the preview uses exactly the live styles,
  // banner, fonts, equations and code highlighting.
  function preview(card){
    if (!window.openProjectCard) return;
    var savedImage = card.dataset.image;
    if (card._url) card.dataset.image = card._url;
    var html = rebuild(card);
    card.dataset.image = savedImage;
    Object.keys(pendingImages).forEach(function(k){ html = html.split(k).join(pendingImages[k].url); });

    var holder = document.createElement('template');
    holder.innerHTML = html;
    var temp = holder.content.querySelector('article');
    temp.removeAttribute('id');
    temp.classList.add('ce-preview-card');
    var full = temp.querySelector('.project-full');
    if (full) full.removeAttribute('id');
    var from = card.querySelector('.ce-cover').getBoundingClientRect();
    temp.style.cssText = 'position:fixed;left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;margin:0;z-index:2;opacity:0;pointer-events:none;';
    document.body.appendChild(temp);

    if (window.hljs) temp.querySelectorAll('pre code').forEach(function(c){ try { hljs.highlightElement(c); } catch (_) {} });
    // Equations are typeset before the card opens (the expanded view is a
    // copy of this card). Images are not waited for: hidden lazy images
    // never load; they load once the card is open.
    Promise.race([typeset(temp), new Promise(function(r){ setTimeout(r, 15000); })]).then(function(){
      // the expanded view copies this card, inline styles included, so it
      // must not inherit the placement-only ones (pointer-events would make
      // the preview ignore the mouse wheel)
      temp.style.opacity = '1';
      temp.style.pointerEvents = '';
      temp.style.zIndex = '';
      // safety net: typeset the opened card too, so any maths that was not
      // ready in time still renders (already rendered maths is left alone)
      document.addEventListener('project-card:expanded', function opened(e){
        if (e.detail && e.detail.originalCard !== temp) return;
        document.removeEventListener('project-card:expanded', opened);
        typeset(e.detail.clone);
      });
      window.openProjectCard(temp);
      document.addEventListener('project-card:closed', function done(e){
        if (e.detail && e.detail.originalCard !== temp) return;
        document.removeEventListener('project-card:closed', done);
        temp.remove();
      });
    });
  }

  // Typesets the maths in an element once MathJax has finished starting up
  // (before that, window.MathJax is only the configuration object).
  function typeset(node){
    var M = window.MathJax;
    if (!M) return Promise.resolve();
    var started = (M.startup && M.startup.promise) || Promise.resolve();
    return started.then(function(){
      return window.MathJax.typesetPromise ? window.MathJax.typesetPromise([node]) : null;
    }).catch(function(){});
  }

  // --- Save ---
  function upload(file, kind){
    return fetch('/__edit/cards/upload?page=' + PAGE + (kind ? '&kind=' + kind : '') + '&name=' + encodeURIComponent(file.name), {
      method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/octet-stream' }, body: file
    }).then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j.src; }); });
  }

  function save(){
    // a card still open is saved as it is now
    syncOpen();
    var cards = forms();
    var untitled = cards.filter(function(c){ return !c.querySelector('.ce-title').value.trim(); });
    if (untitled.length) {
      if (!openEdit) untitled[0]._live.scrollIntoView({ block: 'center' });
      return Promise.reject(new Error('every card needs a title'));
    }
    var iconless = Array.prototype.filter.call(list.querySelectorAll('.ce-icon-row'), function(r){
      return r.querySelector('.ce-icon-href').value.trim() && !r.dataset.src && !r._file;
    })[0];
    if (iconless) {
      var owner = iconless.closest('.ce-card');
      details(owner);
      iconless.scrollIntoView({ block: 'center' });
      return Promise.reject(new Error('a button with a link needs an icon (click its empty circle)'));
    }
    // covers, then figures still waiting in the text boxes
    var used = {};
    cards.forEach(function(c){ Object.keys(pendingImages).forEach(function(k){ if (c.querySelector('.ce-body').value.indexOf(k) !== -1) used[k] = true; }); });
    var jobs = cards.filter(function(c){ return c._file; }).map(function(c){
      return function(){ return upload(c._file).then(function(src){ c.dataset.image = src; c._file = null; }); };
    }).concat(cards.filter(function(c){ return c._data.albedo && c._data.albedo.altFile; }).map(function(c){
      return function(){ return SiteAlbedo.upload(c._data.albedo, function(f){ return upload(f); }); };
    })).concat(Array.prototype.filter.call(list.querySelectorAll('.ce-icon-row'), function(r){ return r._file && r.querySelector('.ce-icon-href').value.trim(); }).map(function(r){
      return function(){ return upload(r._file, 'icon').then(function(src){ r.dataset.src = src; r._file = null; }); };
    })).concat(Object.keys(used).map(function(k){
      return function(){ return upload(pendingImages[k].file).then(function(src){
        cards.forEach(function(c){
          var b = c.querySelector('.ce-body');
          if (b.value.indexOf(k) !== -1) { b.value = b.value.split(k).join(src); c._changed = true; }
        });
        uploaded[k] = src;
        delete pendingImages[k];
      }); };
    }));
    return jobs.reduce(function(chain, job){ return chain.then(job); }, Promise.resolve()).then(function(){
      var out = cards.map(function(c, i){
        var gap = c._data.gap || '';
        if (i === 0) gap = gap.replace(/^\s*\n/, '');
        else if (gap.indexOf('\n') === -1) gap = '\n\n' + new Array(21).join(' ');
        return gap + (c._changed ? rebuild(c) : c._data.src);
      }).join('') + (tail || '');
      return fetch('/__edit/cards/save', {
        method: 'POST',
        headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: PAGE, html: out })
      }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || r.statusText); }); });
    }).then(function(){ dirty = false; });
  }

  // for checking that unchanged cards round-trip exactly
  window.CardsEdit = { splitArticles: splitArticles, readCard: readCard, bodyRange: bodyRange };
})();
