import { beforeEach, expect, mock, test } from 'bun:test';
import { ApplicationConfig } from '../src/main/ApplicationConfig';
import { createElectronMock, flush } from './helpers/electron-mock';

const electronMock = createElectronMock();
mock.module('electron', () => electronMock.electron);

const { Application, EnvEnum, cliArguments, secondInstanceArguments } =
    await import('../src/main/Application');

const ACCELERATOR = 'CommandOrControl+N';

beforeEach(() => electronMock.mock.reset());

function build(): Application {
    return new Application(electronMock.mock.app as never)
        .withEnv(EnvEnum.Test)
        .withCommands()
        .withKeyBindings()
        .withServices()
        .withDrivers()
        .configure()
        .register()
        .bootstrap()
        .boot();
}

test('exposes operating system information', () => {
    const application = new Application(electronMock.mock.app as never).withEnv(EnvEnum.Test);
    expect(application.os().isLinux()).toBe(process.platform === 'linux');
});

test('exposes the configured environment', () => {
    const application = new Application(electronMock.mock.app as never);
    expect(application.withEnv(EnvEnum.Production).env()).toBe('production');
});

test('reads identity from package.json', () => {
    const application = new Application(electronMock.mock.app as never).withEnv(EnvEnum.Test);
    expect(application.name()).toBe('annotate');
    expect(application.version()).toBe('0.0.0');
    expect(application.title()).toBe('Screen Annotate');
});

test('resolves app and executable paths', () => {
    const application = new Application(electronMock.mock.app as never);
    expect(application.appPath()).toBe(process.cwd());
    expect(application.executablePath()).toBe(process.cwd());
    expect(application.binaryPath()).toBe(process.execPath);
});

test('about combines identity, description and environment', () => {
    const application = new Application(electronMock.mock.app as never).withEnv(EnvEnum.Test);
    const about = application.about();
    expect(about.name).toBe('annotate');
    expect(about.title).toBe('Screen Annotate');
    expect(about.version).toBe('0.0.0');
    expect(about.env).toBe('test');
    expect(about.description.length).toBeGreaterThan(0);
});

test('provides a default dark theme with colors', () => {
    const application = new Application(electronMock.mock.app as never);
    expect(application.theme()).toBe('dark');
    expect(Object.keys(application.colors()).length).toBeGreaterThan(0);
});

test('withConfig overrides identity and rebuilds shortcuts', () => {
    const application = new Application(electronMock.mock.app as never);
    const custom = new ApplicationConfig(
        'Custom',
        '9.9.9',
        'light',
        { c: '#ffffff' },
        [],
        [{ id: 'new-canvas', accelerator: ACCELERATOR }],
    );
    application.withConfig(custom);
    expect(application.name()).toBe('Custom');
    expect(application.version()).toBe('9.9.9');
    expect(application.theme()).toBe('light');
});

test('isRunningTests honors the test environment', () => {
    const application = new Application(electronMock.mock.app as never);
    expect(application.withEnv(EnvEnum.Test).isRunningTests()).toBe(true);
});

test('configure applies the theme', () => {
    build();
    expect(electronMock.mock.nativeThemeSource).toBe('dark');
});

test('start boots the overlay and registers shortcuts', async () => {
    const application = build();
    application.start();
    await flush();
    expect(application.isReady()).toBe(true);
    expect(application.isRunning()).toBe(true);
    expect(application.isCommandLine()).toBe(false);
    expect(application.windows().length).toBe(1);
    expect(electronMock.mock.globalShortcuts.has(ACCELERATOR)).toBe(true);
});

test('bootstrap installs clipboard permission handlers', async () => {
    const application = build();
    application.start();
    await flush();
    const allowed = electronMock.mock.requestPermission('clipboard-sanitized-write');
    expect(allowed).toBe(true);
    expect(electronMock.mock.permissions.requests).toContain('clipboard-sanitized-write');
});

test('second instance body of a command is dispatched', async () => {
    const application = build();
    application.start();
    await flush();
    const overlay = electronMock.mock.instances[0];
    expect(overlay.isVisible()).toBe(true);
    electronMock.mock.emitApp('second-instance', {}, ['/electron', '.', '--toggle']);
    expect(overlay.isVisible()).toBe(false);
    electronMock.mock.emitApp('second-instance', {}, ['/electron', '.', '--toggle']);
    expect(overlay.isVisible()).toBe(true);
    expect(application.isCommandLine()).toBe(true);
});

test('second instance show makes the overlay visible', async () => {
    const application = build();
    application.start();
    await flush();
    electronMock.mock.emitApp('second-instance', {}, ['/electron', '.', '--show']);
    expect(electronMock.mock.instances[0].isVisible()).toBe(true);
});

test('second instance quit exits the application', async () => {
    const application = build();
    application.start();
    await flush();
    electronMock.mock.emitApp('second-instance', {}, ['/electron', '.', '--quit']);
    expect(electronMock.mock.quitCount).toBe(1);
});

