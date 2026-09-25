export interface OverlayShortcuts {
    clear: string;
    undo: string;
    undoAlt: string;
    newCanvas: string;
    paste: string;
    pastePlain: string;
    holdDraw: string;
    holdErase: string;
    eraseRightClick: boolean;
    colorKeys: boolean;
}

export interface Shortcuts {
    global: {
        toggleOverlay: string;
        quit: string;
        newCanvas: string;
    };
    overlay: OverlayShortcuts;
}

export const SHORTCUTS = {
    global: {
        toggleOverlay: 'F8',
        quit: 'Ctrl+F8',
        newCanvas: 'CommandOrControl+N',
    },
    overlay: {
        clear: 'Escape',
        undo: 'CommandOrControl+Z',
        undoAlt: 'Backspace',
        newCanvas: 'CommandOrControl+N',
        paste: 'CommandOrControl+V',
        pastePlain: 'CommandOrControl+Shift+V',
        holdDraw: 'Alt',
        holdErase: 'Shift',
        eraseRightClick: true,
        colorKeys: true,
    },
} as const satisfies Shortcuts;
