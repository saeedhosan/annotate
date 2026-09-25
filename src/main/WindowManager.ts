import { BrowserWindow, dialog, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app as appConfig } from '../config/app.js';
import { logger } from '../lib/logger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererUrl = path.join(here, '../../renderer/index.html');

export type WindowType = 'overlay' | 'blank';

export interface WindowConfig {
    width: number;
    height: number;
    transparent: boolean;
    alwaysOnTop: boolean;
    resizable: boolean;
    backgroundColor?: string;
    show: boolean;
}

interface WindowState {
    overlay: BrowserWindow | null;
    windows: Set<BrowserWindow>;
    visible: boolean;
}

interface WindowRecord {
    window: BrowserWindow;
    type: WindowType;
}

export class WindowManager {
    private readonly state: WindowState;
    private readonly registry: WindowRecord[] = [];

    constructor(private readonly config: Partial<WindowConfig> = {}) {
        this.state = { overlay: null, windows: new Set(), visible: false };
    }

    createOverlay(): BrowserWindow {
        if (this.state.overlay && !this.state.overlay.isDestroyed()) return this.state.overlay;
        let window: BrowserWindow;
        try {
            const display = screen.getPrimaryDisplay();
            window = new BrowserWindow({
                x: display.bounds.x,
                y: display.bounds.y,
                width: this.config.width ?? display.bounds.width,
                height: this.config.height ?? display.bounds.height,
                title: appConfig.title,
                frame: false,
                transparent: true,
                alwaysOnTop: true,
                skipTaskbar: true,
                show: false,
                focusable: true,
                resizable: false,
                webPreferences: {
                    preload: path.join(here, 'preload.cjs'),
                    contextIsolation: true,
                    nodeIntegration: false,
                },
            });
        } catch (err) {
            logger.warn('could not create overlay window:', err);
            throw err;
        }
        window.setAlwaysOnTop(true, 'screen-saver');
        window.on('show', () => {
            window.focus();
            window.webContents.focus();
        });
        window.on('closed', () => {
            if (this.state.overlay === window) this.state.overlay = null;
            this.state.visible = false;
        });
        this.registry.push({ window, type: 'overlay' });
        this.state.overlay = window;
        this.track(window);
        this.load(window);
        return window;
    }

    createBlankWindow(background = 'transparent'): BrowserWindow {
        const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
        const window = new BrowserWindow({
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height,
            title: appConfig.title,
            frame: false,
            transparent: background === 'transparent',
            backgroundColor: background === 'transparent' ? undefined : background,
            alwaysOnTop: true,
            skipTaskbar: true,
            show: false,
            resizable: false,
            movable: false,
            fullscreenable: false,
            hasShadow: false,
            focusable: true,
            webPreferences: {
                preload: path.join(here, 'preload.cjs'),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        window.setAlwaysOnTop(true, 'screen-saver');
        window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        window.on('show', () => {
            window.focus();
            window.webContents.focus();
        });
        window.once('ready-to-show', () => window.show());
        this.registry.push({ window, type: 'blank' });
        this.track(window);
        this.load(window, background);
        return window;
    }

    setVisible(visible: boolean): void {
        this.state.visible = visible;
        for (const window of this.state.windows) {
            if (window.isDestroyed()) continue;
            if (visible) {
                window.show();
                window.focus();
                window.webContents.focus();
            } else {
                window.hide();
            }
        }
        logger.info(`annotation layer ${visible ? 'shown' : 'hidden'}.`);
    }

    isVisible(): boolean {
        return this.state.overlay ? this.state.overlay.isVisible() : false;
    }

    revealOverlay(): void {
        if (!this.state.overlay || this.state.overlay.isDestroyed()) {
            this.createOverlay();
            return;
        }
        if (!this.state.overlay.isVisible()) {
            this.state.overlay.show();
            this.state.overlay.focus();
            this.state.overlay.webContents.focus();
        }
    }

    focusOverlay(): void {
        const overlay = this.state.overlay;
        if (!overlay || overlay.isDestroyed()) return;
        overlay.show();
        overlay.focus();
        overlay.webContents.focus();
    }

    async promptForNewCanvas(parent?: BrowserWindow): Promise<void> {
        const options = {
            type: 'question' as const,
            title: 'New blank canvas',
            message: 'Choose a canvas background',
            buttons: ['Light', 'Dark', 'Plain', 'Cancel'],
            defaultId: 0,
            cancelId: 2,
        };
        const response = parent
            ? await dialog.showMessageBox(parent, options)
            : await dialog.showMessageBox(options);
        if (response.response === 0) this.createBlankWindow('#ffffff');
        if (response.response === 1) this.createBlankWindow('#262527');
        if (response.response === 2) this.createBlankWindow('transparent');
    }

    track(window: BrowserWindow): void {
        this.state.windows.add(window);
        window.on('closed', () => {
            this.state.windows.delete(window);
            this.removeRecord(window);
        });
    }

    windows(): BrowserWindow[] {
        return this.registry
            .map((record) => record.window)
            .filter((window) => !window.isDestroyed());
    }

    load(window?: BrowserWindow, background?: string): void {
        const target = window ?? this.state.overlay;
        if (!target) return;
        void target.loadFile(rendererUrl, {
            query: background ? { background } : undefined,
        });
        target.webContents.on('did-finish-load', () => {
            target.webContents.send('window-kind', background ? 'blank' : 'overlay');
            if (!background) {
                target.show();
                target.focus();
                target.webContents.focus();
            }
        });
    }

    close(window: BrowserWindow): void {
        if (!this.state.windows.has(window)) return;
        window.close();
    }

    closeAll(): void {
        for (const record of [...this.registry]) {
            if (!record.window.isDestroyed()) record.window.close();
        }
    }

    private removeRecord(window: BrowserWindow): void {
        const index = this.registry.findIndex((record) => record.window === window);
        if (index >= 0) this.registry.splice(index, 1);
    }
}
