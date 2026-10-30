#!/usr/bin/env node

// Local site editor.
//
//   npm run edit            then open http://localhost:8790/ (any page)
//   npm run edit:open       ...and open it in the browser; also works as
//   npm run edit --open     or  npm run edit -- --open fixations.html
//
// Serves the site from the repo root. On a page that has an editor, tap the
// pixel heart in the footer 5 times (or use the Edit button) to switch to
// edit mode; scripts/edit-mode.js runs the toolbar and the page's own editor
// saves through the API below.
//
//   GET  /__edit/ping
//   Fixations (scripts/fixations-edit.js)
//     GET  /__edit/fixations/items                rows of data/fixations.xlsx
//     POST /__edit/fixations/items  {items}       rewrite rows + sync
//     POST /__edit/fixations/upload?kind=&name=   cover -> images/fixations/<kind>/
//   Travel (scripts/travel-edit.js)
//     GET  /__edit/travel/data                    captions + authors
//     POST /__edit/travel/upload?folder=&name=    photo -> images/travels/<folder>/
//     POST /__edit/travel/save {captions, remove}  merge captions, move removed
//                                              photos to .edit-trash/, rebuild
//   Travel places (scripts/travel-places-edit.js)
//     GET  /__edit/travel/countries               every country (id, name, continent)
//     GET  /__edit/travel/regions?country=<id>    its regions, each with its cities
//     POST /__edit/travel/places {places}         -> scripts/travel-places.js (old
//                                              copy in .edit-trash/travel-places/)
//   Contact (scripts/contact-edit.js)
//     POST /__edit/contact/save {fallback, cards}  -> scripts/contact-places.js
//                                              (old copy in .edit-trash/contact-places/)
//   Timeline (scripts/timeline-edit.js)
//     POST /__edit/timeline/upload?name=          image -> images/timeline/
//     POST /__edit/timeline/save    {html}        replace the entries between
//                                              the timeline-entries markers in
//                                              timeline.html (old copy kept in
//                                              .edit-trash/timeline/)
//   Publications (scripts/publications-edit.js)
//     POST /__edit/publications/upload?name=      cover -> images/publications/
//     POST /__edit/publications/save {html, bibtex}  replace the cards between
//                                              the publications markers (old
//                                              copy in .edit-trash/publications/)
//                                              and write bibtex/<name>.html pages
//   Talks (scripts/talks-edit.js)
//     POST /__edit/talks/upload?kind=pdf|image&name=   -> docs/talks/ or images/talks/
//     POST /__edit/talks/save   {html}        replace the cards between the
//                                              talks-cards markers, then compress
//                                              new PDFs and render their page-1
//                                              posters (npm run talks:sync)
//   Research & Software cards (scripts/cards-edit.js)
//     POST /__edit/cards/upload?page=&name=       image -> images/research/ or images/softwares/
//                              (&kind=icon: a card's icon-link image -> images/icons/)
//     POST /__edit/cards/save   {page, html}      replace the cards between the
//                                              <page>-cards markers (old copy in
//                                              .edit-trash/<page>/)
//
//   Live reload (scripts/edit-mode.js)
//     GET  /__edit/events                         server-sent events: "change"
//                                              {files} whenever files in the
//                                              repo change (pages reload or
//                                              swap in new CSS)
//   Git (scripts/edit-mode.js, the button in the header)
//     GET  /__edit/git/status[?fetch=1]           branch, ahead/behind, changed files
//     POST /__edit/git/commit {message, files, push}  commit the ticked files,
//                                              optionally push
//     POST /__edit/git/push                       push commits not pushed yet
//
// Listens on 127.0.0.1 only. POSTs must carry the X-Site-Edit header, which a
// page on another origin cannot send without a CORS preflight that this
// server never approves.

const fs = require('fs');
const path = require('path');
const http = require('http');
const childProcess = require('child_process');
const XLSX = require('xlsx');

