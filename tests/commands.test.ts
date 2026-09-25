import { expect, test } from 'bun:test';
import { CommandLine } from '../src/main/CommandLine';
import type { CommandInput } from '../src/main/CommandInput';
import { HideApplicationCommand } from '../src/main/commands/HideApplicationCommand';
import { QuitApplicationCommand } from '../src/main/commands/QuitApplicationCommand';
import { ShowApplicationCommand } from '../src/main/commands/ShowApplicationCommand';
import { ToggleApplicationCommand } from '../src/main/commands/ToggleApplicationCommand';
import type { WindowManager } from '../src/main/WindowManager';

function fakeWindows(visible = false) {
    const calls: string[] = [];
    let state = visible;
    const manager = {
        setVisible(value: boolean): void {
            state = value;
            calls.push(`setVisible:${value}`);
        },
        isVisible(): boolean {
            return state;
        },
    } as unknown as WindowManager;
    return { calls, manager };
}

function quitter() {
    const calls: string[] = [];
    const handler = { quit: () => calls.push('quit') };
    return { calls, handler };
}

function input(name: string): CommandInput {
    return { name, arguments: [], options: {} };
}

function line(): CommandLine {
    return new CommandLine();
}

test('show command makes the layer visible', () => {
    const { calls, manager } = fakeWindows(false);
    const result = line().register(new ShowApplicationCommand(manager)).execute(input('show'));
    expect(result.success).toBe(true);
    expect(calls).toEqual(['setVisible:true']);
});

test('hide command makes the layer hidden', () => {
    const { calls, manager } = fakeWindows(true);
    const result = line().register(new HideApplicationCommand(manager)).execute(input('hide'));
    expect(result.success).toBe(true);
    expect(calls).toEqual(['setVisible:false']);
});

test('toggle command flips visibility', () => {
    const { calls, manager } = fakeWindows(false);
    const result = line().register(new ToggleApplicationCommand(manager)).execute(input('toggle'));
    expect(result.success).toBe(true);
    expect(calls).toEqual(['setVisible:true']);
    expect(result.message).toContain('shown');
});

test('toggle command hides when already visible', () => {
    const { calls, manager } = fakeWindows(true);
    const result = line().register(new ToggleApplicationCommand(manager)).execute(input('toggle'));
    expect(calls).toEqual(['setVisible:false']);
    expect(result.message).toContain('hidden');
});

test('quit command triggers the quitter', () => {
    const { calls, handler } = quitter();
    const result = line().register(new QuitApplicationCommand(handler)).execute(input('quit'));
    expect(result.success).toBe(true);
    expect(result.code).toBe(0);
    expect(calls).toEqual(['quit']);
});

test('commands can be dispatched with global flags', () => {
    const { calls, manager } = fakeWindows(false);
    const line = new CommandLine();
    line.register(new ShowApplicationCommand(manager));
    const parsed = line.parse(['--show', '--force']);
    expect(parsed.name).toBe('show');
    line.execute(parsed);
    expect(calls).toEqual(['setVisible:true']);
});
