#!/usr/bin/env node

// Builds scripts/fixations-data.js (the cards on fixations.html) from
// data/fixations.xlsx. One row per card:
//   Kind         Books | Movies | Shows | Games
//   Image        path inside images/fixations/, e.g. games/totk.png
//   Title        card heading (rows without a title are not shown)
//   Rating       1-5 hearts, halves allowed (4.5)
//   Description  short blurb
// Optional albedo columns (how the cover follows the light / dark theme, as
// set by the site editor's albedo control; blank = as before):
//   Albedo       dark  - made for dark mode, flipped (invert + hue-rotate
//                        180deg) in light mode
//                light - made for light mode, flipped in dark mode
//                off   - never flipped
//   Light cover  path inside images/fixations/ shown instead of Image in
//                light mode (with Albedo off or blank)
//   Dark cover   the same for dark mode
// The albedo columns are only written to the sheet when a row uses them.
// Rows appear on the page in sheet order. Any image dropped into
// images/fixations/<books|movies|shows|games>/ that no row uses yet is
// appended as a new row with Kind and Image filled in.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const repoRoot = path.resolve(__dirname, '..');
const workbookPath = path.join(repoRoot, 'data', 'fixations.xlsx');
const imagesRoot = path.join(repoRoot, 'images', 'fixations');
const dataJsPath = path.join(repoRoot, 'scripts', 'fixations-data.js');

const HEADER = ['Kind', 'Image', 'Title', 'Rating', 'Description'];
const ALBEDO_HEADER = ['Albedo', 'Light cover', 'Dark cover'];
const KINDS = ['books', 'movies', 'shows', 'games'];
const KIND_LABELS = { books: 'Books', movies: 'Movies', shows: 'Shows', games: 'Games' };
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

function loadWindowKey(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  const code = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: filePath });
  return sandbox.window[key] || null;
}

function normalizeKind(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'tv' || v === 'show' || v === 'series') return 'shows';
  const plural = v.endsWith('s') ? v : `${v}s`;
  return KINDS.includes(plural) ? plural : '';
}

function cell(row, index) {
  const value = row && row[index];
  return value == null ? '' : String(value).trim();
}

// The Image cell as written, or, if that file doesn't exist, a file in the
// same folder with the same name but another extension (stormlight.png ->
// stormlight.jpg). Returns '' when nothing matches.
function resolveImage(value) {
  const rel = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel) return '';
  if (fs.existsSync(path.join(imagesRoot, rel))) return rel;
  const dir = path.posix.dirname(rel);
  const stem = path.posix.basename(rel).replace(/\.[^.]+$/, '').toLowerCase();
  const absDir = path.join(imagesRoot, dir);
  if (!fs.existsSync(absDir)) return '';
  const match = fs.readdirSync(absDir).find((name) =>
    IMAGE_EXT.test(name) && name.replace(/\.[^.]+$/, '').toLowerCase() === stem);
  return match ? `${dir}/${match}` : '';
}

function normalizeAlbedo(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'dark' || v === 'light' || v === 'off' ? v : '';
}

function hasAlbedo(rows) {
  return rows.some((row) => row.slice(HEADER.length).some(Boolean));
}

function writeWorkbook(rows) {
  const albedo = hasAlbedo(rows);
  const header = albedo ? HEADER.concat(ALBEDO_HEADER) : HEADER;
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows.map((row) => row.slice(0, header.length))]);
  ws['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 40 }, { wch: 8 }, { wch: 90 }, { wch: 8 }, { wch: 28 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fixations');
  fs.mkdirSync(path.dirname(workbookPath), { recursive: true });
  XLSX.writeFile(wb, workbookPath);
}

// --- Read the sheet ---
let rows = [];
if (fs.existsSync(workbookPath)) {
  const workbook = XLSX.readFile(workbookPath);
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
    .slice(1)
    .map((row) => HEADER.concat(ALBEDO_HEADER).map((_, i) => cell(row, i)))
    .filter((row) => row.some(Boolean));
}

