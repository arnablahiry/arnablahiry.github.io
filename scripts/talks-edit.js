// Edit mode for Talks & Teaching (local editor only, see scripts/edit-mode.js
// and scripts/edit-server.js).
//
// The cards live in talks.html between the talks-cards markers. Two kinds:
//   - Presentation: a PDF (docs/talks/) shown in the page's PDF viewer. Its
//     cover is the poster rendered from page 1 of the PDF, unless you pick
//     your own image.
//   - Link: an outbound card (e.g. a notebook hosted elsewhere) with its own
//     cover, link text and badge.
// Each card: kind, date / label, description, cover, image description, the
// PDF or the link; arrows reorder, x removes, "+ Presentation" / "+ Link" add
// one at the top; Preview opens a presentation exactly as on the page.
// Save uploads new PDFs and images, rewrites only the cards that changed, then
// compresses new PDFs and renders their posters (npm run talks:sync).
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  if (!document.body.classList.contains('page-talks')) return;
  var grid = document.getElementById('projects-grid');
  if (!grid) return;

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var UP = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DOWN = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // the page's own markup for the parts that never change
  var VIEW_BUTTON_INNER = '<span class="talks-control-label">View Presentation</span><span class="talks-control-actions"><span class="pdf-badge">PDF</span><svg class="presentation-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="16" x2="12" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="20" x2="16" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>';
  var EXTERNAL_ICON = [
    '<svg class="talks-external-link-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">',
    '    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    '    <polyline points="15 3 21 3 21 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    '    <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    '</svg>'
  ];

  var dirty = false;
  var list = null, tail = '';
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
  function posterFor(pdf){ return 'images/talks/' + String(pdf).split('/').pop().replace(/\.pdf$/i, '') + '.jpg'; }

  (window.SiteEditors = window.SiteEditors || []).push({
    start: start,
    save: save,
    isDirty: function(){ return dirty; }
  });

  // --- Reading the saved page ---
  var START = /<!-- talks-cards:start[\s\S]*?-->\n?/;
  var END = /[ \t]*<!-- talks-cards:end -->/;

  // Splits the region into cards (<article> or <a class="talks-link-card">),
  // each with the text before it (comments included), and what follows.
  function splitCards(region){
    var out = [], pos = 0, re = /<article\b|<a class="talks-link-card"/g, m;
    while ((m = re.exec(region))) {
      var closeTag = m[0] === '<article' ? '</article>' : '</a>';
      var b = region.indexOf(closeTag, m.index);
      if (b === -1) break;
      b += closeTag.length;
      out.push({ gap: region.slice(pos, m.index), src: region.slice(m.index, b) });
      pos = b;
      re.lastIndex = b;
    }
    return { cards: out, tail: region.slice(pos) };
  }

  function readCard(src){
    var t = document.createElement('template');
    t.innerHTML = src;
    var root = t.content.firstElementChild;
    var img = root.querySelector('.project-image');
    var date = root.querySelector('.talk-date');
    var sub = root.querySelector('.project-subtitle');
    var c = {
      src: src,
      kind: root.tagName === 'A' ? 'link' : 'pdf',
      image: img ? img.getAttribute('src') : '',
      alt: img ? img.getAttribute('alt') || '' : '',
      date: date ? date.textContent.trim() : '',
      desc: sub ? sub.textContent.replace(/\s+/g, ' ').trim() : '',
      pdf: root.getAttribute('data-pdf') || '',
      url: root.tagName === 'A' ? root.getAttribute('href') || '' : '',
      linkText: '',
      badge: ''
    };
    var ext = root.querySelector('.talks-external-link');
    if (ext) {
      c.linkText = Array.prototype.filter.call(ext.childNodes, function(n){ return n.nodeType === 3; }).map(function(n){ return n.textContent; }).join(' ').replace(/\s+/g, ' ').trim();
      var badge = ext.querySelector('.pdf-badge');
      c.badge = badge ? badge.textContent.trim() : '';
    }
    return c;
  }

  function start(){
    return fetch('talks.html', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('could not read talks.html'); return r.text(); })
      .then(function(page){
        var s = page.match(START), e = page.match(END);
        if (!s || !e) throw new Error('talks-cards markers not found in talks.html');
        var parts = splitCards(page.slice(s.index + s[0].length, e.index));
        tail = parts.tail;
        build(parts.cards.map(function(p){ var c = readCard(p.src); c.gap = p.gap; return c; }));
      });
  }

  // --- Edit form ---
  function build(cards){
    document.body.classList.add('cards-editing', 'talks-editing');
    grid.querySelectorAll('article.project-card, a.talks-link-card').forEach(function(n){ n.remove(); });
    var bar = el('div', 'ce-new-bar');
    [['pdf', '+ Presentation'], ['link', '+ Link card']].forEach(function(k){
      var b = el('button', 'ce-add-btn', { type: 'button' });
      b.textContent = k[1];
      b.addEventListener('click', function(){
        var c = cardElement({ kind: k[0], image: '', alt: '', date: '', desc: '', pdf: '', url: '', linkText: 'Open', badge: k[0] === 'link' ? 'IPYNB' : '', src: '', gap: '' });
        c._changed = true;
        list.insertBefore(c, list.firstChild);
        dirty = true;
        c.querySelector('.tk-date').focus();
      });
      bar.appendChild(b);
    });
    list = el('div', 'ce-list');
    cards.forEach(function(c){ list.appendChild(cardElement(c)); });
    grid.insertBefore(list, grid.firstChild);
    grid.insertBefore(bar, list);
  }

  function field(labelText, input, hint){
    var wrap = el('label', 'ce-field');
    var l = el('span', 'ce-label'); l.textContent = labelText; wrap.appendChild(l);
    wrap.appendChild(input);
    if (hint) { var h = el('span', 'ce-hint'); h.textContent = hint; wrap.appendChild(h); }
    return wrap;
  }

  function cardElement(data){
    var card = el('section', 'ce-card tk-card');
    card._data = data;
    card._changed = false;
    card.dataset.kind = data.kind;
    card.dataset.pdf = data.pdf || '';
    // a presentation whose cover is its own page-1 poster keeps following the PDF
    card._autoCover = data.kind === 'pdf' && (!data.image || data.image === posterFor(data.pdf));
    card.dataset.image = card._autoCover ? '' : (data.image || '');
    function changed(){ card._changed = true; dirty = true; }

    // cover
    var cover = el('div', 'ce-cover', { role: 'button', tabindex: '0', title: 'Change image' });
    var img = el('img', '', { alt: '' });
    var coverSrc = data.image || (data.pdf ? posterFor(data.pdf) : '');
    if (coverSrc) img.src = coverSrc; else cover.classList.add('is-empty');
    cover.appendChild(img);
    var overlay = el('span', 'ce-cover-overlay'); overlay.innerHTML = PENCIL; cover.appendChild(overlay);
    var file = el('input', '', { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/avif', hidden: '' });
    cover.appendChild(file);
    cover.addEventListener('click', function(e){ if (e.target !== file) file.click(); });
    cover.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', function(){
      var f = file.files && file.files[0];
      if (!f) return;
      card._file = f;
      card._autoCover = false;
      if (card._url) URL.revokeObjectURL(card._url);
      card._url = URL.createObjectURL(f);
      img.src = card._url;
      cover.classList.remove('is-empty');
      autoNote.hidden = true;
      changed();
    });
    var coverCol = el('div', 'tk-cover-col');
    coverCol.appendChild(cover);
    var autoNote = el('div', 'ce-hint tk-auto-note');
    autoNote.textContent = 'Cover: page 1 of the PDF (click to use your own image)';
    autoNote.hidden = !card._autoCover;
    coverCol.appendChild(autoNote);
    card.appendChild(coverCol);

    var form = el('div', 'ce-form');
    var top = el('div', 'ce-top tk-top');
    var kindLabel = el('span', 'tk-kind');
    kindLabel.textContent = data.kind === 'pdf' ? 'Presentation (PDF)' : 'Link card';
    top.appendChild(kindLabel);
    var tools = el('div', 'ce-tools');
    if (data.kind === 'pdf') {
      var prev = el('button', 'ce-mini-btn', { type: 'button' });
      prev.textContent = 'Preview';
      prev.title = 'Open this presentation exactly as on the page';
      prev.addEventListener('click', function(){ preview(card); });
      tools.appendChild(prev);
    }
    tools.appendChild(iconButton(UP, 'ce-tool', 'Move up', function(){
      if (card.previousElementSibling) { list.insertBefore(card, card.previousElementSibling); dirty = true; }
    }));
    tools.appendChild(iconButton(DOWN, 'ce-tool', 'Move down', function(){
      if (card.nextElementSibling) { list.insertBefore(card.nextElementSibling, card); dirty = true; }
    }));
    tools.appendChild(iconButton(CROSS, 'ce-tool ce-tool-remove', 'Remove card', function(){
      var name = card.querySelector('.tk-desc').value.slice(0, 60);
      if (!confirm('Remove this card' + (name ? ' ("' + name + '…")' : '') + '? The files stay in the repo.')) return;
      card.remove();
      dirty = true;
    }));
    top.appendChild(tools);
    form.appendChild(top);

    function textBox(cls, value, placeholder, multiline){
      var t = multiline ? el('textarea', 'ce-input ' + cls, { rows: '1', placeholder: placeholder })
                        : el('input', 'ce-input ' + cls, { type: 'text', placeholder: placeholder });
      t.value = value || '';
      t.addEventListener('input', function(){ changed(); if (multiline) autoGrow(t); });
      return t;
    }
    form.appendChild(field(data.kind === 'pdf' ? 'Date' : 'Label', textBox('tk-date', data.date, data.kind === 'pdf' ? 'e.g. May 2026' : 'e.g. Teaching notebook')));
    form.appendChild(field('Description', textBox('tk-desc', data.desc, 'What the talk was, where and for whom', true)));

    if (data.kind === 'pdf') {
      var pdfRow = el('div', 'ce-row');
      var pdfName = el('span', 'tk-file');
      pdfName.textContent = data.pdf ? data.pdf.split('/').pop() : 'No PDF yet';
      var pdfBtn = el('button', 'ce-mini-btn', { type: 'button' });
      pdfBtn.textContent = data.pdf ? 'Replace PDF' : 'Choose PDF';
      var pdfFile = el('input', '', { type: 'file', accept: 'application/pdf,.pdf', hidden: '' });
      pdfBtn.addEventListener('click', function(){ pdfFile.click(); });
      pdfFile.addEventListener('change', function(){
        var f = pdfFile.files && pdfFile.files[0];
        if (!f) return;
        card._pdfFile = f;
        if (card._pdfUrl) URL.revokeObjectURL(card._pdfUrl);
        card._pdfUrl = URL.createObjectURL(f);
        pdfName.textContent = f.name + ' (new — uploaded on save)';
        pdfBtn.textContent = 'Replace PDF';
        if (card._autoCover) { cover.classList.add('is-empty'); img.removeAttribute('src'); autoNote.textContent = 'Cover: page 1 of the new PDF, made on save'; autoNote.hidden = false; }
        changed();
      });
      pdfRow.appendChild(pdfName);
      pdfRow.appendChild(pdfBtn);
      pdfRow.appendChild(pdfFile);
      form.appendChild(field('Presentation', pdfRow));
    } else {
      form.appendChild(field('Link', textBox('tk-url', data.url, 'https://…')));
      var linkRow = el('div', 'tk-link-row');
      linkRow.appendChild(textBox('tk-linktext', data.linkText, 'Link text, e.g. Open AstroStat Academy Jupyter Book'));
      linkRow.appendChild(textBox('tk-badge', data.badge, 'Badge, e.g. IPYNB'));
      form.appendChild(field('Link text and badge', linkRow));
    }
    form.appendChild(field('Image description', textBox('tk-alt', data.alt, 'Alt text: what the cover shows')));
    card.appendChild(form);
    setTimeout(function(){ card.querySelectorAll('textarea').forEach(autoGrow); }, 0);
    return card;
  }

  function autoGrow(t){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

  // --- Writing a card ---
  var I = function(n){ return new Array(n + 1).join(' '); };
  function cardHtml(card){
    var q = function(s){ return card.querySelector(s); };
    var kind = card.dataset.kind;
    var image = card._autoCover ? posterFor(card.dataset.pdf) : card.dataset.image;
    var alt = q('.tk-alt').value.trim();
    var dims = card._dims ? ' width="' + card._dims.w + '" height="' + card._dims.h + '"' : '';
    var imgTag = '<img class="project-image" src="' + esc(image) + '" alt="' + esc(alt) + '"' + dims + ' loading="lazy" decoding="async">';
    var meta = [
      I(24) + '<div class="project-meta">',
      I(28) + '<div class="talk-date">' + esc(q('.tk-date').value.trim()) + '</div>',
      I(28) + '<p class="project-subtitle">' + esc(q('.tk-desc').value.replace(/\s+/g, ' ').trim()) + '</p>',
      I(24) + '</div>'
    ];
    if (kind === 'pdf') {
      var pdf = esc(card.dataset.pdf);
      return [
        '<article class="project-card" data-pdf="' + pdf + '">',
        I(24) + imgTag
      ].concat(meta, [
        I(24) + '<button class="project-toggle talks-view-btn" data-pdf="' + pdf + '" type="button">' + VIEW_BUTTON_INNER + '</button>',
        I(24) + '<div class="project-full" hidden>',
        I(28) + '<div class="talks-card-pdf-viewer">',
        I(32) + '<div class="talks-pdf-page-container">',
        I(36) + '<canvas></canvas>',
        I(32) + '</div>',
        I(32) + '<div class="talks-pdf-toolbar">',
        I(36) + '<button class="talks-pdf-prev" type="button" aria-label="Previous page">&#9664;</button>',
        I(36) + '<span class="talks-pdf-page-info">–</span>',
        I(36) + '<button class="talks-pdf-next" type="button" aria-label="Next page">&#9654;</button>',
        I(32) + '</div>',
        I(28) + '</div>',
        I(24) + '</div>',
        I(20) + '</article>'
      ]).join('\n');
    }
    var badge = q('.tk-badge').value.trim();
    return [
      '<a class="talks-link-card" href="' + esc(q('.tk-url').value.trim()) + '" target="_blank" rel="noopener noreferrer">',
      I(24) + imgTag
    ].concat(meta, [
      I(24) + '<span class="talks-external-link">',
      I(28) + esc(q('.tk-linktext').value.trim()),
      I(28) + '<span class="talks-control-actions">'
    ], badge ? [I(32) + '<span class="pdf-badge">' + esc(badge) + '</span>'] : [], EXTERNAL_ICON.map(function(l){ return I(32) + l; }), [
      I(28) + '</span>',
      I(24) + '</span>',
      I(20) + '</a>'
    ]).join('\n');
  }

  // --- Preview: the real expanded presentation ---
  function preview(card){
    if (!window.openProjectCard) return;
    if (!card.dataset.pdf && !card._pdfUrl) { alert('Choose a PDF first.'); return; }
    var holder = document.createElement('template');
    holder.innerHTML = cardHtml(card);
    var temp = holder.content.firstElementChild;
    var pdfUrl = card._pdfUrl || card.dataset.pdf;
    temp.setAttribute('data-pdf', pdfUrl);
    if (card._url) temp.querySelector('.project-image').src = card._url;
    var from = card.querySelector('.ce-cover').getBoundingClientRect();
    temp.style.cssText = 'position:fixed;left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;margin:0;';
    document.body.appendChild(temp);
    window.openProjectCard(temp);
    document.addEventListener('project-card:closed', function done(e){
      if (e.detail && e.detail.originalCard !== temp) return;
      document.removeEventListener('project-card:closed', done);
      temp.remove();
    });
  }

  // --- Save ---
  function upload(kind, file){
    return fetch('/__edit/talks/upload?kind=' + kind + '&name=' + encodeURIComponent(file.name), {
      method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/octet-stream' }, body: file
    }).then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j.src; }); });
  }

  function save(){
    var cards = Array.prototype.slice.call(list.querySelectorAll('.tk-card'));
    var bad = cards.filter(function(c){
      return c.dataset.kind === 'pdf' ? !(c.dataset.pdf || c._pdfFile) : !c.querySelector('.tk-url').value.trim();
    });
    if (bad.length) {
      bad[0].scrollIntoView({ block: 'center' });
      return Promise.reject(new Error(bad[0].dataset.kind === 'pdf' ? 'a presentation has no PDF' : 'a link card has no link'));
    }
    var jobs = [];
    cards.forEach(function(c){
      if (c._pdfFile) jobs.push(function(){ return upload('pdf', c._pdfFile).then(function(src){ c.dataset.pdf = src; c._pdfFile = null; }); });
      if (c._file) jobs.push(function(){
        var im = c.querySelector('.ce-cover img');
        if (im.naturalWidth) c._dims = { w: 1000, h: Math.round(1000 * im.naturalHeight / im.naturalWidth) };
        return upload('image', c._file).then(function(src){ c.dataset.image = src; c._file = null; });
      });
    });
    return jobs.reduce(function(chain, job){ return chain.then(job); }, Promise.resolve()).then(function(){
      var out = cards.map(function(c, i){
        var gap = c._data.gap || '';
        // whitespace-only gaps are normalised (comments in them are kept)
        if (!gap.trim()) gap = i === 0 ? I(20) : '\n\n' + I(20);
        else if (i === 0) gap = gap.replace(/^\s*\n/, '');
        if (!c._changed) return gap + c._data.src;
        if (!c._dims && c._data.src) {
          var m = c._data.src.match(/width="(\d+)" height="(\d+)"/);
          if (m) c._dims = { w: +m[1], h: +m[2] };
        }
        if (!c._dims && c.dataset.kind === 'pdf') c._dims = { w: 1000, h: 563 };
        return gap + cardHtml(c);
      }).join('') + (tail || '');
      return fetch('/__edit/talks/save', {
        method: 'POST',
        headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: out })
      }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || j.log || r.statusText); }); });
    }).then(function(){ dirty = false; });
  }

  // for checking that regenerated cards match the page
  window.TalksEdit = { splitCards: splitCards, readCard: readCard, cardHtml: cardHtml, cardElement: cardElement };
})();
