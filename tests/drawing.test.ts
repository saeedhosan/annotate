import { expect, test } from 'bun:test';
import { Drawing } from '../src/shared/Drawing';

test('records strokes and undo removes only the latest one', () => {
    const drawing = new Drawing();
    const first = drawing.startStroke('#0ff', { x: 1, y: 1 });
    drawing.addPoint(first, { x: 2, y: 2 });
    drawing.startStroke('#f00', { x: 3, y: 3 });
    expect(drawing.undo()).toEqual({
        color: '#f00',
        width: 3,
        points: [{ x: 3, y: 3 }],
    });
    expect(drawing.strokes).toHaveLength(1);
});

test('erases a nearby stroke and ignores distant points', () => {
    const drawing = new Drawing();
    drawing.startStroke('#0ff', { x: 50, y: 50 });
    expect(drawing.eraseAt({ x: 60, y: 50 })).toBe(true);
    expect(drawing.eraseAt({ x: 200, y: 200 })).toBe(false);
});

test('clear empties the session and duplicate points are skipped', () => {
    const drawing = new Drawing();
    const stroke = drawing.startStroke('#0ff', { x: 1, y: 1 });
    drawing.addPoint(stroke, { x: 1, y: 1 });
    expect(stroke.points).toHaveLength(1);
    drawing.clear();
    expect(drawing.strokes).toHaveLength(0);
});
