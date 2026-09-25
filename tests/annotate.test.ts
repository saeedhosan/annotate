import { expect, test } from 'bun:test';
import { Annotate, type InputEvent } from '../src/shared/Annotate';
import { Drawing } from '../src/shared/Drawing';
import { PastedObjectStore } from '../src/shared/PastedObjectStore';

function makeChart(): Annotate {
    return new Annotate(new Drawing(), new PastedObjectStore());
}

function event(overrides: Partial<InputEvent> = {}): InputEvent {
    return {
        x: 0,
        y: 0,
        buttons: 1,
        pointerType: 'mouse',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        ...overrides,
    };
}

const web = { enabled: false, tool: 'draw' as const };

test('left button intent resolves to draw', () => {
    const annotate = makeChart();
    expect(annotate.intentFor(event(), web)).toBe('draw');
});

test('right button or shift resolves to erase', () => {
    const annotate = makeChart();
    expect(annotate.intentFor(event({ buttons: 2 }), web)).toBe('erase');
    expect(annotate.intentFor(event({ shiftKey: true }), web)).toBe('erase');
});

test('no buttons and no modifiers is undefined', () => {
    const annotate = makeChart();
    expect(annotate.intentFor(event({ buttons: 0 }), web)).toBeUndefined();
});

test('web eraser tool forces erase, even for touch', () => {
    const annotate = makeChart();
    expect(annotate.intentFor(event({ buttons: 0 }), { enabled: true, tool: 'erase' })).toBe(
        'erase',
    );
    expect(
        annotate.intentFor(event({ buttons: 0, pointerType: 'touch' }), {
            enabled: true,
            tool: 'erase',
        }),
    ).toBe('erase');
});

test('web mode forces draw on touch with the draw tool', () => {
    const annotate = makeChart();
    expect(
        annotate.intentFor(event({ buttons: 0, pointerType: 'touch' }), {
            enabled: true,
            tool: 'draw',
        }),
    ).toBe('draw');
});

test('begin/extend/finish strokes mutate the drawing model', () => {
    const annotate = makeChart();
    annotate.beginStroke('left', { x: 1, y: 1 });
    annotate.extendStroke({ x: 2, y: 2 });
    expect(annotate.currentMode).toBe('draw');
    expect(annotate.snapshot().strokes[0].points).toEqual([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
    ]);
    annotate.endGesture();
    expect(annotate.currentMode).toBeUndefined();
    expect(annotate.activeStroke).toBeUndefined();
});

test('eraseAt removes a nearby stroke and reports it', () => {
    const annotate = makeChart();
    annotate.beginStroke('left', { x: 50, y: 50 });
    annotate.endGesture();
    const removed = annotate.eraseAt({ x: 60, y: 50 }, 16);
    expect(removed.stroke).toBe(true);
    expect(annotate.snapshot().strokes).toHaveLength(0);
});

test('selected color defaults stroke color through the palette', () => {
    const annotate = makeChart();
    annotate.setColor('#ff0000');
    annotate.beginStroke('key', { x: 0, y: 0 });
    expect(annotate.snapshot().strokes[0].color).toBe('#ff0000');
});

test('pasted objects can be added, dragged, and erased', () => {
    const annotate = makeChart();
    annotate.addPasted({
        kind: 'text',
        value: 'Hi',
        x: 10,
        y: 20,
        width: 50,
        height: 26,
    });
    expect(annotate.startDrag({ x: 30, y: 25 })).toBeDefined();
    annotate.dragTo({ x: 100, y: 80 });
    annotate.endDrag();
    const removed = annotate.eraseAt({ x: 100, y: 80 }, 16);
    expect(removed.object?.value).toBe('Hi');
});
