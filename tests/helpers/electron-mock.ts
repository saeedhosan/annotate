import { EventEmitter } from 'node:events';

interface MockWebContents {
    focus(): void;
    send(channel: string, ...args: unknown[]): void;
    on(channel: string, callback: (...args: unknown[]) => void): void;
    emit(channel: string, ...args: unknown[]): void;
}

export class MockBrowserWindow extends EventEmitter {
    static instances: MockBrowserWindow[] = [];
    static focused: MockBrowserWindow | null = null;

    readonly options: Record<string, unknown>;
    readonly webContents: MockWebContents;
    readonly sentMessages: Array<{ channel: string; args: unknown[] }>;

    private windowVisible = false;
    private windowDestroyed = false;
    private lastFile: string | undefined;
    private lastQuery: Record<string, string> | undefined;

    constructor(options: Record<string, unknown> = {}) {
        super();
        this.options = options;
        this.sentMessages = [];
        const listeners = new Map<string, (...args: unknown[]) => void>();
        this.webContents = {
            focus: () => {
                MockBrowserWindow.focused = this;
            },
            send: (channel, ...args) => this.sentMessages.push({ channel, args }),
            on: (channel, callback) => {
                listeners.set(channel, callback);
            },
            emit: (channel, ...args) => {
                listeners.get(channel)?.(...args);
            },
        };
        MockBrowserWindow.instances.push(this);
    }

    static getFocusedWindow(): MockBrowserWindow | null {
        return MockBrowserWindow.focused;
    }

    show(): void {
        this.windowVisible = true;
        this.emit('show');
    }

    hide(): void {
        this.windowVisible = false;
    }

    focus(): void {
        MockBrowserWindow.focused = this;
    }

    isVisible(): boolean {
        return this.windowVisible;
    }

    isDestroyed(): boolean {
        return this.windowDestroyed;
    }

    close(): void {
        if (this.windowDestroyed) return;
        this.windowDestroyed = true;
        this.emit('closed');
    }

    destroy(): void {
        this.close();
    }

    setAlwaysOnTop(): void {}

    setVisibleOnAllWorkspaces(): void {}

    loadFile(file: string, options?: { query?: Record<string, string> }): Promise<void> {
        this.lastFile = file;
        this.lastQuery = options?.query ?? {};
        return Promise.resolve();
    }

    lastLoadedFile(): string | undefined {
        return this.lastFile;
    }

    loadQuery(): Record<string, string> {
        return this.lastQuery ?? {};
    }

    fireReadyToShow(): void {
        this.emit('ready-to-show');
    }

    fireDidFinishLoad(): void {
        this.webContents.emit('did-finish-load');
    }
}

export interface ElectronMock {
    electron: Record<string, unknown>;
    mock: {
        appEvents: EventEmitter;
        app: {
            name: string;
            isPackaged: boolean;
            commandLine: { appendSwitch: (flag: string, value?: string) => void };
            getAppPath(): string;
            isReady(): boolean;
            whenReady(): Promise<void>;
            requestSingleInstanceLock(): boolean;
            quit(): void;
            exit(code?: number): void;
            setAppUserModelId(id: string): void;
            setLoginItemSettings(options: { openAtLogin: boolean; args: string[] }): void;
            on(event: string, listener: (...args: unknown[]) => void): void;
            once(event: string, listener: (...args: unknown[]) => void): void;
            off(event: string, listener: (...args: unknown[]) => void): void;
        };
        switches: string[];
        ipcHandlers: Map<string, (...args: unknown[]) => unknown>;
        ipcRemoved: string[];
        globalShortcuts: Map<string, () => void>;
        instances: MockBrowserWindow[];
        readonly quitCount: number;
        readonly exitCount: number;
        dialogResponse: number;
        clipboardText: string;
        clipboardItems: Array<{ types: string[]; getType(type: string): Promise<Blob> }>;
        conflicts: Set<string>;
        permissions: { requests: string[]; checks: string[] };
        nativeThemeSource: string | undefined;
        setLockResult(value: boolean): void;
        setPackaged(value: boolean): void;
        setReadItems(items: ElectronMock['mock']['clipboardItems']): void;
        setReadText(text: string): void;
        setDialogResponse(response: number): void;
        emitApp(event: string, ...args: unknown[]): void;
        invokeIpc(channel: string, ...args: unknown[]): Promise<unknown>;
        requestPermission(permission: string): boolean;
        reset(): void;
    };
}

