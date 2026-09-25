import { afterAll, expect, test } from 'bun:test';
import {
    createCdpSession,
    launchApp,
    pollEvaluate,
    runClient,
    type AppRun,
    type CdpSession,
} from './cdp-harness';

const E2E_TIMEOUT = 60_000;

const PAINTED_PIXELS = `(() => {
    const canvas = document.querySelector('#canvas');
    const context = canvas.getContext('2d');
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let filled = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) filled++;
    return filled;
})()`;

const COLOR_AT = (x: number, y: number): string => `(() => {
    const canvas = document.querySelector('#canvas');
    const px = Math.round(${x} * devicePixelRatio);
    const py = Math.round(${y} * devicePixelRatio);
    return Array.from(canvas.getContext('2d').getImageData(px, py, 1, 1).data);
})()`;

let app: AppRun | undefined;
let page: CdpSession | undefined;

afterAll(async () => {
    try {
        await page?.close();
    } catch {
        // Ignore cleanup failures.
    }
    try {
        await app?.close();
    } catch {
        // Ignore cleanup failures.
    }
});

test(
    'boots the overlay, loads the renderer, and serves app-config over IPC',
    async () => {
        app = await launchApp({ cwd: process.cwd() });
        const target = await app.page();
        page = await createCdpSession(target);

        const title = await pollEvaluate<string>(
            page,
            'document.title',
            (value) => value === 'Screen Annotate',
            E2E_TIMEOUT,
        );
        expect(title).toBe('Screen Annotate');

        const hasCanvas = await page.evaluate<boolean>("!!document.querySelector('#canvas')", true);
        expect(hasCanvas).toBe(true);

        const isBlank = await page.evaluate<boolean>(
            "document.body.classList.contains('blank')",
            true,
        );
        expect(isBlank).toBe(false);
    },
    E2E_TIMEOUT + 30_000,
);

test(
    'app-config IPC round-trips from the renderer',
    async () => {
        if (!page) throw new Error('The overlay renderer must be available.');
        const config = await page.evaluate<{ title: string }>(
            'window.screenAnnotate.appConfig()',
            true,
        );
        expect(config).toEqual({ title: 'Screen Annotate' });
    },
    E2E_TIMEOUT,
);

test(
    'clipboard-content IPC returns the renderer payload shape',
    async () => {
        if (!page) throw new Error('The overlay renderer must be available.');
        const content = await page.evaluate<{ image: string; text: string }>(
            'window.screenAnnotate.clipboardContent()',
            true,
        );
        expect(content).toHaveProperty('image');
        expect(content).toHaveProperty('text');
        expect(typeof content.image).toBe('string');
        expect(typeof content.text).toBe('string');
    },
    E2E_TIMEOUT,
);

test(
    'the main process boots without throwing',
    async () => {
        if (!app) throw new Error('The application must be launched first.');
        const output = app.output();
        expect(output).not.toContain('App threw an error during load');
        expect(output).not.toContain('Uncaught Exception');
    },
    E2E_TIMEOUT,
);

async function drawStroke(target: CdpSession): Promise<void> {
    await target.inputMouse('mousePressed', 120, 140, {
        button: 'left',
        buttons: 1,
        clickCount: 1,
    });
    await target.inputMouse('mouseMoved', 160, 180, { button: 'left', buttons: 1 });
    await target.inputMouse('mouseMoved', 200, 220, { button: 'left', buttons: 1 });
    await target.inputMouse('mouseReleased', 200, 220, {
        button: 'left',
        buttons: 0,
        clickCount: 1,
    });
}

test(
    'draws a stroke, honoring the r color key',
    async () => {
        if (!page) throw new Error('The overlay renderer must be available.');
        const blank = await page.evaluate<number>(PAINTED_PIXELS, true);
        expect(blank).toBe(0);

        await page.inputKey('keyDown', { key: 'r', code: 'KeyR' });
        await drawStroke(page);
        await page.inputKey('keyUp', { key: 'r', code: 'KeyR' });

        await pollEvaluate<number>(page, PAINTED_PIXELS, (count) => count > 0, 10_000);
        const rgba = await page.evaluate<number[]>(COLOR_AT(120, 140), true);
        expect(rgba[0]).toBeGreaterThan(200);
        expect(rgba[1]).toBeLessThan(100);
        expect(rgba[2]).toBeLessThan(100);
        expect(rgba[3]).toBeGreaterThan(0);
    },
    E2E_TIMEOUT,
);

