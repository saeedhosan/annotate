const STYLE_KEEP =
    /^(color|font|font-family|font-size|font-weight|font-style|font-variant|text-decoration|text-align|text-shadow|line-height|letter-spacing|word-spacing|vertical-align|white-space)$/;

export class HtmlSanitizer {
    sanitize(html: string): string {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll(
            'script, style, iframe, object, embed, link, meta, form, input, button, textarea, select, video, audio, svg',
        ).forEach((el) => el.remove());
        doc.querySelectorAll('*').forEach((el) => {
            for (const attr of [...el.attributes]) {
                const name = attr.name.toLowerCase();
                if (name.startsWith('on')) {
                    el.removeAttribute(name);
                    continue;
                }
                if (name === 'style') {
                    const parts = (attr.value || '')
                        .split(';')
                        .map((piece) => {
                            const idx = piece.indexOf(':');
                            if (idx < 0) return null;
                            const prop = piece.slice(0, idx).trim().toLowerCase();
                            return STYLE_KEEP.test(prop) ? piece.trim() : null;
                        })
                        .filter((piece): piece is string => piece !== null);
                    if (parts.length) el.setAttribute('style', parts.join(';'));
                    else el.removeAttribute('style');
                } else if (
                    !['color', 'face', 'size', 'src', 'align', 'valign', 'nowrap'].includes(name)
                )
                    el.removeAttribute(name);
            }
            if (el.tagName === 'A') el.removeAttribute('href');
        });
        return doc.body.innerHTML.trim();
    }
}
