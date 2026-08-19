#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const workbookPath = path.join(repoRoot, 'data', 'news.xlsx');
const syncScriptPath = path.join(__dirname, 'sync-news-spreadsheet.js');

let debounceTimer = null;
let syncInFlight = false;
let pendingSync = false;
let lastWorkbookSignature = null;
let suppressWorkbookEventsUntil = 0;
let directoryWatcher = null;

function readWorkbookSignature() {
  try {
    const stat = fs.statSync(workbookPath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch (_) {
    return null;
  }
}

function syncNews() {
  if (syncInFlight) {
    pendingSync = true;
    return;
  }

  syncInFlight = true;
  suppressWorkbookEventsUntil = Date.now() + 1200;

  const child = childProcess.spawn(process.execPath, [syncScriptPath], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    syncInFlight = false;
    lastWorkbookSignature = readWorkbookSignature();

    if (code !== 0) {
      console.warn(`News sync exited with code ${code}.`);
    }

    if (pendingSync) {
      pendingSync = false;
      syncNews();
    }
  });
}

function scheduleSync(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (Date.now() < suppressWorkbookEventsUntil) return;
    console.log(`Detected ${reason}; syncing news...`);
    syncNews();
  }, 350);
}

function pollWorkbookChanges() {
  if (Date.now() < suppressWorkbookEventsUntil || syncInFlight) return;

  const nextSignature = readWorkbookSignature();
  if (nextSignature && nextSignature !== lastWorkbookSignature) {
    const previousSignature = lastWorkbookSignature;
    lastWorkbookSignature = nextSignature;
    if (previousSignature !== null) {
      scheduleSync('workbook file change');
    }
  }
}

function watchWorkbook() {
  const dir = path.dirname(workbookPath);
  const target = path.basename(workbookPath);

  if (!fs.existsSync(workbookPath)) {
    console.warn(`Workbook not found: ${workbookPath}`);
  }

  try {
    directoryWatcher = fs.watch(dir, { persistent: true }, (eventType, filename) => {
      if (Date.now() < suppressWorkbookEventsUntil || syncInFlight) return;

      if (!filename) {
        scheduleSync(eventType);
        return;
      }

      if (filename === target) {
        scheduleSync(`${eventType} on ${filename}`);
      }
    });

    directoryWatcher.on('error', (error) => {
      directoryWatcher = null;
      console.warn(`Directory watcher unavailable (${error.code || error.message}); continuing with polling.`);
    });
  } catch (error) {
    directoryWatcher = null;
    console.warn(`Directory watcher unavailable (${error.code || error.message}); continuing with polling.`);
  }

  fs.watchFile(workbookPath, { interval: 500 }, pollWorkbookChanges);

  lastWorkbookSignature = readWorkbookSignature();

  console.log(`Watching ${path.relative(repoRoot, workbookPath)} for changes...`);
  console.log('Press Ctrl+C to stop.');
}

process.on('SIGINT', () => {
  if (directoryWatcher) {
    directoryWatcher.close();
  }
  fs.unwatchFile(workbookPath, pollWorkbookChanges);
  console.log('\nStopping news watcher.');
  process.exit(0);
});

syncNews();
watchWorkbook();
