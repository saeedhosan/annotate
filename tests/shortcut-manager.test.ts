import { beforeEach, expect, mock, test } from 'bun:test';
import { OperatingSystemInformation } from '../src/main/OperatingSystemInformation';
import { createElectronMock } from './helpers/electron-mock';

const electronMock = createElectronMock();
mock.module('electron', () => electronMock.electron);

const { ShortcutManager } = await import('../src/main/ShortcutManager');
const { WindowManager } = await import('../src/main/WindowManager');

type ShortcutConfig = { toggle: string; newCanvas: string };

const linux = new OperatingSystemInformation(
    'linux',
    'Linux',
    '0.0.0',
    '',
    'x64',
    null,
    null,
    null,
);
const config: ShortcutConfig = { toggle: 'F8', newCanvas: 'Ctrl+N' };

beforeEach(() => electronMock.mock.reset());

function manager(onQuit?: () => void): ShortcutManager {
    return new ShortcutManager(new WindowManager(), config, linux, onQuit);
}

test('registerNewCanvas registers the accelerator', () => {
    const shortcuts = manager();
    shortcuts.registerNewCanvas();
    expect(electronMock.mock.globalShortcuts.has('Ctrl+N')).toBe(true);
});

test('registerNewCanvas is idempotent', () => {
    const shortcuts = manager();
    shortcuts.registerNewCanvas();
    shortcuts.registerNewCanvas();
    expect(electronMock.mock.globalShortcuts.size).toBe(1);
});

test('registerNewCanvas tolerates a conflicting accelerator', () => {
    electronMock.mock.conflicts.add('Ctrl+N');
    const shortcuts = manager();
    shortcuts.registerNewCanvas();
    expect(electronMock.mock.globalShortcuts.size).toBe(0);
});

test('unregisterNewCanvas removes the accelerator', () => {
    const shortcuts = manager();
    shortcuts.registerNewCanvas();
    shortcuts.unregisterNewCanvas();
    expect(electronMock.mock.globalShortcuts.has('Ctrl+N')).toBe(false);
});

test('registerToggleShortcut registers the toggle directly when supported', () => {
    electronMock.mock.setPackaged(true);
    const shortcuts = manager();
    shortcuts.registerToggleShortcut();
    expect(electronMock.mock.globalShortcuts.has('F8')).toBe(true);
});

test('registerToggleShortcut registers a quit accelerator when a handler exists', () => {
    electronMock.mock.setPackaged(true);
    const shortcuts = manager(() => undefined);
    shortcuts.registerToggleShortcut();
    expect(electronMock.mock.globalShortcuts.has('F8')).toBe(true);
    expect(electronMock.mock.globalShortcuts.has('Ctrl+F8')).toBe(true);
});

test('registerToggleShortcut registers no in-process binding when the toggle is held', () => {
    electronMock.mock.setPackaged(true);
    electronMock.mock.conflicts.add('F8');
    const shortcuts = manager();
    shortcuts.registerToggleShortcut();
    expect(electronMock.mock.globalShortcuts.has('F8')).toBe(false);
    expect(electronMock.mock.globalShortcuts.has('Ctrl+F8')).toBe(false);
});

test('registerToggleShortcut is skipped outside a packaged build', () => {
    const shortcuts = manager(() => undefined);
    shortcuts.registerToggleShortcut();
    expect(electronMock.mock.globalShortcuts.has('F8')).toBe(false);
    expect(electronMock.mock.globalShortcuts.has('Ctrl+F8')).toBe(false);
});

test('runAgent registers the toggle and quit shortcuts', () => {
    const shortcuts = manager();
    shortcuts.runAgent();
    expect(electronMock.mock.globalShortcuts.has('F8')).toBe(true);
    expect(electronMock.mock.globalShortcuts.has('Ctrl+F8')).toBe(true);
});

test('unregister removes new canvas and agent shortcuts', () => {
    const shortcuts = manager(() => undefined);
    shortcuts.registerNewCanvas();
    shortcuts.runAgent();
    shortcuts.unregister();
    expect(electronMock.mock.globalShortcuts.size).toBe(0);
});

test('usesPathShim reports whether a shim is installed', () => {
    const shortcuts = manager();
    expect(typeof shortcuts.usesPathShim()).toBe('boolean');
});
