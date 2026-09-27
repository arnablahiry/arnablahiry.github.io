#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const travelRoot = path.join(repoRoot, 'images', 'travels');
const workbookPath = path.join(repoRoot, 'data', 'travel-captions.xlsx');
const manifestScriptPath = path.join(__dirname, 'generate-travel-photo-manifest.js');

let debounceTimer = null;
let syncInFlight = false;
let pendingSync = false;
let suppressEventsUntil = 0;
let lastWorkbookSignature = null;

function runManifest() {
  if (syncInFlight) {
    pendingSync = true;
    return;
  }

  syncInFlight = true;
  suppressEventsUntil = Date.now() + 1500;
  const child = childProcess.spawn(process.execPath, [manifestScriptPath], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    syncInFlight = false;
    lastWorkbookSignature = readWorkbookSignature();
    if (code !== 0) {
      console.warn(`Travel photo manifest generation exited with code ${code}.`);
    }
    if (pendingSync) {
      pendingSync = false;
      runManifest();
    }
  });
}

function scheduleSync(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (Date.now() < suppressEventsUntil) return;
    console.log(`Detected ${reason}; regenerating travel photo manifest and captions...`);
    runManifest();
  }, 500);
}

function watchTravelFolder() {
  if (!fs.existsSync(travelRoot)) {
    throw new Error(`Travel image folder not found: ${travelRoot}`);
  }

  fs.watch(travelRoot, { persistent: true, recursive: true }, (eventType, filename) => {
    if (Date.now() < suppressEventsUntil || syncInFlight) return;
    if (filename && (filename.includes(`${path.sep}thumbs${path.sep}`) || filename.startsWith('thumbs' + path.sep))) {
      return;
    }
    scheduleSync(filename ? `${eventType} on ${filename}` : eventType);
  });

  console.log(`Watching ${path.relative(repoRoot, travelRoot)}/ for new photos...`);
}

function readWorkbookSignature() {
  try {
    const stat = fs.statSync(workbookPath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch (_) {
    return null;
  }
}

function pollWorkbookChanges() {
  if (Date.now() < suppressEventsUntil || syncInFlight) return;
  const nextSignature = readWorkbookSignature();
  if (nextSignature && nextSignature !== lastWorkbookSignature) {
    const previousSignature = lastWorkbookSignature;
    lastWorkbookSignature = nextSignature;
    if (previousSignature !== null) {
      scheduleSync('caption workbook change');
    }
  }
}

function watchWorkbook() {
  const dir = path.dirname(workbookPath);
  const target = path.basename(workbookPath);

  if (!fs.existsSync(workbookPath)) {
    console.warn(`Workbook not found: ${workbookPath}`);
  }

  fs.watch(dir, { persistent: true }, (eventType, filename) => {
    if (Date.now() < suppressEventsUntil || syncInFlight) return;
    if (!filename || filename === target) {
      scheduleSync(`${eventType} on ${target}`);
    }
  });

  fs.watchFile(workbookPath, { interval: 500 }, pollWorkbookChanges);
  lastWorkbookSignature = readWorkbookSignature();

  console.log(`Watching ${path.relative(repoRoot, workbookPath)} for caption changes...`);
}

process.on('SIGINT', () => {
  fs.unwatchFile(workbookPath, pollWorkbookChanges);
  console.log('\nStopping travel content watcher.');
  process.exit(0);
});

runManifest();
watchTravelFolder();
watchWorkbook();