// --- Add rows for images no row uses yet (light / dark covers count) ---
const used = new Set();
rows.forEach((row) => [row[1], row[6], row[7]].forEach((value) => {
  if (value) used.add((resolveImage(value) || value).toLowerCase());
}));
const added = [];
KINDS.forEach((kind) => {
  const dir = path.join(imagesRoot, kind);
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir)
    .filter((name) => IMAGE_EXT.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .forEach((name) => {
      const rel = `${kind}/${name}`;
      if (used.has(rel.toLowerCase())) return;
      rows.push([KIND_LABELS[kind], rel, '', '', '', '', '', '']);
      added.push(rel);
    });
});

if (added.length || !fs.existsSync(workbookPath)) {
  writeWorkbook(rows);
  if (added.length) {
    console.log(`Added ${added.length} new image row(s) to ${path.relative(repoRoot, workbookPath)}: ${added.join(', ')}`);
    console.log('Give them a Title (and Rating / Description) to show them on the page.');
  } else {
    console.log(`Created ${path.relative(repoRoot, workbookPath)}.`);
  }
}

// --- Build the page data ---
const items = [];
rows.forEach((row, index) => {
  const [kindCell, imageCell, title, ratingCell, description, albedoCell, lightCell, darkCell] = row;
  if (!title) return;
  const line = index + 2;
  const kind = normalizeKind(kindCell);
  if (!kind) {
    console.warn(`Row ${line} (${title}): unknown Kind "${kindCell}", expected Books, Movies, Shows or Games. Skipped.`);
    return;
  }
  let image = resolveImage(imageCell);
  if (imageCell && !image) {
    console.warn(`Row ${line} (${title}): images/fixations/${imageCell} not found.`);
  } else if (image && image !== imageCell.replace(/\\/g, '/').replace(/^\/+/, '')) {
    console.warn(`Row ${line} (${title}): images/fixations/${imageCell} not found, using ${image}.`);
  }
  // Ratings go in half-heart steps (4.5 -> four and a half hearts)
  const rating = Math.max(0, Math.min(5, Math.round((Number(ratingCell) || 0) * 2) / 2));
  const item = {
    kind,
    image: image ? `images/fixations/${image}` : '',
    title,
    rating,
    description
  };
  // Albedo keys only when set, so cards without them stay as they were
  const albedo = normalizeAlbedo(albedoCell);
  if (albedoCell && !albedo) {
    console.warn(`Row ${line} (${title}): unknown Albedo "${albedoCell}", expected dark, light or off. Ignored.`);
  }
  if (albedo) item.albedo = albedo;
  [['imageLight', lightCell, 'Light cover'], ['imageDark', darkCell, 'Dark cover']].forEach(([key, value, column]) => {
    if (!value) return;
    const alt = resolveImage(value);
    if (alt) item[key] = `images/fixations/${alt}`;
    else console.warn(`Row ${line} (${title}): ${column} images/fixations/${value} not found.`);
  });
  items.push(item);
});

const existing = loadWindowKey(dataJsPath, 'FIXATIONS');
if (existing && JSON.stringify(existing) === JSON.stringify(items)) {
  console.log('No changes to fixations.');
  process.exit(0);
}

const jsBody = [
  '/* Auto-generated by scripts/sync-fixations-spreadsheet.js.',
  '   Edit data/fixations.xlsx while scripts/watch-fixations-spreadsheet.js is running. */',
  '(function () {',
  `  window.FIXATIONS = ${JSON.stringify(items, null, 2).replace(/\n/g, '\n  ')};`,
  '})();',
  ''
].join('\n');

fs.writeFileSync(dataJsPath, jsBody, 'utf8');
console.log(`Synced ${items.length} fixation(s) to ${path.relative(repoRoot, dataJsPath)}.`);
