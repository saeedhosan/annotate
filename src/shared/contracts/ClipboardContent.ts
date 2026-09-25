import type { ClipboardContentType } from './ClipboardContentType.js';

export interface ClipboardImage {
    data: string;
    width: number;
    height: number;
    mimeType: string;
}

export interface ClipboardContent {
    type: ClipboardContentType;
    text: string | null;
    html: string | null;
    image: ClipboardImage | null;
}
