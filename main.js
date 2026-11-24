import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const overlays = new Set();
const drawingModes = new Map();
const canvasBackgrounds = new Map();
const selfTest = process.argv.includes('--self-test');

async function runRendererSelfTest(window) {
  try {
    const result = await window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const canvas = document.querySelector('#canvas');
        // Synthetic pointer events do not create a native pointer capture entry.
        canvas.setPointerCapture = () => {};
        const point = (type, x, y, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, pointerId: 99, button: 0, buttons, clientX: x, clientY: y,
        }));
        point('pointerdown', 80, 80, 1);
        point('pointermove', 180, 140, 1);
        point('pointerup', 180, 140, 0);
        requestAnimationFrame(() => {
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let count = 0;
          for (let index = 3; index < pixels.length; index += 4) count += pixels[index] > 0 ? 1 : 0;
          resolve({
            count,
            drawingEnabled: document.body.classList.contains('drawing-enabled'),
            status: document.querySelector('#status').textContent,
            width: canvas.width,
            height: canvas.height,
          });
        });
      })
    `);
    if (result.count < 100) {
      throw new Error(`expected a rendered line, found ${result.count} painted pixels (mode=${result.drawingEnabled}, canvas=${result.width}x${result.height}, status=${result.status})`);
    }
    console.log(`SELF-TEST PASS: rendered ${result.count} canvas pixels from a pointer stroke.`);
    app.exit(0);
  } catch (error) {
    console.error(`SELF-TEST FAIL: ${error.message}`);
    app.exit(1);
  }
}

function createDrawingWindow({ enabled = false, canvasBackground = null } = {}) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const window = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    transparent: canvasBackground === null,
    backgroundColor: canvasBackground || '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(directory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setAlwaysOnTop(true, 'screen-saver');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setIgnoreMouseEvents(!enabled, { forward: true });
  overlays.add(window);
  drawingModes.set(window, enabled);
  canvasBackgrounds.set(window, canvasBackground);
  window.loadFile(path.join(directory, 'src/renderer/index.html'));
  window.on('closed', () => {
    overlays.delete(window);
    drawingModes.delete(window);
    canvasBackgrounds.delete(window);
  });
  window.webContents.once('did-finish-load', () => {
    if (selfTest) console.log(`SELF-TEST loaded: enabled=${drawingModes.get(window)}`);
    window.webContents.send('drawing-mode', enabled);
    if (selfTest) {
      setTimeout(() => {
        window.webContents.send('drawing-mode', true);
        setTimeout(() => runRendererSelfTest(window), 200);
      }, 200);
    }
  });
  return window;
}

function setDrawingMode(window, enabled) {
  if (window.isDestroyed()) return;
  drawingModes.set(window, enabled);
  // Disabled overlays pass both clicks and pointer movement through to the desktop.
  window.setIgnoreMouseEvents(!enabled, { forward: true });
  window.webContents.send('drawing-mode', enabled);
}

function toggleFocusedOverlay() {
  const window = BrowserWindow.getFocusedWindow() || [...overlays].at(-1);
  if (!window || !overlays.has(window)) return;
  setDrawingMode(window, !drawingModes.get(window));
}

async function promptForNewCanvas(parent = BrowserWindow.getFocusedWindow() || [...overlays].at(-1)) {
  const response = await dialog.showMessageBox(parent, {
    type: 'question',
    title: 'New drawing window',
    message: 'Choose a canvas background',
    buttons: ['White canvas', 'Black canvas', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });
  if (response.response === 0) createDrawingWindow({ enabled: true, canvasBackground: '#ffffff' });
  if (response.response === 1) createDrawingWindow({ enabled: true, canvasBackground: '#000000' });
}

app.whenReady().then(() => {
  ipcMain.on('set-drawing-mode', (event, enabled) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) setDrawingMode(window, enabled);
  });

  ipcMain.handle('get-drawing-mode', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const enabled = window ? Boolean(drawingModes.get(window)) : false;
    if (selfTest) console.log(`SELF-TEST mode query: window=${Boolean(window)}, enabled=${enabled}`);
    return enabled;
  });

  ipcMain.handle('get-canvas-background', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window ? canvasBackgrounds.get(window) : null;
  });

  ipcMain.on('create-new-canvas', (event) => {
    promptForNewCanvas(BrowserWindow.fromWebContents(event.sender));
  });

  createDrawingWindow({ enabled: selfTest || process.argv.includes('--drawing-on') });

  if (!selfTest) {
    if (!globalShortcut.register('F9', toggleFocusedOverlay)) {
      console.error('Could not register F9 as a global shortcut; use Ctrl+Alt+D instead.');
    }
    if (!globalShortcut.register('CommandOrControl+Alt+D', toggleFocusedOverlay)) {
      console.error('Could not register Ctrl+Alt+D as a global shortcut.');
    }
  }
  if (!globalShortcut.register('CommandOrControl+N', promptForNewCanvas)) {
    console.error('Could not register Ctrl+N globally; use it while drawing mode is active.');
  }

  app.on('activate', () => {
    if (overlays.size === 0) createDrawingWindow();
  });
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
