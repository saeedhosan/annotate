import type { Point } from './Drawing';

export type PastedObject = {
    id: number;
    kind: 'text' | 'image' | 'rich';
    value: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
};

export class PastedObjectStore {
    private state: PastedObject[] = [];
    private nextId = 1;

    get objects(): readonly PastedObject[] {
        return this.state;
    }

    add(object: Omit<PastedObject, 'id'>): PastedObject {
        const pasted: PastedObject = { ...object, id: this.nextId++ };
        this.state.push(pasted);
        return pasted;
    }

    objectAt(point: Point): PastedObject | undefined {
        return this.state.findLast(
            (object) =>
                point.x >= object.x &&
                point.x <= object.x + object.width &&
                point.y >= object.y &&
                point.y <= object.y + object.height,
        );
    }

    eraseAt(point: Point): PastedObject | undefined {
        const index = this.state.findLastIndex(
            (object) =>
                point.x >= object.x &&
                point.x <= object.x + object.width &&
                point.y >= object.y &&
                point.y <= object.y + object.height,
        );
        if (index < 0) return undefined;
        return this.state.splice(index, 1)[0];
    }

    move(object: PastedObject, point: Point, offset: Point): void {
        object.x = point.x - offset.x;
        object.y = point.y - offset.y;
    }

    clear(): void {
        this.state.length = 0;
    }
}
