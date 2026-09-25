import type { Command, CommandArguments } from '../Command.js';
import type { CommandResult } from '../CommandResult.js';

export interface QuitHandler {
    quit(): void;
}

export class QuitApplicationCommand implements Command {
    constructor(private readonly quitter: QuitHandler) {}

    name(): string {
        return 'quit';
    }

    description(): string {
        return 'Quit the application';
    }

    execute(_args: CommandArguments): CommandResult {
        this.quitter.quit();
        return { success: true, message: 'Quitting application', code: 0 };
    }
}
