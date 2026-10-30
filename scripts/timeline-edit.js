// Edit mode for the Timeline (local editor only, see scripts/edit-mode.js and
// scripts/edit-server.js).
//
// The entries live in timeline.html between the timeline-entries markers.
// Edit mode reads them from the saved file (not from the live page, which
// scripts have already reformatted) and turns each one into a form:
//   - "+ New month entry" at the top adds an entry; type its month (e.g.
//     "March" or "January, February") and year. Entries sort themselves
//     newest first as soon as a date is filled in.
//   - each entry's blocks (text boxes and images) can be moved up and down
//     or removed; "+ Text" / "+ Image" under the last block adds another;
//   - hovering an image shows a pencil to replace it; under it the albedo
//     control (flip it with the theme, or a second version for the other
//     theme: see SiteAlbedo in scripts/edit-mode.js), then the image
//     description (alt text).
// Save uploads new images (and second versions) into images/timeline/, writes
// the entries back in the page's own markup (year separators and spacing
// included) and reloads.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  var component = document.querySelector('.page-timeline .timeline-component');
  if (!component) return;

  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  var dirty = false;
  var list = null;      // container of the edit entries

  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var UP = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DOWN = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IMAGE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 5v14H5V5h14m0-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-4.86 8.86-3 3.87L9 13.14 6 17h12l-3.86-5.14z" fill="currentColor"/></svg>';

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }
  function iconButton(icon, className, label, onClick){
    var b = el('button', className, { type: 'button', title: label, 'aria-label': label });
    b.innerHTML = icon;
    b.addEventListener('click', function(e){ e.preventDefault(); onClick(); });
    return b;
  }
  function markDirty(){ dirty = true; }
  function escapeHtml(s){
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  (window.SiteEditors = window.SiteEditors || []).push({
    start: start,
    save: save,
    isDirty: function(){ return dirty; }
  });

  // --- Read the saved entries ---
  var START = /<!-- timeline-entries:start[\s\S]*?-->/;
  var END = /<!-- timeline-entries:end -->/;

  function start(){
    return fetch('timeline.html', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('could not read timeline.html'); return r.text(); })
      .then(function(page){
        var s = page.match(START), e = page.match(END);
        if (!s || !e) throw new Error('timeline-entries markers not found in timeline.html');
        var region = page.slice(s.index + s[0].length, e.index);
        var doc = new DOMParser().parseFromString('<div id="r">' + region + '</div>', 'text/html');
        build(parseRegion(doc.getElementById('r')));
      });
  }

  // Entries in order. Anything else between entries (apart from the year
  // separators, which are regenerated) stays attached to the entry before it.
  function parseRegion(root){
    var entries = [];
    Array.prototype.forEach.call(root.children, function(child){
      if (child.classList.contains('timeline-item')) entries.push(parseEntry(child));
      else if (child.classList.contains('timeline-breakout')) return;
      else if (entries.length) entries[entries.length - 1].after.push(child.outerHTML);
    });
    return entries;
  }

  function parseEntry(item){
    var dateEl = item.querySelector('.timeline-date-text');
    var date = dateEl ? dateEl.innerHTML.replace(/<br\s*\/?>/gi, ' ') : '';
    var tmp = document.createElement('div');
    tmp.innerHTML = date;
    date = tmp.textContent.replace(/\s+/g, ' ').replace(/,(\S)/g, ', $1').trim();
    var ym = date.match(/^(.*?)\s*(\d{4})\s*$/);
    var entry = { month: ym ? ym[1] : date, year: ym ? ym[2] : '', blocks: [], after: [] };
    var right = item.querySelector('.timeline-right');
    Array.prototype.forEach.call(right ? right.children : [], function(child){
      var text = child.querySelector('.timeline-text');
      var img = child.classList.contains('timeline-image-wrapper') ? child.querySelector('img') : null;
      if (text && /margin-bottom-/.test(child.className)) {
        entry.blocks.push({
          type: 'text',
          margin: (child.className.match(/margin-bottom-(\w+)/) || [])[1] || 'medium',
          html: text.innerHTML.replace(/\s+/g, ' ').trim()
        });
      } else if (img) {
        entry.blocks.push({ type: 'image', src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '', albedo: window.SiteAlbedo ? SiteAlbedo.read(img) : null });
      } else if (/^\s*height:\s*4%;?\s*$/.test(child.getAttribute('style') || '') && !child.children.length) {
        // spacing between groups: regenerated on save
      } else {
        entry.blocks.push({ type: 'raw', html: child.outerHTML });
      }
    });
    return entry;
  }

  // --- Edit form ---
  function build(entries){
    document.body.classList.add('timeline-editing');
    component.querySelectorAll('.timeline-item, .timeline-breakout').forEach(function(n){ n.remove(); });

    var months = el('datalist', '', { id: 'tl-months' });
    MONTHS.forEach(function(m){ var o = el('option'); o.value = m.charAt(0).toUpperCase() + m.slice(1); months.appendChild(o); });
    document.body.appendChild(months);

    var bar = el('div', 'tl-new-entry-bar');
    var add = el('button', 'tl-add-btn tl-new-entry', { type: 'button' });
    add.textContent = '+ New month entry';
    add.addEventListener('click', function(){
      var entry = entryElement({ month: '', year: String(new Date().getFullYear()), blocks: [] });
      list.insertBefore(entry, list.firstChild);
      restripe();
      markDirty();
      entry.querySelector('.tl-month').focus();
    });
    bar.appendChild(add);

    list = el('div', 'tl-edit-list');
    entries.forEach(function(e){ list.appendChild(entryElement(e)); });

    var anchor = component.querySelector('.overlay-fade-top');
    component.insertBefore(bar, anchor);
    component.insertBefore(list, anchor);
    restripe();
    list.querySelectorAll('textarea').forEach(autoGrow);
  }

  // left/right alternation, as the page's own script does
  function restripe(){
    Array.prototype.forEach.call(list.children, function(item, i){
      item.classList.toggle('timeline-item-even', i % 2 === 0);
      item.classList.toggle('timeline-item-odd', i % 2 === 1);
    });
  }

  function entryElement(entry){
    var item = el('div', 'timeline-item tl-edit-item');
    item._after = entry.after || [];

    var left = el('div', 'timeline-left');
    var date = el('div', 'tl-date');
    var month = el('input', 'tl-month', { type: 'text', list: 'tl-months', placeholder: 'Month', 'aria-label': 'Month' });
    month.value = entry.month;
    var year = el('input', 'tl-year', { type: 'number', min: '1900', max: '2999', placeholder: 'Year', 'aria-label': 'Year' });
    year.value = entry.year;
    [month, year].forEach(function(input){
      input.addEventListener('input', markDirty);
      input.addEventListener('change', function(){ sortEntries(item); });
    });
    date.appendChild(month);
    date.appendChild(year);
    left.appendChild(date);
    left.appendChild(iconButton(CROSS + '<span>Remove entry</span>', 'tl-remove-entry', 'Remove this entry', function(){
      var name = (month.value + ' ' + year.value).trim();
      if (!confirm('Remove the entry ' + (name ? '"' + name + '"' : '') + ' and everything in it?')) return;
      item.remove();
      restripe();
      markDirty();
    }));
    item.appendChild(left);

    var center = el('div', 'timeline-center');
    center.appendChild(el('div', 'timeline-circle'));
    item.appendChild(center);

    var right = el('div', 'timeline-right');
    var blocks = el('div', 'tl-blocks');
    entry.blocks.forEach(function(b){ blocks.appendChild(blockElement(b)); });
    right.appendChild(blocks);

    var adds = el('div', 'tl-add-bar');
    var addText = el('button', 'tl-add-btn', { type: 'button' });
    addText.textContent = '+ Text';
    addText.addEventListener('click', function(){
      var b = blockElement({ type: 'text', margin: 'medium', html: '' });
      blocks.appendChild(b);
      markDirty();
      b.querySelector('textarea').focus();
    });
    var addImage = el('button', 'tl-add-btn', { type: 'button' });
    addImage.textContent = '+ Image';
    addImage.addEventListener('click', function(){
      var b = blockElement({ type: 'image', src: '', alt: '' });
      blocks.appendChild(b);
      markDirty();
      b.querySelector('input[type=file]').click();
    });
    adds.appendChild(addText);
    adds.appendChild(addImage);
    right.appendChild(adds);
    item.appendChild(right);
    return item;
  }

  function blockElement(block){
    var wrap = el('div', 'tl-block');
    wrap.dataset.type = block.type;

    var tools = el('div', 'tl-block-tools');
    tools.appendChild(iconButton(UP, 'tl-tool', 'Move up', function(){
      if (wrap.previousElementSibling) { wrap.parentNode.insertBefore(wrap, wrap.previousElementSibling); markDirty(); }
    }));
    tools.appendChild(iconButton(DOWN, 'tl-tool', 'Move down', function(){
      if (wrap.nextElementSibling) { wrap.parentNode.insertBefore(wrap.nextElementSibling, wrap); markDirty(); }
    }));
    tools.appendChild(iconButton(CROSS, 'tl-tool tl-tool-remove', 'Remove', function(){
      wrap.remove();
      markDirty();
    }));
    wrap.appendChild(tools);

    if (block.type === 'text') {
      wrap.dataset.margin = block.margin || 'medium';
      var box = el('div', 'margin-bottom-' + wrap.dataset.margin);
      // line breaks in the box are <br> in the page; any other HTML is kept as typed
      var ta = el('textarea', 'timeline-text tl-text', { rows: '2', placeholder: 'Write about this month…', 'aria-label': 'Text' });
      ta.value = block.html.replace(/\s*<br\s*\/?>\s*/gi, '\n');
      ta.addEventListener('input', function(){ markDirty(); autoGrow(ta); });
      box.appendChild(ta);
      wrap.appendChild(box);
    } else if (block.type === 'image') {
      var frame = el('div', 'timeline-image-wrapper tl-image', { role: 'button', tabindex: '0', title: 'Change image' });
      var file = el('input', '', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', hidden: '' });
      function setImage(src){
        frame.querySelectorAll('img, .tl-image-empty').forEach(function(n){ n.remove(); });
        if (src) {
          var img = el('img', '', { alt: '', width: '480' });
          img.src = src;
          frame.insertBefore(img, frame.firstChild);
        } else {
          var empty = el('div', 'tl-image-empty');
          empty.innerHTML = IMAGE_ICON + '<span>Choose an image</span>';
          frame.insertBefore(empty, frame.firstChild);
        }
      }
      wrap.dataset.src = block.src || '';
      // existing images keep their saved albedo; a new one starts as "off"
      wrap._albedo = block.src ? block.albedo : window.SiteAlbedo ? SiteAlbedo.fresh() : null;
      setImage(block.src);
      var overlay = el('span', 'tl-image-overlay');
      overlay.innerHTML = PENCIL;
      frame.appendChild(overlay);
      frame.appendChild(file);
      frame.addEventListener('click', function(e){ if (e.target !== file) file.click(); });
      frame.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
      file.addEventListener('change', function(){
        var f = file.files && file.files[0];
        if (!f) return;
        wrap._file = f;
        if (wrap._url) URL.revokeObjectURL(wrap._url);
        wrap._url = URL.createObjectURL(f);
        setImage(wrap._url);
        if (wrap._albedo) SiteAlbedo.replaced(wrap._albedo);
        markDirty();
      });
      wrap.appendChild(frame);
      if (wrap._albedo) wrap.appendChild(SiteAlbedo.control(wrap._albedo, { onChange: markDirty }));
      var alt = el('input', 'tl-alt', { type: 'text', placeholder: 'Describe the image (alt text)', 'aria-label': 'Image description' });
      alt.value = block.alt || '';
      alt.addEventListener('input', markDirty);
      wrap.appendChild(alt);
    } else {
      wrap._html = block.html;
      var raw = el('div', 'tl-raw');
      raw.textContent = 'Fixed content (spacing), kept as is';
      wrap.appendChild(raw);
    }
    return wrap;
  }

  function autoGrow(ta){
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  // --- Ordering: newest first, by year then month ---
  function dateKey(item){
    var year = parseInt(item.querySelector('.tl-year').value, 10);
    var text = item.querySelector('.tl-month').value.toLowerCase();
    var month = -1;
    MONTHS.forEach(function(m, i){
      var at = text.indexOf(m.slice(0, 3));
      if (at !== -1 && (month === -1 || at < text.indexOf(MONTHS[month].slice(0, 3)))) month = i;
    });
    if (!year || month === -1) return Infinity;   // unfinished entries stay on top
    return year * 12 + month;
  }
  function sortEntries(focusItem){
    var items = Array.prototype.slice.call(list.children);
    var sorted = items.map(function(item, i){ return { item: item, key: dateKey(item), i: i }; })
      .sort(function(a, b){ return (b.key - a.key) || (a.i - b.i); });
    var changed = sorted.some(function(s, i){ return s.item !== items[i]; });
    if (!changed) return;
    sorted.forEach(function(s){ list.appendChild(s.item); });
    restripe();
    if (focusItem) focusItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // --- Save ---
  var I = function(n){ return new Array(n + 1).join(' '); };
  var BREAKOUT = [
    I(20) + '<div class="timeline-breakout" data-timeline-breakout aria-hidden="true">',
    I(24) + '<div class="timeline-breakout-sticky">',
    I(28) + '<div class="timeline-breakout-line"></div>',
    I(24) + '</div>',
    I(20) + '</div>'
  ].join('\n');

  function entryHtml(e){
    var out = [];
    out.push(I(20) + '<div class="timeline-item">');
    out.push(I(24) + '<div class="timeline-left">');
    out.push(I(28) + '<div class="timeline-date-text">' + escapeHtml((e.month + ' ' + e.year).trim()) + '</div>');
    out.push(I(24) + '</div>');
    out.push(I(24) + '<div class="timeline-center">');
    out.push(I(28) + '<div class="timeline-circle"></div>');
    out.push(I(24) + '</div>');
    out.push(I(24) + '<div class="timeline-right">');
    var prev = null;
    e.blocks.forEach(function(b){
      if (b.type === 'text') {
        if (prev === 'image') { out.push(''); out.push(I(28) + '<div style="height: 4%;"></div>'); out.push(''); }
        out.push(I(28) + '<div class="margin-bottom-' + b.margin + '">');
        out.push(I(32) + '<div class="timeline-text">');
        out.push(I(36) + b.html);
        out.push(I(32) + '</div>');
        out.push(I(28) + '</div>');
      } else if (b.type === 'image') {
        out.push(I(28) + '<div class="timeline-image-wrapper">');
        out.push(I(32) + '<img src="' + escapeHtml(b.src) + '" alt="' + escapeHtml(b.alt) + '"' + (b.albedo ? SiteAlbedo.html(b.albedo) : ''));
        out.push(I(32) + 'loading="lazy" width="480" decoding="async" />');
        out.push(I(28) + '</div>');
      } else {
        out.push(I(28) + b.html);
      }
      prev = b.type;
    });
    out.push(I(24) + '</div>');
    out.push(I(20) + '</div>');
    (e.after || []).forEach(function(html){ out.push(''); out.push(I(20) + html); });
    return out.join('\n');
  }

  function collect(){
    return Array.prototype.map.call(list.children, function(item){
      var blocks = [];
      item.querySelectorAll('.tl-block').forEach(function(wrap){
        var type = wrap.dataset.type;
        if (type === 'text') {
          var text = wrap.querySelector('textarea').value.trim();
          if (text) blocks.push({ type: 'text', margin: wrap.dataset.margin || 'medium', html: text.replace(/\r?\n/g, '<br>') });
        } else if (type === 'image') {
          if (wrap.dataset.src) blocks.push({ type: 'image', src: wrap.dataset.src, alt: wrap.querySelector('.tl-alt').value.trim(), albedo: wrap._albedo });
        } else {
          blocks.push({ type: 'raw', html: wrap._html });
        }
      });
      return {
        month: item.querySelector('.tl-month').value.replace(/\s+/g, ' ').trim(),
        year: item.querySelector('.tl-year').value.trim(),
        blocks: blocks,
        after: item._after || [],
        key: dateKey(item)
      };
    });
  }

  function upload(file){
    var url = '/__edit/timeline/upload?name=' + encodeURIComponent(file.name);
    return fetch(url, { method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/octet-stream' }, body: file })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j.src; }); });
  }

  function save(){
    sortEntries();
    var bad = Array.prototype.filter.call(list.children, function(item){
      return !item.querySelector('.tl-month').value.trim() || !/^\d{4}$/.test(item.querySelector('.tl-year').value.trim());
    });
    if (bad.length) {
      bad[0].scrollIntoView({ block: 'center' });
      bad[0].querySelector('.tl-month').focus();
      return Promise.reject(new Error('every entry needs a month and a 4-digit year'));
    }
    var images = Array.prototype.slice.call(list.querySelectorAll('.tl-block[data-type="image"]'));
    // each new image, then its new second version (light / dark mode) if any
    return images.reduce(function(chain, wrap){
      return chain.then(function(){
        if (!wrap._file) return;
        return upload(wrap._file).then(function(src){ wrap.dataset.src = src; wrap._file = null; });
      }).then(function(){
        if (wrap._albedo && wrap.dataset.src) return SiteAlbedo.upload(wrap._albedo, upload);
      });
    }, Promise.resolve()).then(function(){
      var entries = collect();
      var parts = [];
      entries.forEach(function(e, i){
        if (i > 0 && e.year !== entries[i - 1].year) parts.push(BREAKOUT);
        parts.push(entryHtml(e));
      });
      return fetch('/__edit/timeline/save', {
        method: 'POST',
        headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: parts.join('\n\n') })
      }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || r.statusText); }); });
    }).then(function(){ dirty = false; });
  }

  // Exposed for checking that the editor reproduces the page faithfully
  window.TimelineEdit = { parseRegion: parseRegion, entryHtml: entryHtml };
})();
