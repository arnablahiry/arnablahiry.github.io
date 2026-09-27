#!/usr/bin/env node

// Re-compresses the talk PDFs in docs/talks/ for the web: images are
// downsampled to 150 dpi and the file is linearized, which typically cuts a
// slide deck exported from Keynote/PowerPoint by ~5-10x with no visible
// difference on screen. Files already optimized are left alone.
// Requires ghostscript (`brew install ghostscript`).
//
// Run after adding a new talk, then `npm run talks:thumbs`.

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const os = require('os');

const repoRoot = path.resolve(__dirname, '..');
const talksRoot = path.join(repoRoot, 'docs', 'talks');
const imageDpi = 150;
// Skip files that are already small, and keep any result that barely helps.
const skipUnderBytes = 2 * 1024 * 1024;
const minSavingRatio = 0.9;

function toWebPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function mb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function pageCount(pdfPath) {
  const out = childProcess.execFileSync('gs', [
    '-q', '-dNODISPLAY', '-dNOSAFER', '-c',
    `(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit`
  ], { encoding: 'utf8' });
  return parseInt(out.trim(), 10);
}

function optimize(pdfPath) {
  const originalSize = fs.statSync(pdfPath).size;
  if (originalSize < skipUnderBytes) {
    return { status: 'skipped (already small)', originalSize, newSize: originalSize };
  }

  const tmpPath = path.join(os.tmpdir(), `talk-opt-${process.pid}-${path.basename(pdfPath)}`);

  try {
    childProcess.execFileSync('gs', [
      '-q', '-dNOPAUSE', '-dBATCH', '-dSAFER',
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.7',
      '-dFastWebView=true',            // linearized: viewers can start on page 1
      '-dDetectDuplicateImages=true',
      '-dDownsampleColorImages=true',
      '-dColorImageDownsampleType=/Bicubic',
      `-dColorImageResolution=${imageDpi}`,
      '-dDownsampleGrayImages=true',
      '-dGrayImageDownsampleType=/Bicubic',
      `-dGrayImageResolution=${imageDpi}`,
      '-dMonoImageDownsampleType=/Subsample',
      '-dMonoImageResolution=300',
      `-sOutputFile=${tmpPath}`,
      pdfPath
    ], { stdio: ['ignore', 'ignore', 'ignore'] });

    const newSize = fs.statSync(tmpPath).size;

    // Never trade pages for bytes: bail out if ghostscript dropped anything.
    if (pageCount(tmpPath) !== pageCount(pdfPath)) {
      return { status: 'kept original (page count changed)', originalSize, newSize };
    }
    if (newSize > originalSize * minSavingRatio) {
      return { status: 'kept original (not enough saved)', originalSize, newSize };
    }

    fs.copyFileSync(tmpPath, pdfPath);
    return { status: 'optimized', originalSize, newSize };
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

if (!fs.existsSync(talksRoot)) {
  throw new Error(`Talks folder not found: ${talksRoot}`);
}

const pdfs = fs.readdirSync(talksRoot)
  .filter((name) => !name.startsWith('.') && path.extname(name).toLowerCase() === '.pdf')
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  .map((name) => path.join(talksRoot, name));

let before = 0;
let after = 0;
for (const pdfPath of pdfs) {
  const result = optimize(pdfPath);
  before += result.originalSize;
  after += result.status === 'optimized' ? result.newSize : result.originalSize;
  console.log(`${toWebPath(pdfPath)}\n  ${mb(result.originalSize)} -> ${mb(result.newSize)}  [${result.status}]`);
}

console.log(`\nTalk PDFs total: ${mb(before)} -> ${mb(after)}`);
