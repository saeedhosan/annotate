import { COLORS } from '../config/colors';
import { SHORTCUTS } from '../config/shortcuts';
import { Accelerator, type ModifierName } from '../shared/Accelerator';
import { Annotate, type InputEvent, type WebState } from '../shared/Annotate';
import { Drawing, type Point } from '../shared/Drawing';
import { PastedObjectStore } from '../shared/PastedObjectStore';
import { HtmlSanitizer } from './HtmlSanitizer';
import { appPrefix, setAppTitle } from './identity';
import { PasteService } from './PasteService';
import { Renderer } from './Renderer';
import { Toast } from './Toast';
import { Toolbar } from './Toolbar';

declare global {
    interface Window {
        screenAnnotate: {
            appConfig(): Promise<{ title: string }>;
            createNewWindow(): Promise<{ ok: boolean; error?: string }>;
            clipboardContent(): Promise<{ image: string; text: string }>;
            onWindowKind(callback: (kind: 'overlay' | 'blank') => void): void;
        };
    }
}

const ERASE_RADIUS = 16;
const TOUCH_ERASE_RADIUS = 28;
const APP = appPrefix;

export class AnnotationApp {
    private readonly accelerator = new Accelerator();
    private readonly annotate: Annotate;
    private readonly renderer: Renderer;
    private readonly paste: PasteService;
    private readonly toast = new Toast();

    private webTool: 'draw' | 'erase' = 'draw';
    private kind: 'overlay' | 'blank' = 'overlay';
    private lastPointer: Point = { x: innerWidth / 2, y: innerHeight / 2 };
    private activePointerId: number | undefined;

    constructor(private readonly canvas: HTMLCanvasElement) {
        this.annotate = new Annotate(new Drawing(), new PastedObjectStore());
        this.renderer = new Renderer(canvas);
        this.paste = new PasteService(
            this.annotate,
            this.renderer,
            new HtmlSanitizer(),
            () => this.redraw(),
            (message, duration) => this.toast.show(message, duration),
        );
    }

    bootstrap(): void {
        if (window.screenAnnotate) {
            window.screenAnnotate.appConfig().then((config) => {
                setAppTitle(config.title);
                document.title = config.title;
            });
            window.screenAnnotate.onWindowKind((kind) => {
                this.kind = kind;
                this.annotate.background = kind;
                document.body.classList.toggle('blank', kind === 'blank');
            });
        } else {
            document.body.classList.add('web');
        }
        const background = new URLSearchParams(location.search).get('background');
        if (background) document.body.style.setProperty('--background', background);
        this.renderer.resize();
        this.redraw();
        if (this.isWeb && 'serviceWorker' in navigator)
            void navigator.serviceWorker.register('./sw.js');
        if (this.isWeb && matchMedia('(pointer: coarse)').matches) this.installToolbar();
        if (
            this.kind === 'overlay' &&
            this.isWeb &&
            matchMedia('(pointer: coarse)').matches &&
            !localStorage.getItem('sa-hinted')
        ) {
            this.toast.show('Draw \u00b7 Erase \u00b7 Undo', 3000);
            localStorage.setItem('sa-hinted', '1');
        }
        this.wireEvents();
    }

    private get isWeb(): boolean {
        return !window.screenAnnotate;
    }

    private redraw(): void {
        this.renderer.render(this.annotate.snapshot());
    }

    private point(event: PointerEvent): Point {
        return { x: event.clientX, y: event.clientY };
    }

    private input(event: PointerEvent): InputEvent {
        return {
            x: event.clientX,
            y: event.clientY,
            buttons: event.buttons,
            pointerType: event.pointerType as InputEvent['pointerType'],
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
        };
    }

    private webState(): WebState {
        return { enabled: this.isWeb, tool: this.webTool };
    }

    private eraseAt(at: Point, event: PointerEvent): void {
        const radius = event.pointerType === 'touch' ? TOUCH_ERASE_RADIUS : ERASE_RADIUS;
        const removed = this.annotate.eraseAt(at, radius);
        if (removed?.object?.kind === 'rich') {
            this.renderer.removeRich(removed.object.id);
        }
        if (removed.object || removed.stroke) this.redraw();
    }

    private clearAll(): void {
        this.annotate.clear();
        this.renderer.clearRich();
        this.redraw();
    }

    private keyLetter(event: KeyboardEvent): string {
        const match = event.code.match(/^Key([A-Z])$/);
        return match ? match[1].toLowerCase() : '';
    }

    private requestNewWindow(): Promise<void> {
        if (!window.screenAnnotate) {
            window.open(location.href, '_blank', 'noopener');
            return Promise.resolve();
        }
        return window.screenAnnotate
            .createNewWindow()
            .then((res) => {
                if (!res || res.ok === false) {
                    const detail = res && res.error ? `: ${res.error}` : '';
                    console.warn(`${APP()} create blank window failed`, res);
                    this.toast.show(`Could not open new window${detail || ''}`);
                }
            })
            .catch((err) => {
                console.warn(`${APP()} create blank window IPC failed:`, err);
                this.toast.show('Could not open new window');
            });
    }

