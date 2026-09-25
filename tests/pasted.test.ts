import { expect, test } from 'bun:test';
import { PastedObjectStore } from '../src/shared/PastedObjectStore';

test('pasted objects remain selectable and movable', () => {
    const store = new PastedObjectStore();
    const object = store.add({
        kind: 'text',
        value: 'Hello',
        x: 10,
        y: 20,
        width: 50,
        height: 26,
    });
    expect(store.objectAt({ x: 30, y: 25 })).toBe(object);
    store.move(object, { x: 100, y: 80 }, { x: 10, y: 5 });
    expect(object).toMatchObject({ x: 90, y: 75 });
    expect(store.objectAt({ x: 30, y: 25 })).toBeUndefined();
});

test('eraseAt removes only the topmost overlapping object', () => {
    const store = new PastedObjectStore();
    const first = store.add({
        kind: 'text',
        value: 'bottom',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
    });
    const second = store.add({
        kind: 'text',
        value: 'top',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
    });
    expect(store.eraseAt({ x: 10, y: 10 })).toBe(second);
    expect(store.objectAt({ x: 10, y: 10 })).toBe(first);
});
