import { app, globalShortcut } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { app as appConfig } from '../config/app.js';
import { Accelerator } from './Accelerator.js';
import { logger } from '../lib/logger.js';
import type { OperatingSystemInformation } from './OperatingSystemInformation.js';
import type { WindowManager } from './WindowManager.js';

const SHIM_PATH = `/usr/bin/${appConfig.slug}`;
const TOGGLE_ARG = '--toggle';
const QUIT_ARG = '--quit';
const QUIT_BINDING = 'Ctrl+F8';

export interface ShortcutConfig {
    toggle: string;
    newCanvas: string;
}

export class ShortcutManager {
    private readonly registered = new Set<string>();
    private readonly agentBindings: string[] = [];

    constructor(
        private readonly windows: WindowManager,
        private readonly config: ShortcutConfig,
        private readonly os: OperatingSystemInformation,
        private readonly onQuit?: () => void,
    ) {}

    register(): void {
        this.registerToggleShortcut();
        this.registerNewCanvas();
    }

    unregister(): void {
        this.unregisterToggleShortcut();
        this.unregisterNewCanvas();
        for (const binding of this.agentBindings) {
            try {
                globalShortcut.unregister(binding);
            } catch {
                // Ignore cleanup failures during shutdown.
            }
        }
        this.agentBindings.length = 0;
    }

    registerToggleShortcut(): void {
        if (!app.isPackaged) {
            logger.info('toggle shortcut is only registered for a packaged build.');
            return;
        }
        if (this.registerDirectToggle()) {
            this.registerDirectQuit();
            return;
        }
        this.registerPlatformToggle();
    }

    private registerDirectToggle(): boolean {
        if (this.registered.has(this.config.toggle)) return true;
        try {
            if (
                !globalShortcut.register(this.config.toggle, () =>
                    this.windows.setVisible(!this.windows.isVisible()),
                )
            ) {
                return false;
            }
            this.registered.add(this.config.toggle);
            logger.info(`${this.config.toggle} toggle shortcut registered.`);
            return true;
        } catch (err) {
            logger.warn(`${this.config.toggle} registration threw:`, err);
            return false;
        }
    }

    private registerDirectQuit(): void {
        if (!this.onQuit || this.registered.has(QUIT_BINDING)) return;
        try {
            if (globalShortcut.register(QUIT_BINDING, this.onQuit)) {
                this.registered.add(QUIT_BINDING);
                logger.info(`${QUIT_BINDING} quit shortcut registered.`);
            } else {
                logger.warn(`${QUIT_BINDING} already held by another application.`);
            }
        } catch (err) {
            logger.warn(`${QUIT_BINDING} registration threw:`, err);
        }
    }

    private registerPlatformToggle(): void {
        if (this.os.isWindows() || this.os.isMacOS()) {
            this.registerLoginAgent();
            return;
        }
        if (!this.os.isLinux()) return;
        if (process.env.APPIMAGE) return;
        if (process.env.NODE_ENV === 'test') return;
        const mode = app.isPackaged ? '' : '-dev';
        const toggleName = `${appConfig.slug}${mode}`;
        const quitName = `${appConfig.slug}-quit${mode}`;
        this.registerDconf(
            toggleName,
            this.toGnomeBinding(this.config.toggle),
            this.buildCommand(TOGGLE_ARG),
        );
        this.registerDconf(
            quitName,
            this.toGnomeBinding(QUIT_BINDING),
            this.buildCommand(QUIT_ARG),
        );
        this.ensureDconfIds([this.dconfId(toggleName), this.dconfId(quitName)]);
    }

    private dconfId(name: string): string {
        return `'/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/${name}/'`;
    }

    private buildCommand(...args: string[]): string {
        const binary = app.isPackaged && this.usesPathShim() ? SHIM_PATH : process.execPath;
        if (app.isPackaged) return `${binary} ${args.join(' ')}`;
        return `${binary} ${app.getAppPath()} ${args.join(' ')}`;
    }

    registerNewCanvas(): void {
        if (this.registered.has(this.config.newCanvas)) return;
        try {
            if (
                globalShortcut.register(
                    this.config.newCanvas,
                    () => void this.windows.promptForNewCanvas(),
                )
            ) {
                this.registered.add(this.config.newCanvas);
                logger.info(`${this.config.newCanvas} new-canvas shortcut registered.`);
            } else {
                logger.warn(`could not register ${this.config.newCanvas} global shortcut.`);
            }
        } catch (err) {
            logger.warn(`${this.config.newCanvas} registration threw:`, err);
        }
    }

