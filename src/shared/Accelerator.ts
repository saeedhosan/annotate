export interface Modifiers {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
}

export type ModifierName = 'ctrl' | 'alt' | 'shift' | 'meta';

export type ModifierState = {
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
};

export class Accelerator {
    parseAccelerator(accelerator: string): { mods: Modifiers; key: string } {
        const mods: Modifiers = {
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        let key = '';
        for (const part of accelerator.split('+').map((piece) => piece.trim())) {
            const token = part.toLowerCase();
            if (['ctrl', 'control', 'commandorcontrol', 'cmdorctrl', 'cmdctrl'].includes(token))
                mods.ctrl = true;
            else if (['command', 'cmd', 'meta', 'super', 'win'].includes(token)) mods.meta = true;
            else if (['alt', 'option'].includes(token)) mods.alt = true;
            else if (token === 'shift') mods.shift = true;
            else key = part;
        }
        return { mods, key };
    }

    matches(event: KeyboardEvent, accelerator: string): boolean {
        const { mods, key } = this.parseAccelerator(accelerator);
        if (event.ctrlKey !== mods.ctrl) return false;
        if (event.altKey !== mods.alt) return false;
        if (event.shiftKey !== mods.shift) return false;
        if (event.metaKey !== mods.meta) return false;
        if (!key) return true;
        const normalized = key.toLowerCase();
        if (/^[a-z0-9]$/.test(normalized)) {
            if (event.code === `Key${key.toUpperCase()}`) return true;
            if (/^[0-9]$/.test(normalized) && event.code === `Digit${key.toUpperCase()}`)
                return true;
            return event.key.toLowerCase() === normalized;
        }
        return event.code === key || event.key === key;
    }

    modifierName(accelerator: string): ModifierName | undefined {
        const { mods } = this.parseAccelerator(accelerator);
        if (mods.shift) return 'shift';
        if (mods.alt) return 'alt';
        if (mods.ctrl) return 'ctrl';
        if (mods.meta) return 'meta';
        return undefined;
    }

    isModifierKey(event: KeyboardEvent, mod: ModifierName): boolean {
        switch (mod) {
            case 'ctrl':
                return event.code === 'ControlLeft' || event.code === 'ControlRight';
            case 'alt':
                return event.code === 'AltLeft' || event.code === 'AltRight';
            case 'shift':
                return event.code === 'ShiftLeft' || event.code === 'ShiftRight';
            case 'meta':
                return event.code === 'MetaLeft' || event.code === 'MetaRight';
        }
    }

    isActive(event: ModifierState, mod: ModifierName, held: ReadonlySet<ModifierName>): boolean {
        switch (mod) {
            case 'ctrl':
                return event.ctrlKey || held.has('ctrl');
            case 'alt':
                return event.altKey || held.has('alt');
            case 'shift':
                return event.shiftKey || held.has('shift');
            case 'meta':
                return event.metaKey || held.has('meta');
        }
    }

    toGnomeBinding(accelerator: string): string {
        const { mods, key } = this.parseAccelerator(accelerator);
        let prefix = '';
        if (mods.ctrl) prefix += '<Control>';
        if (mods.alt) prefix += '<Alt>';
        if (mods.shift) prefix += '<Shift>';
        if (mods.meta) prefix += '<Super>';
        return prefix + key;
    }
}
