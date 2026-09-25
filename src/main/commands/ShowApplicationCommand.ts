import type { Command, CommandArguments } from '../Command.js';
import type { CommandResult } from '../CommandResult.js';
import type { WindowManager } from '../WindowManager.js';

export class ShowApplicationCommand implements Command {
    constructor(private readonly windows: WindowManager) {}

    name(): string {
        return 'show';
    }

    description(): string {
        return 'Show the annotation layer';
    }

    execute(_args: CommandArguments): CommandResult {
        this.windows.setVisible(true);
        return { success: true, message: 'Annotation layer shown', code: 0 };
    }
}
