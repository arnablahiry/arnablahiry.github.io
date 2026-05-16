#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const workbookPath = path.join(repoRoot, 'data', 'mywildindia-captions.xlsx');
const mywildindiaRoot = path.join(repoRoot, 'images', 'mywildindia');

let debounceTimer = null;
let lastWriteTime = 0;
const debounceMs = 1600;
const pollIntervalMs = 500;

function runSync() {
  console.log(`[${new Date().toLocaleTimeString()}] Syncing MyWildIndia captions...`);
  try {
    lastWriteTime = Date.now();
    const syncScript = path.join(__dirname, 'sync-mywildindia-caption-spreadsheet.js');
    childProcess.execFileSync(process.execPath, [syncScript], { stdio: 'inherit' });
  } catch (error) {
    console.error(`Sync failed: ${(error && error.message) || String(error)}`);
  }
}

function queueSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const timeSinceWrite = Date.now() - lastWriteTime;
    if (timeSinceWrite > debounceMs * 0.5) {
      runSync();
    }
  }, debounceMs);
}

function startWatcher() {
  console.log(`Watching ${workbookPath} and ${mywildindiaRoot} for changes...`);
  console.log('Press Ctrl+C to stop.');

  // Watch the workbook.
  fs.watch(workbookPath, (eventType, fileName) => {
    if (Date.now() - lastWriteTime < 500) return;
    console.log(`[${new Date().toLocaleTimeString()}] Workbook changed (${eventType})`);
    queueSync();
  });

  // Poll the images folder for new files.
  setInterval(() => {
    try {
      const currentFiles = new Set();
      const folders = fs.readdirSync(mywildindiaRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'thumbs' && e.name !== 'credits' && e.name !== 'baba');

      folders.forEach((folder) => {
        const folderPath = path.join(mywildindiaRoot, folder.name);
        try {
          const files = fs.readdirSync(folderPath, { withFileTypes: true })
            .filter((f) => f.isFile() && !f.name.startsWith('.'));
          files.forEach((f) => {
            currentFiles.add(path.join(folderPath, f.name));
          });
        } catch (_) {}
      });

      if (!global.prevFileSet) {
        global.prevFileSet = currentFiles;
        return;
      }

      let changed = false;
      for (const file of currentFiles) {
        if (!global.prevFileSet.has(file)) {
          console.log(`[${new Date().toLocaleTimeString()}] New file detected: ${path.relative(repoRoot, file)}`);
          changed = true;
          break;
        }
      }
      if (!changed) {
        for (const file of global.prevFileSet) {
          if (!currentFiles.has(file)) {
            console.log(`[${new Date().toLocaleTimeString()}] File removed: ${path.relative(repoRoot, file)}`);
            changed = true;
            break;
          }
        }
      }

      if (changed) {
        global.prevFileSet = currentFiles;
        queueSync();
      }
    } catch (err) {
      console.error(`Poll error: ${(err && err.message) || String(err)}`);
    }
  }, pollIntervalMs);
}

if (!fs.existsSync(workbookPath)) {
  console.error(`Workbook not found at ${workbookPath}`);
  process.exit(1);
}

startWatcher();
