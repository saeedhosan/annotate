import { PALETTE } from '../config/colors';
import { SHORTCUTS } from '../config/shortcuts';
import { Accelerator, type ModifierName } from './Accelerator';
import { Drawing, type Point, type Stroke } from './Drawing';
import { PastedObjectStore, type PastedObject } from './PastedObjectStore';

export type AnnotationIntent = 'draw' | 'erase' | undefined;
export type AnnotationTrigger = 'left' | 'mod' | 'key' | 'erase-mod' | 'right' | undefined;

export type WebState = { enabled: boolean; tool: 'draw' | 'erase' };

export type AnnotationSnapshot = {
    strokes: readonly Stroke[];
    objects: readonly PastedObject[];
};

export interface InputEvent {
    x: number;
    y: number;
    buttons: number;
    pointerType?: 'mouse' | 'touch' | 'pen';
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
}

export class Annotate {
    constructor(
        readonly drawing: Drawing,
        readonly pastedObjects: PastedObjectStore,
        private readonly accelerator: Accelerator = new Accelerator(),
    ) {}

    readonly heldModifiers = new Set<ModifierName>();
    background: 'overlay' | 'blank' = 'overlay';

    private _color: string | undefined;
    private _mode: 'draw' | 'erase' | undefined;
    private _activeStroke: Stroke | undefined;
    private _activeTrigger: AnnotationTrigger;
    private _dragObject: PastedObject | undefined;
    private _dragOffset: Point | undefined;

    get selectedColor(): string | undefined {
        return this._color;
    }
    setColor(color: string | undefined): void {
        this._color = color;
    }

    get currentMode(): 'draw' | 'erase' | undefined {
        return this._mode;
    }
    get currentTrigger(): AnnotationTrigger {
        return this._activeTrigger;
    }
    get activeStroke(): Stroke | undefined {
        return this._activeStroke;
    }

    intentFor(event: InputEvent, web: WebState): AnnotationIntent {
        if (web.enabled) {
            if (web.tool === 'erase') return 'erase';
            if (event.pointerType === 'touch') return 'draw';
        }
        const drawMod = this.accelerator.modifierName(SHORTCUTS.overlay.holdDraw);
        const eraseMod = this.accelerator.modifierName(SHORTCUTS.overlay.holdErase);
        if (eraseMod && this.accelerator.isActive(event, eraseMod, this.heldModifiers))
            return 'erase';
        if (drawMod && this.accelerator.isActive(event, drawMod, this.heldModifiers)) return 'draw';
        if (this._color) return 'draw';
        if (SHORTCUTS.overlay.eraseRightClick && event.buttons === 2) return 'erase';
        if (event.buttons === 1) return 'draw';
        return undefined;
    }

    drawTrigger(event: InputEvent): 'key' | 'mod' | 'left' {
        if (this._color) return 'key';
        const dm = this.accelerator.modifierName(SHORTCUTS.overlay.holdDraw);
        if (dm && this.accelerator.isActive(event, dm, this.heldModifiers)) return 'mod';
        return 'left';
    }

    eraseTrigger(event: InputEvent): 'mod' | 'right' {
        const em = this.accelerator.modifierName(SHORTCUTS.overlay.holdErase);
        if (em && this.accelerator.isActive(event, em, this.heldModifiers)) return 'mod';
        return 'right';
    }

    beginStroke(trigger: AnnotationTrigger, at: Point): void {
        this._mode = 'draw';
        this._activeTrigger = trigger;
        this._activeStroke = this.drawing.startStroke(this._color ?? PALETTE.primary, at);
    }

    extendStroke(at: Point): void {
        this.drawing.addPoint(this._activeStroke, at);
    }

    beginErase(trigger: AnnotationTrigger): void {
        this._mode = 'erase';
        this._activeTrigger = trigger;
        this._activeStroke = undefined;
    }

    eraseAt(at: Point, radius: number): { stroke?: boolean; object?: PastedObject } {
        const stroke = this.drawing.eraseAt(at, radius);
        const object = this.pastedObjects.eraseAt(at);
        return object ? { stroke, object } : { stroke };
    }

    endGesture(): void {
        this._activeStroke = undefined;
        this._activeTrigger = undefined;
        this._mode = undefined;
    }

    undo(): void {
        this.drawing.undo();
    }

    clear(): void {
        this.drawing.clear();
        this.pastedObjects.clear();
    }

    startDrag(at: Point): PastedObject | undefined {
        this._dragOffset = undefined;
        this._dragObject = undefined;
        const object = this.pastedObjects.objectAt(at);
        if (!object) return undefined;
        this._dragObject = object;
        this._dragOffset = { x: at.x - object.x, y: at.y - object.y };
        return object;
    }

    dragTo(at: Point): boolean {
        if (!this._dragObject || !this._dragOffset) return false;
        this.pastedObjects.move(this._dragObject, at, this._dragOffset);
        return true;
    }

    isDragging(): boolean {
        return this._dragObject !== undefined;
    }

    endDrag(): void {
        this._dragObject = undefined;
        this._dragOffset = undefined;
    }

    addPasted(object: Omit<PastedObject, 'id'>): PastedObject {
        return this.pastedObjects.add(object);
    }

    snapshot(): AnnotationSnapshot {
        return { strokes: this.drawing.strokes, objects: this.pastedObjects.objects };
    }
}
