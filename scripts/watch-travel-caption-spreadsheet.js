#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const workbookPath = path.join(repoRoot, 'data', 'travel-captions.xlsx');
const syncScriptPath = path.join(__dirname, 'sync-travel-caption-spreadsheet.js');

let debounceTimer = null;
let syncInFlight = false;
let pendingSync = false;
let lastWorkbookSignature = null;
let suppressWorkbookEventsUntil = 0;

function syncCaptions() {
  if (syncInFlight) {
    pendingSync = true;
    return;
  }

  syncInFlight = true;
  suppressWorkbookEventsUntil = Date.now() + 1500;
  const child = childProcess.spawn(process.execPath, [syncScriptPath], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    syncInFlight = false;
    lastWorkbookSignature = readWorkbookSignature();
    if (code !== 0) {
      console.warn(`Caption sync exited with code ${code}.`);
    }
    if (pendingSync) {
      pendingSync = false;
      syncCaptions();
    }
  });
}

function scheduleSync(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (Date.now() < suppressWorkbookEventsUntil) return;
    console.log(`Detected ${reason}; syncing travel captions...`);
    syncCaptions();
  }, 300);
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

  fs.watch(dir, { persistent: true }, (eventType, filename) => {
    if (Date.now() < suppressWorkbookEventsUntil || syncInFlight) return;
    if (!filename) {
      scheduleSync(eventType);
      return;
    }

    if (filename === target) {
      scheduleSync(`${eventType} on ${filename}`);
    }
  });

  fs.watchFile(workbookPath, { interval: 500 }, pollWorkbookChanges);

  lastWorkbookSignature = readWorkbookSignature();

  console.log(`Watching ${path.relative(repoRoot, workbookPath)} for changes...`);
}

process.on('SIGINT', () => {
  fs.unwatchFile(workbookPath, pollWorkbookChanges);
  console.log('\nStopping travel caption watcher.');
  process.exit(0);
});

syncCaptions();
watchWorkbook();
