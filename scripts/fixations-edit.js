// Edit mode for My Current Fixations (local editor only, see
// scripts/edit-mode.js and scripts/edit-server.js).
//
// In edit mode every card becomes a form: title and description become text
// boxes, the hearts follow the cursor (click to set, halves allowed), the
// pill picks the kind, hovering the cover shows a pencil to replace it,
// x removes a card and the "+" card adds one. Under each cover sits the
// albedo control (window.SiteAlbedo in scripts/edit-mode.js): flip the cover
// in the other theme, or keep it and add a second version for that theme.
// Save uploads any new covers and second versions, writes data/fixations.xlsx
// through the edit server and regenerates scripts/fixations-data.js.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  var page = window.FixationsPage;
  if (!page) return;

  var API = '/__edit/fixations/items';
  var IMAGES = 'images/fixations/';
  var editing = new URLSearchParams(location.search).get('edit') === '1';
  var dirty = false;

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var IMAGE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 5v14H5V5h14m0-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-4.86 8.86-3 3.87L9 13.14 6 17h12l-3.86-5.14z" fill="currentColor"/></svg>';

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }
  function markDirty(){ dirty = true; }

  (window.SiteEditors = window.SiteEditors || []).push({
    start: function(){
      return fetch(API, { cache: 'no-store' })
        .then(function(r){ if (!r.ok) throw new Error('editor server not reachable'); return r.json(); })
        .then(function(data){ startEditing(data.items || []); });
    },
    save: function(){
      var over = Array.prototype.slice.call(page.grid.querySelectorAll('.fixation-card.is-over-limit'));
      if (over.length) {
        var names = over.map(function(c){ return '• ' + (c.querySelector('.fixation-title').value.trim() || 'Untitled'); }).join('\n');
        if (!confirm('These cards are over the size limit:\n' + names + '\n\nSave anyway?')) {
          var err = new Error('Save cancelled');
          err.cancelled = true;
          return Promise.reject(err);
        }
      }
      return saveAll();
    },
    isDirty: function(){ return dirty; }
  });

  // --- Size-limit warnings (reported by scripts/fixations.js after sizing) ---
  page.onCardSized = function(card, info){
    if (!card.classList.contains('is-editing')) return;
    var notes = [];
    if (info.overHeight > 0) {
      var desc = card.querySelector('.fixation-desc');
      var text = desc ? desc.value.trim() : '';
      var chars = desc && desc.offsetHeight ? Math.ceil(text.length * info.overHeight / desc.offsetHeight) : 0;
      notes.push(chars > 0 ? 'About ' + chars + ' characters too long: the text runs past the image' : 'The text runs past the image');
    }
    if (info.overWidth > 0) notes.push(info.overWidth + 'px wider than the size limit (try a narrower image)');
    if (info.titleWraps) notes.push('Title too long for one line');
    var warn = card.querySelector('.fixation-warning');
    if (!warn) {
      warn = el('div', 'fixation-warning', { role: 'status' });
      card.appendChild(warn);
    }
    warn.textContent = '⚠ ' + notes.join(' · ');
    warn.hidden = !notes.length;
    // over the cover side (under a shortened cover there is free space),
    // so it never hides the text, and above the albedo control
    var coverWrap = card.querySelector('.fixation-cover-edit');
    var ctl = card.querySelector('.fixation-cover-col .albedo-ctl');
    warn.style.right = coverWrap ? Math.max(8, card.clientWidth - coverWrap.offsetWidth + 8) + 'px' : '';
    warn.style.bottom = ctl ? Math.max(8, card.clientHeight - ctl.offsetTop + 8) + 'px' : '';
    card.classList.toggle('is-over-limit', info.overHeight > 0 || info.overWidth > 0 || info.titleWraps);
  };

  // --- Edit mode ---
  function startEditing(items){
    var grid = page.grid;
    grid.innerHTML = '';
    items.forEach(function(item){ grid.appendChild(editCard(item)); });
    grid.appendChild(addCard());

    page.refresh();
    grid.querySelectorAll('.fixation-card').forEach(fitCard);
  }

  function editCard(item, isNew){
    var card = el('article', 'fixation-card is-editing');
    card.dataset.kind = item.kind || 'books';
    card.dataset.rating = page.clampRating(item.rating);
    card.dataset.image = item.image || '';

    // Cover: hover dims it and shows a pencil; click picks a new image
    var coverWrap = el('div', 'fixation-cover-edit', { role: 'button', tabindex: '0', title: 'Change image' });
    var cover;
    if (item.image) {
      cover = el('img', 'fixation-cover', { alt: '' });
      cover.src = IMAGES + item.image;
    } else {
      cover = el('div', 'fixation-cover fixation-cover-empty');
      cover.innerHTML = IMAGE_ICON;
    }
    coverWrap.appendChild(cover);
    var overlay = el('span', 'fixation-cover-overlay');
    overlay.innerHTML = PENCIL;
    coverWrap.appendChild(overlay);
    var file = el('input', '', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', hidden: '' });
    coverWrap.appendChild(file);
    coverWrap.addEventListener('click', function(){ file.click(); });
    coverWrap.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', function(){
      var f = file.files && file.files[0];
      if (!f) return;
      card._pendingFile = f;
      var current = coverWrap.querySelector('.fixation-cover');
      var img = current.tagName === 'IMG' ? current : el('img', 'fixation-cover', { alt: '' });
      if (img !== current) coverWrap.replaceChild(img, current);
      if (card._objectUrl) URL.revokeObjectURL(card._objectUrl);
      card._objectUrl = URL.createObjectURL(f);
      img.addEventListener('load', function(){ page.sizeCover(card); page.schedulePack(); }, { once: true });
      img.src = card._objectUrl;
      window.SiteAlbedo.replaced(card._albedo);
      previewAlbedo(card);
      markDirty();
    });

    // Albedo control under the cover (the cover itself keeps its own
    // keyboard / click handling, so they share a column)
    var coverCol = el('div', 'fixation-cover-col');
    coverCol.appendChild(coverWrap);
    card._albedo = isNew ? window.SiteAlbedo.fresh() : window.SiteAlbedo.read({
      'data-albedo': item.albedo || null,
      'data-src-light': item.imageLight ? IMAGES + item.imageLight : null,
      'data-src-dark': item.imageDark ? IMAGES + item.imageDark : null
    });
    coverCol.appendChild(window.SiteAlbedo.control(card._albedo, {
      compact: true,
      onChange: function(){ previewAlbedo(card); markDirty(); fitCard(card); }
    }));
    card.appendChild(coverCol);
    previewAlbedo(card);

    var remove = el('button', 'site-edit-remove', { type: 'button', title: 'Remove card', 'aria-label': 'Remove card' });
    remove.innerHTML = CROSS;
    remove.addEventListener('click', function(){
      var name = card.querySelector('.fixation-title').value.trim();
      if (!confirm('Remove ' + (name ? '"' + name + '"' : 'this card') + '?')) return;
      card.remove();
      markDirty();
      page.refresh();
    });
    card.appendChild(remove);

    var body = el('div', 'fixation-body');

    // a one-line text area, so a title too long for the card can wrap
    var title = el('textarea', 'fixation-title fixation-input', { rows: '1', placeholder: 'Title', 'aria-label': 'Title' });
    title.value = item.title || '';
    title.addEventListener('keydown', function(e){ if (e.key === 'Enter') e.preventDefault(); });
    title.addEventListener('input', function(){
      if (/\n/.test(title.value)) title.value = title.value.replace(/\s*\n\s*/g, ' ');
      markDirty();
      fitCard(card);
    });
    body.appendChild(title);

    body.appendChild(editableHearts(card));

    var desc = el('textarea', 'fixation-desc fixation-input', { placeholder: 'Description', 'aria-label': 'Description', rows: '1', cols: '1' });
    desc.value = item.description || '';
    desc.addEventListener('input', function(){ markDirty(); fitCard(card); });
    body.appendChild(desc);

    body.appendChild(kindPicker(card));
    card.appendChild(body);
    return card;
  }

  // Hearts follow the cursor (left half of a heart = half a heart), click to
  // set, click the same value again to clear; arrow keys step by halves.
  function editableHearts(card){
    var hearts = el('div', 'fixation-rating is-editable', { tabindex: '0', role: 'slider', 'aria-label': 'Rating', 'aria-valuemin': '0', 'aria-valuemax': '5' });
    function show(value){
      hearts.innerHTML = page.heartsHtml(value);
      hearts.setAttribute('aria-valuenow', value);
      hearts.setAttribute('aria-valuetext', value + ' of 5 hearts');
    }
    function valueAt(x){
      var svgs = hearts.querySelectorAll('svg');
      for (var i = 0; i < svgs.length; i++) {
        var r = svgs[i].getBoundingClientRect();
        if (x <= r.right + 2.5) return i + (x < r.left + r.width / 2 ? 0.5 : 1);
      }
      return 5;
    }
    function set(value){
      card.dataset.rating = value;
      show(value);
      markDirty();
    }
    hearts.addEventListener('mousemove', function(e){ show(valueAt(e.clientX)); });
    hearts.addEventListener('mouseleave', function(){ show(parseFloat(card.dataset.rating) || 0); });
    hearts.addEventListener('click', function(e){
      var v = valueAt(e.clientX);
      set(v === parseFloat(card.dataset.rating) ? 0 : v);
    });
    hearts.addEventListener('keydown', function(e){
      var v = parseFloat(card.dataset.rating) || 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = Math.min(5, v + 0.5);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = Math.max(0, v - 0.5);
      else return;
      e.preventDefault();
      set(v);
    });
    show(parseFloat(card.dataset.rating) || 0);
    return hearts;
  }

  function kindPicker(card){
    var pill = el('label', 'fixation-pill is-editable');
    var icon = el('img', '', { alt: '', width: '20', height: '20' });
    var select = el('select', '', { 'aria-label': 'Kind' });
    Object.keys(page.KINDS).forEach(function(k){
      var opt = el('option', '', { value: k });
      opt.textContent = page.KINDS[k].label;
      select.appendChild(opt);
    });
    function sync(){
      select.value = card.dataset.kind;
      icon.src = page.KINDS[card.dataset.kind].icon;
    }
    select.addEventListener('change', function(){
      card.dataset.kind = select.value;
      sync();
      markDirty();
      page.refresh();
    });
    pill.appendChild(icon);
    pill.appendChild(select);
    sync();
    return pill;
  }

  // The cover in edit mode shows the flip (not the second version, so the
  // pencil always replaces what is shown)
  function previewAlbedo(card){
    var cover = card.querySelector('img.fixation-cover');
    var a = window.SiteAlbedo.attrs(card._albedo)['data-albedo'];
    if (!cover) return;
    if (a) cover.setAttribute('data-albedo', a);
    else cover.removeAttribute('data-albedo');
  }

  // The "+" card: adds a blank card (of the kind being filtered, if any)
  function addCard(){
    var add = el('button', 'fixation-card fixation-add', { type: 'button', title: 'Add a card', 'aria-label': 'Add a card' });
    add.innerHTML = '<span aria-hidden="true">+</span>';
    add.addEventListener('click', function(){
      var kind = page.currentKind();
      var card = editCard({ kind: page.KINDS[kind] ? kind : 'books', rating: 0, title: '', description: '', image: '' }, true);
      add.parentNode.insertBefore(card, add);
      markDirty();
      page.refresh();
      fitCard(card);
      card.querySelector('.fixation-title').focus();
    });
    return add;
  }

  // Text boxes size to their content: the title box is exactly as wide as its
  // text (it sets the column width, as the heading does in the normal view),
  // the description box grows downwards; the cover and packing follow.
  // The title box is sized to its text with a hidden span in the box's own
  // font (a canvas measurement drifts from what the browser renders).
  var ruler = null;
  function titleTextWidth(input, text){
    if (!ruler) {
      ruler = el('span', '', { 'aria-hidden': 'true' });
      ruler.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;';
      document.body.appendChild(ruler);
    }
    var cs = getComputedStyle(input);
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing'].forEach(function(k){ ruler.style[k] = cs[k]; });
    ruler.textContent = text;
    return ruler.offsetWidth;
  }
  function fitCard(card){
    var title = card.querySelector('.fixation-title');
    if (title) {
      var cs = getComputedStyle(title);
      var pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      title.style.width = Math.ceil(titleTextWidth(title, title.value || title.placeholder) + pad + 4) + 'px';
    }
    // the description box height and the column width are set by sizeCover
    page.sizeCover(card);
    page.schedulePack();
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function(){
      if (editing) page.grid.querySelectorAll('.fixation-card.is-editing').forEach(fitCard);
    });
  }

  // --- Save: upload new covers (and second versions), then write all rows
  //     in page order ---
  // -> the image's path inside images/fixations/
  function uploadImage(kind, f){
    var url = '/__edit/fixations/upload?kind=' + encodeURIComponent(kind) + '&name=' + encodeURIComponent(f.name);
    return fetch(url, { method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/octet-stream' }, body: f })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j.image; }); });
  }
  function relImage(src){ return src ? String(src).replace(/^images\/fixations\//, '') : ''; }
  function saveAll(){
    var cards = Array.prototype.slice.call(page.grid.querySelectorAll('.fixation-card.is-editing'));
    return cards.reduce(function(chain, card){
      return chain.then(function(){
        if (!card._pendingFile) return;
        return uploadImage(card.dataset.kind, card._pendingFile)
          .then(function(image){ card.dataset.image = image; card._pendingFile = null; });
      }).then(function(){
        // a second version goes in the same folder as the cover
        var folder = (card.dataset.image || '').split('/')[0];
        return window.SiteAlbedo.upload(card._albedo, function(f){
          return uploadImage(page.KINDS[folder] ? folder : card.dataset.kind, f)
            .then(function(image){ return IMAGES + image; });
        });
      });
    }, Promise.resolve()).then(function(){
      var items = cards.map(function(card){
        var albedo = window.SiteAlbedo.attrs(card._albedo);
        return {
          kind: card.dataset.kind,
          image: card.dataset.image || '',
          title: card.querySelector('.fixation-title').value.trim(),
          rating: parseFloat(card.dataset.rating) || 0,
          description: card.querySelector('.fixation-desc').value.trim(),
          albedo: albedo['data-albedo'] || '',
          imageLight: relImage(albedo['data-src-light']),
          imageDark: relImage(albedo['data-src-dark'])
        };
      }).filter(function(item){ return item.title || item.image || item.description; });
      return fetch(API, {
        method: 'POST',
        headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items })
      }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || j.log || r.statusText); }); });
    });
  }
})();