const repoRoot = path.resolve(__dirname, '..');
const workbookPath = path.join(repoRoot, 'data', 'fixations.xlsx');
const imagesRoot = path.join(repoRoot, 'images', 'fixations');
const syncScriptPath = path.join(__dirname, 'sync-fixations-spreadsheet.js');
const travelRoot = path.join(repoRoot, 'images', 'travels');
const travelManifestScript = path.join(__dirname, 'generate-travel-photo-manifest.js');
const travelCaptions = require('./sync-travel-caption-spreadsheet.js');
const travelGeo = require('./travel-geo.js');
const contactPlacesPath = path.join(__dirname, 'contact-places.js');
const timelinePagePath = path.join(repoRoot, 'timeline.html');
const timelineImagesRoot = path.join(repoRoot, 'images', 'timeline');
const TIMELINE_START = /<!-- timeline-entries:start[\s\S]*?-->\n?/;
const TIMELINE_END = /[ \t]*<!-- timeline-entries:end -->/;
const publicationsPagePath = path.join(repoRoot, 'publications.html');
const publicationsImagesRoot = path.join(repoRoot, 'images', 'publications');
const PUBLICATIONS_START = /<!-- publications:start[\s\S]*?-->\n?/;
const PUBLICATIONS_END = /[ \t]*<!-- publications:end -->/;
const bibtexRoot = path.join(repoRoot, 'bibtex');
const talksPagePath = path.join(repoRoot, 'talks.html');
const TALKS_START = /<!-- talks-cards:start[\s\S]*?-->\n?/;
const TALKS_END = /[ \t]*<!-- talks-cards:end -->/;
const CARD_PAGES = {
  research: { file: 'research.html', images: 'images/research' },
  software: { file: 'software.html', images: 'images/softwares' }
};
function cardMarkers(page) {
  return {
    start: new RegExp(`<!-- ${page}-cards:start[\\s\\S]*?-->\\n?`),
    end: new RegExp(`[ \\t]*<!-- ${page}-cards:end -->`)
  };
}
const BIBTEX_NAME = /^[a-z0-9][a-z0-9_-]*$/;
const PORT = Number(process.env.SITE_EDIT_PORT || process.env.FIXATIONS_EDIT_PORT) || 8790;
const HOST = '127.0.0.1';

const HEADER = ['Kind', 'Image', 'Title', 'Rating', 'Description'];
const KINDS = ['books', 'movies', 'shows', 'games'];
const KIND_LABELS = { books: 'Books', movies: 'Movies', shows: 'Shows', games: 'Games' };
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml'
};

function normalizeKind(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'tv' || v === 'show' || v === 'series') return 'shows';
  const plural = v.endsWith('s') ? v : `${v}s`;
  return KINDS.includes(plural) ? plural : '';
}

function cleanImagePath(value) {
  const rel = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!rel) return '';
  const resolved = path.resolve(imagesRoot, rel);
  if (!resolved.startsWith(imagesRoot + path.sep)) return '';
  return rel;
}

// The Image cell, or a file in the same folder with the same name and another
// extension when the cell's file doesn't exist (as the sync script does).
function resolveImage(value) {
  const rel = cleanImagePath(value);
  if (!rel || fs.existsSync(path.join(imagesRoot, rel))) return rel;
  const dir = path.posix.dirname(rel);
  const stem = path.posix.basename(rel).replace(/\.[^.]+$/, '').toLowerCase();
  const absDir = path.join(imagesRoot, dir);
  if (!fs.existsSync(absDir)) return rel;
  const match = fs.readdirSync(absDir).find((name) =>
    IMAGE_EXT.test(name) && name.replace(/\.[^.]+$/, '').toLowerCase() === stem);
  return match ? `${dir}/${match}` : rel;
}

function clampRating(value) {
  return Math.max(0, Math.min(5, Math.round((Number(value) || 0) * 2) / 2));
}

// --- Workbook ---
function readItems() {
  if (!fs.existsSync(workbookPath)) return [];
  const workbook = XLSX.readFile(workbookPath);
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
    .slice(1)
    .map((row) => row.map((c) => (c == null ? '' : String(c).trim())))
    .filter((row) => row.some(Boolean))
    .map((row) => ({
      kind: normalizeKind(row[0]) || 'books',
      image: resolveImage(row[1]),
      title: row[2] || '',
      rating: clampRating(row[3]),
      description: row[4] || ''
    }));
}

