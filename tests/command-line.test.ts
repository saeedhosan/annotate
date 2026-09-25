import { expect, test } from 'bun:test';
import type { Command, CommandArguments } from '../src/main/Command';
import type { CommandResult } from '../src/main/CommandResult';
import { CommandLine } from '../src/main/CommandLine';

function stub(name: string): Command {
    return {
        name: () => name,
        description: () => `runs ${name}`,
        execute: ({ arguments: args }: CommandArguments): CommandResult => ({
            success: true,
            message: `${name}:${args.join(',')}`,
            code: 0,
        }),
    };
}

const failing = (message: string): Command => ({
    name: () => 'boom',
    description: () => 'fails',
    execute: (): CommandResult => {
        throw new Error(message);
    },
});

test('registers commands and reports presence', () => {
    const line = new CommandLine();
    expect(line.has('show')).toBe(false);
    line.register(stub('show'));
    expect(line.has('show')).toBe(true);
});

test('registerMany registers each command', () => {
    const line = new CommandLine();
    line.registerMany([stub('show'), stub('hide')]);
    expect(line.commands().map((command) => command.name())).toEqual(['show', 'hide']);
});

test('duplicate registration throws', () => {
    const line = new CommandLine();
    line.register(stub('toggle'));
    expect(() => line.register(stub('toggle'))).toThrow(/already registered/);
});

test('parses a positional command by name', () => {
    const line = new CommandLine();
    line.register(stub('toggle'));
    const input = line.parse(['--toggle']);
    expect(input.name).toBe('toggle');
    expect(input.arguments).toEqual([]);
    expect(input.options).toEqual({});
});

test('parses bare command names and options', () => {
    const line = new CommandLine();
    line.register(stub('quit'));
    const input = line.parse(['quit', '--force']);
    expect(input.name).toBe('quit');
    expect(input.arguments).toEqual([]);
    expect(input.options).toEqual({ force: true });
});

test('parses option values with equals syntax', () => {
    const line = new CommandLine();
    const input = line.parse(['--agent']);
    expect(input.options.agent).toBe(true);
});

test('positional arguments are collected', () => {
    const line = new CommandLine();
    line.register(stub('show'));
    const input = line.parse(['show', 'extra']);
    expect(input.arguments).toEqual(['extra']);
});

test('help flag is recognized', () => {
    const line = new CommandLine();
    const input = line.parse(['--help']);
    expect(input.options.help).toBe(true);
    expect(line.execute(input).success).toBe(true);
});

test('agent mode flips the running flag', () => {
    const line = new CommandLine();
    expect(line.isRunningAgentMode()).toBe(false);
    line.parse(['--agent']);
    expect(line.isRunningAgentMode()).toBe(true);
    line.parse([]);
    expect(line.isRunningAgentMode()).toBe(false);
});

test('resolve returns the matching command', () => {
    const line = new CommandLine();
    const command = stub('show');
    line.register(command);
    expect(line.resolve({ name: 'show', arguments: [], options: {} })).toBe(command);
    expect(line.resolve({ name: 'missing', arguments: [], options: {} })).toBeNull();
    expect(line.resolve({ name: null, arguments: [], options: {} })).toBeNull();
});

test('execute runs the command with arguments', () => {
    const line = new CommandLine();
    line.register(stub('ping'));
    const result = line.execute({ name: 'ping', arguments: ['a', 'b'], options: {} });
    expect(result.success).toBe(true);
    expect(result.message).toBe('ping:a,b');
});

test('execute reports unknown commands', () => {
    const line = new CommandLine();
    const result = line.execute({ name: 'nope', arguments: [], options: {} });
    expect(result.success).toBe(false);
    expect(result.code).toBe(1);
    expect(result.message).toMatch(/Unknown command/);
});

test('execute reports when no command is supplied', () => {
    const line = new CommandLine();
    const result = line.execute({ name: null, arguments: [], options: {} });
    expect(result.success).toBe(false);
    expect(result.code).toBe(1);
});

test('execute catches command exceptions', () => {
    const line = new CommandLine();
    line.register(failing('kaboom'));
    const result = line.execute({ name: 'boom', arguments: [], options: {} });
    expect(result.success).toBe(false);
    expect(result.message).toBe('kaboom');
    expect(result.code).toBe(1);
});

test('help prints the command registry', () => {
    const line = new CommandLine();
    line.register(stub('hide'));
    line.register(stub('show'));
    const help = line.help();
    expect(help).toContain('Available commands:');
    expect(help).toContain('show');
    expect(help).toContain('hide');
});
