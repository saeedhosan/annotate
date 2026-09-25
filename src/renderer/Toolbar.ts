import { COLORS } from '../config/colors';

export interface ToolbarActions {
    onUndo(): void;
    onClear(): void;
    onColor(color: string): void;
    onTool(tool: 'draw' | 'erase'): void;
}

const COLOR_NAMES: Record<string, string> = {
    '#00ffff': 'Cyan',
    '#1976d2': 'Blue',
    '#ff8c00': 'Dark Orange',
    '#50c878': 'Emerald',
    '#ff00ff': 'Magenta',
    '#22c55e': 'Green',
    '#ff69b4': 'Pink',
    '#4b0082': 'Indigo',
    '#00a86b': 'Jade',
    '#f0e68c': 'Khaki',
    '#00ff00': 'Lime',
    '#000080': 'Navy',
    '#ffa500': 'Orange',
    '#800080': 'Purple',
    '#6c6c7c': 'Slate',
    '#ff1f1f': 'Red',
    '#c0c0c0': 'Silver',
    '#008080': 'Teal',
    '#120a8f': 'Midnight',
    '#8f00ff': 'Violet',
    '#ffffff': 'White',
    '#738678': 'Olive',
    '#ffff00': 'Yellow',
    '#0014a8': 'Ultramarine',
};

const UNDO_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
const ERASER_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>';
const FULLSCREEN_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';

interface DragState {
    startX: number;
    startY: number;
    left: number;
    top: number;
    timer: number | undefined;
    active: boolean;
}

export class Toolbar {
    private tool: 'draw' | 'erase' = 'draw';
    private bar: HTMLDivElement | undefined;
    private eraserToggle: HTMLButtonElement | undefined;
    private fullscreenButton: HTMLButtonElement | undefined;
    private colorDot: HTMLSpanElement | undefined;
    private colorButton: HTMLButtonElement | undefined;
    private colorMenu: HTMLDivElement | undefined;
    private clearPressed = false;
    private clearTimer: number | undefined;
    private dragState: DragState | undefined;

    private readonly colors: string[];

    constructor(
        private readonly actions: ToolbarActions,
        private readonly onMessage: (message: string, duration?: number) => void,
    ) {
        this.colors = [];
        for (const [, color] of Object.entries(COLORS)) {
            if (!this.colors.includes(color)) this.colors.push(color);
        }
    }