test(
    'undo (Ctrl+Z) removes the last stroke',
    async () => {
        if (!page) throw new Error('The overlay renderer must be available.');
        await pollEvaluate<number>(page, PAINTED_PIXELS, (count) => count > 0, 10_000);

        await page.inputKey('keyDown', { key: 'z', code: 'KeyZ', modifiers: 2 });
        await pollEvaluate<number>(page, PAINTED_PIXELS, (count) => count === 0, 10_000);
        await page.inputKey('keyUp', { key: 'z', code: 'KeyZ', modifiers: 2 });
    },
    E2E_TIMEOUT,
);

test(
    'Escape clears all strokes',
    async () => {
        if (!page) throw new Error('The overlay renderer must be available.');
        await drawStroke(page);
        await pollEvaluate<number>(page, PAINTED_PIXELS, (count) => count > 0, 10_000);

        await page.inputKey('keyDown', { key: 'Escape', code: 'Escape' });
        await page.inputKey('keyUp', { key: 'Escape', code: 'Escape' });
        await pollEvaluate<number>(page, PAINTED_PIXELS, (count) => count === 0, 10_000);
    },
    E2E_TIMEOUT,
);

test(
    'right-click erases the stroke under the cursor',
    async () => {
        if (!page) throw new Error('The overlay renderer must be available.');
        await drawStroke(page);
        await pollEvaluate<number>(page, PAINTED_PIXELS, (count) => count > 0, 10_000);

        await page.inputMouse('mousePressed', 160, 180, {
            button: 'right',
            buttons: 2,
            clickCount: 1,
        });
        await page.inputMouse('mouseReleased', 160, 180, {
            button: 'right',
            buttons: 0,
            clickCount: 1,
        });
        await pollEvaluate<number>(page, PAINTED_PIXELS, (count) => count === 0, 10_000);
    },
    E2E_TIMEOUT,
);

test(
    'clipboard text round-trips through clipboardContent',
    async () => {
        if (!page) throw new Error('The overlay renderer must be available.');
        const seed = `annotate-e2e-${process.pid}-${Date.now()}`;
        await page.focus();
        await page.evaluate(`navigator.clipboard.writeText(${JSON.stringify(seed)})`, true);

        const text = await pollEvaluate<string>(
            page,
            'window.screenAnnotate.clipboardContent().then((content) => content.text)',
            (value) => typeof value === 'string' && value.includes(seed),
            15_000,
        );
        expect(text).toContain(seed);
        await page.blur();
    },
    E2E_TIMEOUT,
);

test(
    'a second --toggle instance forwards to the running app',
    async () => {
        if (!page) throw new Error('The overlay renderer must be available.');

        const hidden = await runClient({
            cwd: process.cwd(),
            args: ['--no-sandbox', '.', '--toggle'],
        });
        expect(hidden.code).toBe(0);
        await pollEvaluate<string>(
            page,
            'document.visibilityState',
            (value) => value === 'hidden',
            20_000,
        );

        const shown = await runClient({
            cwd: process.cwd(),
            args: ['--no-sandbox', '.', '--toggle'],
        });
        expect(shown.code).toBe(0);
        await pollEvaluate<string>(
            page,
            'document.visibilityState',
            (value) => value === 'visible',
            20_000,
        );
    },
    E2E_TIMEOUT,
);

test(
    '--help prints the command list and exits cleanly',
    async () => {
        const help = await runClient({
            cwd: process.cwd(),
            args: ['--no-sandbox', '.', '--help'],
        });
        expect(help.code).toBe(0);
        expect(help.stdout).toContain('Available commands:');
        expect(help.stdout).toContain('toggle');
    },
    E2E_TIMEOUT,
);
