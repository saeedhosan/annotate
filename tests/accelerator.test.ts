import { expect, test } from 'bun:test';
import { Accelerator } from '../src/shared/Accelerator';

const accelerator = new Accelerator();

test('parses accelerator strings into modifier flags', () => {
    expect(accelerator.parseAccelerator('CommandOrControl+Z')).toEqual({
        mods: { ctrl: true, alt: false, shift: false, meta: false },
        key: 'Z',
    });
    expect(accelerator.parseAccelerator('Ctrl+Shift+F8')).toEqual({
        mods: { ctrl: true, alt: false, shift: true, meta: false },
        key: 'F8',
    });
});

test('matches DOM key events against accelerators', () => {
    const event = {
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        key: 'z',
        code: 'KeyZ',
    } as KeyboardEvent;
    expect(accelerator.matches(event, 'CommandOrControl+Z')).toBe(true);
    expect(accelerator.matches(event, 'F8')).toBe(false);
});

test('extracts the required modifier name', () => {
    expect(accelerator.modifierName('Alt')).toBe('alt');
    expect(accelerator.modifierName('Shift')).toBe('shift');
    expect(accelerator.modifierName('F8')).toBeUndefined();
});

test('detects modifier key presses', () => {
    expect(accelerator.isModifierKey({ code: 'AltRight' } as KeyboardEvent, 'alt')).toBe(true);
    expect(accelerator.isModifierKey({ code: 'ShiftLeft' } as KeyboardEvent, 'alt')).toBe(false);
});

test('treats held modifiers as active even without a modifier flag', () => {
    const held = new Set(['ctrl'] as const);
    expect(
        accelerator.isActive(
            { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false },
            'ctrl',
            held,
        ),
    ).toBe(true);
    expect(
        accelerator.isActive(
            { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false },
            'alt',
            held,
        ),
    ).toBe(false);
});

test('converts accelerators to GNOME bindings', () => {
    expect(accelerator.toGnomeBinding('CommandOrControl+Shift+V')).toBe('<Control><Shift>V');
});
