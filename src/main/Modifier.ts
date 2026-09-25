import type { OperatingSystemInformation } from './OperatingSystemInformation.js';

export enum Modifier {
    Control = 'Control',
    Alt = 'Alt',
    Shift = 'Shift',
    Meta = 'Meta',
    CommandOrControl = 'CommandOrControl',
}

export const MODIFIERS: readonly Modifier[] = [
    Modifier.Control,
    Modifier.Alt,
    Modifier.Shift,
    Modifier.Meta,
    Modifier.CommandOrControl,
];

export interface ModifierKey {
    name: string;
    code: string;
}

export interface KeyboardInput {
    key: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
}

export function isModifier(value: string): value is Modifier {
    return MODIFIERS.includes(value as Modifier);
}

export function modifierMatches(modifier: Modifier, input: KeyboardInput): boolean {
    switch (modifier) {
        case Modifier.Control:
            return input.ctrlKey;
        case Modifier.Alt:
            return input.altKey;
        case Modifier.Shift:
            return input.shiftKey;
        case Modifier.Meta:
            return input.metaKey;
        case Modifier.CommandOrControl:
            return input.ctrlKey || input.metaKey;
    }
}

export function isModifierPlatformIndependent(modifier: Modifier): boolean {
    return modifier !== Modifier.CommandOrControl;
}

export function resolveModifier(modifier: Modifier, os: OperatingSystemInformation): ModifierKey {
    switch (modifier) {
        case Modifier.Control:
            return { name: 'Control', code: 'Control' };
        case Modifier.Alt:
            return { name: 'Alt', code: 'Alt' };
        case Modifier.Shift:
            return { name: 'Shift', code: 'Shift' };
        case Modifier.Meta:
            return os.isMacOS()
                ? { name: 'Command', code: 'Meta' }
                : { name: 'Super', code: 'Meta' };
        case Modifier.CommandOrControl:
            return os.isMacOS()
                ? { name: 'Command', code: 'Meta' }
                : { name: 'Control', code: 'Control' };
    }
}
