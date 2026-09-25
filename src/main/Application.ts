import type { App, BrowserWindow } from 'electron';
import { nativeTheme, session, app } from 'electron';
import { app as identity } from '../config/app.js';
import { COLORS, PALETTE } from '../config/colors.js';
import { SHORTCUTS } from '../config/shortcuts.js';
import {
    ApplicationConfig,
    type ColorPalette,
    type KeyBinding,
    type Theme,
} from './ApplicationConfig.js';
import { ClipboardService } from './ClipboardService.js';
import { type Command } from './Command.js';
import type { CommandInput } from './CommandInput.js';
import { CommandLine } from './CommandLine.js';
import { HideApplicationCommand } from './commands/HideApplicationCommand.js';
import { QuitApplicationCommand } from './commands/QuitApplicationCommand.js';
import { ShowApplicationCommand } from './commands/ShowApplicationCommand.js';
import { ToggleApplicationCommand } from './commands/ToggleApplicationCommand.js';
import { IpcServer } from './IpcServer.js';
import { logger } from '../lib/logger.js';
import { OperatingSystemInformation } from './OperatingSystemInformation.js';
import { PlatformConfigure } from './PlatformConfigure.js';
import { ShortcutManager, type ShortcutConfig } from './ShortcutManager.js';
import { WindowManager } from './WindowManager.js';

export enum EnvEnum {
    Development = 'development',
    Production = 'production',
    Test = 'test',
}

export interface ApplicationInfo {
    name: string;
    title: string;
    version: string;
    description: string;
    env: string;
}

const DEFAULT_THEME: Theme = 'dark';

export class Application {
    private readonly osInformation: OperatingSystemInformation;
    private readonly platform: PlatformConfigure;
    private readonly windowManager: WindowManager;
    private readonly commandLine = new CommandLine();
    private readonly clipboardService = new ClipboardService();
    private readonly ipc: IpcServer;
    private shortcuts: ShortcutManager;

    private applicationConfig: ApplicationConfig | undefined;
    private environment: EnvEnum;
    private themeOverride: Theme | undefined;
    private input: CommandInput | undefined;
    private running = false;
    private ready = false;
    private stopping = false;

    constructor(private readonly app: App) {
        this.osInformation = OperatingSystemInformation.fromRuntime();
        this.platform = new PlatformConfigure(this.osInformation);
        this.windowManager = new WindowManager();
        this.shortcuts = this.buildShortcuts(this.defaultKeyBindings());
        this.ipc = new IpcServer(this.windowManager, this.clipboardService);
        this.environment = this.detectDefaultEnv();
    }

    os(): OperatingSystemInformation {
        return this.osInformation;
    }

    env(): string {
        return this.environment;
    }

    name(): string {
        return this.ensureConfig().name();
    }

    title(): string {
        return identity.title;
    }

    version(): string {
        return this.ensureConfig().version();
    }

    config(): ApplicationConfig {
        return this.ensureConfig();
    }

    theme(): Theme {
        return this.themeOverride ?? this.ensureConfig().theme();
    }

    colors(): ColorPalette {
        return this.ensureConfig().colors();
    }

    about(): ApplicationInfo {
        const config = this.ensureConfig();
        return {
            name: config.name(),
            title: this.title(),
            version: config.version(),
            description: identity.description,
            env: this.env(),
        };
    }

    appPath(): string {
        return this.app.getAppPath();
    }

    binaryPath(): string {
        return process.execPath;
    }

    executablePath(): string {
        return this.app.getAppPath();
    }

    withEnv(env: EnvEnum): this {
        this.environment = env;
        return this;
    }

    withConfig(config: ApplicationConfig): this {
        this.applicationConfig = config;
        this.rebuildShortcuts();
        return this;
    }

    withTheme(theme: Theme): this {
        this.themeOverride = theme;
        return this;
    }

    withCommands(): this {
        this.registerBuiltInCommands();
        return this;
    }

    withKeyBindings(): this {
        this.rebuildShortcuts();
        return this;
    }

    withServices(): this {
        return this;
    }

    withDrivers(): this {
        return this;
    }

    configure(): this {
        this.ensureConfig();
        this.applyTheme();
        this.platform.apply();
        return this;
    }

    register(): this {
        this.registerBuiltInCommands();
        this.rebuildShortcuts();
        this.ipc.register();
        return this;
    }

