import { BrowserWindow, ipcMain } from 'electron';
import { app as appConfig } from '../config/app.js';
import type { ClipboardContent } from '../shared/contracts/ClipboardContent.js';
import { ClipboardService } from './ClipboardService.js';
import { IpcChannels } from './IpcChannels.js';
import { WindowManager } from './WindowManager.js';

export class IpcServer {
    constructor(
        private readonly windows: WindowManager,
        private readonly clipboard: ClipboardService,
    ) {}

    register(): void {
        ipcMain.handle(IpcChannels.appConfig, () => ({ title: appConfig.title }));
        ipcMain.handle(IpcChannels.createNewWindow, async () => {
            try {
                await this.createNewWindow();
                return { ok: true };
            } catch (err) {
                return { ok: false, error: err instanceof Error ? err.message : String(err) };
            }
        });
        ipcMain.handle(IpcChannels.clipboardContent, async () => {
            try {
                return toRendererClipboard(await this.clipboardContent());
            } catch {
                return { image: '', text: '' };
            }
        });
    }

    unregister(): void {
        ipcMain.removeHandler(IpcChannels.appConfig);
        ipcMain.removeHandler(IpcChannels.createNewWindow);
        ipcMain.removeHandler(IpcChannels.clipboardContent);
    }

    async createNewWindow(): Promise<void> {
        await this.windows.promptForNewCanvas(BrowserWindow.getFocusedWindow() ?? undefined);
    }

    async clipboardContent(): Promise<ClipboardContent> {
        return this.clipboard.clipboardContent();
    }
}

function toRendererClipboard(content: ClipboardContent): { image: string; text: string } {
    return {
        image: content.image?.data ?? '',
        text: content.text ?? content.html ?? '',
    };
}
