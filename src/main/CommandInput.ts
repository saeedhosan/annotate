export interface CommandInput {
    name: string | null;
    arguments: string[];
    options: Record<string, string | boolean>;
}
