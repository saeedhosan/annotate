import { app } from 'electron';
import type { OperatingSystemInformation } from './OperatingSystemInformation.js';

export class PlatformConfigure {
    constructor(private readonly os: OperatingSystemInformation) {}

    apply(): void {
        this.applyWayland();
        this.applyX11();
        this.applyWindows();
        this.applyMacOS();
    }

    applyWayland(): void {
        if (!this.isWayland()) return;
        app.commandLine.appendSwitch('disable-gpu-compositing');
        app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
        if (!process.env.DISPLAY) {
            app.commandLine.appendSwitch(
                'enable-features',
                'GlobalShortcutsPortal,GlobalShortcutsPortalPreferredTrigger',
            );
        }
    }

    applyX11(): void {
        if (!this.isX11()) return;
        app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
    }

    applyWindows(): void {
        if (!this.isWindows()) return;
        app.commandLine.appendSwitch('high-dpi-support', '1');
    }

    applyMacOS(): void {
        if (!this.isMacOS()) return;
        app.commandLine.appendSwitch('disable-renderer-backgrounding');
    }

    isWayland(): boolean {
        return this.os.isWayland() || process.env.XDG_SESSION_TYPE === 'wayland';
    }

    isX11(): boolean {
        return this.os.isX11() || process.env.XDG_SESSION_TYPE === 'x11';
    }

    isWindows(): boolean {
        return this.os.isWindows();
    }

    isMacOS(): boolean {
        return this.os.isMacOS();
    }
}
