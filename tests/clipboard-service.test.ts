import { beforeEach, expect, mock, test } from 'bun:test';
import { createElectronMock } from './helpers/electron-mock';

const electronMock = createElectronMock();
mock.module('electron', () => electronMock.electron);

const { ClipboardService } = await import('../src/main/ClipboardService');

const service = new ClipboardService();

beforeEach(() => electronMock.mock.reset());

test('returns text content when the clipboard holds text', async () => {
    electronMock.mock.setReadText('hello world');
    const content = await service.clipboardContent();
    expect(content).toEqual({
        type: 'text',
        text: 'hello world',
        html: null,
        image: null,
    });
});

test('returns an image data uri when images are present', async () => {
    electronMock.mock.setReadItems([
        { types: ['image/png'], getType: async () => new Blob([new Uint8Array([1, 2, 3])]) },
    ]);
    const content = await service.clipboardContent();
    expect(content.type).toBe('image');
    expect(content.image?.data).toBe('data:image/png;base64,AQID');
    expect(content.text).toBeNull();
});

test('images take precedence over html', async () => {
    electronMock.mock.setReadItems([
        {
            types: ['text/html', 'image/png'],
            getType: async (type: string) =>
                new Blob([type === 'image/png' ? new Uint8Array([1, 2, 3]) : '<p>hi</p>']),
        },
    ]);
    const content = await service.clipboardContent();
    expect(content.type).toBe('image');
});

test('returns html content when present without images', async () => {
    electronMock.mock.setReadItems([
        { types: ['text/html'], getType: async () => new Blob(['<b>bold</b>']) },
    ]);
    const content = await service.clipboardContent();
    expect(content.type).toBe('html');
    expect(content.text).toBe('<b>bold</b>');
    expect(content.image).toBeNull();
});

test('reports empty when nothing is available', async () => {
    const content = await service.clipboardContent();
    expect(content).toEqual({ type: 'empty', text: null, html: null, image: null });
});
