const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  getDrawingMode: () => ipcRenderer.invoke('get-drawing-mode'),
  getCanvasBackground: () => ipcRenderer.invoke('get-canvas-background'),
  requestNewCanvas: () => ipcRenderer.send('create-new-canvas'),
  onDrawingMode: (callback) => ipcRenderer.on('drawing-mode', (_event, enabled) => callback(enabled)),
});
