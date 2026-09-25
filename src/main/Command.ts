export interface CommandArguments {
    arguments: string[];
    options: Record<string, string | boolean>;
}

export interface Command {
    name(): string;
    description(): string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(args: CommandArguments): any;
}
