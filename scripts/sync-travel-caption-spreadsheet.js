#!/usr/bin/env node

// Keeps data/travel-captions.xlsx in step with the travel photos and writes
// scripts/travel-captions.js for the page.
//
// One sheet per country folder; one row per photo, keyed by file name:
//   Photo    file name inside images/travels/<folder>/
//   Caption  shown under the photo in the lightbox
//   Author   who took it (empty = Arnab)
// and, only on sheets where a photo uses them (set in the site editor):
//   Albedo        dark / light: the photo was made for that theme and is
//                 flipped (invert + hue-rotate) in the other one; off: never
//                 flipped; empty: the page default
//   Light version file name of a second version shown in light mode instead
//   Dark version  the same for dark mode
// Second versions sit next to the photos, named <photo>.light.<ext> or
// <photo>.dark.<ext> (also <photo>.light-2.<ext>, ...): files named like that
// are never listed as photos of their own (isSecondVersion), but still get a
// thumbnail (thumbs/<photo>.light.jpg).
// New photos get a row; rows of photos that no longer exist are dropped.
// Older workbooks keyed "photo 1", "photo 2", ... are converted on the fly
// using the photo order of the manifest.
//
// Also used as a module by scripts/edit-server.js (readCaptions /
// writeCaptions).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'scripts', 'travel-photo-manifest.js');
const captionJsPath = path.join(repoRoot, 'scripts', 'travel-captions.js');
const workbookPath = path.join(repoRoot, 'data', 'travel-captions.xlsx');

function loadWindowKey(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  const code = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: filePath });
  return sandbox.window[key] || null;
}

