// Exposes the same surface the frontend's bridge.ts expects under window.shellBridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shellBridge', {
  echo: (msg) => ipcRenderer.invoke('echo', msg),
  reportReady: () => ipcRenderer.send('ready'),
  reportIpc: (line) => ipcRenderer.send('ipc_result', line),
});
