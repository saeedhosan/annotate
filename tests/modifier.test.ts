import { expect, test } from 'bun:test';
import { OperatingSystemInformation } from '../src/main/OperatingSystemInformation';
import {
    isModifier,
    isModifierPlatformIndependent,
    Modifier,
    modifierMatches,
    resolveModifier,
    type KeyboardInput,
} from '../src/main/Modifier';

const mac = new OperatingSystemInformation(
    'darwin',
    'macOS',
    '0.0.0',
    'release',
    'arm64',
    null,
    null,
    null,
);
const linux = new OperatingSystemInformation(
    'linux',
    'Linux',
    '0.0.0',
    'release',
    'x64',
    null,
    null,
    null,
);

test('isModifier recognizes members', () => {
    expect(isModifier(Modifier.Control)).toBe(true);
    expect(isModifier('CommandOrControl')).toBe(true);
    expect(isModifier('Win')).toBe(false);
});

test('modifierMatches checks keyboard input state', () => {
    const input: KeyboardInput = {
        key: 'a',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
    };
    expect(modifierMatches(Modifier.Control, input)).toBe(true);
    expect(modifierMatches(Modifier.Alt, input)).toBe(false);
    expect(modifierMatches(Modifier.Shift, input)).toBe(false);
});

test('command-or-control accepts either control or meta', () => {
    const input: KeyboardInput = {
        key: 'n',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: true,
    };
    expect(modifierMatches(Modifier.CommandOrControl, input)).toBe(true);
});

test('platform independent excludes command-or-control', () => {
    expect(isModifierPlatformIndependent(Modifier.Control)).toBe(true);
    expect(isModifierPlatformIndependent(Modifier.CommandOrControl)).toBe(false);
});

test('resolveModifier on mac resolves command-or-control and meta to Command', () => {
    expect(resolveModifier(Modifier.CommandOrControl, mac)).toEqual({
        name: 'Command',
        code: 'Meta',
    });
    expect(resolveModifier(Modifier.Meta, mac)).toEqual({ name: 'Command', code: 'Meta' });
});

test('resolveModifier on linux resolves command-or-control to Control', () => {
    expect(resolveModifier(Modifier.CommandOrControl, linux)).toEqual({
        name: 'Control',
        code: 'Control',
    });
    expect(resolveModifier(Modifier.Meta, linux)).toEqual({ name: 'Super', code: 'Meta' });
    expect(resolveModifier(Modifier.Alt, linux)).toEqual({ name: 'Alt', code: 'Alt' });
});
