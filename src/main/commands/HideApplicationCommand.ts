import type { Command, CommandArguments } from '../Command.js';
import type { CommandResult } from '../CommandResult.js';
import type { WindowManager } from '../WindowManager.js';

export class HideApplicationCommand implements Command {
    constructor(private readonly windows: WindowManager) {}

    name(): string {
        return 'hide';
    }

    description(): string {
        return 'Hide the annotation layer';
    }

    execute(_args: CommandArguments): CommandResult {
        this.windows.setVisible(false);
        return { success: true, message: 'Annotation layer hidden', code: 0 };
    }
}
