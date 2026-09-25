let title = 'Annotate';

export function setAppTitle(next: string): void {
    title = next;
}

export const appPrefix = (): string => `${title}:`;
