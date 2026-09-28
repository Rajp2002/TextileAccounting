import type { Rect } from './weave-timeline'

/**
 * Where an `object-fit: contain` image actually draws inside its box.
 *
 * @param box            rendered box of the <img> (including any CSS transform on it)
 * @param natural        intrinsic image size
 * @param objectPosition computed `object-position`, e.g. "0% 50%" or "50% 50%"
 */
export function containedImageRect(box: Rect, natural: { width: number; height: number }, objectPosition: string): Rect {
    const k = Math.min(box.w / natural.width, box.h / natural.height)
    const w = natural.width * k
    const h = natural.height * k
    const [px, py] = parseObjectPosition(objectPosition)
    return { x: box.x + (box.w - w) * px, y: box.y + (box.h - h) * py, w, h }
}

/** The logo's opaque ink inside a drawn image rect. */
export function inkRect(drawn: Rect, natural: { width: number; height: number }, ink: { x0: number; y0: number; x1: number; y1: number }): Rect {
    const k = drawn.w / natural.width
    return { x: drawn.x + ink.x0 * k, y: drawn.y + ink.y0 * k, w: (ink.x1 - ink.x0) * k, h: (ink.y1 - ink.y0) * k }
}

function keyword(value: string, axis: 'x' | 'y'): number | null {
    if (value === 'center') return 0.5
    if (axis === 'x' && value === 'left') return 0
    if (axis === 'x' && value === 'right') return 1
    if (axis === 'y' && value === 'top') return 0
    if (axis === 'y' && value === 'bottom') return 1
    if (value.endsWith('%')) {
        const n = Number.parseFloat(value)
        return Number.isFinite(n) ? n / 100 : null
    }
    return null
}

/** Supports the forms browsers return from getComputedStyle (percentages) plus keywords. */
export function parseObjectPosition(value: string): [number, number] {
    const parts = value.trim().split(/\s+/).filter(Boolean)
    const x = parts[0] ? keyword(parts[0], 'x') : null
    const y = parts[1] ? keyword(parts[1], 'y') : null
    return [x ?? 0.5, y ?? 0.5]
}
