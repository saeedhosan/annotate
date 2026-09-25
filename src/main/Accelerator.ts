import { Modifier, type KeyboardInput } from './Modifier.js';

const CANONICAL_ORDER: readonly Modifier[] = [
    Modifier.Control,
    Modifier.Alt,
    Modifier.Shift,
    Modifier.Meta,
    Modifier.CommandOrControl,
];

const MODIFIER_KEY_NAMES = new Set([
    'alt',
    'ctrl',
    'control',
    'shift',
    'meta',
    'super',
    'command',
    'cmd',
    'option',
]);

export class Accelerator {
    constructor(
        readonly key: string,
        readonly modifiers: Modifier[],
    ) {}

    static parse(value: string): Accelerator {
        const parts = value
            .split('+')
            .map((part) => part.trim())
            .filter((part) => part !== '');
        if (parts.length === 0) throw new Error(`Invalid accelerator: ${value}`);
        const modifiers: Modifier[] = [];
        let key = '';
        for (const part of parts) {
            const token = part.toLowerCase();
            if (['ctrl', 'control'].includes(token)) {
                addModifier(modifiers, Modifier.Control, value);
            } else if (['commandorcontrol', 'cmdorctrl', 'cmdctrl'].includes(token)) {
                addModifier(modifiers, Modifier.CommandOrControl, value);
            } else if (['command', 'cmd', 'meta', 'super', 'win'].includes(token)) {
                addModifier(modifiers, Modifier.Meta, value);
            } else if (['alt', 'option'].includes(token)) {
                addModifier(modifiers, Modifier.Alt, value);
            } else if (token === 'shift') {
                addModifier(modifiers, Modifier.Shift, value);
            } else {
                if (key !== '') throw new Error(`Invalid accelerator: ${value}`);
                key = part;
            }
        }
        if (!key) throw new Error(`Accelerator is missing a key: ${value}`);
        modifiers.sort((a, b) => CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b));
        return new Accelerator(key, modifiers);
    }

    matches(input: KeyboardInput): boolean {
        if (this.key.toLowerCase() !== input.key.toLowerCase()) return false;
        return this.modifiers.every((modifier) => modifierMatches(modifier, input));
    }

    modifierName(): string {
        const primary = this.modifiers[0];
        if (primary) return primary;
        return this.key;
    }

    isModifierKey(): boolean {
        return MODIFIER_KEY_NAMES.has(this.key.toLowerCase());
    }

    isActive(): boolean {
        if (this.key === '') return false;
        if (isFunctionOrNavigationKey(this.key)) return true;
        return this.modifiers.length > 0;
    }

    toGnomeBinding(): string {
        let prefix = '';
        for (const modifier of this.modifiers) {
            if (modifier === Modifier.Control || modifier === Modifier.CommandOrControl) {
                prefix += '<Control>';
            } else if (modifier === Modifier.Alt) {
                prefix += '<Alt>';
            } else if (modifier === Modifier.Shift) {
                prefix += '<Shift>';
            } else if (modifier === Modifier.Meta) {
                prefix += '<Super>';
            }
        }
        return `${prefix}${this.key}`;
    }
}

function modifierMatches(modifier: Modifier, input: KeyboardInput): boolean {
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

function addModifier(modifiers: Modifier[], modifier: Modifier, value: string): void {
    if (modifiers.includes(modifier)) {
        throw new Error(`Duplicate modifier in accelerator: ${value}`);
    }
    modifiers.push(modifier);
}

function isFunctionOrNavigationKey(key: string): boolean {
    return /^(F\d{1,2}|Escape|Space|Enter|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Arrow(Up|Down|Left|Right))$/i.test(
        key,
    );
}
