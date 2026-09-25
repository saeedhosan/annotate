import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { app as electronApp } from 'electron';
import Logger from 'loggest';
import ConsoleLog from 'loggest/dist/plugins/ConsoleLog.js';
import { app } from '../config/app.js';
import FileSystemLogger from './FileSystemLogger.js';

type LogMode = 'production' | 'development' | 'testing' | 'test';

function detectMode(): LogMode {
    if (process.env.NODE_ENV === 'production') return 'production';
    if (process.env.NODE_ENV === 'test') return 'test';
    if (process.env.NODE_ENV === 'testing') return 'testing';
    return 'development';
}

// Bun's test runner sets NODE_ENV=test; keep unit/e2e test output quiet
// while the real app still logs to the terminal.
const quietTests = process.env.NODE_ENV === 'test';

function stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack ?? value.message;
    if (value === undefined) return 'undefined';
    const seen = new WeakSet();
    let encoded: string | undefined;
    try {
        encoded = JSON.stringify(value, (_key, entry) => {
            if (typeof entry === 'bigint') return `${entry}n`;
            if (typeof entry === 'function') return `[Function: ${entry.name || 'anonymous'}]`;
            if (entry instanceof Date) return entry.toISOString();
            if (typeof entry === 'object' && entry !== null) {
                if (seen.has(entry)) return '[Circular]';
                seen.add(entry);
            }
            return entry;
        });
    } catch {
        // Fall through to String(value).
    }
    return encoded ?? String(value);
}

export const logger = new Logger({
    plugins: [
        new ConsoleLog(),
        new FileSystemLogger({
            filePath: () => path.join(electronApp.getPath('logs'), 'annotate.log'),
        }),
    ],
    context: {
        name: app.name,
        version: app.version,
        env: process.env.NODE_ENV ?? 'development',
        mode: detectMode(),
        loggerId: randomUUID(),
    },
    format: (level, ctx, message) => {
        const stamp = new Date().toISOString();
        return `${stamp} ${ctx?.name ?? 'app'}: ${stringify(message)}`;
    },
    ...(quietTests ? { filter: () => false } : {}),
});

export default logger;
