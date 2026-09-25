import { expect, test } from 'bun:test';
import { ApplicationConfig, type KeyBinding } from '../src/main/ApplicationConfig';
import type { Command } from '../src/main/Command';
import type { CommandResult } from '../src/main/CommandResult';

const stub: Command = {
    name: () => 'show',
    description: () => 'Shows the layer',
    execute: (): CommandResult => ({ success: true, code: 0 }),
};

const bindings: KeyBinding[] = [
    { id: 'toggle-overlay', accelerator: 'F8' },
    { id: 'new-canvas', accelerator: 'Ctrl+N' },
];

const palette = { red: '#ff0000', blue: '#0000ff' };

test('stores and returns configuration', () => {
    const config = new ApplicationConfig('Annotate', '1.2.3', 'dark', palette, [stub], bindings);
    expect(config.name()).toBe('Annotate');
    expect(config.version()).toBe('1.2.3');
    expect(config.theme()).toBe('dark');
    expect(config.colors()).toEqual(palette);
    expect(config.commands()).toEqual([stub]);
    expect(config.keyBindings()).toEqual(bindings);
});

test('trims name and version', () => {
    const config = new ApplicationConfig('  Annotate  ', ' 1.2.3 ', 'light', palette, [], bindings);
    expect(config.name()).toBe('Annotate');
    expect(config.version()).toBe('1.2.3');
});

test('rejects an empty name', () => {
    expect(() => new ApplicationConfig('', '1.0.0', 'dark', palette, [], bindings)).toThrow(
        /name must not be empty/,
    );
});

test('rejects an empty version', () => {
    expect(() => new ApplicationConfig('Annotate', '  ', 'dark', palette, [], bindings)).toThrow(
        /version must be present/,
    );
});

test('rejects unsupported themes', () => {
    expect(() => new ApplicationConfig('Annotate', '1.0.0', 'neon', palette, [], bindings)).toThrow(
        /Unsupported theme/,
    );
});

test('rejects an empty palette', () => {
    expect(() => new ApplicationConfig('Annotate', '1.0.0', 'dark', {}, [], bindings)).toThrow(
        /color palette must be provided/,
    );
});

test('rejects non-command entries', () => {
    expect(
        () =>
            new ApplicationConfig(
                'Annotate',
                '1.0.0',
                'dark',
                palette,
                [{ nope: true } as never],
                [],
            ),
    ).toThrow(/valid command instances/);
});

test('rejects duplicate command names', () => {
    expect(
        () => new ApplicationConfig('Annotate', '1.0.0', 'dark', palette, [stub, stub], []),
    ).toThrow(/Duplicate command name: show/);
});

test('rejects duplicate key binding ids', () => {
    const duplicate = [
        { id: 'toggle-overlay', accelerator: 'F8' },
        { id: 'toggle-overlay', accelerator: 'F9' },
    ];
    expect(
        () => new ApplicationConfig('Annotate', '1.0.0', 'dark', palette, [], duplicate),
    ).toThrow(/Duplicate key binding id/);
});

test('rejects conflicting accelerators', () => {
    const conflicting = [
        { id: 'toggle-overlay', accelerator: 'F8' },
        { id: 'new-canvas', accelerator: 'F8' },
    ];
    expect(
        () => new ApplicationConfig('Annotate', '1.0.0', 'dark', palette, [], conflicting),
    ).toThrow(/Conflicting key binding accelerator/);
});

test('rejects key bindings without an accelerator', () => {
    const missing = [{ id: 'toggle-overlay', accelerator: '  ' }];
    expect(() => new ApplicationConfig('Annotate', '1.0.0', 'dark', palette, [], missing)).toThrow(
        /must define an accelerator/,
    );
});

test('returns defensive copies', () => {
    const config = new ApplicationConfig('Annotate', '1.0.0', 'dark', palette, [stub], bindings);
    config.colors().red = '#000000';
    config.keyBindings()[0].accelerator = 'F9';
    expect(config.colors().red).toBe('#ff0000');
    expect(config.keyBindings()[0].accelerator).toBe('F8');
});