function writeItems(items) {
  const rows = items.map((item) => [
    KIND_LABELS[normalizeKind(item.kind) || 'books'],
    cleanImagePath(item.image),
    String(item.title || '').trim(),
    clampRating(item.rating) || '',
    String(item.description || '').trim()
  ]);
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
  ws['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 40 }, { wch: 8 }, { wch: 90 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fixations');
  fs.mkdirSync(path.dirname(workbookPath), { recursive: true });
  XLSX.writeFile(wb, workbookPath);
}

function runScript(scriptPath) {
  const result = childProcess.spawnSync(process.execPath, [scriptPath], { cwd: repoRoot, encoding: 'utf8' });
  const log = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (log) console.log(log);
  return { ok: result.status === 0, log };
}

// --- Uploads ---
function uniqueImageName(dir, original) {
  const ext = /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(original) ? path.extname(original).toLowerCase() : '';
  const stem = path.basename(original, path.extname(original))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cover';
  let name = `${stem}${ext}`;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i += 1) name = `${stem}-${i}${ext}`;
  return name;
}

// --- Travel ---
const FOLDER_RE = /^[a-z0-9][a-z0-9_-]*$/;

function travelData() {
  const captions = travelCaptions.readCaptions();
  const authors = new Set(['Arnab']);
  Object.values(captions).forEach((entries) => Object.values(entries).forEach((e) => { if (e.author) authors.add(e.author); }));
  return { captions, authors: Array.from(authors) };
}

// Removed photos are moved (not deleted) to .edit-trash/travels/<folder>/,
// which git ignores; their thumbnails are regenerated anyway, so dropped.
function trashTravelPhoto(folder, file) {
  if (!FOLDER_RE.test(folder) || file !== path.basename(file) || !IMAGE_EXT.test(file)) return;
  const source = path.join(travelRoot, folder, file);
  if (!fs.existsSync(source)) return;
  const trashDir = path.join(repoRoot, '.edit-trash', 'travels', folder);
  fs.mkdirSync(trashDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(source, path.join(trashDir, `${stamp}_${file}`));
  const thumb = path.join(travelRoot, folder, 'thumbs', `${path.parse(file).name}.jpg`);
  if (fs.existsSync(thumb)) fs.unlinkSync(thumb);
  console.log(`Moved images/travels/${folder}/${file} to .edit-trash/travels/${folder}/`);
}

function saveTravel(edits, remove) {
  (Array.isArray(remove) ? remove : []).forEach((r) => trashTravelPhoto(String(r.folder || ''), String(r.file || '')));
  const captions = travelCaptions.readCaptions();
  Object.keys(edits || {}).forEach((folder) => {
    if (!FOLDER_RE.test(folder)) return;
    captions[folder] = captions[folder] || {};
    Object.keys(edits[folder] || {}).forEach((file) => {
      if (file !== path.basename(file) || !IMAGE_EXT.test(file)) return;
      const e = edits[folder][file] || {};
      captions[folder][file] = {
        caption: String(e.caption || '').trim(),
        author: String(e.author || '').trim()
      };
    });
  });
  travelCaptions.writeCaptions(captions);
  // Rebuilds the photo list and thumbnails, then re-syncs the captions
  return runScript(travelManifestScript);
}

// --- Contact ---
const CONTACT_ID_RE = /^[a-z0-9_-]{1,40}$/;
const CONTACT_FIELDS = ['tz', 'from', 'to', 'note', 'address', 'map', 'email1', 'email2', 'phone'];

function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (_) { return false; }
}

