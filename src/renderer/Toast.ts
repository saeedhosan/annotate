export class Toast {
    private timer: number | undefined;

    show(message: string, duration = 2000): void {
        let el = document.querySelector<HTMLElement>('#toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            el.style.cssText =
                'position:fixed;right:16px;bottom:16px;padding:7px 10px;border-radius:7px;color:#fff;background:rgba(20,20,24,.72);font:12px/1.4 system-ui,sans-serif;pointer-events:none;z-index:9999;opacity:0;transition:opacity .15s ease;';
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.style.opacity = '1';
        clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
            el!.style.opacity = '0';
            this.timer = window.setTimeout(() => el!.remove(), 180);
        }, duration);
    }
}
