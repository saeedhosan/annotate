import { PALETTE } from '../config/colors';
import type { AnnotationSnapshot } from '../shared/Annotate';
import type { PastedObject } from '../shared/PastedObjectStore';
import type { Stroke } from '../shared/Drawing';

export class Renderer {
    private readonly context: CanvasRenderingContext2D;
    private readonly imageCache = new Map<string, HTMLImageElement>();
    private readonly richElements = new Map<number, HTMLDivElement>();
    private last: AnnotationSnapshot | undefined;

    constructor(private readonly canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        this.context = ctx;
    }

    resize(): void {
        this.canvas.width = innerWidth * devicePixelRatio;
        this.canvas.height = innerHeight * devicePixelRatio;
        this.canvas.style.width = `${innerWidth}px`;
        this.canvas.style.height = `${innerHeight}px`;
        this.context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        if (this.last) this.render(this.last);
    }

    render(snapshot: AnnotationSnapshot): void {
        this.last = snapshot;
        const ctx = this.context;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        for (const object of snapshot.objects) this.renderPasted(object);
        for (const stroke of snapshot.strokes) this.renderStroke(stroke);
    }

    measureText(text: string): number {
        return this.context.measureText(text).width;
    }

    clearRich(): void {
        for (const el of this.richElements.values()) el.remove();
        this.richElements.clear();
    }

    removeRich(id: number): void {
        this.richElements.get(id)?.remove();
        this.richElements.delete(id);
    }

    measureRich(object: PastedObject): void {
        const el = this.placeRich(object);
        const rect = el.getBoundingClientRect();
        object.width = Math.max(1, Math.round(rect.width));
        object.height = Math.max(1, Math.round(rect.height));
    }

    private renderStroke(stroke: Stroke): void {
        if (!stroke.points.length) return;
        const ctx = this.context;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
        if (stroke.points.length === 1)
            ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y + 0.1);
        ctx.stroke();
    }

    private renderPasted(object: PastedObject): void {
        if (object.kind === 'text') {
            const ctx = this.context;
            ctx.fillStyle = object.color ?? PALETTE.textPrimary;
            ctx.font = '20px sans-serif';
            ctx.textBaseline = 'top';
            ctx.fillText(object.value, object.x, object.y);
            return;
        }
        if (object.kind === 'image') {
            const cached = this.imageCache.get(object.value);
            if (cached) {
                this.context.drawImage(cached, object.x, object.y, object.width, object.height);
                return;
            }
            const image = new Image();
            image.onload = () => {
                this.imageCache.set(object.value, image);
                if (this.last) this.render(this.last);
            };
            image.src = object.value;
            return;
        }
        this.placeRich(object);
    }

    private placeRich(object: PastedObject): HTMLDivElement {
        let el = this.richElements.get(object.id);
        if (!el) {
            el = document.createElement('div');
            el.style.cssText =
                'position:fixed;left:0;top:0;pointer-events:none;z-index:0;width:max-content;max-width:60vw;';
            el.innerHTML = `<style>p,h1,h2,h3,h4,h5,h6,ul,ol,dl,blockquote,figure,hr{margin:0;padding:0}</style><div>${object.value}</div>`;
            document.body.appendChild(el);
            this.richElements.set(object.id, el);
        }
        el.style.transform = `translate(${object.x}px, ${object.y}px)`;
        return el;
    }
}
