import type { Color } from './Color';
import type { Point } from './Point';

export interface Stroke {
    points: Point[];
    color: Color;
    width: number;
}