// Checks every field, then writes scripts/contact-places.js (the previous
// version goes to .edit-trash/contact-places/)
function saveContact(payload) {
  const cards = {};
  Object.keys((payload && payload.cards) || {}).forEach((id) => {
    if (!CONTACT_ID_RE.test(id)) return;
    const input = payload.cards[id] || {};
    const card = {};
    CONTACT_FIELDS.forEach((key) => { card[key] = String(input[key] == null ? '' : input[key]).trim().slice(0, 4000); });
    ['from', 'to'].forEach((key) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(card[key])) card[key] = ''; });
    if (card.from && card.to && card.from > card.to) [card.from, card.to] = [card.to, card.from];
    if (card.tz && !validTimeZone(card.tz)) card.tz = '';
    if (card.map && !/^https?:\/\//i.test(card.map)) card.map = '';
    cards[id] = card;
  });
  const ids = Object.keys(cards);
  if (!ids.length) throw Object.assign(new Error('No cards to save'), { status: 400 });
  const fallback = ids.includes(payload.fallback) ? payload.fallback : ids[0];

  if (fs.existsSync(contactPlacesPath)) {
    const trashDir = path.join(repoRoot, '.edit-trash', 'contact-places');
    fs.mkdirSync(trashDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(contactPlacesPath, path.join(trashDir, `${stamp}_contact-places.js`));
  }
  const header = fs.existsSync(contactPlacesPath)
    ? (fs.readFileSync(contactPlacesPath, 'utf8').match(/^(?:\/\/.*\n)+/) || [''])[0]
    : '';
  fs.writeFileSync(contactPlacesPath, `${header}window.CONTACT_PLACES = ${JSON.stringify({ fallback, cards }, null, 2)};\n`);
}

// --- Timeline ---
// Replaces the part of a page between its start/end marker comments, keeping
// the previous version of the page in .edit-trash/<name>/.
function saveRegion(pagePath, startRe, endRe, html, trashName) {
  const page = fs.readFileSync(pagePath, 'utf8');
  const start = page.match(startRe);
  const end = page.match(endRe);
  if (!start || !end || end.index < start.index) throw new Error(`editable-region markers not found in ${path.basename(pagePath)}`);
  const from = start.index + start[0].length;
  const trashDir = path.join(repoRoot, '.edit-trash', trashName);
  fs.mkdirSync(trashDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(trashDir, `${stamp}_${path.basename(pagePath)}`), page);
  const body = `\n${String(html).replace(/\s+$/, '')}\n\n`;
  fs.writeFileSync(pagePath, page.slice(0, from) + body + page.slice(end.index));
}

function saveTimeline(html) {
  saveRegion(timelinePagePath, TIMELINE_START, TIMELINE_END, html, 'timeline');
}

// BibTeX pages (bibtex/<name>.html) share one look: the page is rebuilt from
// an existing one with only the entry swapped. An empty entry leaves the page.
function writeBibtexPage(name, entry) {
  if (!BIBTEX_NAME.test(name)) throw new Error(`bad BibTeX page name "${name}"`);
  const text = String(entry || '').replace(/\r\n/g, '\n').trim();
  if (!text) return;
  const template = fs.readdirSync(bibtexRoot).filter((f) => f.endsWith('.html')).sort()[0];
  if (!template) throw new Error('no bibtex/*.html page to use as a template');
  const html = fs.readFileSync(path.join(bibtexRoot, template), 'utf8');
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const next = html.replace(/(<pre id="bibtex">)[\s\S]*?(<\/pre>)/, (_, a, b) => `${a}\n${escaped}\n${b}`);
  if (next === html && !html.includes('<pre id="bibtex">')) throw new Error(`bibtex/${template} has no <pre id="bibtex">`);
  const file = path.join(bibtexRoot, `${name}.html`);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) return;
  fs.writeFileSync(file, next);
  console.log(`Wrote bibtex/${name}.html`);
}

// --- HTTP helpers ---
function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Upload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isTrustedWrite(req) {
  if (req.headers['x-site-edit'] !== '1') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const { hostname, port } = new URL(origin);
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname) && Number(port || 80) === PORT;
  } catch (_) {
    return false;
  }
}

function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (_) {
    return send(res, 400, 'Bad request', 'text/plain');
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = path.resolve(repoRoot, `.${rel}`);
  const inside = filePath === repoRoot || filePath.startsWith(repoRoot + path.sep);
  const hidden = path.relative(repoRoot, filePath).split(path.sep).some((part) => part.startsWith('.'));
  if (!inside || hidden) return send(res, 404, 'Not found', 'text/plain');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

// --- Live reload ---
// Every page served by this editor listens on /__edit/events; a burst of
// writes (a Save, a git checkout) arrives as one "change" event.
const liveClients = new Set();
const IGNORED_DIRS = ['node_modules', '.git', '.edit-trash'];
let pendingChanges = new Set();
let changeTimer = null;

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  liveClients.forEach((res) => res.write(msg));
}

