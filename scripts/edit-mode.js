// Site-wide edit mode (local editor only: npm run edit).
//
// On the published site this script does nothing. When the page is served
// by scripts/edit-server.js on localhost:
//   - tapping the pixel heart in the footer 5 times switches to edit mode
//     (the page reloads with ?edit=1); pages with an editor also get an Edit
//     button at the bottom right;
//   - in edit mode the toolbar offers Cancel and Save, and asks before
//     leaving with unsaved changes;
//   - live reload: when a file the page uses changes on disk, new CSS is
//     swapped in, images are refetched, and for anything else the page
//     reloads where it was scrolled to (never over unsaved edits);
//   - a git button next to the logo shows uncommitted changes and opens a
//     dialog to commit the ticked files and push them.
// A page makes itself editable by pushing an editor before the load event:
//   (window.SiteEditors = window.SiteEditors || []).push({
//     start()   -> Promise   turn the page into its editable form
//     save()    -> Promise   write the changes through the edit server
//     isDirty() -> boolean   unsaved changes?
//   });
(function(){
  var LOCAL = ['localhost', '127.0.0.1', '[::1]', '::1'];
  if (LOCAL.indexOf(location.hostname) === -1) return;

  var editing = new URLSearchParams(location.search).get('edit') === '1';
  var PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>';
  var CROSS = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var BRANCH = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="4.5" cy="3.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="4.5" cy="12.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="11.5" cy="5.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 5.1v5.8M11.5 7.1c0 2.6-3 2.4-6.2 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var SCROLL_KEY = 'site-live-scroll';

  var editors = [];
  var saving = false;     // during Save (its own writes must not reload the page)

  function urlWith(edit){
    var params = new URLSearchParams(location.search);
    if (edit) params.set('edit', '1'); else params.delete('edit');
    var q = params.toString();
    return location.pathname + (q ? '?' + q : '') + location.hash;
  }

  function el(tag, className, attrs){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.keys(attrs).forEach(function(k){ node.setAttribute(k, attrs[k]); });
    return node;
  }

  var toastTimer = 0;
  function toast(message, ms){
    var t = document.querySelector('.site-edit-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'site-edit-toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove('is-shown'); }, ms || 2600);
  }

  function pageDirty(){
    return editing && editors.some(function(ed){ return ed.isDirty && ed.isDirty(); });
  }

  window.SiteEdit = { editing: editing, toast: toast };

  // --- Albedo: how an image follows the light / dark theme ---
  // Shared by the page editors: a control under each image they edit.
  //   on  -> data-albedo="dark|light": the image was made for the theme the
  //          editor is in, and is flipped (invert + hue-rotate 180deg, as
  //          Albedo does) in the other theme;
  //   off -> data-albedo="off": never flipped; optionally a second version for
  //          the other theme in data-src-light / data-src-dark.
  // An image without data-albedo keeps the page's own styling ("page
  // default"). scripts/theme-toggle.js swaps the second versions in and
  // css/utils.css does the flipping, on the published site too.
  // An editor keeps one state object per image:
  //   var s = SiteAlbedo.read(img)          (or SiteAlbedo.fresh() for a new upload)
  //   form.appendChild(SiteAlbedo.control(s, { onChange: markDirty }))
  //   SiteAlbedo.replaced(s)                when the image itself is replaced
  //   SiteAlbedo.upload(s, uploadFn)        on save (uploads a new second version)
  //   SiteAlbedo.apply(img, s) / SiteAlbedo.html(s) / SiteAlbedo.changed(s)
  var SiteAlbedo = (function(){
    var IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/avif';   // no SVG: not every page's upload takes it
    var controls = [];
    function theme(){ return document.body.classList.contains('light-mode') ? 'light' : 'dark'; }
    function other(t){ return t === 'light' ? 'dark' : 'light'; }
    function snapshot(s){ return [s.albedo || '', s.altMode && s.alt ? s.altMode + ':' + s.alt : ''].join('|'); }
    function read(node){
      var get = function(n){ return node && node.getAttribute ? node.getAttribute(n) : node ? node[n] : null; };
      var a = get('data-albedo');
      var s = { albedo: a === 'dark' || a === 'light' || a === 'off' ? a : null, alt: '', altMode: null, altFile: null, altUrl: '' };
      if (get('data-src-light')) { s.alt = get('data-src-light'); s.altMode = 'light'; }
      else if (get('data-src-dark')) { s.alt = get('data-src-dark'); s.altMode = 'dark'; }
      s._saved = snapshot(s);
      return s;
    }
    function fresh(){ var s = read(null); s.albedo = 'off'; s._saved = ''; return s; }
    function attrs(s){
      var on = s.albedo === 'dark' || s.albedo === 'light';
      var keepAlt = !on && s.alt && !s.altFile;
      return {
        'data-albedo': s.albedo,
        'data-src-light': keepAlt && s.altMode === 'light' ? s.alt : null,
        'data-src-dark': keepAlt && s.altMode === 'dark' ? s.alt : null
      };
    }
    function apply(img, s){
      var a = attrs(s);
      Object.keys(a).forEach(function(k){ if (a[k]) img.setAttribute(k, a[k]); else img.removeAttribute(k); });
    }
    function escAttr(v){ return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
    function html(s){
      var a = attrs(s);
      return Object.keys(a).filter(function(k){ return a[k]; }).map(function(k){ return ' ' + k + '="' + escAttr(a[k]) + '"'; }).join('');
    }
    function changed(s){ return snapshot(s) !== s._saved || !!s.altFile; }
    function replaced(s){ if (s.albedo === 'dark' || s.albedo === 'light') { s.albedo = theme(); refreshAll(); } }
    function upload(s, uploadFn){
      if (!s.altFile || s.albedo === 'dark' || s.albedo === 'light') return Promise.resolve();
      return Promise.resolve(uploadFn(s.altFile)).then(function(src){ s.alt = src; s.altFile = null; });
    }

    function control(s, opts){
      opts = opts || {};
      var box = el('div', 'albedo-ctl' + (opts.compact ? ' is-compact' : ''));
      var top = el('div', 'albedo-top');
      var sw = el('button', 'albedo-switch', { type: 'button', role: 'switch' });
      sw.appendChild(el('span', 'albedo-knob'));
      var label = el('span', 'albedo-label');
      label.textContent = 'Albedo inversion';
      var note = el('span', 'albedo-note');
      top.appendChild(sw);
      top.appendChild(label);
      top.appendChild(note);
      box.appendChild(top);

      var alt = el('div', 'albedo-alt');
      var file = el('input', '', { type: 'file', accept: IMAGE_TYPES, hidden: '' });
      var addBtn = el('button', 'albedo-add', { type: 'button' });
      var thumb = el('img', 'albedo-thumb', { alt: '' });
      var altName = el('span', 'albedo-alt-name');
      var change = el('button', 'albedo-link', { type: 'button' }); change.textContent = 'Change';
      var remove = el('button', 'albedo-link', { type: 'button' }); remove.textContent = 'Remove';
      [file, addBtn, thumb, altName, change, remove].forEach(function(n){ alt.appendChild(n); });
      box.appendChild(alt);

      function changedNow(){ render(); if (opts.onChange) opts.onChange(s); }
      sw.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        s.albedo = s.albedo === 'dark' || s.albedo === 'light' ? 'off' : theme();
        changedNow();
      });
      function pick(e){ e.preventDefault(); e.stopPropagation(); file.click(); }
      addBtn.addEventListener('click', pick);
      change.addEventListener('click', pick);
      thumb.addEventListener('click', pick);
      remove.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        if (s.altUrl) URL.revokeObjectURL(s.altUrl);
        s.alt = ''; s.altMode = null; s.altFile = null; s.altUrl = '';
        changedNow();
      });
      file.addEventListener('click', function(e){ e.stopPropagation(); });
      file.addEventListener('change', function(){
        var f = file.files && file.files[0];
        file.value = '';
        if (!f) return;
        var mode = s.alt || s.altFile ? s.altMode : other(theme());
        var dot = f.name.lastIndexOf('.');
        var named = new File([f], (dot > 0 ? f.name.slice(0, dot) : f.name) + '-' + mode + (dot > 0 ? f.name.slice(dot) : ''), { type: f.type });
        if (s.altUrl) URL.revokeObjectURL(s.altUrl);
        s.altFile = named;
        s.altUrl = URL.createObjectURL(named);
        s.altMode = mode;
        if (s.albedo == null) s.albedo = 'off';
        changedNow();
      });
      box.addEventListener('click', function(e){ e.stopPropagation(); });

      function render(){
        var on = s.albedo === 'dark' || s.albedo === 'light';
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
        sw.classList.toggle('is-default', s.albedo == null);
        box.classList.toggle('is-on', on);
        note.textContent = on ? 'made for ' + s.albedo + ' mode, flipped in ' + other(s.albedo) + ' mode'
          : s.albedo == null ? 'page default' : 'off';
        var has = !!(s.altUrl || s.alt);
        alt.hidden = on;
        addBtn.hidden = has;
        thumb.hidden = altName.hidden = change.hidden = remove.hidden = !has;
        addBtn.textContent = '+ Add ' + other(theme()) + ' mode version';
        if (has) {
          thumb.src = s.altUrl || s.alt;
          altName.textContent = (s.altMode === 'light' ? 'Light' : 'Dark') + ' mode version' + (s.altFile ? ' (new)' : '');
        }
      }
      box.refresh = render;
      controls.push(box);
      render();
      return box;
    }
    function refreshAll(){ controls.forEach(function(c){ c.refresh(); }); }
    // labels follow the theme the editor is in
    new MutationObserver(refreshAll).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return { theme: theme, read: read, fresh: fresh, control: control, replaced: replaced, upload: upload,
             apply: apply, html: html, attrs: attrs, changed: changed };
  })();
  window.SiteAlbedo = SiteAlbedo;

  function whenLoaded(fn){
    if (document.readyState === 'complete') fn();
    else window.addEventListener('load', fn);
  }

  whenLoaded(function(){
    fetch('/__edit/ping', { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error(); })
      .then(setup)
      .catch(function(){ /* not served by the local editor */ });
  });

  function setup(){
    editors = window.SiteEditors || [];
    restoreScroll();
    liveReload();
    gitButton();

    var toolbar = document.createElement('div');
    toolbar.className = 'site-edit-toolbar';
    function button(html, className, onClick){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'site-edit-btn ' + (className || '');
      b.innerHTML = html;
      b.addEventListener('click', onClick);
      toolbar.appendChild(b);
      return b;
    }

    // Five taps on the footer heart (each within 1.5 s of the last)
    var taps = 0, lastTap = 0;
    document.addEventListener('click', function(e){
      if (!e.target.closest || !e.target.closest('.footer-heart')) return;
      var now = Date.now();
      taps = now - lastTap < 1500 ? taps + 1 : 1;
      lastTap = now;
      if (taps < 5) return;
      taps = 0;
      if (editing) { toast('Already in edit mode'); return; }
      if (!editors.length) { toast('No editor for this page yet'); return; }
      location.href = urlWith(true);
    });

    if (!editing) {
      if (editors.length) {
        button(PENCIL + '<span>Edit</span>', 'is-primary', function(){ location.href = urlWith(true); });
        document.body.appendChild(toolbar);
      }
      return;
    }

    if (!editors.length) {
      toast('No editor for this page yet');
      return;
    }

    document.body.classList.add('site-editing');
    Promise.all(editors.map(function(ed){ return Promise.resolve(ed.start()); }))
      .then(function(){
        var cancel = button('Cancel', '', function(){
          if (pageDirty() && !confirm('Discard your changes?')) return;
          leaving = true;
          location.href = urlWith(false);
        });
        var save = button('Save', 'is-primary', function(){
          save.disabled = cancel.disabled = true;
          save.textContent = 'Saving…';
          saving = true;
          editors.reduce(function(chain, ed){
            return chain.then(function(){ return ed.save(); });
          }, Promise.resolve()).then(function(){
            leaving = true;
            location.href = urlWith(false);
          }).catch(function(err){
            saving = false;
            if (!(err && err.cancelled)) alert('Could not save: ' + (err && err.message ? err.message : err));
            save.disabled = cancel.disabled = false;
            save.textContent = 'Save';
          });
        });
        document.body.appendChild(toolbar);
      })
      .catch(function(err){
        toast('Could not start the editor: ' + (err && err.message ? err.message : err));
      });

    var leaving = false;
    window.addEventListener('beforeunload', function(e){
      if (leaving || !pageDirty()) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  // --- Live reload ---

  // "http://localhost:8790/css/a.css?v=2" -> "css/a.css" (null for other sites)
  function repoPath(url){
    try {
      var u = new URL(url, location.href);
      if (u.origin !== location.origin) return null;
      var p = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      return p === '' || /\/$/.test(p) ? p + 'index.html' : p;
    } catch (_) { return null; }
  }

  // Everything this page has loaded: its HTML, scripts, styles, images and
  // anything it fetched (data files)
  function filesInUse(){
    var used = {};
    used[repoPath(location.href)] = 'page';
    (performance.getEntriesByType ? performance.getEntriesByType('resource') : []).forEach(function(e){
      var p = repoPath(e.name);
      if (p && !used[p]) used[p] = 'other';
    });
    Array.prototype.forEach.call(document.scripts, function(s){ var p = s.src && repoPath(s.src); if (p) used[p] = 'other'; });
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"]'), function(l){ var p = repoPath(l.href); if (p) used[p] = 'css'; });
    Array.prototype.forEach.call(document.images, function(img){ var p = img.currentSrc || img.src; p = p && repoPath(p); if (p && !used[p]) used[p] = 'img'; });
    return used;
  }

  function liveReload(){
    if (!window.EventSource) return;
    if (performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(5000);
    var source = new EventSource('/__edit/events');
    source.addEventListener('change', function(e){
      var files = [];
      try { files = JSON.parse(e.data).files || []; } catch (_) { return; }
      filesChanged(files);
      document.dispatchEvent(new CustomEvent('site-files-changed', { detail: files }));
    });
  }

  function filesChanged(files){
    var used = filesInUse();
    var css = [], imgs = [], reload = false;
    files.forEach(function(f){
      var kind = used[f];
      if (!kind) return;
      if (kind === 'css') css.push(f);
      else if (kind === 'img') imgs.push(f);
      else reload = true;
    });
    if (reload) {
      if (saving) return;   // Save leaves the page when it's done
      if (pageDirty()) { toast('Files changed on disk: Save or Cancel to see them', 5000); return; }
      rememberScroll();
      location.reload();
      return;
    }
    var stamp = '?v=' + Date.now();
    // new stylesheet first, old one removed once it has loaded: no flash
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"]'), function(link){
      var p = repoPath(link.href);
      if (css.indexOf(p) === -1) return;
      var next = link.cloneNode();
      next.href = p + stamp;
      next.addEventListener('load', function(){ link.remove(); });
      next.addEventListener('error', function(){ next.remove(); });
      link.after(next);
    });
    Array.prototype.forEach.call(document.images, function(img){
      var p = repoPath(img.currentSrc || img.src);
      if (p && imgs.indexOf(p) !== -1) img.src = p + stamp;
    });
  }

  // Pages scroll either the window or body (css/style.css): keep both
  function rememberScroll(){
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
        url: location.pathname + location.search, x: window.scrollX, y: window.scrollY, body: document.body.scrollTop
      }));
    } catch (_) {}
  }

  function restoreScroll(){
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || 'null'); sessionStorage.removeItem(SCROLL_KEY); } catch (_) {}
    if (!saved || saved.url !== location.pathname + location.search) return;
    window.scrollTo(saved.x, saved.y);
    document.body.scrollTop = saved.body;
    // once more after late layout (images, fonts)
    setTimeout(function(){ window.scrollTo(saved.x, saved.y); document.body.scrollTop = saved.body; }, 250);
  }

  // --- Git: the button next to the logo and its dialog ---
  var git = { status: null, pill: null, dialog: null, ui: null, busy: false };

  function gitButton(){
    var header = document.querySelector('header');
    if (!header) return;
    var pill = git.pill = el('button', 'site-git-pill', { type: 'button' });
    header.appendChild(pill);
    pill.addEventListener('click', openGitDialog);

    function place(){
      var logo = header.querySelector('.logo-container') || header.firstElementChild;
      if (!logo || logo === pill) return;
      pill.style.left = Math.round(logo.getBoundingClientRect().right - header.getBoundingClientRect().left + 14) + 'px';
    }
    place();
    window.addEventListener('resize', place);
    // again whenever the logo changes size (e.g. once its image has loaded)
    var logoBox = header.querySelector('.logo-container');
    if (logoBox && window.ResizeObserver) new ResizeObserver(place).observe(logoBox);
    var quiet = function(){ refreshGit(false).catch(function(){}); };
    quiet();

    var timer = 0;
    document.addEventListener('site-files-changed', function(){
      clearTimeout(timer);
      timer = setTimeout(quiet, 500);
    });
    window.addEventListener('focus', quiet);
  }

  function refreshGit(fetchRemote){
    return fetch('/__edit/git/status' + (fetchRemote ? '?fetch=1' : ''), { cache: 'no-store' })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j; }); })
      .then(function(status){
        git.status = status;
        renderPill();
        if (git.dialog && git.dialog.open && !git.busy) renderGitDialog();
        return status;
      })
      .catch(function(err){
        if (git.pill) { git.pill.hidden = true; }
        throw err;
      });
  }

  function plural(n, one, many){ return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  function renderPill(){
    var s = git.status, pill = git.pill;
    if (!pill || !s) return;
    pill.hidden = false;
    var n = s.files.length;
    var bits = [];
    if (n) bits.push(plural(n, 'change'));
    if (s.ahead) bits.push('↑' + s.ahead + (n ? '' : ' to push'));
    if (s.behind) bits.push('↓' + s.behind);
    pill.className = 'site-git-pill' + (n ? ' has-changes' : (s.ahead ? ' has-ahead' : ' is-clean'));
    pill.innerHTML = BRANCH;
    pill.appendChild(el('span')).textContent = bits.length ? bits.join(' · ') : 'Up to date';
    pill.title = s.branch + (s.upstream ? ' → ' + s.upstream : '') + ': commit & push';
    pill.setAttribute('aria-label', 'Git: ' + (bits.length ? bits.join(', ') : 'up to date') + '. Commit and push');
  }

  // "https://github.com/arnablahiry/arnablahiry.github.io.git" -> what a push does
  function pushNote(remote){
    var m = String(remote || '').match(/github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/i);
    if (!m) return remote ? 'Push sends your commits to ' + remote + '.' : '';
    if (/\.github\.io$/i.test(m[2])) return 'Pushing publishes the live site (' + m[2] + ').';
    return 'Push sends your commits to github.com/' + m[1] + '/' + m[2] + '.';
  }

  // "Update travels, contact" from the changed files
  var PAGE_WORDS = ['index', 'about', 'travels', 'travel', 'tripblogs', 'fixations', 'mywildindia', 'memoirs', 'timeline', 'research', 'software', 'talks', 'publications', 'cv', 'contact', 'repositories'];
  function suggestMessage(files){
    var names = [];
    files.forEach(function(f){
      var lower = f.path.toLowerCase();
      PAGE_WORDS.some(function(w){
        if (lower.indexOf(w) === -1) return false;
        var name = w === 'index' ? 'home' : (w === 'travel' ? 'travels' : w);
        if (names.indexOf(name) === -1) names.push(name);
        return true;
      });
    });
    if (!names.length) return 'Update site';
    if (names.length > 4) return 'Update ' + names.slice(0, 4).join(', ') + ' and more';
    return 'Update ' + names.join(', ');
  }

  var CODE_NAMES = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied', U: 'conflict', '?': 'new' };
  function codeOf(f){
    var c = f.code.trim()[0] || '?';
    return CODE_NAMES[c] ? c : 'M';
  }

  function buildGitDialog(){
    var d = git.dialog = el('dialog', 'site-git-dialog', { 'aria-labelledby': 'site-git-title' });
    var ui = git.ui = {};
    var head = d.appendChild(el('div', 'sg-head'));
    var titles = head.appendChild(el('div'));
    titles.appendChild(el('div', 'sg-title', { id: 'site-git-title' })).textContent = 'Commit & push';
    ui.branch = titles.appendChild(el('div', 'sg-branch'));
    var x = head.appendChild(el('button', 'sg-x', { type: 'button', 'aria-label': 'Close' }));
    x.innerHTML = CROSS;
    x.addEventListener('click', function(){ if (!git.busy) d.close(); });

    var body = d.appendChild(el('div', 'sg-body'));
    ui.notes = body.appendChild(el('div', 'sg-notes'));
    ui.filesHead = body.appendChild(el('label', 'sg-files-head'));
    ui.all = ui.filesHead.appendChild(el('input', '', { type: 'checkbox' }));
    ui.count = ui.filesHead.appendChild(el('span'));
    ui.all.addEventListener('change', function(){
      ui.list.querySelectorAll('input').forEach(function(b){ b.checked = ui.all.checked; });
      updateCount();
    });
    ui.list = body.appendChild(el('ul', 'sg-files'));
    ui.list.addEventListener('change', updateCount);
    ui.msgLabel = body.appendChild(el('label', 'sg-label', { for: 'sg-message' }));
    ui.msgLabel.textContent = 'Commit message';
    ui.message = body.appendChild(el('textarea', 'sg-message', { id: 'sg-message', rows: '3', placeholder: 'What changed?' }));
    ui.output = body.appendChild(el('pre', 'sg-output'));
    ui.output.hidden = true;

    var foot = d.appendChild(el('div', 'sg-foot'));
    ui.push = foot.appendChild(el('p', 'sg-push-note'));
    var buttons = foot.appendChild(el('div', 'sg-buttons'));
    ui.cancel = buttons.appendChild(el('button', 'sg-btn', { type: 'button' }));
    ui.cancel.textContent = 'Close';
    ui.cancel.addEventListener('click', function(){ if (!git.busy) d.close(); });
    ui.commit = buttons.appendChild(el('button', 'sg-btn', { type: 'button' }));
    ui.commit.textContent = 'Commit';
    ui.commit.addEventListener('click', function(){ runGit(false); });
    ui.commitPush = buttons.appendChild(el('button', 'sg-btn is-primary', { type: 'button' }));
    ui.commitPush.addEventListener('click', function(){ runGit(true); });

    d.addEventListener('cancel', function(e){ if (git.busy) e.preventDefault(); });
    document.body.appendChild(d);
  }

  function openGitDialog(){
    if (!git.dialog) buildGitDialog();
    git.ui.output.hidden = true;
    git.ui.message.value = '';
    git.ui.list.innerHTML = '';   // every file starts ticked again
    git.ui.branch.textContent = 'Checking GitHub…';
    renderGitDialog();
    git.dialog.showModal();
    // fetch first, so "behind" is up to date
    refreshGit(true).then(function(){
      if (!git.ui.message.value && git.status.files.length) git.ui.message.value = suggestMessage(git.status.files);
    }).catch(function(err){ showOutput('Could not read git status: ' + err.message, true); });
  }

  function renderGitDialog(){
    var s = git.status, ui = git.ui;
    if (!s || !ui) return;
    ui.branch.textContent = s.branch + (s.upstream ? ' → ' + s.upstream : ' (not on GitHub yet)');

    ui.notes.innerHTML = '';
    var note = function(text, kind){ ui.notes.appendChild(el('p', 'sg-note ' + (kind || ''))).textContent = text; };
    if (s.behind) note('GitHub has ' + plural(s.behind, 'commit') + ' you don\'t have yet: a push will be refused until you pull them (git pull in a terminal).', 'is-warn');
    if (s.ahead) note(plural(s.ahead, 'commit') + ' not pushed yet.');
    if (s.fetchError) note('Could not check GitHub: ' + s.fetchError, 'is-warn');
    if (pageDirty()) note('This page has unsaved edits: Save them first to include them.', 'is-warn');

    // keep ticks across refreshes; new files start ticked
    var was = {};
    ui.list.querySelectorAll('input').forEach(function(b){ was[b.value] = b.checked; });
    ui.list.innerHTML = '';
    s.files.forEach(function(f){
      var li = ui.list.appendChild(el('li'));
      var label = li.appendChild(el('label'));
      var box = label.appendChild(el('input', '', { type: 'checkbox', value: f.path }));
      box.checked = was.hasOwnProperty(f.path) ? was[f.path] : true;
      var code = codeOf(f);
      label.appendChild(el('span', 'sg-code is-' + CODE_NAMES[code], { title: CODE_NAMES[code] })).textContent = code === '?' ? 'N' : code;
      var name = label.appendChild(el('span', 'sg-path'));
      var cut = f.path.lastIndexOf('/');
      if (cut !== -1) name.appendChild(el('span', 'sg-dir')).textContent = f.path.slice(0, cut + 1);
      name.appendChild(document.createTextNode(f.path.slice(cut + 1)));
      if (f.from) name.appendChild(el('span', 'sg-dir')).textContent = '  ← ' + f.from;
    });
    var hasFiles = s.files.length > 0;
    ui.filesHead.hidden = ui.list.hidden = ui.msgLabel.hidden = ui.message.hidden = !hasFiles;
    if (!hasFiles) note(s.ahead ? 'Nothing new to commit.' : 'Nothing to commit: everything is committed and pushed.');
    updateCount();

    ui.push.textContent = pushNote(s.remote);
    ui.commit.hidden = !hasFiles;
    ui.commitPush.hidden = !hasFiles && !s.ahead;
    ui.commitPush.textContent = hasFiles ? 'Commit & push' : 'Push ' + plural(s.ahead, 'commit');
  }

  function pickedFiles(){
    return Array.prototype.filter.call(git.ui.list.querySelectorAll('input'), function(b){ return b.checked; }).map(function(b){ return b.value; });
  }

  function updateCount(){
    var ui = git.ui, total = ui.list.querySelectorAll('input').length, n = pickedFiles().length;
    ui.count.textContent = n + ' of ' + plural(total, 'file') + ' ticked';
    ui.all.checked = n === total && total > 0;
    ui.all.indeterminate = n > 0 && n < total;
  }

  function showOutput(text, isError){
    git.ui.output.hidden = !text;
    git.ui.output.textContent = text || '';
    git.ui.output.classList.toggle('is-error', !!isError);
  }

  function runGit(push){
    var s = git.status, ui = git.ui;
    if (!s || git.busy) return;
    var commit = s.files.length > 0;
    var files = pickedFiles();
    if (commit && !files.length) { showOutput('Tick at least one file.', true); return; }
    if (commit && !ui.message.value.trim()) { showOutput('Write a commit message first.', true); ui.message.focus(); return; }

    git.busy = true;
    var buttons = [ui.cancel, ui.commit, ui.commitPush];
    buttons.forEach(function(b){ b.disabled = true; });
    var label = push ? ui.commitPush : ui.commit;
    var before = label.textContent;
    label.textContent = commit ? (push ? 'Committing & pushing…' : 'Committing…') : 'Pushing…';
    showOutput('');

    var request = commit
      ? fetch('/__edit/git/commit', { method: 'POST', headers: { 'X-Site-Edit': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: ui.message.value, files: files, push: push }) })
      : fetch('/__edit/git/push', { method: 'POST', headers: { 'X-Site-Edit': '1' } });

    request
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.statusText); return j; }); })
      .then(function(result){
        git.busy = false;
        if (result.ok) {
          git.dialog.close();
          toast(result.commit
            ? 'Committed ' + result.commit + (result.pushed ? ' and pushed' : '')
            : 'Pushed', 3500);
        } else {
          var what = result.step === 'push'
            ? (result.commit ? 'Committed ' + result.commit + ', but the push failed:' : 'The push failed:')
            : 'Git could not ' + (result.step || 'do that') + ':';
          showOutput(what + '\n' + (result.output || ''), true);
        }
        return refreshGit(false).catch(function(){});
      })
      .catch(function(err){
        git.busy = false;
        showOutput(err.message, true);
      })
      .then(function(){
        buttons.forEach(function(b){ b.disabled = false; });
        label.textContent = before;
        if (git.dialog.open) renderGitDialog();
      });
  }
})();
