// Edit mode for My Travels (local editor only, see scripts/edit-mode.js and
// scripts/edit-server.js).
//
// - Each country's photo grid ends with a "+" tile: pick one or more photos
//   to add to that country (they show straight away, marked "new").
// - Clicking a photo opens the lightbox with a caption box ("Add a
//   comment...") and an author picker (including "New author...").
// - x on a photo marks it for removal (click again to keep it); on Save the
//   file is moved to .edit-trash/ in the repo, not deleted.
// - Under the caption, the albedo control (window.SiteAlbedo, see
//   scripts/edit-mode.js): albedo inversion on (made for the theme the editor
//   is in, flipped in the other) or off, with optionally a second version of
//   the photo for the other theme.
// Save uploads the new photos into images/travels/<folder>/ (second versions
// next to them as <photo>.light.<ext> / <photo>.dark.<ext>, which are never
// listed as photos of their own), writes captions, authors and albedo
// settings into data/travel-captions.xlsx and rebuilds the photo list and
// thumbnails.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  if (!window.TravelPage || !window.TRAVEL_DATABASE_COUNTRIES) return;

  var DEFAULT_AUTHOR = window.TRAVEL_DEFAULT_AUTHOR || 'Arnab';
  var authorImage = window.TRAVEL_AUTHOR_IMAGE || function(){ return 'images/pfp_no_pixel.jpeg'; };
  var NEW_AUTHOR = '__new__';

  var saved = {};      // captions from the workbook: { folder: { file: {caption, author[, albedo, light, dark]} } }
  var authors = [];
  var edits = {};      // opened photos: { folder: { file: {caption, author, albedo: SiteAlbedo state} } }
  var pending = {};    // photos to upload: { folder: [{ file, url, caption, author, albedo }] }
  var removed = {};    // photos to remove: { folder: { file: true } }

  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var UNDO = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3L2 6l3 3M2.5 6H10a4 4 0 0 1 0 8H6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }

  (window.SiteEditors = window.SiteEditors || []).push({
    start: function(){
      return fetch('/__edit/travel/data', { cache: 'no-store' })
        .then(function(r){ if (!r.ok) throw new Error('editor server not reachable'); return r.json(); })
        .then(function(data){
          saved = data.captions || {};
          authors = data.authors && data.authors.length ? data.authors : [DEFAULT_AUTHOR];
          document.body.classList.add('travel-editing');
          window.TravelEdit = { decorateGrid: decorateGrid, decorateLightbox: decorateLightbox };
        });
    },
    save: save,
    isDirty: isDirty
  });

  // "images/travels/greece/greece_1.png" -> { folder: 'greece', file: 'greece_1.png' }
  function keyOf(src){
    var m = String(src || '').match(/images\/travels\/([^/]+)\/([^/?#]+)$/);
    return m ? { folder: m[1], file: decodeURIComponent(m[2]) } : null;
  }

  function photoSrc(folder, file){ return file ? 'images/travels/' + folder + '/' + file : null; }
  function thumbOf(src){ return String(src).replace(/\/([^/]+)\.[^./]+$/, '/thumbs/$1.jpg'); }

  // --- Albedo: one SiteAlbedo state per photo ---
  function albedoState(folder, s){
    return window.SiteAlbedo.read({
      'data-albedo': s.albedo || null,
      'data-src-light': photoSrc(folder, s.light),
      'data-src-dark': photoSrc(folder, s.dark)
    });
  }

  // Attributes to preview a state with: a second version not uploaded yet
  // shows from its local copy; saved ones as thumbnails in the grids
  function previewAttrs(s, thumb){
    var a = window.SiteAlbedo.attrs(s);
    var on = s.albedo === 'dark' || s.albedo === 'light';
    if (!on && s.altFile && s.altMode) a['data-src-' + s.altMode] = s.altUrl;
    else if (thumb) ['data-src-light', 'data-src-dark'].forEach(function(k){ if (a[k]) a[k] = thumbOf(a[k]); });
    return a;
  }

  function setAttrs(img, a){
    Object.keys(a).forEach(function(k){ if (a[k]) img.setAttribute(k, a[k]); else img.removeAttribute(k); });
  }

  // The photo on show and its tiles follow the control straight away
  function preview(item){
    if (!item || !item.albedo) return;
    var shown = document.getElementById('lightbox-image');
    if (shown) setAttrs(shown, previewAttrs(item.albedo, false));
    document.querySelectorAll('.photo-card .photo-card-button img').forEach(function(img){
      var card = img.closest('.photo-card');
      var mine = item.url ? img.getAttribute('data-pending-url') === item.url
        : card.dataset.src && card.dataset.src === item.src;
      if (!mine) return;
      // grid tiles show thumbnails, new photos their own file
      setAttrs(img, previewAttrs(item.albedo, !item.url && img.hasAttribute('data-albedo-thumb')));
    });
  }

  // "images/travels/greece/greece_1.light.png" -> "greece_1.light.png"
  function fileOf(src){ var k = src && keyOf(src); return k ? k.file : ''; }

  // Uploads a second version next to its photo: <photo>.<mode>.<ext>
  function uploadSecondVersion(folder, photoFile, s){
    return window.SiteAlbedo.upload(s, function(file){
      var dot = file.name.lastIndexOf('.');
      var name = photoFile.replace(/\.[^.]+$/, '') + '.' + s.altMode + (dot > 0 ? file.name.slice(dot) : '');
      return uploadFile(folder, name, file).then(function(j){ return photoSrc(folder, j.file); });
    });
  }

  function uploadFile(folder, name, body){
    var url = '/__edit/travel/upload?folder=' + encodeURIComponent(folder) + '&name=' + encodeURIComponent(name);
    return fetch(url, { method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/octet-stream' }, body: body })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j; }); });
  }

  function entryOf(item){
    var a = window.SiteAlbedo.attrs(item.albedo);
    return {
      caption: item.caption || '',
      author: item.author || '',
      albedo: a['data-albedo'] || '',
      light: fileOf(a['data-src-light']),
      dark: fileOf(a['data-src-dark'])
    };
  }

  // --- Photo grids: pending photos and the "+" tile ---
  function decorateGrid(grid, countryId){
    var country = window.TRAVEL_DATABASE_COUNTRIES[countryId];
    if (!country || !country.folder) return 0;
    var folder = country.folder;
    var extra = 0;
    grid.dataset.editCountry = countryId;

    // x on every existing photo: mark for removal / keep
    grid.querySelectorAll('.photo-card.has-photo:not(.is-pending)').forEach(function(card){
      if (card.querySelector('.site-edit-remove')) return;
      var key = keyOf(card.dataset.src);
      if (!key) return;
      var tile = card.querySelector('.photo-card-button img');
      var thumbAttrs = tile && /\/thumbs\//.test(tile.getAttribute('data-lazy-src') || tile.getAttribute('src') || '');
      if (thumbAttrs) tile.setAttribute('data-albedo-thumb', '');
      var opened = edits[key.folder] && edits[key.folder][key.file];
      if (opened) preview(opened);
      var btn = el('button', 'site-edit-remove', { type: 'button' });
      function show(){
        var gone = !!(removed[key.folder] && removed[key.folder][key.file]);
        card.classList.toggle('is-removed', gone);
        btn.innerHTML = gone ? UNDO : CROSS;
        btn.title = gone ? 'Keep this photo' : 'Remove this photo';
        btn.setAttribute('aria-label', btn.title);
      }
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        removed[key.folder] = removed[key.folder] || {};
        if (removed[key.folder][key.file]) delete removed[key.folder][key.file];
        else removed[key.folder][key.file] = true;
        show();
      });
      card.appendChild(btn);
      show();
    });

    // "No photos yet" placeholder makes way for the + tile
    var placeholder = grid.querySelector('.photo-placeholder');
    if (placeholder && !grid.querySelector('.has-photo')) { placeholder.remove(); extra -= 1; }

    var list = pending[folder] || [];
    list.forEach(function(p, i){
      var card = el('div', 'photo-card has-photo is-pending');
      var btn = el('button', 'photo-card-button', { type: 'button', title: 'New photo (saved on Save)' });
      var img = el('img', '', { alt: 'New photo', 'data-pending-url': p.url });
      setAttrs(img, previewAttrs(p.albedo, false));
      img.src = p.url;
      btn.appendChild(img);
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var metas = list.map(function(q){
          var who = q.author || DEFAULT_AUTHOR;
          return { src: q.url, caption: q.caption, credit: who, creditImage: authorImage(who), pending: q };
        });
        window.TravelPage.openLightbox(metas, i);
      });
      card.appendChild(btn);
      card.appendChild(el('span', 'photo-new-badge')).textContent = 'new';
      var drop = el('button', 'site-edit-remove', { type: 'button', title: 'Don\'t add this photo', 'aria-label': 'Don\'t add this photo' });
      drop.innerHTML = CROSS;
      drop.addEventListener('click', function(e){
        e.stopPropagation();
        list.splice(list.indexOf(p), 1);
        URL.revokeObjectURL(p.url);
        redecorate();
      });
      card.appendChild(drop);
      grid.appendChild(card);
      extra += 1;
    });

    var add = el('div', 'photo-card photo-add');
    var addBtn = el('button', 'photo-card-button', { type: 'button', title: 'Add photos to ' + country.name, 'aria-label': 'Add photos to ' + country.name });
    addBtn.innerHTML = '<span aria-hidden="true">+</span>';
    var input = el('input', '', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', multiple: '', hidden: '' });
    addBtn.addEventListener('click', function(e){ e.stopPropagation(); input.click(); });
    input.addEventListener('change', function(){
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      pending[folder] = pending[folder] || [];
      files.forEach(function(f){
        pending[folder].push({ file: f, url: URL.createObjectURL(f), caption: '', author: '', albedo: window.SiteAlbedo.fresh() });
      });
      redecorate();
    });
    add.appendChild(addBtn);
    add.appendChild(input);
    grid.appendChild(add);
    extra += 1;
    return extra;
  }

  // Re-add the edit tiles of every open grid (after photos were picked),
  // without re-rendering the grids themselves
  function redecorate(){
    document.querySelectorAll('[data-edit-country]').forEach(function(grid){
      grid.querySelectorAll('.photo-card.is-pending, .photo-card.photo-add').forEach(function(c){ c.remove(); });
      decorateGrid(grid, grid.dataset.editCountry);
      if (grid === window.TravelPage.focusGrid && window.TravelPage.updateFocusGridHeight) {
        window.TravelPage.updateFocusGridHeight(grid.children.length);
      }
    });
  }

  // --- Lightbox: caption box and author picker for the photo on show ---
  var ui = null;
  var target = null;   // object the inputs write into

  function buildLightboxUi(captionEl, nameEl){
    ui = {};
    ui.caption = el('textarea', 'lightbox-caption-input', { rows: '3', placeholder: '+ Add a comment…', 'aria-label': 'Caption' });
    captionEl.parentNode.insertBefore(ui.caption, captionEl);
    ui.author = el('select', 'lightbox-author-select', { 'aria-label': 'Author' });
    nameEl.parentNode.insertBefore(ui.author, nameEl);
    ui.albedo = el('div', 'lightbox-albedo');
    captionEl.parentNode.appendChild(ui.albedo);

    ui.caption.addEventListener('input', function(){
      if (target) target.caption = ui.caption.value;
    });
    ui.author.addEventListener('change', function(){
      var value = ui.author.value;
      if (value === NEW_AUTHOR) {
        var name = (prompt('Name of the new author') || '').trim();
        if (name && authors.indexOf(name) === -1) authors.push(name);
        fillAuthors();
        value = name || (target && target.author) || DEFAULT_AUTHOR;
        ui.author.value = value;
      }
      if (target) target.author = value === DEFAULT_AUTHOR ? '' : value;
      if (ui.image) ui.image.src = authorImage(value);
    });
  }

  function fillAuthors(){
    ui.author.innerHTML = '';
    authors.forEach(function(name){
      var opt = el('option', '', { value: name });
      opt.textContent = name;
      ui.author.appendChild(opt);
    });
    var add = el('option', '', { value: NEW_AUTHOR });
    add.textContent = 'New author…';
    ui.author.appendChild(add);
  }

  function decorateLightbox(frame, captionEl, nameEl, imageEl){
    if (!captionEl || !nameEl) return;
    if (!ui) buildLightboxUi(captionEl, nameEl);
    ui.image = imageEl;

    if (frame.pending) {
      target = frame.pending;
    } else {
      var key = keyOf(frame.src);
      if (!key) { target = null; ui.albedo.innerHTML = ''; return; }
      edits[key.folder] = edits[key.folder] || {};
      if (!edits[key.folder][key.file]) {
        var s = (saved[key.folder] || {})[key.file] || {};
        // created lazily; dropped again on save if nothing changed
        edits[key.folder][key.file] = {
          src: frame.src,
          caption: s.caption || '',
          author: s.author || '',
          albedo: albedoState(key.folder, s),
          _orig: (s.caption || '') + '\u0000' + (s.author || '')
        };
      }
      target = edits[key.folder][key.file];
    }

    // albedo control of this photo (one per photo, kept while editing)
    var item = target;
    if (!item._albedoCtl) item._albedoCtl = window.SiteAlbedo.control(item.albedo, { compact: true, onChange: function(){ preview(item); } });
    ui.albedo.innerHTML = '';
    ui.albedo.appendChild(item._albedoCtl);
    preview(item);

    var who = target.author || DEFAULT_AUTHOR;
    if (authors.indexOf(who) === -1) authors.push(who);
    fillAuthors();
    ui.caption.value = target.caption || '';
    ui.author.value = who;
    if (imageEl) imageEl.src = authorImage(who);
  }

  // Entries opened in the lightbox but left unchanged are not edits
  function changedEdits(){
    var out = {};
    Object.keys(edits).forEach(function(folder){
      Object.keys(edits[folder]).forEach(function(file){
        var e = edits[folder][file];
        if ((e.caption || '') + '\u0000' + (e.author || '') === e._orig && !window.SiteAlbedo.changed(e.albedo)) return;
        out[folder] = out[folder] || {};
        out[folder][file] = e;
      });
    });
    return out;
  }

  function isDirty(){
    return Object.keys(changedEdits()).length > 0
      || Object.keys(pending).some(function(f){ return pending[f].length; })
      || removedList().length > 0;
  }

  function removedList(){
    var out = [];
    Object.keys(removed).forEach(function(folder){
      Object.keys(removed[folder]).forEach(function(file){ out.push({ folder: folder, file: file }); });
    });
    return out;
  }

  // --- Save: upload new photos and second versions, then send caption and
  // albedo changes and removals ---
  function save(){
    var changed = changedEdits();
    var out = {};
    var uploads = [];
    Object.keys(pending).forEach(function(folder){
      pending[folder].forEach(function(p){ uploads.push({ folder: folder, p: p }); });
    });
    Object.keys(changed).forEach(function(folder){
      Object.keys(changed[folder]).forEach(function(file){
        if (removed[folder] && removed[folder][file]) return;
        uploads.push({ folder: folder, file: file, e: changed[folder][file] });
      });
    });
    return uploads.reduce(function(chain, u){
      return chain.then(function(){
        var item = u.p || u.e;
        var photo = u.p
          ? uploadFile(u.folder, u.p.file.name, u.p.file).then(function(j){ return j.file; })
          : Promise.resolve(u.file);
        return photo.then(function(file){
          return uploadSecondVersion(u.folder, file, item.albedo).then(function(){
            out[u.folder] = out[u.folder] || {};
            out[u.folder][file] = entryOf(item);
          });
        });
      });
    }, Promise.resolve()).then(function(){
      pending = {};
      return fetch('/__edit/travel/save', {
        method: 'POST',
        headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ captions: out, remove: removedList() })
      }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || j.log || r.statusText); }); });
    });
  }
})();
