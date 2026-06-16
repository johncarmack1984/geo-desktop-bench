// Electron shell — mirror of the Tauri one. Loads the shared frontend dist,
// echoes IPC, and prints cold-start elapsed (main start → renderer first frame).
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const start = process.hrtime.bigint();

ipcMain.handle('echo', (_event, msg) => msg);
ipcMain.on('ready', () => {
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`STARTUP_MS=${ms.toFixed(1)}`);
});
ipcMain.on('ipc_result', (_event, line) => {
  console.log(`IPC_RESULT ${line}`);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'shell-bench (Electron)',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  // Packaged: frontend is copied into Resources/frontend (see build.extraResources).
  const indexHtml = app.isPackaged
    ? path.join(process.resourcesPath, 'frontend', 'index.html')
    : path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  win.loadFile(indexHtml);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
