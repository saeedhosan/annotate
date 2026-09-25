import type { Command, CommandArguments } from './Command.js';
import type { CommandInput } from './CommandInput.js';

export class CommandLine {
    private readonly registry = new Map<string, Command>();
    private agentMode = false;

    isRunningAgentMode(): boolean {
        return this.agentMode;
    }

    register(command: Command): CommandLine {
        const name = command.name();
        if (this.registry.has(name)) {
            throw new Error(`Command already registered: ${name}`);
        }
        this.registry.set(name, command);
        return this;
    }

    registerMany(commands: Command[]): CommandLine {
        for (const command of commands) this.register(command);
        return this;
    }

    commands(): Command[] {
        return [...this.registry.values()];
    }

    has(name: string): boolean {
        return this.registry.has(name);
    }

    parse(argv: string[]): CommandInput {
        this.agentMode = false;
        const positional: string[] = [];
        const options: Record<string, string | boolean> = {};
        let name: string | null = null;
        for (const raw of argv) {
            const token = raw.trim();
            if (token === '--help' || token === '-h') {
                options['help'] = true;
                continue;
            }
            if (token === '--agent') {
                options['agent'] = true;
                this.agentMode = true;
                continue;
            }
            const option = parseOption(token);
            if (option) {
                if (this.has(option.key) && name === null) {
                    name = option.key;
                } else {
                    options[option.key] = option.value ?? true;
                }
                continue;
            }
            if (name === null && this.has(token)) {
                name = token;
                continue;
            }
            positional.push(token);
        }
        return { name, arguments: positional, options };
    }

    resolve(input: CommandInput): Command | null {
        if (!input.name) return null;
        return this.registry.get(input.name) ?? null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(input: CommandInput): any {
        if (input.options.help) {
            return { success: true, message: this.help(), code: 0 };
        }
        const command = this.resolve(input);
        if (!command) {
            return {
                success: false,
                message: input.name ? `Unknown command: ${input.name}` : 'No command supplied',
                code: 1,
            };
        }
        const args: CommandArguments = { arguments: input.arguments, options: input.options };
        try {
            return command.execute(args);
        } catch (err) {
            return {
                success: false,
                message: err instanceof Error ? err.message : String(err),
                code: 1,
            };
        }
    }

    help(): string {
        const commands = this.commands();
        const lines = ['Available commands:'];
        if (commands.length === 0) lines.push('  (none)');
        for (const command of commands) {
            lines.push(`  ${command.name().padEnd(12)} ${command.description()}`);
        }
        return lines.join('\n');
    }
}

function parseOption(token: string): { key: string; value?: string } | null {
    if (token.startsWith('--')) {
        const body = token.slice(2);
        if (body === '') return null;
        const equal = body.indexOf('=');
        if (equal >= 0) return { key: body.slice(0, equal), value: body.slice(equal + 1) };
        return { key: body };
    }
    if (token.startsWith('-') && token.length > 1) return { key: token.slice(1) };
    return null;
}
