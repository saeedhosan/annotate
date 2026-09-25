import { appPrefix } from './identity';
import type { Annotate } from '../shared/Annotate';
import type { Point } from '../shared/Drawing';
import type { HtmlSanitizer } from './HtmlSanitizer';
import type { Renderer } from './Renderer';

const APP = appPrefix;

export interface ClipboardItemLike {
    types: readonly string[];
    getType(type: string): Promise<Blob>;
}

export interface ClipboardPort {
    readBrowser(): Promise<ClipboardItemLike[]>;
    readNative(): Promise<{ image: string; text: string }>;
}

export const systemClipboard: ClipboardPort = {
    async readBrowser() {
        if (navigator.clipboard && navigator.clipboard.read)
            return (await navigator.clipboard.read()) as ClipboardItemLike[];
        return [];
    },
    async readNative() {
        if (!window.screenAnnotate) return { image: '', text: '' };
        try {
            return await window.screenAnnotate.clipboardContent();
        } catch (err) {
            console.warn(`${APP()} clipboard-content IPC failed:`, err);
            return { image: '', text: '' };
        }
    },
};

export class PasteService {
    constructor(
        private readonly annotate: Annotate,
        private readonly renderer: Renderer,
        private readonly sanitizer: HtmlSanitizer,
        private readonly onChanged: () => void,
        private readonly onMessage: (message: string, duration?: number) => void,
        private readonly clipboard: ClipboardPort = systemClipboard,
    ) {}

    async paste(at: Point, plain: boolean): Promise<void> {
        let html: string | undefined;
        let text: string | undefined;
        let imageBlob: Blob | undefined;
        try {
            const item = (await this.clipboard.readBrowser())[0];
            if (item) {
                const imageType = item.types.find((candidate) => candidate.startsWith('image/'));
                const htmlType = item.types.find((candidate) => candidate === 'text/html');
                const textType = item.types.find((candidate) => candidate === 'text/plain');
                if (imageType) imageBlob = (await item.getType(imageType)) as Blob;
                if (htmlType) html = await (await item.getType(htmlType)).text();
                if (textType) text = await (await item.getType(textType)).text();
            }
        } catch (err) {
            console.warn(`${APP()} navigator.clipboard.read failed:`, err);
        }
        if (imageBlob) {
            this.pasteImage(URL.createObjectURL(imageBlob), at);
            return;
        }
        if (!plain && html) {
            this.pasteRich(html, at);
            return;
        }
        if (text) {
            this.pasteText(text, at);
            return;
        }
        const native = await this.clipboard.readNative();
        if (native.image) {
            this.pasteImage(native.image, at);
            return;
        }
        if (native.text) {
            this.pasteText(native.text, at);
            return;
        }
        this.onMessage('Clipboard is empty or unreadable');
    }

    private pasteImage(src: string, at: Point): void {
        const image = new Image();
        image.onerror = () => this.onMessage('Could not load pasted image');
        image.onload = () => {
            const scale = Math.min(
                1,
                (innerWidth * 0.6) / image.width,
                (innerHeight * 0.6) / image.height,
            );
            this.annotate.addPasted({
                kind: 'image',
                value: src,
                x: at.x,
                y: at.y,
                width: Math.max(1, Math.round(image.width * scale)),
                height: Math.max(1, Math.round(image.height * scale)),
            });
            this.onChanged();
        };
        image.src = src;
    }

    private pasteRich(html: string, at: Point): void {
        const clean = this.sanitizer.sanitize(html);
        if (!clean) {
            this.onMessage('No rich text content');
            return;
        }
        const object = this.annotate.addPasted({
            kind: 'rich',
            value: clean,
            x: at.x,
            y: at.y,
            width: 200,
            height: 40,
        });
        this.renderer.measureRich(object);
        this.onChanged();
    }

    private pasteText(text: string, at: Point): void {
        const width = Math.max(80, this.renderer.measureText(text));
        this.annotate.addPasted({
            kind: 'text',
            value: text,
            x: at.x,
            y: at.y,
            width,
            height: 26,
            color: this.annotate.selectedColor,
        });
        this.onChanged();
    }
}