test('agent mode registers shortcuts without windows', async () => {
    const application = new Application(electronMock.mock.app as never)
        .withEnv(EnvEnum.Test)
        .withCommands()
        .withKeyBindings()
        .withServices()
        .withDrivers()
        .configure()
        .register()
        .boot();
    process.argv.push('--agent');
    try {
        application.start();
        await flush();
    } finally {
        process.argv.pop();
    }
    expect(application.isRunning()).toBe(false);
    expect(application.isReady()).toBe(true);
    expect(electronMock.mock.instances.length).toBe(0);
    expect(electronMock.mock.globalShortcuts.has('F8')).toBe(true);
    expect(electronMock.mock.globalShortcuts.has('Ctrl+F8')).toBe(true);
});

test('a failed single instance lock quits', async () => {
    electronMock.mock.setLockResult(false);
    const application = build();
    application.start();
    await flush();
    expect(electronMock.mock.quitCount).toBe(1);
    expect(electronMock.mock.instances.length).toBe(0);
});

test('help prints usage and exits', async () => {
    const application = build();
    process.argv.push('--help');
    try {
        application.start();
        await flush();
    } finally {
        process.argv.pop();
    }
    expect(electronMock.mock.exitCount).toBe(1);
});

test('a fresh primary --quit exits without opening the overlay', async () => {
    const application = build();
    process.argv.push('--quit');
    try {
        application.start();
        await flush();
    } finally {
        process.argv.pop();
    }
    expect(electronMock.mock.quitCount).toBe(1);
    expect(application.windows().length).toBe(0);
});

test('a fresh primary --hide exits without opening the overlay', async () => {
    const application = build();
    process.argv.push('--hide');
    try {
        application.start();
        await flush();
    } finally {
        process.argv.pop();
    }
    expect(electronMock.mock.quitCount).toBe(1);
    expect(application.windows().length).toBe(0);
});

test('a fresh primary --toggle opens the overlay like a launcher', async () => {
    const application = build();
    process.argv.push('--toggle');
    try {
        application.start();
        await flush();
    } finally {
        process.argv.pop();
    }
    expect(application.windows().length).toBe(1);
});

test('start registers the global toggle and quit shortcuts', async () => {
    const application = build();
    application.start();
    await flush();
    expect(electronMock.mock.globalShortcuts.has('F8')).toBe(true);
    expect(electronMock.mock.globalShortcuts.has('Ctrl+F8')).toBe(true);
    expect(electronMock.mock.globalShortcuts.has(ACCELERATOR)).toBe(true);
});

test('dev argv keeps flags after the app path', () => {
    expect(cliArguments(['/electron', '/app', '--help'], true)).toEqual(['--help']);
    expect(cliArguments(['/electron', '/app', '--toggle'], true)).toEqual(['--toggle']);
});

test('packaged argv carries no app path to strip', () => {
    expect(cliArguments(['/opt/Screen Annotate/annotate', '--help'], false)).toEqual(['--help']);
    expect(cliArguments(['/opt/Screen Annotate/annotate', '--toggle'], false)).toEqual([
        '--toggle',
    ]);
});

test('second instance dev argv drops the executable and trailing app path', () => {
    expect(
        secondInstanceArguments(
            ['/electron', '--quit', '--ozone-platform=wayland', '/app'],
            true,
            '/app',
        ),
    ).toEqual(['--quit', '--ozone-platform=wayland']);
    expect(secondInstanceArguments(['/electron', '--toggle'], true, '/app')).toEqual(['--toggle']);
});

test('second instance dev argv keeps an app path in first position', () => {
    expect(secondInstanceArguments(['/electron', '/app', '--toggle'], true, '/app')).toEqual([
        '/app',
        '--toggle',
    ]);
});

test('second instance packaged argv carries no app path to strip', () => {
    expect(secondInstanceArguments(['/opt/Screen Annotate/annotate', '--quit'], false, '')).toEqual(
        ['--quit'],
    );
});

test('activate reveals the overlay', async () => {
    const application = build();
    application.start();
    await flush();
    electronMock.mock.emitApp('activate', undefined);
    expect(electronMock.mock.instances[0].isVisible()).toBe(true);
});

test('before-quit stops the application', async () => {
    const application = build();
    application.start();
    await flush();
    expect(application.isRunning()).toBe(true);
    electronMock.mock.emitApp('before-quit', { preventDefault() {} });
    expect(application.isRunning()).toBe(false);
});

test('window-all-closed quits outside macos', async () => {
    const application = build();
    application.start();
    await flush();
    electronMock.mock.emitApp('window-all-closed');
    if (process.platform === 'linux') {
        expect(electronMock.mock.quitCount).toBe(1);
    } else {
        expect(electronMock.mock.quitCount).toBe(0);
    }
});

test('stop unregisters, closes windows and flags the app as stopped', async () => {
    const application = build();
    application.start();
    await flush();
    application.stop();
    expect(application.isRunning()).toBe(false);
    expect(application.isReady()).toBe(false);
    expect(application.windows()).toEqual([]);
    expect(electronMock.mock.instances[0].isDestroyed()).toBe(true);
    expect(electronMock.mock.ipcRemoved.length).toBe(3);
    expect(electronMock.mock.globalShortcuts.size).toBe(0);
});

test('quit exits the application', () => {
    const application = new Application(electronMock.mock.app as never);
    application.quit();
    expect(electronMock.mock.quitCount).toBe(1);
});
