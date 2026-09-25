import type { Point } from './Point';
import type { Size } from './Size';

export type PastedObjectType = 'text' | 'html' | 'image';

export interface PastedObject {
    id: string;
    type: PastedObjectType;
    position: Point;
    size: Size;
    content: string | ImageData;
}
