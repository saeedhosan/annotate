import type { Color } from '../shared/types/Color.js';
import type { Command } from './Command.js';

export type Theme = 'light' | 'dark' | 'system';

export type ColorPalette = Record<string, Color>;

export interface KeyBinding {
    id: string;
    accelerator: string;
}

const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

export class ApplicationConfig {
    private readonly nameValue: string;
    private readonly versionValue: string;
    private readonly themeValue: Theme;
    private readonly colorsValue: ColorPalette;
    private readonly commandsValue: readonly Command[];
    private readonly keyBindingsValue: readonly KeyBinding[];

    constructor(
        name: string,
        version: string,
        theme: Theme,
        colors: ColorPalette,
        commands: Command[],
        keyBindings: KeyBinding[],
    ) {
        validateName(name);
        validateVersion(version);
        validateTheme(theme);
        validateColors(colors);
        validateCommands(commands);
        validateKeyBindings(keyBindings);
        this.nameValue = name.trim();
        this.versionValue = version.trim();
        this.themeValue = theme;
        this.colorsValue = { ...colors };
        this.commandsValue = [...commands];
        this.keyBindingsValue = keyBindings.map((binding) => ({ ...binding }));
    }

    name(): string {
        return this.nameValue;
    }

    version(): string {
        return this.versionValue;
    }

    theme(): Theme {
        return this.themeValue;
    }

    colors(): ColorPalette {
        return { ...this.colorsValue };
    }

    commands(): Command[] {
        return [...this.commandsValue];
    }

    keyBindings(): KeyBinding[] {
        return this.keyBindingsValue.map((binding) => ({ ...binding }));
    }
}

function validateName(name: string): void {
    if (typeof name !== 'string' || name.trim() === '') {
        throw new Error('Application name must not be empty.');
    }
}

function validateVersion(version: string): void {
    if (typeof version !== 'string' || version.trim() === '') {
        throw new Error('Application version must be present.');
    }
}

function validateTheme(theme: Theme): void {
    if (!THEMES.includes(theme)) {
        throw new Error(`Unsupported theme: ${String(theme)}`);
    }
}

function validateColors(colors: ColorPalette): void {
    if (!colors || typeof colors !== 'object' || Object.keys(colors).length === 0) {
        throw new Error('A color palette must be provided.');
    }
}

function isCommand(value: unknown): value is Command {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Command;
    return (
        typeof candidate.name === 'function' &&
        typeof candidate.description === 'function' &&
        typeof candidate.execute === 'function'
    );
}

function validateCommands(commands: Command[]): void {
    if (!Array.isArray(commands)) {
        throw new Error('Commands must be provided as an array.');
    }
    const names = new Set<string>();
    for (const command of commands) {
        if (!isCommand(command)) {
            throw new Error('Commands must be valid command instances.');
        }
        const name = command.name();
        if (names.has(name)) {
            throw new Error(`Duplicate command name: ${name}`);
        }
        names.add(name);
    }
}

function validateKeyBindings(keyBindings: KeyBinding[]): void {
    if (!Array.isArray(keyBindings)) {
        throw new Error('Key bindings must be provided as an array.');
    }
    const ids = new Set<string>();
    const accelerators = new Set<string>();
    for (const binding of keyBindings) {
        if (!binding || typeof binding.id !== 'string' || binding.id.trim() === '') {
            throw new Error('Key binding must have a non-empty identifier.');
        }
        if (typeof binding.accelerator !== 'string' || binding.accelerator.trim() === '') {
            throw new Error(`Key binding ${binding.id} must define an accelerator.`);
        }
        if (ids.has(binding.id)) {
            throw new Error(`Duplicate key binding id: ${binding.id}`);
        }
        if (accelerators.has(binding.accelerator)) {
            throw new Error(`Conflicting key binding accelerator: ${binding.accelerator}`);
        }
        ids.add(binding.id);
        accelerators.add(binding.accelerator);
    }
}