function watchRepo() {
  try {
    fs.watch(repoRoot, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const rel = filename.split(path.sep).join('/');
      if (IGNORED_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`))) return;
      if (/(^|\/)\.DS_Store$|~$|\.swp$/.test(rel)) return;
      pendingChanges.add(rel);
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => {
        const files = Array.from(pendingChanges);
        pendingChanges = new Set();
        broadcast('change', { files });
      }, 120);
    });
  } catch (error) {
    console.log(`Live reload is off (could not watch the repo: ${error.message}).`);
  }
}

function serveEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive'
  });
  res.write('retry: 1000\n\n');
  liveClients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); liveClients.delete(res); });
}

// --- Git ---
// Git runs without a shell (arguments are passed as a list) and never asks
// for a password in the terminal: a push that needs credentials fails with
// git's message instead of hanging.
function git(args, timeout) {
  return new Promise((resolve) => {
    childProcess.execFile('git', args, {
      cwd: repoRoot,
      timeout: timeout || 20000,
      maxBuffer: 8 * 1024 * 1024,
      env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' })
    }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error ? error.code : 0, out: String(stdout || ''), err: String(stderr || (error && error.message) || '') });
    });
  });
}

// `git status --porcelain -z`: "XY path\0", renames "R  new\0old\0"
function parseStatus(raw) {
  const parts = raw.split('\0');
  const files = [];
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i];
    if (!entry) continue;
    const code = entry.slice(0, 2);
    const file = { code, path: entry.slice(3) };
    if (code[0] === 'R' || code[0] === 'C') { file.from = parts[i + 1]; i += 1; }
    files.push(file);
  }
  return files;
}

async function gitStatus(fetchFirst) {
  let fetchError = '';
  if (fetchFirst) {
    const f = await git(['fetch', '--quiet'], 15000);
    if (!f.ok) fetchError = f.err.trim();
  }
  const [branch, upstream, status, remote] = await Promise.all([
    git(['rev-parse', '--abbrev-ref', 'HEAD']),
    git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']),
    git(['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    git(['remote', 'get-url', 'origin'])
  ]);
  if (!branch.ok) throw new Error(branch.err.trim() || 'Not a git repository');
  let ahead = 0, behind = 0;
  if (upstream.ok) {
    const counts = await git(['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
    if (counts.ok) [ahead, behind] = counts.out.trim().split(/\s+/).map(Number);
  }
  return {
    branch: branch.out.trim(),
    upstream: upstream.ok ? upstream.out.trim() : '',
    remote: remote.ok ? remote.out.trim() : '',
    ahead, behind,
    files: parseStatus(status.out),
    fetchError
  };
}

async function gitPush(branch, upstream) {
  return upstream ? git(['push'], 90000) : git(['push', '-u', 'origin', branch], 90000);
}

// Commits exactly the ticked files (their staged and unstaged changes),
// whatever else is in the index, then pushes if asked
async function gitCommit(payload) {
  const message = String(payload.message || '').trim();
  if (!message) throw Object.assign(new Error('Write a commit message first'), { status: 400 });
  if (message.length > 5000) throw Object.assign(new Error('Commit message too long'), { status: 400 });
  const status = await gitStatus(false);
  const known = new Map();
  status.files.forEach((f) => { known.set(f.path, f); });
  const picked = (Array.isArray(payload.files) ? payload.files : []).map(String).filter((p) => known.has(p));
  if (!picked.length) throw Object.assign(new Error('Tick at least one file to commit'), { status: 400 });
  const paths = [];
  picked.forEach((p) => { paths.push(p); if (known.get(p).from) paths.push(known.get(p).from); });

  const add = await git(['add', '-A', '--', ...paths]);
  if (!add.ok) return { ok: false, step: 'add', output: add.err };
  const commit = await git(['commit', '-m', message, '--', ...paths]);
  if (!commit.ok) return { ok: false, step: 'commit', output: (commit.out + commit.err).trim() };
  const sha = (await git(['rev-parse', '--short', 'HEAD'])).out.trim();
  console.log(`Committed ${sha} from the editor: ${message.split('\n')[0]}`);
  if (!payload.push) return { ok: true, commit: sha, pushed: false, output: commit.out.trim() };
  const push = await gitPush(status.branch, status.upstream);
  if (push.ok) console.log(`Pushed ${status.branch} from the editor.`);
  return { ok: push.ok, step: push.ok ? '' : 'push', commit: sha, pushed: push.ok, output: (push.ok ? commit.out : push.err).trim() };
}

// --- Server ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const { pathname } = url;

  try {
    if (pathname === '/__edit/ping') return send(res, 200, { ok: true });

    if (pathname === '/__edit/events') return serveEvents(req, res);

    if (pathname === '/__edit/git/status') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
      return send(res, 200, await gitStatus(url.searchParams.get('fetch') === '1'));
    }

    if (pathname === '/__edit/git/commit' || pathname === '/__edit/git/push') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      if (pathname === '/__edit/git/push') {
        const status = await gitStatus(false);
        const push = await gitPush(status.branch, status.upstream);
        if (push.ok) console.log(`Pushed ${status.branch} from the editor.`);
        return send(res, 200, { ok: push.ok, step: push.ok ? '' : 'push', pushed: push.ok, output: push.err.trim() });
      }
      const payload = JSON.parse((await readBody(req, 256 * 1024)).toString('utf8') || '{}');
      return send(res, 200, await gitCommit(payload));
    }

    if (pathname === '/__edit/fixations/items') {
      if (req.method === 'GET') return send(res, 200, { items: readItems() });
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });

      const payload = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8') || '{}');
      if (!Array.isArray(payload.items)) return send(res, 400, { error: 'Expected {items: [...]}' });
      writeItems(payload.items);
      const sync = runScript(syncScriptPath);
      console.log(`Saved ${payload.items.length} fixation row(s) from the editor.`);
      return send(res, sync.ok ? 200 : 500, { ok: sync.ok, log: sync.log });
    }

    if (pathname === '/__edit/talks/upload') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const pdf = url.searchParams.get('kind') === 'pdf';
      const original = url.searchParams.get('name') || (pdf ? 'talk.pdf' : 'cover.jpg');
      if (pdf ? !/\.pdf$/i.test(original) : !/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(original)) {
        return send(res, 400, { error: pdf ? 'Use a .pdf file' : 'Use a .jpg, .png, .svg, .webp, .gif or .avif image' });
      }
      const body = await readBody(req, pdf ? 200 * 1024 * 1024 : MAX_UPLOAD_BYTES);
      if (!body.length) return send(res, 400, { error: 'Empty upload' });
      const dirRel = pdf ? 'docs/talks' : 'images/talks';
      const dir = path.join(repoRoot, dirRel);
      fs.mkdirSync(dir, { recursive: true });
      // PDFs keep their name (it becomes the poster's name too), made unique
      let name = original;
      if (pdf) {
        const stem = path.basename(original, path.extname(original)).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'talk';
        name = `${stem}.pdf`;
        for (let i = 2; fs.existsSync(path.join(dir, name)); i += 1) name = `${stem}-${i}.pdf`;
      } else {
        name = uniqueImageName(dir, original);
      }
      fs.writeFileSync(path.join(dir, name), body);
      console.log(`Saved ${dirRel}/${name}`);
      return send(res, 200, { src: `${dirRel}/${name}` });
    }

    if (pathname === '/__edit/talks/save') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const payload = JSON.parse((await readBody(req, 4 * 1024 * 1024)).toString('utf8') || '{}');
      if (typeof payload.html !== 'string') return send(res, 400, { error: 'Expected {html}' });
      saveRegion(talksPagePath, TALKS_START, TALKS_END, payload.html, 'talks');
      console.log('Saved talks.html from the editor (previous version in .edit-trash/talks/).');
      // compress any new PDFs, then render missing posters (both skip work already done)
      const optimize = runScript(path.join(__dirname, 'optimize-talk-pdfs.js'));
      const thumbs = runScript(path.join(__dirname, 'generate-talk-thumbnails.js'));
      return send(res, thumbs.ok ? 200 : 500, { ok: thumbs.ok, log: [optimize.log, thumbs.log].filter(Boolean).join('\n') });
    }

    if (pathname === '/__edit/cards/upload') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const page = CARD_PAGES[url.searchParams.get('page')];
      if (!page) return send(res, 400, { error: 'Unknown page' });
      const original = url.searchParams.get('name') || 'image.png';
      if (!/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(original)) return send(res, 400, { error: 'Use a .jpg, .png, .svg, .webp, .gif or .avif image' });
      const body = await readBody(req, MAX_UPLOAD_BYTES);
      if (!body.length) return send(res, 400, { error: 'Empty upload' });
      const folder = url.searchParams.get('kind') === 'icon' ? 'images/icons' : page.images;
      const dir = path.join(repoRoot, folder);
      fs.mkdirSync(dir, { recursive: true });
      const name = uniqueImageName(dir, original);
      fs.writeFileSync(path.join(dir, name), body);
      console.log(`Saved ${folder}/${name}`);
      return send(res, 200, { src: `${folder}/${name}` });
    }

    if (pathname === '/__edit/cards/save') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const payload = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString('utf8') || '{}');
      const page = CARD_PAGES[payload.page];
      if (!page || typeof payload.html !== 'string') return send(res, 400, { error: 'Expected {page, html}' });
      const m = cardMarkers(payload.page);
      saveRegion(path.join(repoRoot, page.file), m.start, m.end, payload.html, payload.page);
      console.log(`Saved ${page.file} from the editor (previous version in .edit-trash/${payload.page}/).`);
      return send(res, 200, { ok: true });
    }

    if (pathname === '/__edit/publications/upload') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const original = url.searchParams.get('name') || 'cover.png';
      if (!/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(original)) return send(res, 400, { error: 'Use a .jpg, .png, .svg, .webp, .gif or .avif image' });
      const body = await readBody(req, MAX_UPLOAD_BYTES);
      if (!body.length) return send(res, 400, { error: 'Empty upload' });
      fs.mkdirSync(publicationsImagesRoot, { recursive: true });
      const name = uniqueImageName(publicationsImagesRoot, original);
      fs.writeFileSync(path.join(publicationsImagesRoot, name), body);
      console.log(`Saved images/publications/${name}`);
      return send(res, 200, { src: `images/publications/${name}` });
    }

    if (pathname === '/__edit/publications/save') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const payload = JSON.parse((await readBody(req, 4 * 1024 * 1024)).toString('utf8') || '{}');
      if (typeof payload.html !== 'string') return send(res, 400, { error: 'Expected {html}' });
      Object.keys(payload.bibtex || {}).forEach((name) => writeBibtexPage(name, payload.bibtex[name]));
      saveRegion(publicationsPagePath, PUBLICATIONS_START, PUBLICATIONS_END, payload.html, 'publications');
      console.log('Saved publications.html from the editor (previous version in .edit-trash/publications/).');
      return send(res, 200, { ok: true });
    }

    if (pathname === '/__edit/timeline/upload') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const original = url.searchParams.get('name') || 'photo.jpg';
      if (!IMAGE_EXT.test(original)) return send(res, 400, { error: 'Use a .jpg, .png, .webp, .gif or .avif image' });
      const body = await readBody(req, MAX_UPLOAD_BYTES);
      if (!body.length) return send(res, 400, { error: 'Empty upload' });
      fs.mkdirSync(timelineImagesRoot, { recursive: true });
      const name = uniqueImageName(timelineImagesRoot, original);
      fs.writeFileSync(path.join(timelineImagesRoot, name), body);
      console.log(`Saved images/timeline/${name}`);
      return send(res, 200, { src: `images/timeline/${name}` });
    }

    if (pathname === '/__edit/timeline/save') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const payload = JSON.parse((await readBody(req, 4 * 1024 * 1024)).toString('utf8') || '{}');
      if (typeof payload.html !== 'string') return send(res, 400, { error: 'Expected {html}' });
      saveTimeline(payload.html);
      console.log('Saved timeline.html from the editor (previous version in .edit-trash/timeline/).');
      return send(res, 200, { ok: true });
    }

    if (pathname === '/__edit/fixations/upload' || pathname === '/__edit/travel/upload') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });

      const travel = pathname === '/__edit/travel/upload';
      const folder = travel
        ? String(url.searchParams.get('folder') || '').toLowerCase()
        : (normalizeKind(url.searchParams.get('kind')) || 'books');
      if (travel && !FOLDER_RE.test(folder)) return send(res, 400, { error: 'Bad folder' });
      const original = url.searchParams.get('name') || 'photo.jpg';
      if (!IMAGE_EXT.test(original)) return send(res, 400, { error: 'Use a .jpg, .png, .webp, .gif or .avif image' });
      const body = await readBody(req, MAX_UPLOAD_BYTES);
      if (!body.length) return send(res, 400, { error: 'Empty upload' });

      const dir = path.join(travel ? travelRoot : imagesRoot, folder);
      fs.mkdirSync(dir, { recursive: true });
      const name = uniqueImageName(dir, original);
      fs.writeFileSync(path.join(dir, name), body);
      console.log(`Saved ${path.relative(repoRoot, path.join(dir, name))}`);
      return send(res, 200, travel ? { file: name } : { image: `${folder}/${name}` });
    }

    if (pathname === '/__edit/travel/data') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
      return send(res, 200, travelData());
    }

    if (pathname === '/__edit/travel/countries') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
      return send(res, 200, { countries: travelGeo.countries() });
    }

    if (pathname === '/__edit/travel/regions') {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
      const regions = travelGeo.regions(url.searchParams.get('country'));
      if (!regions) return send(res, 404, { error: 'Unknown country' });
      return send(res, 200, { regions });
    }

    if (pathname === '/__edit/contact/save') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const payload = JSON.parse((await readBody(req, 512 * 1024)).toString('utf8') || '{}');
      saveContact(payload);
      console.log('Saved scripts/contact-places.js from the editor (previous version in .edit-trash/contact-places/).');
      return send(res, 200, { ok: true });
    }

    if (pathname === '/__edit/travel/places') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const payload = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8') || '{}');
      if (!payload.places || typeof payload.places !== 'object') return send(res, 400, { error: 'Expected {places: {...}}' });
      travelGeo.writePlaces(payload.places);
      console.log('Saved scripts/travel-places.js from the editor (previous version in .edit-trash/travel-places/).');
      return send(res, 200, { ok: true });
    }

    if (pathname === '/__edit/travel/save') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (!isTrustedWrite(req)) return send(res, 403, { error: 'Forbidden' });
      const payload = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8') || '{}');
      const result = saveTravel(payload.captions || {}, payload.remove);
      console.log('Saved travel captions from the editor.');
      return send(res, result.ok ? 200 : 500, { ok: result.ok, log: result.log });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    return send(res, error.status || 500, { error: error.message || 'Server error' });
  }
});

// --open [page]  (or `npm run edit --open`, which npm passes as npm_config_open)
function openTarget() {
  const i = process.argv.indexOf('--open');
  if (i !== -1) {
    const next = process.argv[i + 1];
    return next && !next.startsWith('-') ? next.replace(/^\/+/, '') : '';
  }
  const env = process.env.npm_config_open;
  if (env && env !== 'false') return env === 'true' ? '' : env.replace(/^\/+/, '');
  return null;
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = childProcess.spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.on('error', () => console.log(`Could not open a browser; go to ${url}`));
  child.unref();
}

server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE') throw error;
  // Most likely the editor is already running: reuse it
  console.log(`Port ${PORT} is already in use: the site editor is probably running already (http://localhost:${PORT}/).`);
  console.log('Stop it with Ctrl+C in its terminal, or set SITE_EDIT_PORT to use another port.');
  const target = openTarget();
  if (target !== null) openBrowser(`http://localhost:${PORT}/${target}`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  watchRepo();
  const target = openTarget();
  if (target !== null) openBrowser(`http://localhost:${PORT}/${target}`);
  console.log(`Site editor running: http://localhost:${PORT}/`);
  console.log('On a page with an editor, tap the footer heart 5 times (or use the Edit button). Ctrl+C to stop.');
});
