export type Rect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>
export type Placement = { left: number; top: number; side: 'right' | 'left' | 'below' | 'above' | 'corner' }

export function expandTourRect(rect: Rect, padding = 6): Rect {
    return { left: rect.left - padding, top: rect.top - padding, right: rect.right + padding, bottom: rect.bottom + padding, width: rect.width + padding * 2, height: rect.height + padding * 2 }
}

export function placeTourPanel({ target, context, panel, viewport, gap = 16, margin = 16 }: {
    target: Rect; context?: Rect | null; panel: { width: number; height: number }
    viewport: { width: number; height: number }; gap?: number; margin?: number
}): Placement {
    const outline = expandTourRect(target)
    const union = {
        left: Math.min(outline.left, context?.left ?? outline.left),
        top: Math.min(outline.top, context?.top ?? outline.top),
        right: Math.max(outline.right, context?.right ?? outline.right),
        bottom: Math.max(outline.bottom, context?.bottom ?? outline.bottom),
    }
    const maxLeft = viewport.width - panel.width - margin
    const maxTop = viewport.height - panel.height - margin
    const clamp = (value: number, max: number) => Math.max(margin, Math.min(value, max))
    const area = (p: Placement, box: Rect) => Math.max(0, Math.min(p.left + panel.width, box.right) - Math.max(p.left, box.left))
        * Math.max(0, Math.min(p.top + panel.height, box.bottom) - Math.max(p.top, box.top))
    const overlap = (p: Placement) => area(p, outline) + (context ? area(p, context) : 0)
    const candidates: Placement[] = [
        { left: union.right + gap, top: clamp(union.top, maxTop), side: 'right' },
        { left: union.left - gap - panel.width, top: clamp(union.top, maxTop), side: 'left' },
        { left: clamp(union.left, maxLeft), top: union.bottom + gap, side: 'below' },
        { left: clamp(union.left, maxLeft), top: union.top - gap - panel.height, side: 'above' },
    ]
    const valid = candidates.find(p => p.left >= margin && p.top >= margin && p.left <= maxLeft && p.top <= maxTop && overlap(p) === 0)
    if (valid) return valid
    const corners: Placement[] = [
        { left: maxLeft, top: margin, side: 'corner' }, { left: maxLeft, top: maxTop, side: 'corner' },
        { left: margin, top: margin, side: 'corner' }, { left: margin, top: maxTop, side: 'corner' },
    ]
    return corners.reduce((best, next) => overlap(next) < overlap(best) ? next : best)
}
