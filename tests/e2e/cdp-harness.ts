import { spawn, type ChildProcess } from 'node:child_process';
import electronPath from 'electron';

export interface PageTarget {
    type: string;
    title: string;
    url: string;
    webSocketDebuggerUrl: string;
}

export interface CdpSession {
    evaluate<T>(expression: string, awaitPromise?: boolean, timeoutMs?: number): Promise<T>;
    focus(): Promise<void>;
    blur(): Promise<void>;
    inputMouse(
        type: 'mousePressed' | 'mouseReleased' | 'mouseMoved',
        x: number,
        y: number,
        options?: MouseOptions,
    ): Promise<void>;
    inputKey(type: 'keyDown' | 'keyUp', options?: KeyOptions): Promise<void>;
    close(): Promise<void>;
}

export interface MouseOptions {
    button?: 'none' | 'left' | 'middle' | 'right' | 'back' | 'forward';
    buttons?: number;
    modifiers?: number;
    clickCount?: number;
}

export interface KeyOptions {
    key?: string;
    code?: string;
    modifiers?: number;
    text?: string;
}

export interface ClientRun {
    code: number | null;
    stdout: string;
    stderr: string;
}

export interface AppRun {
    page(): Promise<PageTarget>;
    output(): string;
    close(): Promise<void>;
}

let nextPort = 20000;

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
    probe: () => Promise<T>,
    predicate: (value: T) => boolean,
    timeoutMs: number,
    intervalMs = 250,
): Promise<T> {
    const started = Date.now();
    let last: T;
    while (Date.now() - started < timeoutMs) {
        last = await probe();
        if (predicate(last)) return last;
        await delay(intervalMs);
    }
    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return (await response.json()) as T;
    } finally {
        clearTimeout(timer);
    }
}

async function listPages(port: number): Promise<PageTarget[]> {
    try {
        const targets = await fetchJson<PageTarget[]>(`http://127.0.0.1:${port}/json/list`, 2000);
        return targets.filter((target) => target.type === 'page');
    } catch {
        return [];
    }
}

function whenOpen(socket: WebSocket): Promise<void> {
    if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true });
        socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')), {
            once: true,
        });
    });
}

export async function createCdpSession(target: PageTarget): Promise<CdpSession> {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await whenOpen(socket);

    let nextId = 0;
    const pending = new Map<
        number,
        { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();

    socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data));
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id);
        if (message.error) {
            entry.reject(new Error(message.error.message));
        } else {
            entry.resolve(message.result);
        }
    });

    const call = <T>(
        method: string,
        params: Record<string, unknown> = {},
        timeoutMs = 15000,
    ): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const id = ++nextId;
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new Error(`CDP timeout waiting for ${method}`));
            }, timeoutMs);
            pending.set(id, {
                resolve: (value) => {
                    clearTimeout(timer);
                    resolve(value as T);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            });
            socket.send(JSON.stringify({ id, method, params }));
        });

    await call('Runtime.enable');

    return {
        async evaluate<T>(expression: string, awaitPromise = false, timeoutMs = 15000): Promise<T> {
            const response = await call<{
                result?: { value?: unknown; description?: string };
                exceptionDetails?: { text?: string; exception?: { description?: string } };
            }>('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }, timeoutMs);
            if (response.exceptionDetails) {
                const detail =
                    response.exceptionDetails.exception?.description ??
                    response.exceptionDetails.text;
                throw new Error(`Evaluation failed: ${detail}`);
            }
            return response.result?.value as T;
        },
        async inputMouse(
            type: 'mousePressed' | 'mouseReleased' | 'mouseMoved',
            x: number,
            y: number,
            options: MouseOptions = {},
        ): Promise<void> {
            await call('Input.dispatchMouseEvent', {
                type,
                x,
                y,
                button: options.button ?? 'none',
                buttons: options.buttons ?? 0,
                modifiers: options.modifiers ?? 0,
                clickCount: options.clickCount ?? 1,
                pointerType: 'mouse',
            });
        },
        async inputKey(type: 'keyDown' | 'keyUp', options: KeyOptions = {}): Promise<void> {
            const virtualKey =
                options.key === 'Escape'
                    ? 27
                    : options.key?.length === 1
                      ? options.key.charCodeAt(0)
                      : 0;
            await call('Input.dispatchKeyEvent', {
                type,
                key: options.key ?? '',
                code: options.code ?? '',
                modifiers: options.modifiers ?? 0,
                windowsVirtualKeyCode: virtualKey,
                ...(type === 'keyDown' && options.key?.length === 1
                    ? {
                          text: options.text ?? options.key,
                          unmodifiedText: options.text ?? options.key,
                      }
                    : {}),
            });
        },
        async focus(): Promise<void> {
            await call('Page.bringToFront');
            await call('Emulation.setFocusEmulationEnabled', { enabled: true });
        },
        async blur(): Promise<void> {
            await call('Emulation.setFocusEmulationEnabled', { enabled: false });
        },
        async close(): Promise<void> {
            socket.close();
        },
    };
}