export function createElectronMock(): ElectronMock {
    const appEvents = new EventEmitter();
    const switches: string[] = [];
    const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcRemoved: string[] = [];
    const globalShortcuts = new Map<string, () => void>();
    const instances = MockBrowserWindow.instances;
    const conflicts = new Set<string>();
    const permissions = { requests: [] as string[], checks: [] as string[] };

    let lockResult = true;
    let packaged = false;
    let acquiredLock = true;
    let dialogResponse = 2;
    let clipboardText = '';
    let clipboardItems: Array<{ types: string[]; getType(type: string): Promise<Blob> }> = [];
    let nativeThemeSource: string | undefined;
    let ready = false;
    let quitCount = 0;
    let exitCount = 0;

    const app = {
        name: 'annotate',
        isPackaged: packaged,
        commandLine: {
            appendSwitch(flag: string, value?: string) {
                switches.push(value === undefined ? flag : `${flag}=${value}`);
            },
        },
        getAppPath(): string {
            return process.cwd();
        },
        isReady(): boolean {
            return ready;
        },
        whenReady(): Promise<void> {
            return Promise.resolve();
        },
        requestSingleInstanceLock(): boolean {
            if (!lockResult) return false;
            if (acquiredLock) return false;
            acquiredLock = true;
            return true;
        },
        quit(): void {
            quitCount += 1;
        },
        exit(_code?: number): void {
            exitCount += 1;
        },
        setAppUserModelId(_id: string): void {},
        setLoginItemSettings(_options: { openAtLogin: boolean; args: string[] }): void {},
        on(event: string, listener: (...args: unknown[]) => void): void {
            appEvents.on(event, listener);
        },
        once(event: string, listener: (...args: unknown[]) => void): void {
            appEvents.once(event, listener);
        },
        off(event: string, listener: (...args: unknown[]) => void): void {
            appEvents.off(event, listener);
        },
    };

    const electron = {
        app,
        BrowserWindow: MockBrowserWindow,
        globalShortcut: {
            register(accelerator: string, callback: () => void): boolean {
                if (globalShortcuts.has(accelerator) || conflicts.has(accelerator)) return false;
                globalShortcuts.set(accelerator, callback);
                return true;
            },
            unregister(accelerator: string): void {
                globalShortcuts.delete(accelerator);
            },
            unregisterAll(): void {
                globalShortcuts.clear();
            },
        },
        ipcMain: {
            handle(channel: string, handler: (...args: unknown[]) => unknown): void {
                ipcHandlers.set(channel, handler);
            },
            removeHandler(channel: string): void {
                ipcRemoved.push(channel);
                ipcHandlers.delete(channel);
            },
        },
        session: {
            defaultSession: {
                setPermissionRequestHandler(
                    handler: (
                        webContents: unknown,
                        permission: string,
                        callback: (value: boolean) => void,
                    ) => void,
                ): void {
                    permissions.requestHandler = handler;
                },
                setPermissionCheckHandler(
                    handler: (webContents: unknown, permission: string) => boolean,
                ): void {
                    permissions.checkHandler = handler;
                },
            },
        },
        nativeTheme: {
            themeSource: '',
            set themeSource(value: string) {
                nativeThemeSource = value;
            },
        },
        clipboard: {
            async read(): Promise<
                Array<{ types: string[]; getType(type: string): Promise<Blob> }>
            > {
                return clipboardItems;
            },
            async readText(): Promise<string> {
                return clipboardText;
            },
            async has(_mimetype: string): Promise<boolean> {
                return false;
            },
            async write(): Promise<void> {},
            async writeText(): Promise<void> {},
        },
        screen: {
            getPrimaryDisplay() {
                return { bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
            },
            getDisplayNearestPoint() {
                return { bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
            },
            getCursorScreenPoint() {
                return { x: 0, y: 0 };
            },
        },
        dialog: {
            async showMessageBox() {
                return { response: dialogResponse, checkboxChecked: false };
            },
        },
    };

    return {
        electron,
        mock: {
            appEvents,
            app,
            switches,
            ipcHandlers,
            ipcRemoved,
            globalShortcuts,
            instances,
            get quitCount(): number {
                return quitCount;
            },
            get exitCount(): number {
                return exitCount;
            },
            dialogResponse,
            clipboardText,
            clipboardItems,
            conflicts,
            permissions,
            get nativeThemeSource(): string | undefined {
                return nativeThemeSource;
            },
            setLockResult(value: boolean): void {
                lockResult = value;
                acquiredLock = false;
            },
            setPackaged(value: boolean): void {
                packaged = value;
                app.isPackaged = value;
            },
            setReadItems(items: ElectronMock['mock']['clipboardItems']): void {
                clipboardItems = items;
            },
            setReadText(text: string): void {
                clipboardText = text;
            },
            setDialogResponse(response: number): void {
                dialogResponse = response;
            },
            emitApp(event: string, ...args: unknown[]): void {
                appEvents.emit(event, ...args);
            },
            async invokeIpc(channel: string, ...args: unknown[]): Promise<unknown> {
                const handler = ipcHandlers.get(channel);
                if (!handler) throw new Error(`No IPC handler for: ${channel}`);
                return handler(...args);
            },
            requestPermission(permission: string): boolean {
                const callback = permissions.requestHandler as
                    | ((
                          webContents: unknown,
                          permission: string,
                          cb: (value: boolean) => void,
                      ) => void)
                    | undefined;
                const check = permissions.checkHandler as
                    ((webContents: unknown, permission: string) => boolean) | undefined;
                let allowed = false;
                callback?.(null, permission, (value) => {
                    allowed = value;
                });
                permissions.requests.push(permission);
                if (check) {
                    permissions.checks.push(permission);
                    return check(null, permission);
                }
                return allowed;
            },
            reset(): void {
                switches.length = 0;
                ipcRemoved.length = 0;
                ipcHandlers.clear();
                globalShortcuts.clear();
                instances.length = 0;
                MockBrowserWindow.focused = null;
                conflicts.clear();
                permissions.requests.length = 0;
                permissions.checks.length = 0;
                nativeThemeSource = undefined;
                lockResult = true;
                acquiredLock = false;
                packaged = false;
                app.isPackaged = false;
                dialogResponse = 2;
                clipboardText = '';
                clipboardItems = [];
                ready = false;
                quitCount = 0;
                exitCount = 0;
                appEvents.removeAllListeners();
            },
        },
    };
}

export async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}
