export type Point = { x: number; y: number };
export type Stroke = { points: Point[]; color: string; width: number };

export class Drawing {
    private state: Stroke[] = [];

    get strokes(): readonly Stroke[] {
        return this.state;
    }

    startStroke(color: string, at: Point, width = 3): Stroke {
        const stroke: Stroke = { color, width, points: [at] };
        this.state.push(stroke);
        return stroke;
    }

    addPoint(stroke: Stroke | undefined, at: Point): void {
        if (!stroke || this.state.at(-1) !== stroke) return;
        const previous = stroke.points.at(-1);
        if (!previous || previous.x !== at.x || previous.y !== at.y) stroke.points.push(at);
    }

    undo(): Stroke | undefined {
        return this.state.pop();
    }

    clear(): void {
        this.state.length = 0;
    }

    eraseAt(at: Point, radius = 16): boolean {
        const radiusSquared = radius * radius;
        const index = this.state.findLastIndex((stroke) =>
            stroke.points.some((candidate) => {
                const dx = candidate.x - at.x;
                const dy = candidate.y - at.y;
                return dx * dx + dy * dy <= radiusSquared;
            }),
        );
        if (index < 0) return false;
        this.state.splice(index, 1);
        return true;
    }
}