export async function pollEvaluate<T>(
    session: CdpSession,
    expression: string,
    predicate: (value: T) => boolean,
    timeoutMs: number,
): Promise<T> {
    const started = Date.now();
    let last: T;
    while (Date.now() - started < timeoutMs) {
        try {
            last = await session.evaluate<T>(expression, true, 5000);
        } catch {
            last = undefined as T;
        }
        if (predicate(last)) return last;
        await delay(200);
    }
    throw new Error(`pollEvaluate timed out for: ${expression}`);
}

export async function launchApp(options: { cwd: string }): Promise<AppRun> {
    const port = nextPort++;
    const stdin = 'ignore';
    const process = spawn(
        electronPath as unknown as string,
        ['--no-sandbox', '--remote-debugging-port=' + port, '.'],
        {
            cwd: options.cwd,
            stdio: [stdin, 'pipe', 'pipe'],
        },
    ) as ChildProcess;

    let bootOutput = '';
    process.stdout?.on('data', (chunk) => (bootOutput += String(chunk)));
    process.stderr?.on('data', (chunk) => (bootOutput += String(chunk)));

    const page = async (): Promise<PageTarget> => {
        const targets = await waitFor<PageTarget[]>(
            () => listPages(port),
            (pages) => pages.some((candidate) => candidate.url.includes('/renderer/')),
            40_000,
        );
        return targets.find((candidate) => candidate.url.includes('/renderer/')) as PageTarget;
    };

    const close = async (): Promise<void> => {
        if (process.exitCode === null && !process.killed) {
            process.kill('SIGTERM');
            await Promise.race([waitForExit(process), delay(5000)]);
            if (process.exitCode === null && !process.killed) process.kill('SIGKILL');
        }
    };

    return { page, output: () => bootOutput, close };
}

function waitForExit(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null) return Promise.resolve();
    return new Promise((resolve) => child.once('exit', () => resolve()));
}

export function runClient(options: {
    cwd: string;
    args: string[];
    timeoutMs?: number;
}): Promise<ClientRun> {
    const process = spawn(electronPath as unknown as string, options.args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
    }) as ChildProcess;

    let stdout = '';
    let stderr = '';
    process.stdout?.on('data', (chunk) => (stdout += String(chunk)));
    process.stderr?.on('data', (chunk) => (stderr += String(chunk)));

    return new Promise<ClientRun>((resolve, reject) => {
        process.once('exit', (code) => resolve({ code, stdout, stderr }));
        const timer = setTimeout(() => {
            try {
                process.kill('SIGKILL');
            } catch {
                // The process already exited.
            }
            reject(new Error(`client did not exit after ${options.timeoutMs ?? 30000}ms`));
        }, options.timeoutMs ?? 30_000);
        process.once('exit', () => clearTimeout(timer));
    });
}
