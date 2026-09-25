import type { Command, CommandArguments } from '../Command.js';
import type { CommandResult } from '../CommandResult.js';
import type { WindowManager } from '../WindowManager.js';

export class ToggleApplicationCommand implements Command {
    constructor(private readonly windows: WindowManager) {}

    name(): string {
        return 'toggle';
    }

    description(): string {
        return 'Toggle the annotation layer visibility';
    }

    execute(_args: CommandArguments): CommandResult {
        this.windows.setVisible(!this.windows.isVisible());
        const visible = this.windows.isVisible();
        return {
            success: true,
            message: visible ? 'Annotation layer shown' : 'Annotation layer hidden',
            code: 0,
        };
    }
}
