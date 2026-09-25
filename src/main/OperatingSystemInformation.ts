import os from 'node:os';

export class OperatingSystemInformation {
    constructor(
        readonly platform: string,
        readonly name: string,
        readonly version: string,
        readonly release: string,
        readonly architecture: string,
        readonly session: string | null,
        readonly desktopEnvironment: string | null,
        readonly displayServer: string | null,
    ) {}

    static fromRuntime(): OperatingSystemInformation {
        const session =
            process.env.XDG_SESSION_TYPE ??
            (process.platform === 'darwin'
                ? 'macos'
                : process.platform === 'win32'
                  ? 'windows'
                  : null);
        const desktopEnvironment = process.env.XDG_CURRENT_DESKTOP ?? null;
        const displayServer = detectDisplayServer();
        return new OperatingSystemInformation(
            process.platform,
            platformLabel(process.platform),
            os.version(),
            os.release(),
            os.arch(),
            session,
            desktopEnvironment,
            displayServer,
        );
    }

    isLinux(): boolean {
        return this.platform === 'linux';
    }

    isWindows(): boolean {
        return this.platform === 'win32';
    }

    isMacOS(): boolean {
        return this.platform === 'darwin';
    }

    isWayland(): boolean {
        return this.session?.toLowerCase() === 'wayland' || this.displayServer === 'wayland';
    }

    isX11(): boolean {
        return this.session?.toLowerCase() === 'x11' || this.displayServer === 'x11';
    }
}

function platformLabel(platform: string): string {
    switch (platform) {
        case 'linux':
            return 'Linux';
        case 'darwin':
            return 'macOS';
        case 'win32':
            return 'Windows';
        default:
            return platform;
    }
}

function detectDisplayServer(): string | null {
    if (process.env.WAYLAND_DISPLAY) return 'wayland';
    if (process.env.XDG_SESSION_TYPE === 'wayland') return 'wayland';
    if (process.env.DISPLAY) return 'x11';
    return null;
}
