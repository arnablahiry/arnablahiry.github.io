#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const aboutRoot = path.join(repoRoot, 'images', 'about');
const thumbnailRoot = path.join(aboutRoot, 'thumbs');
const thumbnailMaxSize = 520;
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function toWebPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => naturalCompare(a.name, b.name));
  return entries.flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fullPath === thumbnailRoot || fullPath.startsWith(thumbnailRoot + path.sep)) return [];
      return walk(fullPath);
    }
    if (!entry.isFile()) return [];
    if (!imageExtensions.has(path.extname(entry.name).toLowerCase())) return [];
    return [fullPath];
  });
}

function thumbnailPathFor(sourcePath) {
  const rel = path.relative(aboutRoot, sourcePath);
  const parsed = path.parse(rel);
  const extKey = parsed.ext.toLowerCase().replace(/^\./, '');
  return path.join(thumbnailRoot, parsed.dir, `${parsed.name}-${extKey}.jpg`);
}

function ensureThumbnail(sourcePath) {
  const thumbPath = thumbnailPathFor(sourcePath);
  const sourceStat = fs.statSync(sourcePath);

  if (fs.existsSync(thumbPath)) {
    const thumbStat = fs.statSync(thumbPath);
    if (thumbStat.mtimeMs >= sourceStat.mtimeMs) return thumbPath;
  }

  fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
  childProcess.execFileSync('sips', [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', '65',
    '-Z', String(thumbnailMaxSize),
    sourcePath,
    '--out', thumbPath
  ], { stdio: 'ignore' });

  return thumbPath;
}

if (!fs.existsSync(aboutRoot)) {
  throw new Error(`About image folder not found: ${aboutRoot}`);
}

const sourceImages = walk(aboutRoot);
const thumbs = sourceImages.map(ensureThumbnail);

console.log(`Wrote ${thumbs.length} about thumbnails to ${toWebPath(thumbnailRoot)}.`);