    bootstrap(): this {
        session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) =>
            callback(permission.startsWith('clipboard')),
        );
        session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
            permission.startsWith('clipboard'),
        );
        this.running = true;
        return this;
    }

    boot(): this {
        this.app.on('second-instance', (_event, argv: string[]) => this.handleSecondInstance(argv));
        this.app.on('activate', () => this.handleActivate());
        this.app.on('window-all-closed', () => this.handleWindowAllClosed());
        this.app.on('before-quit', () => this.handleBeforeQuit());
        return this;
    }

    start(): void {
        this.input = this.commandLine.parse(cliArguments());
        if (this.input.options.help) {
            console.log(this.commandLine.help());
            this.app.exit(0);
            return;
        }
        if (!this.commandLine.isRunningAgentMode() && !this.app.requestSingleInstanceLock()) {
            this.app.quit();
            return;
        }
        void this.app.whenReady().then(() => this.handleReady());
    }

    stop(): void {
        if (this.stopping) return;
        this.stopping = true;
        this.shortcuts.unregister();
        this.ipc.unregister();
        this.windowManager.closeAll();
        this.running = false;
        this.ready = false;
    }

    quit(): void {
        this.app.quit();
    }

    isRunning(): boolean {
        return this.running;
    }

    isCommandLine(): boolean {
        const input = this.input;
        if (!input) return false;
        return input.name !== null || input.options.agent === true || input.options.help === true;
    }

    isRunningTests(): boolean {
        if (this.environment === EnvEnum.Test) return true;
        return process.env.NODE_ENV === 'test' || process.argv.includes('--test');
    }

    isReady(): boolean {
        return this.ready || this.app.isReady();
    }

    windows(): BrowserWindow[] {
        return this.windowManager.windows();
    }

    handleSecondInstance(argv: string[]): void {
        logger.debug('second instance arguments', argv);
        const input = this.commandLine.parse(secondInstanceArguments(argv));
        this.input = input;
        if (input.options.agent) {
            this.shortcuts.runAgent();
            return;
        }
        if (!input.name) return;
        this.commandLine.execute(input);
    }

    handleReady(): void {
        this.ready = true;
        if (this.commandLine.isRunningAgentMode()) {
            this.shortcuts.runAgent();
            return;
        }
        this.bootstrap();
        if (this.handlePrimaryCommand()) return;
        this.windowManager.createOverlay();
        this.windowManager.focusOverlay();
        this.shortcuts.registerToggleShortcut();
        this.shortcuts.registerNewCanvas();
        logger.info('overlay ready', {
            environment: this.env(),
            mode: this.environment,
            version: identity.version,
        });
    }

    private handlePrimaryCommand(): boolean {
        const input = this.input;
        if (!input?.name) return false;
        if (input.name === 'show' || input.name === 'toggle') return false;
        this.commandLine.execute(input);
        if (input.name !== 'quit') this.app.quit();
        return true;
    }

    handleActivate(): void {
        this.windowManager.revealOverlay();
    }

    handleBeforeQuit(): void {
        this.stop();
    }

    handleWindowAllClosed(): void {
        if (!this.osInformation.isMacOS()) this.app.quit();
    }

    private ensureConfig(): ApplicationConfig {
        if (!this.applicationConfig) this.applicationConfig = this.buildDefaultConfig();
        return this.applicationConfig;
    }

    private buildDefaultConfig(): ApplicationConfig {
        return new ApplicationConfig(
            identity.name,
            identity.version,
            DEFAULT_THEME,
            this.buildPalette(),
            this.registeredCommands(),
            this.defaultKeyBindings(),
        );
    }

    private buildPalette(): ColorPalette {
        return { ...PALETTE, ...COLORS };
    }

    private defaultKeyBindings(): KeyBinding[] {
        return [
            { id: 'toggle-overlay', accelerator: SHORTCUTS.global.toggleOverlay },
            { id: 'new-canvas', accelerator: SHORTCUTS.global.newCanvas },
            { id: 'quit', accelerator: SHORTCUTS.global.quit },
        ];
    }

    private registerBuiltInCommands(): void {
        const commands: Command[] = [
            new ShowApplicationCommand(this.windowManager),
            new HideApplicationCommand(this.windowManager),
            new ToggleApplicationCommand(this.windowManager),
            new QuitApplicationCommand(this),
        ];
        for (const command of commands) {
            if (!this.commandLine.has(command.name())) this.commandLine.register(command);
        }
    }

    private registeredCommands(): Command[] {
        return this.commandLine.commands();
    }

    private buildShortcuts(bindings: KeyBinding[]): ShortcutManager {
        return new ShortcutManager(
            this.windowManager,
            this.shortcutConfigFromBindings(bindings),
            this.osInformation,
            () => this.quit(),
        );
    }

    private rebuildShortcuts(): void {
        const bindings = this.applicationConfig?.keyBindings() ?? this.defaultKeyBindings();
        this.shortcuts = this.buildShortcuts(bindings);
    }

    private shortcutConfigFromBindings(bindings: KeyBinding[]): ShortcutConfig {
        const find = (id: string, fallback: string): string =>
            bindings.find((binding) => binding.id === id)?.accelerator ?? fallback;
        return {
            toggle: find('toggle-overlay', SHORTCUTS.global.toggleOverlay),
            newCanvas: find('new-canvas', SHORTCUTS.global.newCanvas),
        };
    }

    private applyTheme(): void {
        try {
            nativeTheme.themeSource = this.theme();
        } catch {
            // Theme application is optional and must not prevent startup.
        }
    }

    private detectDefaultEnv(): EnvEnum {
        if (process.env.NODE_ENV === 'test' || process.argv.includes('--test')) {
            return EnvEnum.Test;
        }
        if (process.env.NODE_ENV === 'production') return EnvEnum.Production;
        if (this.app.isPackaged) return EnvEnum.Production;
        return EnvEnum.Development;
    }
}

export function cliArguments(
    argv: string[] = process.argv,
    hasAppPath = process.defaultApp,
): string[] {
    // In development Electron prepends the app path to process.argv (position 1);
    // packaged binaries carry only the executable, so there is no path to skip.
    return argv.slice(hasAppPath ? 2 : 1);
}

export function secondInstanceArguments(
    argv: string[],
    defaultApp = process.defaultApp,
    appPath = app.getAppPath(),
): string[] {
    // The second-instance event carries the command line of the second process.
    // In development Electron appends the resolved app path as a trailing element,
    // so drop it before parsing. Packaged binaries just skip the executable.
    const args = argv.slice(1);
    if (defaultApp && args.length > 0 && args[args.length - 1] === appPath) {
        return args.slice(0, -1);
    }
    return args;
}
