import { clipboard } from 'electron';
import type { ClipboardContent, ClipboardImage } from '../shared/contracts/ClipboardContent.js';

export class ClipboardService {
    async clipboardContent(): Promise<ClipboardContent> {
        try {
            const { image, html } = await this.readImageOrHtml();
            if (image) return { type: 'image', text: null, html, image };
            if (html) return { type: 'html', text: html, html, image: null };
            const text = await clipboard.readText();
            if (text) return { type: 'text', text, html: null, image: null };
            return { type: 'empty', text: null, html: null, image: null };
        } catch {
            return { type: 'empty', text: null, html: null, image: null };
        }
    }

    private async readImageOrHtml(): Promise<{
        image: ClipboardImage | null;
        html: string | null;
    }> {
        const items = await clipboard.read();
        for (const item of items) {
            const type = item.types.find((candidate) => candidate.startsWith('image/'));
            if (!type) continue;
            const blob = (await item.getType(type)) as Blob;
            const bytes = Buffer.from(await blob.arrayBuffer());
            return {
                image: {
                    data: `data:${type};base64,${bytes.toString('base64')}`,
                    width: 0,
                    height: 0,
                    mimeType: type,
                },
                html: null,
            };
        }
        for (const item of items) {
            if (!item.types.includes('text/html')) continue;
            const blob = (await item.getType('text/html')) as Blob;
            return { image: null, html: await blob.text() };
        }
        return { image: null, html: null };
    }
}