    unregisterToggleShortcut(): void {
        this.unregisterBinding(this.config.toggle);
        this.unregisterBinding(QUIT_BINDING);
    }

    unregisterNewCanvas(): void {
        this.unregisterBinding(this.config.newCanvas);
    }

    runAgent(): void {
        if (this.os.isMacOS()) app.dock?.hide();
        if (this.registerAgentBinding(this.config.toggle, spawnToggle)) {
            logger.info(`${this.config.toggle} toggle shortcut registered.`);
        } else {
            logger.warn(`${this.config.toggle} already held by another process.`);
        }
        if (this.registerAgentBinding(QUIT_BINDING, spawnQuit)) {
            logger.info(`${QUIT_BINDING} quit shortcut registered.`);
        } else {
            logger.warn(
                `${QUIT_BINDING} already held or unsupported; quitting shortcut will be unavailable.`,
            );
        }
        if (this.agentBindings.length === 0) {
            logger.warn(`no global shortcuts available; agent exiting.`);
            app.quit();
        }
    }

    usesPathShim(): boolean {
        try {
            return (
                existsSync(SHIM_PATH) && realpathSync(SHIM_PATH) === realpathSync(process.execPath)
            );
        } catch {
            return false;
        }
    }

    registerDconf(name: string, binding: string, command: string): void {
        const schema = 'org.gnome.settings-daemon.plugins.media-keys';
        const keyPath = `/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/${name}/`;
        const key = `${schema}.custom-keybinding:${keyPath}`;
        gsettings(['set', key, 'command', command], (err) => {
            if (err) {
                logger.warn(`gsettings unavailable; ${binding} shortcut not registered.`);
                return;
            }
            gsettings(['set', key, 'binding', binding], (err) => {
                if (err) {
                    logger.warn(`gsettings unavailable; ${binding} binding not registered.`);
                }
            });
        });
    }

    ensureDconfIds(ids: string[]): void {
        const schema = 'org.gnome.settings-daemon.plugins.media-keys';
        gsettings(['get', schema, 'custom-keybindings'], (err, out) => {
            if (err) {
                logger.warn(`gsettings unavailable; shortcut list not registered.`);
                return;
            }
            let list = out?.trim() ?? '[]';
            const typePrefix = list.match(/^@[\w-]+ (.*)$/);
            if (typePrefix) list = typePrefix[1];
            let changed = false;
            for (const id of ids) {
                if (!list.includes(id)) {
                    list = list === '[]' ? `[${id}]` : `${list.slice(0, -1)}, ${id}]`;
                    changed = true;
                }
            }
            if (!changed) {
                logger.info(`shortcuts are active.`);
                return;
            }
            gsettings(['set', schema, 'custom-keybindings', list], (err) => {
                if (err) {
                    logger.warn(`gsettings unavailable; shortcut list not registered.`);
                } else {
                    logger.info(`shortcut list registered.`);
                }
            });
        });
    }

    private registerAgentBinding(binding: string, callback: () => void): boolean {
        if (globalShortcut.register(binding, callback)) {
            this.agentBindings.push(binding);
            return true;
        }
        return false;
    }

    private registerLoginAgent(): void {
        try {
            app.setLoginItemSettings({ openAtLogin: true, args: ['--agent'] });
            logger.info(`toggle agent added to login items.`);
        } catch (err) {
            logger.warn(`could not enable launch at login:`, err);
        }
        spawnToggle();
    }

    private unregisterBinding(binding: string): void {
        if (!this.registered.has(binding)) return;
        try {
            globalShortcut.unregister(binding);
        } catch {
            // Ignore cleanup failures during shutdown.
        }
        this.registered.delete(binding);
    }

    private toGnomeBinding(binding: string): string {
        return Accelerator.parse(binding).toGnomeBinding();
    }
}

function launch(args: string[]): void {
    const launchArgs = app.isPackaged ? args : [app.getAppPath(), ...args];
    const child = spawn(process.execPath, launchArgs, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });
    child.unref();
}

function spawnToggle(): void {
    launch([TOGGLE_ARG]);
}

function spawnQuit(): void {
    launch([QUIT_ARG]);
}

function gsettings(args: string[], callback: (err: Error | null, out?: string) => void): void {
    execFile('gsettings', args, { encoding: 'utf8' }, (err, stdout) =>
        callback(err ?? null, stdout as string),
    );
}
