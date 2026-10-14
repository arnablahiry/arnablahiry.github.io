// Edit mode for My Travels: which countries and places are on the globe
// (local editor only, see scripts/edit-mode.js and scripts/edit-server.js).
//
// A card next to the globe lists every country with a checkbox, visited ones
// first, under a search box with suggestions. Opening a country shows the
// places picked there (click one to turn the globe to it, x to drop it), a
// search box for its regions and cities, and its regions, each opening into
// its cities: tick a city, or a region as a whole, to give it a pin. The
// globe follows every change. Save writes scripts/travel-places.js.
// Countries and places come from the edit server (scripts/travel-geo.js).
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  if (!window.TravelPage || !window.TRAVEL_BUILD_COUNTRY) return;

  var places = {};      // working copy of window.TRAVEL_PLACES: { id: { name, continent, folder, places } }
  var original = '';    // ...as loaded, to tell whether anything changed
  var dropped = {};     // countries unticked this session, restored if ticked again
  var countries = [];   // every country: [{ id, iso2, name, continent, lat, lng, key }]
  var countryById = {};
  var regionsOf = {};   // id -> Promise of the country's regions (see loadRegions)
  var rows = {};        // id -> country row
  var panels = {};      // id -> open country panel
  var ui = {};

  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  (window.SiteEditors = window.SiteEditors || []).push({
    start: function(){
      return fetch('/__edit/travel/countries', { cache: 'no-store' })
        .then(function(r){ if (!r.ok) throw new Error('editor server not reachable'); return r.json(); })
        .then(function(data){
          countries = (data.countries || []).map(function(c){ c.key = norm(c.name); return c; });
          countries.forEach(function(c){ countryById[c.id] = c; });
          places = JSON.parse(JSON.stringify(window.TRAVEL_PLACES || {}));
          original = JSON.stringify(places);
          buildCard();
          document.body.classList.add('travel-places-editing');
        });
    },
    save: save,
    isDirty: function(){ return JSON.stringify(places) !== original; }
  });

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }

  // Lower case, no accents: "Chaniá" -> "chania"
  function norm(s){
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function plural(n, one, many){ return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  // --- Search with suggestions ---

  // 0: name starts with the query, 1: a word does, 2: it's inside; -1: no match
  function rank(key, q){
    var at = key.indexOf(q);
    if (at === -1) return -1;
    if (at === 0) return 0;
    return /[\s\-'(.,]/.test(key.charAt(at - 1)) ? 1 : 2;
  }

  // items: [{ name, key }] -> best matches first
  function search(items, query, limit){
    var q = norm(query).trim();
    if (!q) return [];
    var hits = [];
    items.forEach(function(it){
      var r = rank(it.key, q);
      if (r >= 0) hits.push({ it: it, r: r });
    });
    hits.sort(function(a, b){
      return a.r - b.r || a.it.name.length - b.it.name.length || a.it.name.localeCompare(b.it.name);
    });
    return hits.slice(0, limit).map(function(h){ return h.it; });
  }

  // The name with the part matching the query (ignoring case and accents) in <mark>
  function highlighted(text, query){
    var frag = document.createDocumentFragment();
    var q = norm(query).trim();
    var flat = '', map = [];
    for (var i = 0; i < text.length; i++) {
      var n = norm(text[i]);
      for (var k = 0; k < n.length; k++) { flat += n[k]; map.push(i); }
    }
    var at = q ? flat.indexOf(q) : -1;
    if (at === -1) { frag.appendChild(document.createTextNode(text)); return frag; }
    var start = map[at], end = map[at + q.length - 1] + 1;
    frag.appendChild(document.createTextNode(text.slice(0, start)));
    var mark = el('mark');
    mark.textContent = text.slice(start, end);
    frag.appendChild(mark);
    frag.appendChild(document.createTextNode(text.slice(end)));
    return frag;
  }

  var comboCount = 0;

  // Search box with a scrolling list of suggestions: type, then arrow keys
  // and Enter, or click. find(query) -> [{ name, sub, checked, value }];
  // pick(value) when one is chosen.
  function combobox(placeholder, find, pick){
    var id = 'tpc-suggest-' + (++comboCount);
    var wrap = el('div', 'tpc-search');
    var input = el('input', 'tpc-search-input', {
      type: 'search', placeholder: placeholder, 'aria-label': placeholder.replace(/…$/, ''),
      role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': id,
      autocomplete: 'off', spellcheck: 'false'
    });
    var listbox = el('ul', 'tpc-suggest', { id: id, role: 'listbox' });
    listbox.hidden = true;
    wrap.appendChild(input);
    wrap.appendChild(listbox);
    var items = [];
    var active = -1;

    function close(){
      listbox.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function setActive(i){
      var opts = listbox.querySelectorAll('[role="option"]');
      if (opts[active]) opts[active].classList.remove('is-active');
      active = i;
      if (!opts[active]) return;
      opts[active].classList.add('is-active');
      input.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView({ block: 'nearest' });
    }
    function update(){
      var q = input.value;
      if (!q.trim()) { close(); return; }
      items = find(q);
      listbox.innerHTML = '';
      if (!items.length) {
        listbox.appendChild(el('li', 'tpc-suggest-empty')).textContent = 'No matches';
      }
      items.forEach(function(it, i){
        var opt = el('li', 'tpc-option' + (it.checked ? ' is-checked' : ''), { id: id + '-' + i, role: 'option' });
        var name = el('span', 'tpc-option-name');
        name.appendChild(highlighted(it.name, q));
        opt.appendChild(name);
        if (it.sub) opt.appendChild(el('span', 'tpc-option-sub')).textContent = it.sub;
        if (it.checked) opt.appendChild(el('span', 'tpc-option-tick', { 'aria-label': 'picked' })).textContent = '✓';
        opt.addEventListener('mousedown', function(e){ e.preventDefault(); });  // keep focus in the input
        opt.addEventListener('click', function(){ choose(i); });
        listbox.appendChild(opt);
      });
      listbox.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
      if (items.length) setActive(0);
    }
    function choose(i){
      var it = items[i];
      if (!it) return;
      input.value = '';
      close();
      pick(it.value);
    }

    input.addEventListener('input', update);
    input.addEventListener('focus', function(){ if (input.value.trim()) update(); });
    input.addEventListener('blur', close);
    input.addEventListener('keydown', function(e){
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (listbox.hidden) { update(); return; }
        if (!items.length) return;
        var n = items.length;
        setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active - 1 + n) % n);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!listbox.hidden && active >= 0) choose(active);
      } else if (e.key === 'Escape' && !listbox.hidden) {
        e.preventDefault();
        close();
      }
    });
    return { el: wrap, input: input };
  }

  // --- The card ---

  function buildCard(){
    var wrap = document.getElementById('globe-wrap');
    if (!wrap) return;
    var card = el('section', 'travel-places-card', { 'aria-label': 'Countries and places visited' });

    var head = el('div', 'tpc-head');
    // not an h4: the site's heading rule would force its pixel font on it
    head.appendChild(el('div', 'tpc-title', { role: 'heading', 'aria-level': '4' })).textContent = 'Countries visited';
    ui.count = head.appendChild(el('span', 'tpc-count'));
    card.appendChild(head);

    card.appendChild(combobox('Search countries…', findCountries, pickCountry).el);

    ui.list = el('div', 'tpc-list');
    ui.visited = ui.list.appendChild(el('div', 'tpc-group'));
    ui.list.appendChild(el('div', 'tpc-divider')).textContent = 'Not visited yet';
    ui.rest = ui.list.appendChild(el('div', 'tpc-group'));
    card.appendChild(ui.list);

    countries.forEach(function(c){
      rows[c.id] = countryRow(c);
      (places[c.id] ? ui.visited : ui.rest).appendChild(rows[c.id]);
    });
    wrap.appendChild(card);
    updateCount();
  }

  function updateCount(){
    var ids = Object.keys(places);
    var n = ids.reduce(function(sum, id){ return sum + places[id].places.length; }, 0);
    ui.count.textContent = plural(ids.length, 'country', 'countries') + ' · ' + plural(n, 'place');
  }

  function findCountries(q){
    return search(countries, q, 50).map(function(c){
      return { name: c.name, sub: c.continent, checked: !!places[c.id], value: c.id };
    });
  }

  // From the search: tick it, bring it up to the visited ones and open it
  function pickCountry(id){
    if (!places[id]) setVisited(id, true);
    if (!places[id]) return;
    moveToVisited(id);
    openCountry(id);
    reveal(rows[id]);
    lookAtCountry(id);
  }

  function moveToVisited(id){
    var row = rows[id];
    var name = countryById[id].name;
    var next = null;
    Array.prototype.some.call(ui.visited.children, function(other){
      if (other !== row && countryById[other.dataset.id].name.localeCompare(name) > 0) { next = other; return true; }
      return false;
    });
    ui.visited.insertBefore(row, next);
  }

  function reveal(node){
    if (!node) return;
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    node.classList.remove('is-flash');
    void node.offsetWidth;
    node.classList.add('is-flash');
  }

  function lookAtCountry(id){
    var c = countryById[id];
    window.TravelPage.lookAt({ id: id, fallback: c && c.lat !== null ? [c.lng, c.lat] : null });
  }

  function countryRow(c){
    var row = el('div', 'tpc-country');
    row.dataset.id = c.id;
    var line = row.appendChild(el('div', 'tpc-line'));
    var toggle = line.appendChild(el('button', 'tpc-toggle', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Places in ' + c.name }));
    var label = line.appendChild(el('label', 'tpc-label'));
    var box = label.appendChild(el('input', '', { type: 'checkbox' }));
    label.appendChild(el('span', 'tpc-name')).textContent = c.name;
    line.appendChild(el('span', 'tpc-badge'));

    toggle.addEventListener('click', function(){
      if (panels[c.id]) closeCountry(c.id); else openCountry(c.id);
    });
    box.addEventListener('change', function(){
      if (!setVisited(c.id, box.checked)) { box.checked = !box.checked; return; }
      if (box.checked) lookAtCountry(c.id);
    });
    row.addEventListener('mouseenter', function(){ if (places[c.id]) window.TravelPage.highlight(c.id); });
    row.addEventListener('mouseleave', function(){ window.TravelPage.highlight(null); });
    refreshRow(c.id, row);
    return row;
  }

  function refreshRow(id, row){
    row = row || rows[id];
    if (!row) return;
    var entry = places[id];
    row.classList.toggle('is-visited', !!entry);
    row.querySelector('.tpc-line input').checked = !!entry;
    row.querySelector('.tpc-badge').textContent = entry && entry.places.length ? entry.places.length : '';
  }

  // "Côte d'Ivoire" -> "cote_d_ivoire", the photo folder under images/travels/
  function folderFor(name, id){
    var base = norm(name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'country';
    var taken = {};
    Object.keys(places).forEach(function(k){ if (Number(k) !== Number(id)) taken[places[k].folder] = true; });
    var folder = base;
    for (var i = 2; taken[folder]; i++) folder = base + '_' + i;
    return folder;
  }

  // Tick/untick a country; false if unticking was called off
  function setVisited(id, on){
    var c = countryById[id];
    if (on) {
      if (!places[id]) {
        places[id] = dropped[id] || { name: c.name, continent: c.continent, folder: folderFor(c.name, id), places: [] };
        delete dropped[id];
        changed(id);
      }
      return true;
    }
    var entry = places[id];
    if (!entry) return true;
    var shown = window.TRAVEL_DATABASE_COUNTRIES[id];
    var photos = shown && shown.photos ? shown.photos.length : 0;
    if (entry.places.length || photos) {
      var msg = 'Take ' + entry.name + ' off the globe?'
        + (entry.places.length ? (entry.places.length === 1 ? ' Its place goes with it.' : ' Its ' + entry.places.length + ' places go with it.') : '')
        + (photos ? ' Its photos stay in images/travels/' + entry.folder + '/ but won\'t be shown.' : '');
      if (!confirm(msg)) return false;
    }
    dropped[id] = entry;
    delete places[id];
    changed(id);
    return true;
  }

  // Push a country's change to the globe and the card
  function changed(id){
    var shown = window.TRAVEL_DATABASE_COUNTRIES;
    if (places[id]) shown[id] = window.TRAVEL_BUILD_COUNTRY(places[id]);
    else delete shown[id];
    window.TravelPage.refreshVisits();
    refreshRow(id);
    refreshPanel(id);
    updateCount();
  }

  // --- A country's places ---

  // [{ name, lat, lng, cities: [[name, lat, lng]] }] from the edit server,
  // plus search items for the region and each city
  function loadRegions(id){
    if (!regionsOf[id]) {
      regionsOf[id] = fetch('/__edit/travel/regions?country=' + encodeURIComponent(id), { cache: 'no-store' })
        .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j.regions || []; }); })
        .then(function(regions){
          regions.forEach(function(r){
            r.item = { type: 'region', name: r.name, region: r.name, lat: r.lat, lng: r.lng, key: norm(r.name) };
            r.items = r.cities.map(function(c){ return { name: c[0], region: r.name, lat: c[1], lng: c[2], key: norm(c[0]) }; });
          });
          return regions;
        });
      regionsOf[id].catch(function(){ delete regionsOf[id]; });
    }
    return regionsOf[id];
  }

  function samePlace(p, item){
    if ((p.type === 'region') !== (item.type === 'region')) return false;
    if (item.type === 'region') return norm(p.name) === norm(item.name);
    if (p.region && norm(p.region) !== norm(item.region)) return false;
    if (norm(p.name) === norm(item.name)) return true;
    return Math.abs(p.lat - item.lat) < 0.0002 && Math.abs(p.lng - item.lng) < 0.0002;
  }

  function indexOfPlace(id, item){
    var list = places[id] ? places[id].places : [];
    for (var i = 0; i < list.length; i++) if (samePlace(list[i], item)) return i;
    return -1;
  }

  function setPlace(id, item, on){
    if (on && !places[id]) setVisited(id, true);
    if (!places[id]) return;
    var at = indexOfPlace(id, item);
    if (on && at === -1) {
      var place = { name: item.name, region: item.region };
      if (item.type === 'region') place.type = 'region';
      place.lat = item.lat;
      place.lng = item.lng;
      places[id].places.push(place);
      window.TravelPage.lookAt({ lat: item.lat, lng: item.lng });
    } else if (!on && at !== -1) {
      places[id].places.splice(at, 1);
    } else {
      return;
    }
    changed(id);
  }

  function openCountry(id){
    var row = rows[id];
    if (!row || panels[id]) return;
    var c = countryById[id];
    var panel = { el: el('div', 'tpc-panel'), boxes: [], regionRows: {} };
    panels[id] = panel;
    row.classList.add('is-open');
    row.querySelector('.tpc-toggle').setAttribute('aria-expanded', 'true');
    panel.chips = panel.el.appendChild(el('div', 'tpc-chips'));
    panel.note = panel.el.appendChild(el('p', 'tpc-note'));
    panel.status = panel.el.appendChild(el('p', 'tpc-status'));
    panel.status.textContent = 'Loading regions…';
    row.appendChild(panel.el);
    refreshPanel(id);

    loadRegions(id).then(function(regions){
      if (panels[id] !== panel) return;
      panel.regions = regions;
      panel.status.remove();
      if (!regions.length) {
        panel.el.appendChild(el('p', 'tpc-status')).textContent = 'No regions or cities listed for ' + c.name + '.';
        return;
      }
      var all = [];
      regions.forEach(function(r){ all.push(r.item); all.push.apply(all, r.items); });
      var cities = all.length - regions.length;
      var find = function(q){
        return search(all, q, 80).map(function(it){
          return { name: it.name, sub: it.type === 'region' ? 'whole region' : it.region, checked: indexOfPlace(id, it) !== -1, value: it };
        });
      };
      var box = combobox('Search ' + plural(cities, 'city', 'cities') + ' & regions…', find, function(item){ pickPlace(id, item); });
      box.el.classList.add('tpc-search-sm');
      panel.el.insertBefore(box.el, panel.note);
      panel.tree = panel.el.appendChild(el('div', 'tpc-tree'));
      regions.forEach(function(r){ panel.tree.appendChild(regionRow(id, r, panel)); });
      refreshPanel(id);
    }).catch(function(err){
      if (panels[id] === panel) panel.status.textContent = 'Could not load regions: ' + (err && err.message ? err.message : err);
    });
  }

  function closeCountry(id){
    var panel = panels[id];
    if (!panel) return;
    panel.el.remove();
    delete panels[id];
    rows[id].classList.remove('is-open');
    rows[id].querySelector('.tpc-toggle').setAttribute('aria-expanded', 'false');
  }

  // From the country's search: tick it, then show it in the tree
  function pickPlace(id, item){
    if (indexOfPlace(id, item) === -1) setPlace(id, item, true);   // turns the globe to it
    else window.TravelPage.lookAt({ lat: item.lat, lng: item.lng });
    var panel = panels[id];
    if (!panel) return;
    var regionRowEl = panel.regionRows[item.region];
    if (!regionRowEl) return;
    if (item.type === 'region') { reveal(regionRowEl.querySelector('.tpc-line')); return; }
    openRegion(regionRowEl, true);
    var target = null;
    panel.boxes.some(function(b){ if (b.item === item) { target = b.box.closest('.tpc-city'); return true; } return false; });
    reveal(target);
  }

  function placeBox(id, item, panel){
    var box = el('input', '', { type: 'checkbox' });
    box.addEventListener('change', function(){ setPlace(id, item, box.checked); });
    box.checked = indexOfPlace(id, item) !== -1;
    panel.boxes.push({ box: box, item: item });
    return box;
  }

  function regionRow(id, region, panel){
    var wrap = el('div', 'tpc-region');
    var line = wrap.appendChild(el('div', 'tpc-line'));
    var toggle = line.appendChild(el('button', 'tpc-toggle', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Cities in ' + region.name }));
    if (!region.items.length) toggle.disabled = true;
    var label = line.appendChild(el('label', 'tpc-label', { title: 'Pin ' + region.name + ' as a whole' }));
    label.appendChild(placeBox(id, region.item, panel));
    label.appendChild(el('span', 'tpc-name')).textContent = region.name;
    line.appendChild(el('span', 'tpc-badge'));
    wrap._region = region;
    wrap._id = id;
    toggle.addEventListener('click', function(){ openRegion(wrap, !wrap.classList.contains('is-open')); });
    panel.regionRows[region.name] = wrap;
    return wrap;
  }

  // Cities are only put in the page when their region is first opened
  function openRegion(wrap, open){
    var panel = panels[wrap._id];
    if (!panel) return;
    if (open && !wrap._cities) {
      wrap._cities = wrap.appendChild(el('div', 'tpc-cities'));
      wrap._region.items.forEach(function(item){
        var label = wrap._cities.appendChild(el('label', 'tpc-label tpc-city'));
        label.appendChild(placeBox(wrap._id, item, panel));
        label.appendChild(el('span', 'tpc-name')).textContent = item.name;
      });
    }
    wrap.classList.toggle('is-open', open);
    wrap.querySelector('.tpc-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // Picked places as chips, ticks and per-region counts in an open panel
  function refreshPanel(id){
    var panel = panels[id];
    if (!panel) return;
    var entry = places[id];
    var list = entry ? entry.places : [];

    panel.chips.innerHTML = '';
    list.forEach(function(p, i){
      var pinned = Number.isFinite(p.lat) && Number.isFinite(p.lng);
      var chip = panel.chips.appendChild(el('span', 'tpc-chip' + (pinned ? '' : ' is-unpinned') + (p.type === 'region' ? ' is-region' : '')));
      var go = chip.appendChild(el('button', 'tpc-chip-name', {
        type: 'button',
        title: pinned ? (p.region && p.region !== p.name ? p.region + ' (show on the globe)' : 'Show on the globe') : 'No coordinates: listed, but no pin'
      }));
      go.textContent = p.name;
      go.addEventListener('click', function(){ if (pinned) window.TravelPage.lookAt({ lat: p.lat, lng: p.lng }); });
      var x = chip.appendChild(el('button', 'tpc-chip-remove', { type: 'button', title: 'Remove ' + p.name, 'aria-label': 'Remove ' + p.name }));
      x.innerHTML = CROSS;
      x.addEventListener('click', function(){
        places[id].places.splice(i, 1);
        changed(id);
      });
    });
    if (!list.length) {
      panel.chips.appendChild(el('span', 'tpc-chips-empty')).textContent = entry
        ? 'No places yet: tick a region or a city below.'
        : 'Not visited: tick a region or a city to add it.';
    }

    var pins = list.some(function(p){ return Number.isFinite(p.lat) && Number.isFinite(p.lng); });
    panel.note.textContent = entry && !pins && !window.TravelPage.hasShape(id)
      ? 'Too small for the globe\'s map: add a place to give it a pin.'
      : '';
    panel.note.hidden = !panel.note.textContent;

    panel.boxes.forEach(function(b){ b.box.checked = indexOfPlace(id, b.item) !== -1; });
    Object.keys(panel.regionRows).forEach(function(name){
      var n = list.filter(function(p){ return p.type !== 'region' && norm(p.region) === norm(name); }).length;
      panel.regionRows[name].querySelector('.tpc-badge').textContent = n ? n : '';
    });
  }

  // --- Save ---
  function save(){
    if (JSON.stringify(places) === original) return Promise.resolve();
    return fetch('/__edit/travel/places', {
      method: 'POST',
      headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ places: places })
    }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || r.statusText); }); });
  }
})();
