import { expect, test } from 'bun:test';
import { OperatingSystemInformation } from '../src/main/OperatingSystemInformation';

function os(
    platform: string,
    session: string | null = null,
    displayServer: string | null = null,
): OperatingSystemInformation {
    return new OperatingSystemInformation(
        platform,
        platform,
        '0.0.0',
        'release',
        'x64',
        session,
        null,
        displayServer,
    );
}

test('identifies linux', () => {
    const info = os('linux');
    expect(info.isLinux()).toBe(true);
    expect(info.isWindows()).toBe(false);
    expect(info.isMacOS()).toBe(false);
});

test('identifies windows', () => {
    const info = os('win32');
    expect(info.isWindows()).toBe(true);
    expect(info.isLinux()).toBe(false);
});

test('identifies macos', () => {
    const info = os('darwin');
    expect(info.isMacOS()).toBe(true);
    expect(info.isLinux()).toBe(false);
    expect(info.isWindows()).toBe(false);
});

test('wayland detected from session', () => {
    const info = os('linux', 'wayland');
    expect(info.isWayland()).toBe(true);
    expect(info.isX11()).toBe(false);
});

test('x11 detected from session', () => {
    const info = os('linux', 'x11');
    expect(info.isX11()).toBe(true);
    expect(info.isWayland()).toBe(false);
});

test('display server fallback detection', () => {
    expect(os('linux', null, 'wayland').isWayland()).toBe(true);
    expect(os('linux', null, 'x11').isX11()).toBe(true);
    expect(os('linux', null, null).isWayland()).toBe(false);
    expect(os('linux', null, null).isX11()).toBe(false);
});

test('fromRuntime exposes process platform', () => {
    const info = OperatingSystemInformation.fromRuntime();
    expect(info.isLinux()).toBe(process.platform === 'linux');
});
