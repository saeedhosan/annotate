import { beforeEach, expect, mock, test } from 'bun:test';
import { createElectronMock, MockBrowserWindow } from './helpers/electron-mock';

const electronMock = createElectronMock();
mock.module('electron', () => electronMock.electron);

const { WindowManager } = await import('../src/main/WindowManager');

beforeEach(() => electronMock.mock.reset());

test('createOverlay builds a tracked overlay window', () => {
    const manager = new WindowManager();
    const window = manager.createOverlay();
    expect(window).toBeInstanceOf(MockBrowserWindow);
    expect(manager.windows()).toEqual([window]);
    expect(window.isVisible()).toBe(false);
});

test('createOverlay reuses the existing overlay', () => {
    const manager = new WindowManager();
    const first = manager.createOverlay();
    const second = manager.createOverlay();
    expect(first).toBe(second);
    expect(electronMock.mock.instances.length).toBe(1);
});

test('setVisible shows and hides tracked windows', () => {
    const manager = new WindowManager();
    const window = manager.createOverlay();
    manager.setVisible(true);
    expect(window.isVisible()).toBe(true);
    manager.setVisible(false);
    expect(window.isVisible()).toBe(false);
});

test('isVisible reflects the overlay state', () => {
    const manager = new WindowManager();
    expect(manager.isVisible()).toBe(false);
    manager.createOverlay();
    manager.setVisible(true);
    expect(manager.isVisible()).toBe(true);
});

test('createBlankWindow stays hidden until ready-to-show', () => {
    const manager = new WindowManager();
    const window = manager.createBlankWindow();
    expect(window.isVisible()).toBe(false);
    window.fireReadyToShow();
    expect(window.isVisible()).toBe(true);
});

test('createBlankWindow records the background query', () => {
    const manager = new WindowManager();
    const window = manager.createBlankWindow('red');
    expect(window.loadQuery()).toEqual({ background: 'red' });
});

test('createBlankWindow sends window-kind after load', () => {
    const manager = new WindowManager();
    const window = manager.createBlankWindow();
    window.fireDidFinishLoad();
    expect(window.sentMessages).toContainEqual({ channel: 'window-kind', args: ['blank'] });
});

test('overlay sends window-kind after load', () => {
    const manager = new WindowManager();
    const window = manager.createOverlay();
    window.fireDidFinishLoad();
    expect(window.sentMessages).toContainEqual({ channel: 'window-kind', args: ['overlay'] });
});

test('overlay is shown on did-finish-load', () => {
    const manager = new WindowManager();
    const window = manager.createOverlay();
    expect(window.isVisible()).toBe(false);
    window.fireDidFinishLoad();
    expect(window.isVisible()).toBe(true);
});

test('revealOverlay creates an overlay when none exists', () => {
    const manager = new WindowManager();
    manager.revealOverlay();
    expect(electronMock.mock.instances.length).toBe(1);
});

test('focusOverlay shows the existing overlay', () => {
    const manager = new WindowManager();
    const window = manager.createOverlay();
    manager.focusOverlay();
    expect(window.isVisible()).toBe(true);
});

test('promptForNewCanvas light response opens a light canvas', async () => {
    const manager = new WindowManager();
    electronMock.mock.setDialogResponse(0);
    await manager.promptForNewCanvas();
    const window = electronMock.mock.instances[0];
    expect(window.loadQuery()).toEqual({ background: '#ffffff' });
});

test('promptForNewCanvas dark response opens a dark canvas', async () => {
    const manager = new WindowManager();
    electronMock.mock.setDialogResponse(1);
    await manager.promptForNewCanvas();
    expect(electronMock.mock.instances[0].loadQuery()).toEqual({ background: '#262527' });
});

test('promptForNewCanvas plain response opens a transparent canvas', async () => {
    const manager = new WindowManager();
    electronMock.mock.setDialogResponse(2);
    await manager.promptForNewCanvas();
    expect(electronMock.mock.instances[0].loadQuery()).toEqual({ background: 'transparent' });
});

test('close removes a window from tracking', () => {
    const manager = new WindowManager();
    const window = manager.createOverlay();
    manager.close(window);
    expect(window.isDestroyed()).toBe(true);
    expect(manager.windows()).toEqual([]);
});

test('closeAll destroys every window', () => {
    const manager = new WindowManager();
    manager.createOverlay();
    manager.createBlankWindow();
    manager.closeAll();
    expect(electronMock.mock.instances.every((instance) => instance.isDestroyed())).toBe(true);
    expect(manager.windows()).toEqual([]);
});

test('closed windows leave the tracked set', () => {
    const manager = new WindowManager();
    const window = manager.createOverlay();
    window.close();
    expect(manager.windows()).toEqual([]);
});