function titleFromSlug(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sanitizeSheetName(value) {
  const cleaned = String(value || 'Sheet')
    .replace(/[\\/?*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Sheet').slice(0, 31);
}

function sheetNamesFor(slugs) {
  const used = new Set();
  const map = {};
  slugs.forEach((slug) => {
    const base = sanitizeSheetName(titleFromSlug(slug));
    let candidate = base;
    for (let i = 2; used.has(candidate.toLowerCase()); i += 1) {
      const suffix = ` ${i}`;
      candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    }
    used.add(candidate.toLowerCase());
    map[slug] = candidate;
  });
  return map;
}

function readManifest() {
  const manifest = loadWindowKey(manifestPath, 'TRAVEL_PHOTO_MANIFEST');
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Unable to read manifest from ${manifestPath}. Run generate-travel-photo-manifest first.`);
  }
  return manifest;
}

function fileNamesOf(manifest, slug) {
  return (Array.isArray(manifest[slug]) ? manifest[slug] : [])
    .map((entry) => String(entry && entry.src ? entry.src : entry).split('/').pop());
}

function clean(value) {
  return value == null ? '' : String(value).trim();
}

const ALBEDO_HEADER = ['Albedo', 'Light version', 'Dark version'];
const SECOND_VERSION_RE = /\.(light|dark)(-\d+)?\.[a-z0-9]+$/i;

function isSecondVersion(file) {
  return SECOND_VERSION_RE.test(String(file || ''));
}

function cleanAlbedo(value) {
  const v = clean(value).toLowerCase();
  return v === 'dark' || v === 'light' || v === 'off' ? v : '';
}

// A second version is a file in the photo's own folder: keep the file name
function cleanFile(value) {
  return clean(value).split(/[\\/]/).pop();
}

// { caption, author } plus albedo / light / dark only when set, so photos
// without albedo settings look exactly as before
function entryOf(caption, author, albedo, light, dark) {
  const entry = { caption: clean(caption), author: clean(author) };
  if (cleanAlbedo(albedo)) entry.albedo = cleanAlbedo(albedo);
  if (cleanFile(light)) entry.light = cleanFile(light);
  if (cleanFile(dark)) entry.dark = cleanFile(dark);
  return entry;
}

function hasAlbedo(entry) {
  return !!(entry && (entry.albedo || entry.light || entry.dark));
}

// Column positions by header name (older sheets: Photo, Caption, Author)
function columnsOf(header) {
  const names = (header || []).map((h) => clean(h).toLowerCase());
  const at = (name, fallback) => (names.indexOf(name) === -1 ? fallback : names.indexOf(name));
  return {
    photo: at('photo', 0),
    caption: at('caption', 1),
    author: at('author', 2),
    albedo: at('albedo', -1),
    light: at('light version', -1),
    dark: at('dark version', -1)
  };
}

// Captions currently in the workbook, as
// { folder: { file: {caption, author[, albedo, light, dark]} } }.
// Folders are matched to sheets by title (belgium -> "Belgium").
function readCaptions(manifest) {
  manifest = manifest || readManifest();
  const result = {};
  const legacy = loadWindowKey(captionJsPath, 'TRAVEL_CAPTIONS') || {};

  let workbook = null;
  if (fs.existsSync(workbookPath)) workbook = XLSX.readFile(workbookPath);
  const sheetBySlug = {};
  if (workbook) {
    const byTitle = {};
    workbook.SheetNames.forEach((name) => { byTitle[name.toLowerCase()] = name; });
    const slugs = Object.keys(manifest);
    const names = sheetNamesFor(slugs.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })));
    slugs.forEach((slug) => {
      const sheet = byTitle[names[slug].toLowerCase()] || byTitle[titleFromSlug(slug).toLowerCase()];
      if (sheet) sheetBySlug[slug] = sheet;
    });
    // Sheets for folders that have no photos yet (e.g. added in the editor)
    workbook.SheetNames.forEach((name) => {
      const slug = name.toLowerCase().replace(/\s+/g, '_');
      if (!sheetBySlug[slug] && !Object.values(sheetBySlug).includes(name)) sheetBySlug[slug] = name;
    });
  }

  const slugs = new Set([...Object.keys(manifest), ...Object.keys(sheetBySlug)]);
  slugs.forEach((slug) => {
    const files = fileNamesOf(manifest, slug);
    const entries = {};

    if (workbook && sheetBySlug[slug]) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetBySlug[slug]], { header: 1, raw: false, defval: '' });
      const col = columnsOf(rows[0]);
      const cell = (row, i) => (i < 0 ? '' : row[i]);
      rows.slice(1).forEach((row) => {
        const key = clean(row[col.photo]);
        if (!key) return;
        const legacyIndex = key.match(/^photo\s+(\d+)$/i);
        const file = legacyIndex ? files[Number(legacyIndex[1]) - 1] : key;
        if (!file) return;
        entries[file] = entryOf(row[col.caption], row[col.author], cell(row, col.albedo), cell(row, col.light), cell(row, col.dark));
      });
    } else if (Array.isArray(legacy[slug])) {
      legacy[slug].forEach((caption, i) => {
        if (files[i]) entries[files[i]] = { caption: clean(caption), author: '' };
      });
    } else if (legacy[slug] && typeof legacy[slug] === 'object') {
      Object.keys(legacy[slug]).forEach((file) => {
        const v = legacy[slug][file] || {};
        entries[file] = entryOf(v.caption, v.author, v.albedo, v.light, v.dark);
      });
    }
    result[slug] = entries;
  });
  return result;
}

// Writes the workbook: every photo in the manifest gets a row (in manifest
// order), plus any extra files listed in `captions` that the manifest
// doesn't know yet (photos just uploaded by the editor).
function writeCaptions(captions, manifest) {
  manifest = manifest || readManifest();
  const slugs = Array.from(new Set([...Object.keys(manifest), ...Object.keys(captions)]))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const names = sheetNamesFor(slugs);
  const wb = XLSX.utils.book_new();
  slugs.forEach((slug) => {
    const entries = captions[slug] || {};
    const files = fileNamesOf(manifest, slug);
    Object.keys(entries).forEach((file) => { if (!files.includes(file) && manifestless(slug, file)) files.push(file); });
    if (!files.length) return;
    // the albedo columns only on sheets that use them
    const albedo = files.some((file) => hasAlbedo(entries[file]));
    const rows = [['Photo', 'Caption', 'Author'].concat(albedo ? ALBEDO_HEADER : [])];
    files.forEach((file) => {
      const e = entries[file] || {};
      const row = [file, clean(e.caption), clean(e.author)];
      if (albedo) row.push(cleanAlbedo(e.albedo), cleanFile(e.light), cleanFile(e.dark));
      rows.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 90 }, { wch: 14 }].concat(albedo ? [{ wch: 8 }, { wch: 24 }, { wch: 24 }] : []);
    XLSX.utils.book_append_sheet(wb, ws, names[slug]);
  });
  fs.mkdirSync(path.dirname(workbookPath), { recursive: true });
  XLSX.writeFile(wb, workbookPath);
}

// A file that isn't in the manifest is only kept if it exists on disk.
function manifestless(slug, file) {
  return fs.existsSync(path.join(repoRoot, 'images', 'travels', slug, file));
}

function writeCaptionJs(captions) {
  // Only photos with a caption, an author or albedo settings are needed by
  // the page; second versions that don't exist (yet) are left out
  const out = {};
  Object.keys(captions).sort().forEach((slug) => {
    const entries = {};
    Object.keys(captions[slug]).forEach((file) => {
      const e = captions[slug][file];
      const light = e.light && manifestless(slug, e.light) ? e.light : '';
      const dark = e.dark && manifestless(slug, e.dark) ? e.dark : '';
      if (!e.caption && !e.author && !e.albedo && !light && !dark) return;
      entries[file] = {};
      if (e.caption) entries[file].caption = e.caption;
      if (e.author) entries[file].author = e.author;
      if (e.albedo) entries[file].albedo = e.albedo;
      if (light) entries[file].light = light;
      if (dark) entries[file].dark = dark;
    });
    out[slug] = entries;
  });
  const jsBody = [
    '/* Auto-generated by scripts/sync-travel-caption-spreadsheet.js.',
    '   Edit data/travel-captions.xlsx and rerun the script. */',
    '(function () {',
    `  window.TRAVEL_CAPTIONS = ${JSON.stringify(out, null, 2).replace(/\n/g, '\n  ')};`,
    '})();',
    ''
  ].join('\n');
  fs.writeFileSync(captionJsPath, jsBody, 'utf8');
}

function main() {
  const manifest = readManifest();
  const captions = readCaptions(manifest);
  // keep only photos that exist
  Object.keys(captions).forEach((slug) => {
    const files = new Set(fileNamesOf(manifest, slug));
    Object.keys(captions[slug]).forEach((file) => { if (!files.has(file)) delete captions[slug][file]; });
  });
  writeCaptions(captions, manifest);
  writeCaptionJs(captions);
  const photoCount = Object.keys(manifest).reduce((sum, slug) => sum + fileNamesOf(manifest, slug).length, 0);
  console.log(`Synced ${path.relative(repoRoot, workbookPath)} and ${path.relative(repoRoot, captionJsPath)} (${Object.keys(manifest).length} countries, ${photoCount} photos).`);
}

module.exports = { readCaptions, writeCaptions, readManifest, isSecondVersion };

if (require.main === module) main();
