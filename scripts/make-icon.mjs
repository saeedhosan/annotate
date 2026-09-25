import { existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'assets', 'logo.png');
const force = process.argv.includes('--force');

const ASSETS_FILL = 0.9;
const publicDir = path.join(root, 'src', 'renderer', 'public');

const targets = [
    ...[16, 32, 48, 64, 128, 256, 512].map((size) => ({
        size,
        out: path.join(root, 'assets', `logo-${size}.png`),
        fill: ASSETS_FILL,
    })),
    // PWA icons referenced by src/renderer/public/manifest.webmanifest and index.html
    { size: 192, out: path.join(publicDir, 'logo-192.png'), fill: ASSETS_FILL },
    { size: 512, out: path.join(publicDir, 'logo-512.png'), fill: ASSETS_FILL },
    {
        size: 180,
        out: path.join(publicDir, 'apple-touch-icon.png'),
        fill: ASSETS_FILL,
    },
    // maskable icons must fill the whole canvas edge-to-edge for the safe zone
    { size: 192, out: path.join(publicDir, 'maskable-192.png'), fill: 1.0 },
    { size: 512, out: path.join(publicDir, 'maskable-512.png'), fill: 1.0 },
];

if (!existsSync(src)) {
    console.error(`assets/logo.png not found (${src}). Place the logo there and retry.`);
    process.exit(1);
}

const FRESH_WINDOW_MS = 2_000;
const upToDate = targets.every(
    ({ out }) =>
        existsSync(out) && statSync(out).mtimeMs + FRESH_WINDOW_MS >= statSync(src).mtimeMs,
);
if (upToDate && !force) {
    console.log(
        `using prebuilt icons (${targets.map(({ size }) => `${size}x${size}`).join(', ')}) — pass --force to rebuild`,
    );
    process.exit(0);
}

const sizeOut = execFileSync(
    'ffprobe',
    [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=s=x:p=0',
        src,
    ],
    { encoding: 'utf8' },
).trim();
const [srcW, srcH] = sizeOut.split('x').map((n) => Number(n));

const raw = execFileSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'],
    { maxBuffer: 64 * 1024 * 1024 },
);

const ALPHA_MIN = 8;
let minX = srcW,
    minY = srcH,
    maxX = -1,
    maxY = -1;
for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
        if (raw[(y * srcW + x) * 4 + 3] > ALPHA_MIN) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
}
if (maxX < 0) {
    console.error('logo has no visible (non-transparent) pixels.');
    process.exit(1);
}

const cropW = maxX - minX + 1;
const cropH = maxY - minY + 1;

for (const { size, out, fill } of targets) {
    mkdirSync(path.dirname(out), { recursive: true });
    const target = Math.round(size * fill);
    const scale = Math.min(target / cropW, target / cropH);
    const scaleW = Math.max(1, Math.round(cropW * scale));
    const scaleH = Math.max(1, Math.round(cropH * scale));

    try {
        execFileSync('ffmpeg', [
            '-y',
            '-loglevel',
            'error',
            '-i',
            src,
            '-vf',
            `crop=${cropW}:${cropH}:${minX}:${minY},` +
                `scale=${scaleW}:${scaleH}:flags=lanczos,` +
                `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black@0`,
            '-compression_level',
            '9',
            '-frames:v',
            '1',
            '-update',
            '1',
            out,
        ]);
    } catch {
        console.error(`failed to write ${out}`);
        process.exit(1);
    }
    const contentPct = Math.round((100 * Math.max(scaleW, scaleH)) / size);
    console.log(
        `wrote ${size}x${size} icon (content fills ~${contentPct}%) to ${path.relative(root, out)}`,
    );
}
