#!/usr/bin/env node

// Reruns sync-fixations-spreadsheet.js whenever data/fixations.xlsx is saved
// or an image is added to / removed from images/fixations/<kind>/.

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const workbookPath = path.join(repoRoot, 'data', 'fixations.xlsx');
const imagesRoot = path.join(repoRoot, 'images', 'fixations');
const syncScriptPath = path.join(__dirname, 'sync-fixations-spreadsheet.js');

let debounceTimer = null;
let syncInFlight = false;
let pendingSync = false;
let lastWorkbookSignature = null;
let suppressEventsUntil = 0;
const watchers = [];

function readWorkbookSignature() {
  try {
    const stat = fs.statSync(workbookPath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch (_) {
    return null;
  }
}

function syncFixations() {
  if (syncInFlight) {
    pendingSync = true;
    return;
  }

  syncInFlight = true;
  // The sync may append rows to the workbook; don't treat that write as an edit.
  suppressEventsUntil = Date.now() + 1200;

  const child = childProcess.spawn(process.execPath, [syncScriptPath], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    syncInFlight = false;
    lastWorkbookSignature = readWorkbookSignature();

    if (code !== 0) {
      console.warn(`Fixations sync exited with code ${code}.`);
    }

    if (pendingSync) {
      pendingSync = false;
      syncFixations();
    }
  });
}

function scheduleSync(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (Date.now() < suppressEventsUntil) return;
    console.log(`Detected ${reason}; syncing fixations...`);
    syncFixations();
  }, 350);
}

function pollWorkbookChanges() {
  if (Date.now() < suppressEventsUntil || syncInFlight) return;

  const nextSignature = readWorkbookSignature();
  if (nextSignature && nextSignature !== lastWorkbookSignature) {
    const previousSignature = lastWorkbookSignature;
    lastWorkbookSignature = nextSignature;
    if (previousSignature !== null) {
      scheduleSync('workbook change');
    }
  }
}

function watchDir(dir, options, onEvent) {
  try {
    const watcher = fs.watch(dir, { persistent: true, ...options }, onEvent);
    watcher.on('error', (error) => {
      console.warn(`Watcher on ${path.relative(repoRoot, dir)} stopped (${error.code || error.message}).`);
    });
    watchers.push(watcher);
  } catch (error) {
    console.warn(`Cannot watch ${path.relative(repoRoot, dir)} (${error.code || error.message}).`);
  }
}

function watchAll() {
  const workbookName = path.basename(workbookPath);
  fs.mkdirSync(path.dirname(workbookPath), { recursive: true });

  watchDir(path.dirname(workbookPath), {}, (eventType, filename) => {
    if (Date.now() < suppressEventsUntil || syncInFlight) return;
    if (!filename || filename === workbookName) scheduleSync(`${eventType} on ${workbookName}`);
  });

  // Recursive fs.watch is supported on macOS and Windows; elsewhere new
  // images are still picked up on the next workbook save.
  watchDir(imagesRoot, { recursive: true }, (eventType, filename) => {
    if (!filename || !/\.(jpe?g|png|webp|gif|avif)$/i.test(filename)) return;
    scheduleSync(`${eventType} on images/fixations/${filename}`);
  });

  fs.watchFile(workbookPath, { interval: 500 }, pollWorkbookChanges);
  lastWorkbookSignature = readWorkbookSignature();

  console.log(`Watching ${path.relative(repoRoot, workbookPath)} and images/fixations/ for changes...`);
  console.log('Press Ctrl+C to stop.');
}

process.on('SIGINT', () => {
  watchers.forEach((w) => w.close());
  fs.unwatchFile(workbookPath, pollWorkbookChanges);
  console.log('\nStopping fixations watcher.');
  process.exit(0);
});

syncFixations();
watchAll();
