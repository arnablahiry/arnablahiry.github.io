// Edit mode for the Research and Software cards (local editor only, see
// scripts/edit-mode.js and scripts/edit-server.js).
//
// The cards live in research.html / software.html between the
// <page>-cards markers. Edit mode reads them from the saved file and shows a
// form per card:
//   - the card front: cover (hover, click to replace), title and subtitle
//     (inline HTML allowed, e.g. <b>N</b>);
//     Software only: category (personal / collaboration) and type (science,
//     fun) for the filters and tag chips, badges, and icon links (GitHub,
//     docs, PyPI, website, Zenodo, CosmoStat; empty = no icon);
//   - the expanded text as HTML source, with "+ Figure" (pick an image; it is
//     inserted at the cursor and uploaded on save) and "Preview" (renders it,
//     equations and code included);
//   - move up / down, remove; "+ New card" adds one at the top.
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
    { kind: 'zenodo',    label: 'Zenodo',    icon: 'images/icons/Zenodo.png',           alt: 'Zenodo',    aria: 'Zenodo record' },
    { kind: 'cosmostat', label: 'CosmoStat', icon: 'images/icons/cosmostat.png',        alt: 'CosmoStat', aria: 'CosmoStat page' }
  ];
  function iconKind(src){
    var f = String(src || '').split('/').pop();
    for (var i = 0; i < ICONS.length; i++) if (ICONS[i].icon.split('/').pop() === f) return ICONS[i].kind;
    return null;
  }

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var UP = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DOWN = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var BODY_MARK = '<!--CARD-BODY-->';
  var dirty = false;
  var list = null, head = '', tail = '';
  var pendingImages = {};   // "__pending-image-N__" -> { file, url }
  var pendingCount = 0;

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }
  function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function iconButton(icon, className, label, onClick){
    var b = el('button', className, { type: 'button', title: label, 'aria-label': label });
    b.innerHTML = icon;
    b.addEventListener('click', function(e){ e.preventDefault(); onClick(); });
    return b;
  }

  (window.SiteEditors = window.SiteEditors || []).push({
    start: start,
    save: save,
    isDirty: function(){ return dirty; }
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
      title: title ? title.innerHTML.trim() : '',
      subtitle: sub ? sub.innerHTML.replace(/\s+/g, ' ').trim() : '',
      body: range ? src.slice(range.from, range.to) : '',
      tags: (a.getAttribute('data-tags') || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean),
      badges: [],
      icons: {}
    };
    a.querySelectorAll('.project-badges a').forEach(function(l){
      var i = l.querySelector('img');
      card.badges.push({ img: i ? i.getAttribute('src') : '', alt: i ? i.getAttribute('alt') || '' : '', href: l.getAttribute('href') || '' });
    });
    a.querySelectorAll('.project-icons .project-icon-link').forEach(function(l){
      var kind = iconKind((l.querySelector('img') || {}).getAttribute ? l.querySelector('img').getAttribute('src') : '');
      if (kind) card.icons[kind] = l.getAttribute('href') || '';
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

  // --- Edit form ---
  function build(cards){
    document.body.classList.add('cards-editing');
    grid.querySelectorAll('article.project-card').forEach(function(n){ n.remove(); });
    var bar = el('div', 'ce-new-bar');
    var add = el('button', 'ce-add-btn', { type: 'button' });
    add.textContent = '+ New card';
    add.addEventListener('click', function(){
      var c = cardElement(newCard());
      c._changed = true;
      list.insertBefore(c, list.firstChild);
      dirty = true;
      c.querySelector('.ce-title').focus();
    });
    bar.appendChild(add);
    list = el('div', 'ce-list');
    cards.forEach(function(c){ list.appendChild(cardElement(c)); });
    grid.insertBefore(list, grid.firstChild);
    grid.insertBefore(bar, list);
  }

  function newCard(){
    var ids = Array.prototype.map.call(list.querySelectorAll('.ce-card'), function(c){ return c._data.src; }).join(' ');
    var n = 1;
    if (!SOFTWARE) { while (ids.indexOf('id="proj-' + n + '"') !== -1) n++; }
    var I = function(k){ return new Array(k + 1).join(' '); };
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
    card.body = '\n' + I(28) + '<h3>Overview</h3>\n' + I(28) + '<p>Describe the project here.</p>\n' + I(28) + '\n' + I(24);
    if (SOFTWARE) card.tags = ['end-to-end', 'science'];
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
      changed();
    });
    card.appendChild(cover);

    var form = el('div', 'ce-form');
    var top = el('div', 'ce-top');
    var tools = el('div', 'ce-tools');
    tools.appendChild(iconButton(UP, 'ce-tool', 'Move up', function(){
      if (card.previousElementSibling) { list.insertBefore(card, card.previousElementSibling); dirty = true; }
    }));
    tools.appendChild(iconButton(DOWN, 'ce-tool', 'Move down', function(){
      if (card.nextElementSibling) { list.insertBefore(card.nextElementSibling, card); dirty = true; }
    }));
    tools.appendChild(iconButton(CROSS, 'ce-tool ce-tool-remove', 'Remove card', function(){
      var name = card.querySelector('.ce-title').value.replace(/<[^>]+>/g, '').trim();
      if (!confirm('Remove ' + (name ? '"' + name + '"' : 'this card') + '?')) return;
      card.remove();
      dirty = true;
    }));
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

      // icon links
      var icons = el('div', 'ce-icons');
      ICONS.forEach(function(I){
        var row = el('div', 'ce-icon-row');
        row.dataset.kind = I.kind;
        row.appendChild(el('img', 'ce-icon-img', { src: I.icon, alt: '' }));
        var name = el('span', 'ce-icon-name'); name.textContent = I.label; row.appendChild(name);
        row.appendChild(textBox('ce-icon-href', data.icons[I.kind], 'URL'));
        icons.appendChild(row);
      });
      form.appendChild(field('Icon links (empty = no icon)', icons));
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
      var key = '__pending-image-' + (++pendingCount) + '__';
      pendingImages[key] = { file: f, url: URL.createObjectURL(f) };
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
      changed();
    });
    var prevBtn = el('button', 'ce-mini-btn', { type: 'button' }); prevBtn.textContent = 'Preview';
    prevBtn.title = 'Open this card exactly as it will look on the page';
    prevBtn.addEventListener('click', function(){ preview(card); });
    bodyTools.appendChild(figBtn);
    bodyTools.appendChild(figFile);
    bodyTools.appendChild(prevBtn);
    var bodyWrap = el('div', 'ce-body-wrap');
    bodyWrap.appendChild(bodyTools);
    bodyWrap.appendChild(body);
    form.appendChild(field('Expanded text (HTML)', bodyWrap));

    card.appendChild(form);
    setTimeout(function(){ card.querySelectorAll('textarea:not(.ce-body)').forEach(autoGrow); }, 0);
    return card;
  }

  function dedent(text){
    var lines = text.replace(/\t/g, '    ').split('\n');
    var indent = Infinity;
    lines.forEach(function(l){ if (l.trim()) indent = Math.min(indent, l.match(/^ */)[0].length); });
    if (indent === Infinity) indent = 28;
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return { indent: indent, text: lines.map(function(l){ return l.slice(Math.min(indent, l.match(/^ */)[0].length)); }).join('\n') + '\n' };
  }
  function reindent(text, indent){
    var pad = new Array(indent + 1).join(' ');
    var lines = text.replace(/\s+$/, '').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    return '\n' + lines.map(function(l){ return l.trim() ? pad + l : ''; }).join('\n') + '\n' + new Array(Math.max(0, indent - 4) + 1).join(' ');
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

      // icon links: existing ones get their link updated in place (unknown
      // kinds are left alone); new ones are added at the end
      var iconBox = a.querySelector('.project-icons');
      var short = q('.ce-title').value.replace(/<[^>]+>/g, '').split('[')[0].replace(/\s+/g, ' ').trim();
      ICONS.forEach(function(I){
        var href = q('.ce-icon-row[data-kind="' + I.kind + '"] .ce-icon-href').value.trim();
        if (href === (data.icons[I.kind] || '')) return;
        var existing = iconBox && Array.prototype.filter.call(iconBox.querySelectorAll('.project-icon-link'), function(l){
          var im = l.querySelector('img');
          return im && iconKind(im.getAttribute('src')) === I.kind;
        })[0];
        if (existing) {
          if (href) existing.setAttribute('href', href); else removeWithSpace(existing);
          return;
        }
        if (!href) return;
        if (!iconBox && meta) { iconBox = document.createElement('div'); iconBox.className = 'project-icons'; appendIndented(meta, iconBox, 28); }
        var last = iconBox.lastChild;
        var trailing = last && last.nodeType === 3 ? last : null;
        var link = document.createElement('template');
        link.innerHTML = '<a class="project-icon-link" href="' + esc(href) + '" aria-label="' + esc(short + ' ' + I.aria) + '" target="_blank" rel="noopener"><img class="project-icon" src="' + I.icon + '" alt="' + I.alt + '" loading="lazy" decoding="async"></a>';
        iconBox.insertBefore(document.createTextNode('\n' + new Array(33).join(' ')), trailing);
        iconBox.insertBefore(link.content.firstChild, trailing);
        if (!trailing) iconBox.appendChild(document.createTextNode('\n' + new Array(29).join(' ')));
      });
      if (iconBox && !iconBox.querySelector('.project-icon-link')) removeWithSpace(iconBox);
    }

    var html = a.outerHTML.replace(/ hidden=""/g, ' hidden');
    var bodyText = reindent(q('.ce-body').value, card._indent || 28);
    return html.indexOf(BODY_MARK) !== -1 ? html.replace(BODY_MARK, function(){ return bodyText; }) : html;
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
  function upload(file){
    return fetch('/__edit/cards/upload?page=' + PAGE + '&name=' + encodeURIComponent(file.name), {
      method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/octet-stream' }, body: file
    }).then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j.src; }); });
  }

  function save(){
    var cards = Array.prototype.slice.call(list.querySelectorAll('.ce-card'));
    var untitled = cards.filter(function(c){ return !c.querySelector('.ce-title').value.trim(); });
    if (untitled.length) {
      untitled[0].scrollIntoView({ block: 'center' });
      untitled[0].querySelector('.ce-title').focus();
      return Promise.reject(new Error('every card needs a title'));
    }
    // covers, then figures still waiting in the text boxes
    var used = {};
    cards.forEach(function(c){ Object.keys(pendingImages).forEach(function(k){ if (c.querySelector('.ce-body').value.indexOf(k) !== -1) used[k] = true; }); });
    var jobs = cards.filter(function(c){ return c._file; }).map(function(c){
      return function(){ return upload(c._file).then(function(src){ c.dataset.image = src; c._file = null; }); };
    }).concat(Object.keys(used).map(function(k){
      return function(){ return upload(pendingImages[k].file).then(function(src){
        cards.forEach(function(c){
          var b = c.querySelector('.ce-body');
          if (b.value.indexOf(k) !== -1) { b.value = b.value.split(k).join(src); c._changed = true; }
        });
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
