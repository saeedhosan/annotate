import { beforeEach, expect, mock, test } from 'bun:test';
import { createElectronMock, flush } from './helpers/electron-mock';

const electronMock = createElectronMock();
mock.module('electron', () => electronMock.electron);

const { ClipboardService } = await import('../src/main/ClipboardService');
const { IpcChannels } = await import('../src/main/IpcChannels');
const { IpcServer } = await import('../src/main/IpcServer');
const { WindowManager } = await import('../src/main/WindowManager');

beforeEach(() => electronMock.mock.reset());

function server(overrides: { windows?: WindowManager } = {}): IpcServer {
    return new IpcServer(overrides.windows ?? new WindowManager(), new ClipboardService());
}

test('register installs the built-in handlers', () => {
    const ipc = server();
    ipc.register();
    expect(electronMock.mock.ipcHandlers.has(IpcChannels.appConfig)).toBe(true);
    expect(electronMock.mock.ipcHandlers.has(IpcChannels.createNewWindow)).toBe(true);
    expect(electronMock.mock.ipcHandlers.has(IpcChannels.clipboardContent)).toBe(true);
});

test('app-config returns the application title', async () => {
    const ipc = server();
    ipc.register();
    const result = await electronMock.mock.invokeIpc(IpcChannels.appConfig);
    expect(result).toEqual({ title: 'Screen Annotate' });
});

test('clipboard-content returns renderer text', async () => {
    const ipc = server();
    ipc.register();
    electronMock.mock.setReadText('paste me');
    const result = (await electronMock.mock.invokeIpc(IpcChannels.clipboardContent)) as {
        image: string;
        text: string;
    };
    expect(result).toEqual({ image: '', text: 'paste me' });
});

test('clipboard-content returns renderer image data', async () => {
    const ipc = server();
    ipc.register();
    electronMock.mock.setReadItems([
        { types: ['image/png'], getType: async () => new Blob([new Uint8Array([1, 2, 3])]) },
    ]);
    const result = (await electronMock.mock.invokeIpc(IpcChannels.clipboardContent)) as {
        image: string;
        text: string;
    };
    expect(result.image).toBe('data:image/png;base64,AQID');
    expect(result.text).toBe('');
});

test('create-new-window opens a canvas and reports ok', async () => {
    const ipc = server();
    ipc.register();
    electronMock.mock.setDialogResponse(0);
    const result = await electronMock.mock.invokeIpc(IpcChannels.createNewWindow);
    await flush();
    expect(result).toEqual({ ok: true });
    expect(electronMock.mock.instances.length).toBe(1);
    expect(electronMock.mock.instances[0].loadQuery()).toEqual({ background: '#ffffff' });
});

test('create-new-window reports errors back to the renderer', async () => {
    class FailingWindows extends WindowManager {
        override async promptForNewCanvas(): Promise<void> {
            throw new Error('no canvas available');
        }
    }
    const ipc = server({ windows: new FailingWindows() });
    ipc.register();
    const result = await electronMock.mock.invokeIpc(IpcChannels.createNewWindow);
    expect(result).toEqual({ ok: false, error: 'no canvas available' });
});

test('clipboard-content failures degrade to empty values', async () => {
    class FailingClipboard extends ClipboardService {
        override async clipboardContent(): Promise<never> {
            throw new Error('clipboard unavailable');
        }
    }
    const ipc = new IpcServer(new WindowManager(), new FailingClipboard());
    ipc.register();
    const result = await electronMock.mock.invokeIpc(IpcChannels.clipboardContent);
    expect(result).toEqual({ image: '', text: '' });
});

test('unregister removes the built-in handlers', () => {
    const ipc = server();
    ipc.register();
    ipc.unregister();
    expect(electronMock.mock.ipcRemoved.sort()).toEqual(
        [IpcChannels.appConfig, IpcChannels.createNewWindow, IpcChannels.clipboardContent].sort(),
    );
    expect(electronMock.mock.ipcHandlers.size).toBe(0);
});
