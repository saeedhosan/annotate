import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import FileSystemLogger from '../src/lib/FileSystemLogger';

describe('FileSystemLogger', () => {
    let dir: string;
    let filePath: string;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(tmpdir(), 'annotate-logs-'));
        filePath = path.join(dir, 'logs', 'annotate.log');
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test('writes a formatted line and creates parent directories', async () => {
        const plugin = new FileSystemLogger({ filePath });
        await plugin.handle('info', {}, 'overlay ready', { environment: 'development' });

        const output = await readFile(filePath, 'utf8');
        expect(output).toBe('[INFO] overlay ready {"environment":"development"}\n');
    });

    test('resolves the file path lazily and only once', async () => {
        let calls = 0;
        const plugin = new FileSystemLogger({
            filePath: () => {
                calls += 1;
                return filePath;
            },
        });

        await plugin.handle('warn', {}, 'first');
        await plugin.handle('error', {}, 'second');

        expect(calls).toBe(1);
        const output = await readFile(filePath, 'utf8');
        expect(output).toBe('[WARN] first\n[ERROR] second\n');
    });

    test('serializes structured values safely', async () => {
        const plugin = new FileSystemLogger({ filePath });
        const circular: Record<string, unknown> = { label: 'node' };
        circular.self = circular;

        await plugin.handle(
            'debug',
            {},
            'trace',
            circular,
            new Error('boom'),
            BigInt(7),
            42n,
            () => undefined,
        );

        const output = await readFile(filePath, 'utf8');
        expect(output).toContain('[DEBUG] trace');
        expect(output).toContain('"self":"[Circular]"');
        expect(output).toContain('boom');
        expect(output).toContain('7n');
        expect(output).toContain('42n');
    });

    test('appends sequentially without interleaving', async () => {
        const plugin = new FileSystemLogger({ filePath });
        const writes = Array.from({ length: 25 }, (_, index) =>
            plugin.handle('info', {}, `line-${index}`),
        );

        await Promise.all(writes);

        const output = await readFile(filePath, 'utf8');
        const lines = output.trim().split('\n');
        expect(lines).toHaveLength(25);
        lines.forEach((line, index) => expect(line).toBe(`[INFO] line-${index}`));
    });

    test('rotates when the file exceeds maxBytes and keeps maxFiles backups', async () => {
        const plugin = new FileSystemLogger({
            filePath,
            maxBytes: 120,
            maxFiles: 2,
        });

        for (let index = 0; index < 40; index += 1) {
            await plugin.handle(
                'info',
                {},
                `chunk-${index.toString().padStart(2, '0')}-${'x'.repeat(60)}`,
            );
        }

        const files = (await readdir(path.join(dir, 'logs'))).sort();
        expect(files).toContain('annotate.log');
        expect(files).toContain('annotate.log.1');
        expect(files).toContain('annotate.log.2');
        expect(files).not.toContain('annotate.log.3');
    });

    test('never throws when the log destination is unusable', async () => {
        const plugin = new FileSystemLogger({ filePath: dir });

        await expect(plugin.handle('error', {}, 'cannot write')).resolves.toBeUndefined();
    });
});
