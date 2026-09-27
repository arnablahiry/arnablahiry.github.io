#!/usr/bin/env node

// Renders page 1 of every talk PDF in docs/talks/ into a small JPEG poster in
// images/talks/. The talks page shows these posters instead of downloading the
// PDFs on load, so the grid no longer pulls tens of megabytes up front.
// Requires ghostscript (`brew install ghostscript`) and macOS `sips`.

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const os = require('os');

const repoRoot = path.resolve(__dirname, '..');
const talksRoot = path.join(repoRoot, 'docs', 'talks');
const thumbnailRoot = path.join(repoRoot, 'images', 'talks');
const thumbnailWidth = 1000;
const renderDpi = 144;

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function toWebPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function thumbnailPathFor(pdfPath) {
  return path.join(thumbnailRoot, `${path.parse(pdfPath).name}.jpg`);
}

function ensureThumbnail(pdfPath) {
  const thumbPath = thumbnailPathFor(pdfPath);
  const sourceStat = fs.statSync(pdfPath);

  if (fs.existsSync(thumbPath)) {
    const thumbStat = fs.statSync(thumbPath);
    if (thumbStat.mtimeMs >= sourceStat.mtimeMs) return { thumbPath, skipped: true };
  }

  fs.mkdirSync(thumbnailRoot, { recursive: true });
  const rawPath = path.join(os.tmpdir(), `talk-thumb-${process.pid}-${path.parse(pdfPath).name}.jpg`);

  try {
    childProcess.execFileSync('gs', [
      '-q', '-dNOPAUSE', '-dBATCH', '-dSAFER',
      '-sDEVICE=jpeg',
      '-dJPEGQ=90',
      `-r${renderDpi}`,
      '-dFirstPage=1', '-dLastPage=1',
      '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4',
      `-sOutputFile=${rawPath}`,
      pdfPath
    ], { stdio: 'ignore' });

    childProcess.execFileSync('sips', [
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', '78',
      '-Z', String(thumbnailWidth),
      rawPath,
      '--out', thumbPath
    ], { stdio: 'ignore' });
  } finally {
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
  }

  return { thumbPath, skipped: false };
}

if (!fs.existsSync(talksRoot)) {
  throw new Error(`Talks folder not found: ${talksRoot}`);
}

const pdfs = fs.readdirSync(talksRoot)
  .filter((name) => !name.startsWith('.') && path.extname(name).toLowerCase() === '.pdf')
  .sort(naturalCompare)
  .map((name) => path.join(talksRoot, name));

let written = 0;
for (const pdfPath of pdfs) {
  const { thumbPath, skipped } = ensureThumbnail(pdfPath);
  if (!skipped) written += 1;
  console.log(`${skipped ? 'up to date' : 'wrote     '} ${toWebPath(thumbPath)}`);
}

console.log(`\n${written} of ${pdfs.length} talk posters regenerated in ${toWebPath(thumbnailRoot)}.`);
