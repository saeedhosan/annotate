import { expect, test } from 'bun:test';
import { Accelerator } from '../src/main/Accelerator';
import { Modifier, type KeyboardInput } from '../src/main/Modifier';

function input(overrides: Partial<KeyboardInput> = {}): KeyboardInput {
    return {
        key: 'f8',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        ...overrides,
    };
}

test('parses modifiers in canonical order', () => {
    const accelerator = Accelerator.parse('Shift+Ctrl+F8');
    expect(accelerator.key).toBe('F8');
    expect(accelerator.modifiers).toEqual([Modifier.Control, Modifier.Shift]);
});

test('parses command-or-control and meta aliases', () => {
    expect(Accelerator.parse('CmdOrCtrl+N').modifiers).toEqual([Modifier.CommandOrControl]);
    expect(Accelerator.parse('Super+K').modifiers).toEqual([Modifier.Meta]);
    expect(Accelerator.parse('Command+S').modifiers).toEqual([Modifier.Meta]);
    expect(Accelerator.parse('Option+P').modifiers).toEqual([Modifier.Alt]);
});

test('rejects empty accelerators', () => {
    expect(() => Accelerator.parse('')).toThrow(/Invalid accelerator/);
    expect(() => Accelerator.parse('+++')).toThrow(/Invalid accelerator/);
});

test('rejects duplicate modifiers', () => {
    expect(() => Accelerator.parse('Ctrl+Control+F8')).toThrow(/Duplicate modifier/);
});

test('rejects accelerators without a key', () => {
    expect(() => Accelerator.parse('Ctrl+')).toThrow(/missing a key/);
});

test('rejects accelerators with multiple keys', () => {
    expect(() => Accelerator.parse('Ctrl+F8+Q')).toThrow(/Invalid accelerator/);
});

test('matches a keyboard input', () => {
    const accelerator = Accelerator.parse('Ctrl+Shift+A');
    expect(accelerator.matches(input({ key: 'A', ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(accelerator.matches(input({ key: 'a', ctrlKey: true, shiftKey: false }))).toBe(false);
    expect(accelerator.matches(input({ key: 'B', ctrlKey: true, shiftKey: true }))).toBe(false);
});

test('command-or-control matches ctrl or meta', () => {
    const accelerator = Accelerator.parse('CommandOrControl+N');
    expect(accelerator.matches(input({ key: 'n', ctrlKey: true }))).toBe(true);
    expect(accelerator.matches(input({ key: 'n', metaKey: true }))).toBe(true);
    expect(accelerator.matches(input({ key: 'n' }))).toBe(false);
});

test('reports the primary modifier name', () => {
    expect(Accelerator.parse('Ctrl+F8').modifierName()).toBe(Modifier.Control);
    expect(Accelerator.parse('F8').modifierName()).toBe('F8');
});

test('recognizes modifier keys', () => {
    expect(new Accelerator('Shift', []).isModifierKey()).toBe(true);
    expect(Accelerator.parse('Ctrl+F8').isModifierKey()).toBe(false);
});

test('funciton and navigation keys are active without modifiers', () => {
    expect(Accelerator.parse('F8').isActive()).toBe(true);
    expect(Accelerator.parse('Escape').isActive()).toBe(true);
    expect(Accelerator.parse('Ctrl+A').isActive()).toBe(true);
    expect(Accelerator.parse('A').isActive()).toBe(false);
});

test('converts to gnome binding', () => {
    expect(Accelerator.parse('F8').toGnomeBinding()).toBe('F8');
    expect(Accelerator.parse('Ctrl+F8').toGnomeBinding()).toBe('<Control>F8');
    expect(Accelerator.parse('Ctrl+Shift+N').toGnomeBinding()).toBe('<Control><Shift>N');
    expect(Accelerator.parse('Meta+Alt+F8').toGnomeBinding()).toBe('<Alt><Super>F8');
});