    install(): void {
        const bar = (this.bar = document.createElement('div'));
        bar.id = 'web-tools';

        this.fullscreenButton = document.createElement('button');
        this.fullscreenButton.type = 'button';

        const undoButton = document.createElement('button');
        undoButton.type = 'button';
        undoButton.innerHTML = UNDO_ICON;
        undoButton.title = 'Undo (hold to clear)';

        this.eraserToggle = document.createElement('button');
        this.eraserToggle.type = 'button';

        const colorWrap = document.createElement('div');
        colorWrap.className = 'color-wrap';
        this.colorButton = document.createElement('button');
        this.colorButton.type = 'button';
        this.colorButton.className = 'color-toggle';
        this.colorDot = document.createElement('span');
        this.colorDot.className = 'dot';
        const caret = document.createElement('span');
        caret.className = 'caret';
        caret.textContent = '\u25be';
        this.colorButton.append(this.colorDot, caret);
        this.colorMenu = document.createElement('div');
        this.colorMenu.className = 'color-menu';
        this.colorMenu.hidden = true;

        this.colorButton.addEventListener('click', () => {
            this.colorMenu!.hidden = !this.colorMenu!.hidden;
        });
        document.addEventListener('pointerdown', (event) => {
            if (!bar.contains(event.target as Node)) this.colorMenu!.hidden = true;
        });

        this.eraserToggle.addEventListener('click', () => {
            this.tool = this.tool === 'draw' ? 'erase' : 'draw';
            this.actions.onTool(this.tool);
            this.update();
        });
        document.addEventListener('fullscreenchange', () => this.update());
        this.fullscreenButton.addEventListener('click', async () => {
            if (!document.fullscreenElement) {
                try {
                    const request = document.documentElement.requestFullscreen?.();
                    if (request) await request;
                } catch {
                    /* unsupported */
                }
                if (!document.fullscreenElement)
                    this.onMessage(
                        'Fullscreen \u2014 iOS: tap Share \u00b7 Add to Home Screen',
                        3600,
                    );
            } else void document.exitFullscreen();
        });

        for (const color of this.colors) {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'color-option';
            option.innerHTML = `<span class="dot" style="background:${color}"></span>${COLOR_NAMES[color] ?? color}`;
            option.title = color;
            option.addEventListener('click', () => {
                this.actions.onColor(color);
                this.tool = 'draw';
                this.setColor(color);
                this.update();
                this.colorMenu!.hidden = true;
            });
            this.colorMenu.appendChild(option);
        }

        undoButton.addEventListener('pointerdown', () => {
            this.clearPressed = false;
            clearTimeout(this.clearTimer);
            this.clearTimer = window.setTimeout(() => {
                this.clearPressed = true;
                this.actions.onClear();
            }, 600);
        });
        undoButton.addEventListener('pointerup', () => {
            clearTimeout(this.clearTimer);
            this.clearTimer = undefined;
        });
        undoButton.addEventListener('contextmenu', (event) => event.preventDefault());
        undoButton.addEventListener('click', () => {
            if (this.clearPressed) {
                this.clearPressed = false;
                return;
            }
            this.actions.onUndo();
        });

        colorWrap.append(this.colorButton, this.colorMenu);

        bar.addEventListener('pointerdown', (event) => {
            if ((event.target as Element).closest('button')) return;
            this.colorMenu!.hidden = true;
            event.preventDefault();
            bar.setPointerCapture(event.pointerId);
            const rect = bar.getBoundingClientRect();
            clearTimeout(this.dragState?.timer);
            this.dragState = {
                startX: event.clientX,
                startY: event.clientY,
                left: rect.left,
                top: rect.top,
                timer: undefined,
                active: false,
            };
            this.dragState.timer = window.setTimeout(() => {
                if (this.dragState) this.dragState.active = true;
            }, 250);
        });
        bar.addEventListener('pointermove', (event) => {
            if (!this.dragState) return;
            const dx = event.clientX - this.dragState.startX;
            const dy = event.clientY - this.dragState.startY;
            if (!this.dragState.active) {
                if (dx * dx + dy * dy <= 4) return;
                clearTimeout(this.dragState.timer);
                this.dragState.timer = undefined;
                this.dragState.active = true;
            }
            bar.style.left = `${Math.min(innerWidth - bar.offsetWidth, Math.max(0, this.dragState.left + dx))}px`;
            bar.style.top = `${Math.min(innerHeight - bar.offsetHeight, Math.max(0, this.dragState.top + dy))}px`;
        });
        bar.addEventListener('pointerup', () => this.endDrag());
        bar.addEventListener('pointercancel', () => this.endDrag());

        bar.append(this.fullscreenButton, undoButton, this.eraserToggle, colorWrap);
        document.body.appendChild(bar);
        this.setColor(this.colors[0]);
        this.update();
    }

    private setColor(color: string): void {
        this.colorDot!.style.background = color;
        this.colorButton!.title = COLOR_NAMES[color] ?? color;
    }

    private update(): void {
        this.eraserToggle!.innerHTML = ERASER_ICON;
        this.eraserToggle!.classList.toggle('on', this.tool === 'erase');
        this.eraserToggle!.title = this.tool === 'erase' ? 'Eraser on' : 'Eraser';
        this.fullscreenButton!.innerHTML = FULLSCREEN_ICON;
        this.fullscreenButton!.title = document.fullscreenElement
            ? 'Exit fullscreen'
            : 'Fullscreen';
    }

    private endDrag(): void {
        if (this.dragState) {
            clearTimeout(this.dragState.timer);
            this.dragState.timer = undefined;
            this.dragState.active = false;
        }
        this.dragState = undefined;
    }
}