    private installToolbar(): void {
        const toolbar = new Toolbar(
            {
                onUndo: () => {
                    this.annotate.undo();
                    this.redraw();
                },
                onClear: () => this.clearAll(),
                onColor: (color) => this.annotate.setColor(color),
                onTool: (tool) => {
                    this.webTool = tool;
                },
            },
            (message, duration) => this.toast.show(message, duration),
        );
        toolbar.install();
    }

    private wireEvents(): void {
        this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
        this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
        window.addEventListener('pointerup', () => this.onPointerEnd());
        window.addEventListener('pointercancel', () => this.onPointerEnd());
        window.addEventListener('resize', () => this.renderer.resize());
        window.addEventListener('keydown', (event) => void this.onKeyDown(event));
        window.addEventListener('keyup', (event) => this.onKeyUp(event));
    }

    private onPointerDown(event: PointerEvent): void {
        const at = this.point(event);
        this.lastPointer = at;
        if (event.pointerType === 'touch') {
            if (this.activePointerId !== undefined) return;
            this.activePointerId = event.pointerId;
            this.canvas.setPointerCapture(event.pointerId);
        }
        if (event.ctrlKey) {
            this.annotate.startDrag(at);
            return;
        }
        const inputEvent = this.input(event);
        const intent = this.annotate.intentFor(inputEvent, this.webState());
        if (intent === 'draw') {
            this.annotate.beginStroke(this.annotate.drawTrigger(inputEvent), at);
            this.redraw();
        } else if (intent === 'erase') {
            this.annotate.beginErase(this.annotate.eraseTrigger(inputEvent));
            this.eraseAt(at, event);
        }
    }

    private onPointerMove(event: PointerEvent): void {
        const at = this.point(event);
        this.lastPointer = at;
        if (
            this.activePointerId !== undefined &&
            event.pointerType === 'touch' &&
            event.pointerId !== this.activePointerId
        )
            return;
        if (this.annotate.isDragging()) {
            this.annotate.dragTo(at);
            this.redraw();
            return;
        }
        const inputEvent = this.input(event);
        const intent = this.annotate.intentFor(inputEvent, this.webState());
        if (intent === 'draw') {
            const trigger = this.annotate.drawTrigger(inputEvent);
            if (this.annotate.currentMode === 'draw' && this.annotate.currentTrigger === trigger) {
                this.annotate.extendStroke(at);
            } else {
                this.annotate.beginStroke(trigger, at);
            }
            this.redraw();
        } else if (intent === 'erase') {
            const trigger = this.annotate.eraseTrigger(inputEvent);
            if (this.annotate.currentMode !== 'erase' || this.annotate.currentTrigger !== trigger) {
                this.annotate.beginErase(trigger);
            }
            this.eraseAt(at, event);
        } else {
            this.annotate.endGesture();
        }
    }

    private onPointerEnd(): void {
        this.annotate.endDrag();
        this.activePointerId = undefined;
        this.annotate.endGesture();
    }

    private async onKeyDown(event: KeyboardEvent): Promise<void> {
        for (const mod of ['alt', 'shift', 'ctrl', 'meta'] as ModifierName[]) {
            if (this.accelerator.isModifierKey(event, mod)) this.annotate.heldModifiers.add(mod);
        }
        const letter = this.keyLetter(event);
        if (
            SHORTCUTS.overlay.colorKeys &&
            letter &&
            COLORS[letter] &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        )
            this.annotate.setColor(COLORS[letter]);
        if (this.accelerator.matches(event, SHORTCUTS.overlay.clear)) {
            this.clearAll();
            return;
        }
        if (
            this.accelerator.matches(event, SHORTCUTS.overlay.undo) ||
            this.accelerator.matches(event, SHORTCUTS.overlay.undoAlt)
        ) {
            event.preventDefault();
            this.annotate.undo();
            this.redraw();
            return;
        }
        if (this.accelerator.matches(event, SHORTCUTS.overlay.newCanvas)) {
            event.preventDefault();
            void this.requestNewWindow();
            return;
        }
        if (this.accelerator.matches(event, SHORTCUTS.overlay.paste)) {
            event.preventDefault();
            if (!this.annotate.activeStroke) await this.paste.paste(this.lastPointer, false);
            return;
        }
        if (this.accelerator.matches(event, SHORTCUTS.overlay.pastePlain)) {
            event.preventDefault();
            if (!this.annotate.activeStroke) await this.paste.paste(this.lastPointer, true);
            return;
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        const drawMod = this.accelerator.modifierName(SHORTCUTS.overlay.holdDraw);
        const eraseMod = this.accelerator.modifierName(SHORTCUTS.overlay.holdErase);
        for (const mod of ['alt', 'shift', 'ctrl', 'meta'] as ModifierName[]) {
            if (this.accelerator.isModifierKey(event, mod)) {
                this.annotate.heldModifiers.delete(mod);
                if ((mod === drawMod || mod === eraseMod) && this.annotate.currentTrigger === 'mod')
                    this.annotate.endGesture();
            }
        }
        const letter = this.keyLetter(event);
        if (letter && COLORS[letter]) {
            this.annotate.setColor(undefined);
            if (this.annotate.currentTrigger === 'key') this.annotate.endGesture();
        }
    }
}
