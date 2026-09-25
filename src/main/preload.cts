import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('screenAnnotate', {
    appConfig: () =>
        ipcRenderer.invoke('app-config') as Promise<{
            title: string;
        }>,
    createNewWindow: () => ipcRenderer.invoke('create-new-window'),
    clipboardContent: () =>
        ipcRenderer.invoke('clipboard-content') as Promise<{
            image: string;
            text: string;
        }>,
    onWindowKind: (callback: (kind: 'overlay' | 'blank') => void) =>
        ipcRenderer.on('window-kind', (_event, kind) => callback(kind)),
});
