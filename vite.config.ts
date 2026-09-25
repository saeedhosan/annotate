import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// Matches the title derivation in src/config/app.ts (build.productName,
// then productName, then name) so the browser tab shows the same title the
// native Electron window gets via IPC.
function appTitle(): string {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
        name: string;
        productName?: string;
        build?: { productName?: string };
    };
    return pkg.build?.productName ?? pkg.productName ?? pkg.name;
}

function injectAppTitle(): Plugin {
    const title = appTitle();
    return {
        name: 'inject-app-title',
        transformIndexHtml(html) {
            return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
        },
    };
}

export default defineConfig({
    root: 'src/renderer',
    base: './',
    plugins: [injectAppTitle()],
    build: { outDir: '../../dist/renderer', emptyOutDir: true },
});
