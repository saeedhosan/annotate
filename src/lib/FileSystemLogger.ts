import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LogLevel, Plugin } from 'loggest';

export interface FileSystemLoggerOptions {
    filePath: string | (() => string | Promise<string>);
    maxBytes?: number;
    maxFiles?: number;
}

const DEFAULT_MAX_BYTES = 1_000_000;
const DEFAULT_MAX_FILES = 3;

export class FileSystemLogger implements Plugin {
    private readonly maxBytes: number;
    private readonly maxFiles: number;
    private queue: Promise<void> = Promise.resolve();
    private resolvedPath: string | undefined;

    constructor(private readonly options: FileSystemLoggerOptions) {
        this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
        this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    }

    handle(
        level: LogLevel,
        _ctx: Record<string, unknown>,
        message: unknown,
        ...optional: unknown[]
    ): Promise<void> {
        this.enqueue(level, message, optional);
        return this.queue;
    }

    private enqueue(level: LogLevel, message: unknown, optional: unknown[]): void {
        this.queue = this.queue
            .then(() => this.write(level, message, optional))
            .catch(() => {
                // A logging failure must never crash the application.
            });
    }

    private async write(level: LogLevel, message: unknown, optional: unknown[]): Promise<void> {
        const filePath = await this.resolvePath();
        const content = [message, ...optional.map(stringify)].join(' ');
        const line = `[${level.toUpperCase()}] ${content}\n`;
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await this.rotate(filePath, line.length);
        await fs.appendFile(filePath, line, 'utf8');
    }

    private async resolvePath(): Promise<string> {
        if (this.resolvedPath) return this.resolvedPath;
        const target =
            typeof this.options.filePath === 'function'
                ? await this.options.filePath()
                : this.options.filePath;
        this.resolvedPath = target;
        return target;
    }

    private async rotate(filePath: string, incomingBytes: number): Promise<void> {
        try {
            const stat = await fs.stat(filePath);
            if (stat.size + incomingBytes <= this.maxBytes) return;
        } catch {
            return;
        }
        for (let i = this.maxFiles - 1; i >= 1; i -= 1) {
            const next = `${filePath}.${i + 1}`;
            const current = `${filePath}.${i}`;
            try {
                await fs.unlink(next);
            } catch {
                // Missing rotation files are expected on first run.
            }
            try {
                await fs.rename(current, next);
            } catch {
                // Missing rotation files are expected on first run.
            }
        }
        const first = `${filePath}.1`;
        try {
            await fs.unlink(first);
        } catch {
            // Missing rotation file is expected on first run.
        }
        try {
            await fs.rename(filePath, first);
        } catch {
            // Missing log file is expected on first run.
        }
    }
}

function stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack ?? value.message;
    if (value === undefined) return 'undefined';
    const seen = new WeakSet();
    try {
        const encoded = JSON.stringify(value, (_key, entry) => {
            if (typeof entry === 'bigint') return `${entry}n`;
            if (typeof entry === 'function')
                return `[Function: ${(entry as () => void).name || 'anonymous'}]`;
            if (entry instanceof Date) return entry.toISOString();
            if (typeof entry === 'object' && entry !== null) {
                if (seen.has(entry)) return '[Circular]';
                seen.add(entry);
            }
            return entry;
        });
        if (encoded !== undefined) return encoded;
    } catch {
        // Fall through to String(value).
    }
    return String(value);
}

export default FileSystemLogger;
