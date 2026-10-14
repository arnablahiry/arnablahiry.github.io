// Edit mode for Publications (local editor only, see scripts/edit-mode.js and
// scripts/edit-server.js).
//
// The cards live in publications.html between the publications markers. Edit
// mode reads them from the saved file and turns each into a form:
//   - cover image (hover, click to replace), title, authors (**A. Lahiry**
//     for bold), journal line;
//   - one link per button: arXiv, NASA ADS, journal, project page (pick a
//     Research card or type any URL); an empty link means no button;
//   - the BibTeX entry itself (saved as bibtex/<name>.html, which the BibTeX
//     button opens);
//   - the abstract (blank line = new paragraph);
//   - "Shown on the site" (off = kept in the page but hidden), move up/down,
//     remove; "+ New publication" adds one at the top.
// Save uploads new covers, writes BibTeX pages and rewrites the cards.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  var grid = document.getElementById('projects-grid');
  if (!grid || !document.querySelector('link[href*="publications_style"]')) return;

  var LINKS = [
    { key: 'arxiv',   label: 'arXiv',       icon: 'images/icons/arxiv.png',   aria: 'arXiv',    placeholder: 'https://arxiv.org/abs/…' },
    { key: 'ads',     label: 'NASA ADS',    icon: 'images/icons/ads.png',     aria: 'ADS',      placeholder: 'https://ui.adsabs.harvard.edu/abs/…' },
    { key: 'journal', label: 'Journal',     icon: 'images/icons/journal.png', aria: 'Journal',  placeholder: 'https://doi.org/…' },
    { key: 'bibtex',  label: 'BibTeX',      icon: 'images/icons/cite.png',    aria: 'Citation', placeholder: '' },
    { key: 'project', label: 'Project page', icon: 'images/icons/project.png', aria: 'Project',  placeholder: 'research.html#proj-…' }
  ];
  var ICON_KEY = { 'arxiv.png': 'arxiv', 'ads.png': 'ads', 'journal.png': 'journal', 'cite.png': 'bibtex', 'project.png': 'project' };

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var UP = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DOWN = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var dirty = false;
  var list = null;
  function markDirty(){ dirty = true; }
  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }
  function esc(s){
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function text(html){
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent.replace(/\s+/g, ' ').trim();
  }
  function slug(s){
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').split('_').slice(0, 3).join('_') || 'paper';
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
    isDirty: function(){ return dirty; }
  });

  // --- Read the saved cards (and the BibTeX entries and Research cards) ---
  var START = /<!-- publications:start[\s\S]*?-->/;
  var END = /<!-- publications:end -->/;

  function start(){
    return Promise.all([
      fetch('publications.html', { cache: 'no-store' }).then(function(r){ return r.text(); }),
      fetch('research.html', { cache: 'no-store' }).then(function(r){ return r.ok ? r.text() : ''; }).catch(function(){ return ''; })
    ]).then(function(pages){
      var page = pages[0];
      var s = page.match(START), e = page.match(END);
      if (!s || !e) throw new Error('publications markers not found in publications.html');
      var doc = new DOMParser().parseFromString('<div id="r">' + page.slice(s.index + s[0].length, e.index) + '</div>', 'text/html');
      var pubs = Array.prototype.map.call(doc.querySelectorAll('#r > article.project-card'), parseCard);
      var research = new DOMParser().parseFromString(pages[1] || '', 'text/html');
      var projects = Array.prototype.map.call(research.querySelectorAll('article.project-card[id]'), function(a){
        var t = a.querySelector('.project-title');
        return { href: 'research.html#' + a.id, title: t ? t.textContent.replace(/\s+/g, ' ').trim() : a.id };
      });
      return Promise.all(pubs.map(function(p){
        if (!p.bibName) return p;
        return fetch('bibtex/' + p.bibName + '.html', { cache: 'no-store' })
          .then(function(r){ return r.ok ? r.text() : ''; })
          .then(function(html){
            var pre = new DOMParser().parseFromString(html, 'text/html').getElementById('bibtex');
            p.bibtex = pre ? pre.textContent.trim() : '';
            p.bibtexSaved = p.bibtex;
            return p;
          });
      })).then(function(list){ build(list, projects); });
    });
  }

  function parseCard(a){
    var img = a.querySelector('.project-image');
    var p = {
      hidden: a.hasAttribute('hidden'),
      image: img ? img.getAttribute('src') : '',
      title: text((a.querySelector('.project-title') || {}).innerHTML || ''),
      authors: '',
      journal: text((a.querySelector('.project-journal') || {}).innerHTML || ''),
      links: {},
      bibName: '',
      bibtex: '',
      bibtexSaved: '',
      abstract: ''
    };
    var au = a.querySelector('.project-authors');
    if (au) p.authors = text(au.innerHTML.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**').replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**'));
    a.querySelectorAll('.action-buttons .paper-button').forEach(function(b){
      var icon = b.querySelector('img');
      var key = icon ? ICON_KEY[icon.getAttribute('src').split('/').pop()] : null;
      var url = b.getAttribute('href') || ((b.getAttribute('onclick') || '').match(/window\.open\('([^']+)'/) || [])[1] || '';
      if (!key || !url) return;
      if (key === 'bibtex') {
        var m = url.match(/^bibtex\/([^/]+)\.html$/);
        if (m) { p.bibName = m[1]; return; }
      }
      p.links[key] = url;
    });
    var full = a.querySelector('.project-full');
    if (full) {
      var paras = Array.prototype.map.call(full.querySelectorAll('p'), function(x){ return text(x.innerHTML); }).filter(Boolean);
      p.abstract = paras.length ? paras.join('\n\n') : text(full.innerHTML);
    }
    return p;
  }

  // --- Edit form ---
  function build(pubs, projects){
    document.body.classList.add('publications-editing');
    grid.querySelectorAll('article.project-card').forEach(function(n){ n.remove(); });

    var dl = el('datalist', '', { id: 'pub-projects' });
    projects.forEach(function(pr){ var o = el('option'); o.value = pr.href; o.label = pr.title; dl.appendChild(o); });
    document.body.appendChild(dl);

    var bar = el('div', 'pub-new-bar');
    var add = el('button', 'pub-add-btn', { type: 'button' });
    add.textContent = '+ New publication';
    add.addEventListener('click', function(){
      var card = cardElement({ hidden: false, image: '', title: '', authors: '**A. Lahiry**', journal: '', links: {}, bibName: '', bibtex: '', bibtexSaved: '', abstract: '' });
      list.insertBefore(card, list.firstChild);
      markDirty();
      card.querySelector('.pub-title').focus();
    });
    bar.appendChild(add);

    list = el('div', 'pub-edit-list');
    pubs.forEach(function(p){ list.appendChild(cardElement(p)); });
    grid.insertBefore(list, grid.firstChild);
    grid.insertBefore(bar, list);
    list.querySelectorAll('textarea').forEach(autoGrow);
  }

  function field(labelText, input, hint){
    var wrap = el('label', 'pub-field');
    var l = el('span', 'pub-label');
    l.textContent = labelText;
    wrap.appendChild(l);
    wrap.appendChild(input);
    if (hint) { var h = el('span', 'pub-hint'); h.textContent = hint; wrap.appendChild(h); }
    return wrap;
  }

  function cardElement(p){
    var card = el('article', 'project-card pub-edit-card');
    card._bibName = p.bibName;
    card._bibSaved = p.bibtexSaved;
    card.dataset.image = p.image || '';
    card.classList.toggle('is-hidden', !!p.hidden);

    // cover
    var cover = el('div', 'pub-cover', { role: 'button', tabindex: '0', title: 'Change image' });
    var img = el('img', 'project-image', { alt: '' });
    if (p.image) img.src = p.image; else cover.classList.add('is-empty');
    cover.appendChild(img);
    var overlay = el('span', 'pub-cover-overlay');
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
      markDirty();
    });
    card.appendChild(cover);

    var meta = el('div', 'project-meta pub-edit-meta');

    // top row: shown toggle + move / remove
    var top = el('div', 'pub-top');
    var shown = el('label', 'pub-shown');
    var cb = el('input', '', { type: 'checkbox' });
    cb.checked = !p.hidden;
    cb.addEventListener('change', function(){ card.classList.toggle('is-hidden', !cb.checked); markDirty(); });
    shown.appendChild(cb);
    shown.appendChild(document.createTextNode(' Shown on the site'));
    top.appendChild(shown);
    var tools = el('div', 'pub-tools');
    tools.appendChild(iconButton(UP, 'pub-tool', 'Move up', function(){
      if (card.previousElementSibling) { list.insertBefore(card, card.previousElementSibling); markDirty(); }
    }));
    tools.appendChild(iconButton(DOWN, 'pub-tool', 'Move down', function(){
      if (card.nextElementSibling) { list.insertBefore(card.nextElementSibling, card); markDirty(); }
    }));
    tools.appendChild(iconButton(CROSS, 'pub-tool pub-tool-remove', 'Remove publication', function(){
      var name = card.querySelector('.pub-title').value.trim();
      if (!confirm('Remove ' + (name ? '"' + name + '"' : 'this publication') + '?')) return;
      card.remove();
      markDirty();
    }));
    top.appendChild(tools);
    meta.appendChild(top);

    function textBox(cls, value, placeholder, multiline){
      var t = multiline ? el('textarea', 'pub-input ' + cls, { rows: '1', placeholder: placeholder })
                        : el('input', 'pub-input ' + cls, { type: 'text', placeholder: placeholder });
      t.value = value || '';
      t.addEventListener('input', function(){ markDirty(); if (multiline) autoGrow(t); });
      return t;
    }
    meta.appendChild(textBox('pub-title project-title', p.title, 'Title', true));
    meta.appendChild(field('Authors', textBox('pub-authors', p.authors, 'A. Lahiry, …'), 'Wrap your name in ** to make it bold: **A. Lahiry**'));
    meta.appendChild(field('Journal / status', textBox('pub-journal', p.journal, 'e.g. Published: The Astrophysical Journal (2025)')));

    // links
    var links = el('div', 'pub-links');
    LINKS.forEach(function(L){
      var row = el('div', 'pub-link-row');
      row.dataset.key = L.key;
      var ic = el('img', 'pub-link-icon', { src: L.icon, alt: '' });
      row.appendChild(ic);
      var name = el('span', 'pub-link-name');
      name.textContent = L.label;
      row.appendChild(name);
      if (L.key === 'bibtex') {
        var bibName = el('input', 'pub-input pub-bibname', { type: 'text', placeholder: 'page name', 'aria-label': 'BibTeX page name' });
        bibName.value = p.bibName || '';
        bibName.title = 'Saved as bibtex/<name>.html';
        bibName.addEventListener('input', function(){ bibName.value = bibName.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''); markDirty(); });
        row.appendChild(bibName);
        var bib = textBox('pub-bibtex', p.bibtex, '@ARTICLE{…}  (paste the BibTeX entry; empty = no button)', true);
        row.appendChild(bib);
      } else {
        var input = textBox('pub-link', p.links[L.key], L.placeholder);
        if (L.key === 'project') input.setAttribute('list', 'pub-projects');
        row.appendChild(input);
      }
      links.appendChild(row);
    });
    meta.appendChild(field('Links (empty = no button)', links));

    meta.appendChild(field('Abstract', textBox('pub-abstract', p.abstract, 'Abstract (blank line = new paragraph)', true)));
    card.appendChild(meta);
    return card;
  }

  function autoGrow(t){
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
  }

  // --- Save ---
  var I = function(n){ return new Array(n + 1).join(' '); };

  function authorsHtml(s){
    return esc(s).replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  }

  function cardHtml(c, n){
    var out = [];
    out.push(I(20) + '<!-- Publication ' + n + ' -->');
    out.push(I(20) + '<article class="project-card"' + (c.hidden ? ' hidden' : '') + '>');
    out.push(I(24) + '<img class="project-image" src="' + esc(c.image) + '" alt="Publication image" loading="lazy" decoding="async">');
    out.push(I(24) + '<div class="project-meta">');
    out.push(I(28) + '<h3 class="project-title">' + esc(c.title) + '</h3>');
    if (c.authors) out.push(I(28) + '<p class="project-authors">' + authorsHtml(c.authors) + '</p>');
    if (c.journal) out.push(I(28) + '<p class="project-journal">' + esc(c.journal) + '</p>');
    out.push(I(28) + '<div class="action-buttons">');
    LINKS.forEach(function(L){
      var url = L.key === 'bibtex' ? (c.bibName && c.bibtex ? 'bibtex/' + c.bibName + '.html' : '') : c.links[L.key];
      if (!url) return;
      out.push(I(32) + '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="paper-button' + (L.key === 'project' ? ' paper-button--wide' : '') + '" aria-label="' + L.aria + '">');
      out.push(I(36) + '<img src="' + L.icon + '" alt="' + L.aria + '" loading="lazy" decoding="async">');
      out.push(I(32) + '</a>');
    });
    out.push(I(28) + '</div>');
    if (c.abstract) {
      out.push(I(28) + '<button class="project-toggle" aria-expanded="false" aria-controls="pub-' + n + '-desc">Show Abstract</button>');
      out.push(I(28) + '<div class="project-full" id="pub-' + n + '-desc" aria-expanded="false">');
      c.abstract.split(/\n\s*\n/).map(function(x){ return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean).forEach(function(par){
        out.push(I(32) + '<p>' + esc(par) + '</p>');
      });
      out.push(I(28) + '</div>');
    }
    out.push(I(24) + '</div>');
    out.push(I(20) + '</article>');
    return out.join('\n');
  }

  function collect(){
    return Array.prototype.map.call(list.children, function(card){
      var links = {};
      card.querySelectorAll('.pub-link-row').forEach(function(row){
        var input = row.querySelector('.pub-link');
        if (input) links[row.dataset.key] = input.value.trim();
      });
      var bibtex = card.querySelector('.pub-bibtex').value.trim();
      var title = card.querySelector('.pub-title').value.replace(/\s+/g, ' ').trim();
      var bibName = card.querySelector('.pub-bibname').value.trim() || (bibtex ? slug(title) : '');
      return {
        card: card,
        hidden: card.classList.contains('is-hidden'),
        image: card.dataset.image,
        title: title,
        authors: card.querySelector('.pub-authors').value.replace(/\s+/g, ' ').trim(),
        journal: card.querySelector('.pub-journal').value.replace(/\s+/g, ' ').trim(),
        links: links,
        bibName: bibName,
        bibtex: bibtex,
        bibtexChanged: bibtex && (bibtex !== card._bibSaved || bibName !== card._bibName),
        abstract: card.querySelector('.pub-abstract').value.trim()
      };
    });
  }

  function save(){
    var untitled = Array.prototype.filter.call(list.children, function(c){ return !c.querySelector('.pub-title').value.trim(); });
    if (untitled.length) {
      untitled[0].scrollIntoView({ block: 'center' });
      untitled[0].querySelector('.pub-title').focus();
      return Promise.reject(new Error('every publication needs a title'));
    }
    var uploads = Array.prototype.filter.call(list.children, function(c){ return c._file; });
    return uploads.reduce(function(chain, card){
      return chain.then(function(){
        return fetch('/__edit/publications/upload?name=' + encodeURIComponent(card._file.name), {
          method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/octet-stream' }, body: card._file
        }).then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j; }); })
          .then(function(j){ card.dataset.image = j.src; card._file = null; });
      });
    }, Promise.resolve()).then(function(){
      var pubs = collect();
      var bibtex = {};
      pubs.forEach(function(p){ if (p.bibtexChanged) bibtex[p.bibName] = p.bibtex; });
      var html = pubs.map(function(p, i){ return cardHtml(p, i + 1); }).join('\n\n');
      return fetch('/__edit/publications/save', {
        method: 'POST',
        headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: html, bibtex: bibtex })
      }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || r.statusText); }); });
    }).then(function(){ dirty = false; });
  }

  // for checking that the editor reproduces the page faithfully
  window.PublicationsEdit = { parseCard: parseCard, cardHtml: cardHtml };
})();
