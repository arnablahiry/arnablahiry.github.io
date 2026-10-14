// Edit mode for Contact (local editor only, see scripts/edit-mode.js and
// scripts/edit-server.js).
//
// Each location card shows whether it is the right answer today and the
// dates it covers. Clicking a card opens a dialog: pick the days you'll be
// there on the calendar (first click the start, then the end), the time
// zone those days are in, whether it's the card to fall back on when no
// card's dates include today, and the message, address, map link, emails
// and phone it shows. Save writes scripts/contact-places.js.
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;
  if (!window.CONTACT_PLACES) return;
  var page = null;        // window.ContactPage, set up by scripts/contact.js once the page has loaded

  var data = null;        // working copy of window.CONTACT_PLACES
  var original = '';
  var ui = null;          // the dialog's parts
  var draft = null;       // the card being edited: { id, card, fallback }

  var FIELDS = [
    { key: 'note', label: 'Message', type: 'textarea', rows: 4, hint: 'Shown first when this card is the right answer.' },
    { key: 'address', label: 'Address', type: 'textarea', rows: 3 },
    { key: 'map', label: 'Map link', type: 'url', placeholder: 'https://maps.app.goo.gl/…', hint: 'Makes the address a link.' },
    { key: 'email1', label: 'Email', type: 'email' },
    { key: 'email2', label: 'Second email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' }
  ];
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  (window.SiteEditors = window.SiteEditors || []).push({
    start: function(){
      page = window.ContactPage;
      if (!page) return Promise.reject(new Error('contact page script not loaded'));
      data = JSON.parse(JSON.stringify(window.CONTACT_PLACES));
      data.cards = data.cards || {};
      original = JSON.stringify(data);
      document.body.classList.add('contact-editing');
      buildDialog();
      cardEls().forEach(decorateCard);
      page.closeAll();
      return Promise.resolve();
    },
    save: save,
    isDirty: function(){ return JSON.stringify(data) !== original; }
  });

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }

  function cardEls(){ return Array.prototype.slice.call(document.querySelectorAll('.contact-card')); }

  function cardName(id){
    var img = document.querySelector('.contact-card[data-id="' + id + '"] img');
    return (img && img.alt) || id.charAt(0).toUpperCase() + id.slice(1);
  }

  function blankCard(){ return { tz: '', from: '', to: '', note: '', address: '', map: '', email1: '', email2: '', phone: '' }; }

  function rangeText(card){
    if (card.from && card.to) return card.from === card.to ? page.formatDate(card.from) : page.formatDate(card.from) + ' → ' + page.formatDate(card.to);
    if (card.from) return 'From ' + page.formatDate(card.from);
    if (card.to) return 'Until ' + page.formatDate(card.to);
    return 'No dates';
  }

  // --- Badges on the cards ---
  function decorateCard(cardEl){
    var id = cardEl.dataset.id;
    if (!id) return;
    if (!data.cards[id]) data.cards[id] = blankCard();
    var badge = cardEl.appendChild(el('div', 'contact-edit-badge'));
    cardEl.appendChild(el('span', 'contact-edit-pencil', { 'aria-hidden': 'true' })).innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
    cardEl._badge = badge;
    // In edit mode a click edits the card instead of playing the guessing game
    var open = function(e){
      e.stopPropagation();
      e.preventDefault();
      openDialog(id, cardEl);
    };
    cardEl.addEventListener('click', open, true);
    cardEl.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') open(e); }, true);
    var btn = cardEl.querySelector('.contact-btn');
    if (btn) btn.setAttribute('aria-label', 'Edit ' + cardName(id));
    refreshBadges();
  }

  function refreshBadges(){
    var right = page.correctIds(data);
    cardEls().forEach(function(cardEl){
      var id = cardEl.dataset.id;
      var badge = cardEl._badge;
      if (!badge) return;
      var ok = right.indexOf(id) !== -1;
      badge.className = 'contact-edit-badge ' + (ok ? 'is-right' : 'is-wrong');
      badge.innerHTML = '';
      badge.appendChild(el('span', 'contact-edit-badge-state')).textContent = ok ? '✓ Right answer today' : '✗ Wrong today';
      var meta = rangeText(data.cards[id]) + (data.fallback === id ? ' · default' : '');
      badge.appendChild(el('span', 'contact-edit-badge-dates')).textContent = meta;
    });
  }

  // --- The dialog ---
  function buildDialog(){
    ui = {};
    var d = ui.dialog = el('dialog', 'contact-edit-dialog', { 'aria-labelledby': 'ced-title' });
    var head = d.appendChild(el('div', 'ced-head'));
    ui.title = head.appendChild(el('div', 'ced-title', { id: 'ced-title' }));
    var x = head.appendChild(el('button', 'ced-x', { type: 'button', 'aria-label': 'Close without keeping changes' }));
    x.innerHTML = CROSS;
    x.addEventListener('click', function(){ d.close(); });

    var body = d.appendChild(el('div', 'ced-body'));

    // left: when
    var when = body.appendChild(el('section', 'ced-col ced-when'));
    when.appendChild(el('div', 'ced-label')).textContent = 'When I\'m here';
    var range = when.appendChild(el('div', 'ced-range'));
    ui.ends = {};
    ['from', 'to'].forEach(function(end, i){
      if (i) range.appendChild(el('span', 'ced-range-arrow', { 'aria-hidden': 'true' })).textContent = '→';
      var b = range.appendChild(el('button', 'ced-end', { type: 'button' }));
      b.appendChild(el('span', 'ced-end-label')).textContent = end === 'from' ? 'From' : 'To';
      b.appendChild(el('span', 'ced-end-value'));
      b.addEventListener('click', function(){ cal.setActive(end, true); });
      ui.ends[end] = b;
    });
    ui.clear = range.appendChild(el('button', 'ced-clear', { type: 'button' }));
    ui.clear.textContent = 'Clear';
    ui.clear.addEventListener('click', function(){
      draft.card.from = '';
      draft.card.to = '';
      cal.setActive('from', false);
      changed();
    });

    var cal = ui.cal = calendar(when.appendChild(el('div', 'ced-cal')));
    ui.tzHint = when.appendChild(el('p', 'ced-hint'));

    var fb = when.appendChild(el('label', 'ced-check'));
    ui.fallback = fb.appendChild(el('input', '', { type: 'checkbox' }));
    fb.appendChild(el('span')).textContent = 'Default: the right card whenever no card\'s dates include today';
    ui.fallback.addEventListener('change', function(){ draft.fallback = ui.fallback.checked; changed(); });
    ui.fallbackHint = when.appendChild(el('p', 'ced-hint'));
    ui.status = when.appendChild(el('p', 'ced-status', { 'aria-live': 'polite' }));

    // right: what it shows
    var what = body.appendChild(el('section', 'ced-col ced-what'));
    what.appendChild(el('div', 'ced-label')).textContent = 'What it shows';
    ui.fields = {};
    FIELDS.concat([{ key: 'tz', label: 'Time zone of the dates', type: 'text', placeholder: 'Visitor\'s own time zone', list: 'ced-tz-list' }]).forEach(function(f){
      var wrap = what.appendChild(el('label', 'ced-field'));
      wrap.appendChild(el('span', 'ced-field-label')).textContent = f.label;
      var input = f.type === 'textarea'
        ? el('textarea', 'ced-input', { rows: String(f.rows || 3) })
        : el('input', 'ced-input', { type: f.type, spellcheck: 'false', autocomplete: 'off' });
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.list) input.setAttribute('list', f.list);
      wrap.appendChild(input);
      if (f.hint) wrap.appendChild(el('span', 'ced-field-hint')).textContent = f.hint;
      input.addEventListener('input', function(){
        if (f.key === 'tz') {
          var tz = input.value.trim();
          var ok = !tz || validTimeZone(tz);
          input.setAttribute('aria-invalid', ok ? 'false' : 'true');
          if (!ok) return;
          draft.card.tz = tz;
          changed();
          return;
        }
        draft.card[f.key] = input.value;
      });
      ui.fields[f.key] = input;
    });
    var list = what.appendChild(el('datalist', '', { id: 'ced-tz-list' }));
    (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []).forEach(function(tz){
      list.appendChild(el('option', '', { value: tz }));
    });

    var foot = d.appendChild(el('div', 'ced-foot'));
    var cancel = foot.appendChild(el('button', 'ced-btn', { type: 'button' }));
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function(){ d.close(); });
    var done = foot.appendChild(el('button', 'ced-btn is-primary', { type: 'button' }));
    done.textContent = 'Done';
    done.addEventListener('click', function(){ keep(); d.close(); });

    d.addEventListener('close', function(){
      draft = null;
      if (ui.returnTo) ui.returnTo.focus();
    });
    // a click on the backdrop closes it, like Cancel
    d.addEventListener('mousedown', function(e){
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
    document.body.appendChild(d);
  }

  function validTimeZone(tz){
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (_) { return false; }
  }

  function openDialog(id, cardEl){
    draft = { id: id, card: JSON.parse(JSON.stringify(data.cards[id])), fallback: data.fallback === id };
    ui.returnTo = cardEl.querySelector('.contact-btn');
    ui.title.textContent = cardName(id);
    Object.keys(ui.fields).forEach(function(key){
      ui.fields[key].value = draft.card[key] || '';
      ui.fields[key].setAttribute('aria-invalid', 'false');
    });
    ui.fallback.checked = draft.fallback;
    // the default card can only be moved, by ticking it on another card
    ui.fallback.disabled = draft.fallback;
    ui.fallbackHint.textContent = draft.fallback ? 'To change the default, tick it on another card.' : '';
    ui.fallbackHint.hidden = !draft.fallback;
    ui.cal.setActive(draft.card.from && !draft.card.to ? 'to' : 'from', false);
    ui.cal.show(draft.card.from || page.todayIn(draft.card.tz));
    changed();
    ui.dialog.showModal();
  }

  // Draft -> dialog (range buttons, calendar, hints, status)
  function changed(){
    var c = draft.card;
    ['from', 'to'].forEach(function(end){
      var v = ui.ends[end].querySelector('.ced-end-value');
      v.textContent = c[end] ? page.formatDate(c[end]) : 'Pick a day';
      ui.ends[end].classList.toggle('is-empty', !c[end]);
    });
    ui.clear.hidden = !c.from && !c.to;
    ui.cal.render();

    var place = cardName(draft.id);
    var today = page.todayIn(c.tz);
    ui.tzHint.textContent = (c.tz ? 'Days in ' + place + ' time (' + c.tz + ')' : 'Days in each visitor\'s own time zone')
      + ', where today is ' + page.formatDate(today) + '.';

    var trial = JSON.parse(JSON.stringify(data));
    trial.cards[draft.id] = c;
    if (draft.fallback) trial.fallback = draft.id;
    var right = page.correctIds(trial).indexOf(draft.id) !== -1;
    ui.status.className = 'ced-status ' + (right ? 'is-right' : 'is-wrong');
    ui.status.textContent = right
      ? '✓ With this, ' + place + ' is the right answer today.'
      : '✗ With this, ' + place + ' is a wrong answer today.';
  }

  function keep(){
    if (!draft) return;
    data.cards[draft.id] = draft.card;
    if (draft.fallback) data.fallback = draft.id;
    refreshBadges();
  }

  // --- Calendar: pick a range of days ---
  // "2026-10-14" <-> { y, m (0-11), d }, all in UTC so time zones and DST
  // never shift a day
  function parse(iso){ var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function iso(date){ return date.toISOString().slice(0, 10); }
  function addDays(isoDate, n){ var t = parse(isoDate); t.setUTCDate(t.getUTCDate() + n); return iso(t); }
  function addMonths(isoDate, n){
    var t = parse(isoDate);
    var day = t.getUTCDate();
    t.setUTCDate(1);
    t.setUTCMonth(t.getUTCMonth() + n);
    var last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(day, last));
    return iso(t);
  }

  function calendar(root){
    var state = { view: null, active: 'from', hover: '', focus: '' };
    var head = root.appendChild(el('div', 'ced-cal-head'));
    var prev = head.appendChild(el('button', 'ced-cal-nav', { type: 'button', 'aria-label': 'Previous month' }));
    prev.innerHTML = CHEVRON;
    var label = head.appendChild(el('div', 'ced-cal-month', { 'aria-live': 'polite' }));
    var next = head.appendChild(el('button', 'ced-cal-nav is-next', { type: 'button', 'aria-label': 'Next month' }));
    next.innerHTML = CHEVRON;
    var week = root.appendChild(el('div', 'ced-cal-week', { 'aria-hidden': 'true' }));
    ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(function(n){ week.appendChild(el('span')).textContent = n; });
    var grid = root.appendChild(el('div', 'ced-cal-grid', { role: 'grid' }));
    var todayBtn = root.appendChild(el('button', 'ced-cal-today', { type: 'button' }));
    todayBtn.textContent = 'Today';

    prev.addEventListener('click', function(){ state.view = addMonths(state.view, -1); state.focus = ''; render(); });
    next.addEventListener('click', function(){ state.view = addMonths(state.view, 1); state.focus = ''; render(); });
    todayBtn.addEventListener('click', function(){ show(page.todayIn(draft.card.tz)); focusDay(); });
    grid.addEventListener('mouseleave', function(){ if (state.hover) { state.hover = ''; render(); } });

    function show(isoDate){
      state.view = isoDate.slice(0, 8) + '01';
      state.focus = isoDate;
      render();
    }

    function setActive(end, focus){
      state.active = end;
      var v = draft && draft.card[end];
      if (v) show(v); else render();
      if (focus) focusDay();
    }

    function focusDay(){
      var b = grid.querySelector('[tabindex="0"]');
      if (b) b.focus();
    }

    function pick(day){
      var c = draft.card;
      if (state.active === 'from' || !c.from || day < c.from) {
        c.from = day;
        if (c.to && c.to < day) c.to = '';
        state.active = 'to';
      } else {
        c.to = day;
        state.active = 'from';
      }
      state.hover = '';
      state.focus = day;
      changed();
    }

    function render(){
      if (!draft || !state.view) return;
      var c = draft.card;
      var today = page.todayIn(c.tz);
      ui.ends.from.classList.toggle('is-active', state.active === 'from');
      ui.ends.to.classList.toggle('is-active', state.active === 'to');

      var first = parse(state.view);
      label.textContent = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
      var start = addDays(state.view, -((first.getUTCDay() + 6) % 7));   // the Monday on or before the 1st
      var month = state.view.slice(0, 7);
      // the end of the range: picked, or the day under the pointer while picking it
      var end = c.to || (state.active === 'to' && c.from && state.hover >= c.from ? state.hover : '');
      var focus = state.focus && state.focus.slice(0, 7) === month ? state.focus
        : (c.from && c.from.slice(0, 7) === month ? c.from : (today.slice(0, 7) === month ? today : state.view));

      grid.innerHTML = '';
      for (var w = 0; w < 6; w++) {
        var row = grid.appendChild(el('div', 'ced-cal-row', { role: 'row' }));
        for (var i = 0; i < 7; i++) {
          var day = addDays(start, w * 7 + i);
          var b = row.appendChild(el('button', 'ced-day', { type: 'button', role: 'gridcell', tabindex: day === focus ? '0' : '-1' }));
          b.dataset.date = day;
          b.textContent = String(Number(day.slice(8)));
          b.setAttribute('aria-label', page.formatDate(day));
          if (day.slice(0, 7) !== month) b.classList.add('is-other');
          if (day === today) { b.classList.add('is-today'); b.setAttribute('aria-current', 'date'); }
          var isFrom = day === c.from, isTo = day === end;
          if (isFrom) b.classList.add('is-from');
          if (isTo) b.classList.add('is-to');
          if (c.from && end && day > c.from && day < end) b.classList.add('is-between');
          if (c.from && end && c.from !== end) {
            if (isFrom) b.classList.add('has-after');
            if (isTo) b.classList.add('has-before');
          }
          if (!c.to && isTo) b.classList.add('is-preview');
          b.setAttribute('aria-pressed', isFrom || (isTo && !!c.to) ? 'true' : 'false');
        }
      }
    }

    grid.addEventListener('click', function(e){
      var b = e.target.closest('.ced-day');
      if (b) pick(b.dataset.date);
    });
    grid.addEventListener('mouseover', function(e){
      var b = e.target.closest('.ced-day');
      if (!b || state.active !== 'to' || !draft.card.from || draft.card.to) return;
      if (state.hover !== b.dataset.date) {
        state.hover = b.dataset.date;
        render();
      }
    });
    // Arrow keys move a day/week, Page Up/Down a month
    grid.addEventListener('keydown', function(e){
      var b = e.target.closest('.ced-day');
      if (!b) return;
      var steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      var day = b.dataset.date;
      var to;
      if (steps[e.key]) to = addDays(day, steps[e.key]);
      else if (e.key === 'PageUp') to = addMonths(day, -1);
      else if (e.key === 'PageDown') to = addMonths(day, 1);
      if (!to) return;
      e.preventDefault();
      state.focus = to;
      if (to.slice(0, 7) !== state.view.slice(0, 7)) state.view = to.slice(0, 8) + '01';
      if (state.active === 'to' && draft.card.from && !draft.card.to) state.hover = to;
      render();
      focusDay();
    });

    return { show: show, render: render, setActive: setActive };
  }

  // --- Save ---
  function save(){
    if (JSON.stringify(data) === original) return Promise.resolve();
    return fetch('/__edit/contact/save', {
      method: 'POST',
      headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r){ return r.json().then(function(j){ if (!r.ok || !j.ok) throw new Error(j.error || r.statusText); }); });
  }
})();
