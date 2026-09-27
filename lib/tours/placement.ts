export type TourBox = { left: number; top: number; right: number; bottom: number; width: number; height: number }
export type TourPanelPlacement = { left: number; top: number; side: 'right' | 'left' | 'below' | 'above' | 'corner' }

const intersects = (a: TourBox, b: TourBox) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
const area = (a: TourBox, b: TourBox) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

export function placeTourPanel({ target, context, panel, viewport, gap = 16, margin = 16 }: {
  target: TourBox; context?: TourBox | null; panel: { width: number; height: number }; viewport: { width: number; height: number }; gap?: number; margin?: number
}): TourPanelPlacement {
  const outline = { left: target.left - 6, top: target.top - 6, right: target.right + 6, bottom: target.bottom + 6, width: target.width + 12, height: target.height + 12 }
  const union = context ? { left: Math.min(outline.left, context.left), top: Math.min(outline.top, context.top), right: Math.max(outline.right, context.right), bottom: Math.max(outline.bottom, context.bottom), width: 0, height: 0 } : outline
  union.width = union.right - union.left; union.height = union.bottom - union.top
  const box = (left: number, top: number) => ({ left, top, right: left + panel.width, bottom: top + panel.height, width: panel.width, height: panel.height })
  const candidates = [
    { side: 'right' as const, ...box(union.right + gap, clamp(union.top, margin, viewport.height - panel.height - margin)) },
    { side: 'left' as const, ...box(union.left - gap - panel.width, clamp(union.top, margin, viewport.height - panel.height - margin)) },
    { side: 'below' as const, ...box(clamp(union.left, margin, viewport.width - panel.width - margin), union.bottom + gap) },
    { side: 'above' as const, ...box(clamp(union.left, margin, viewport.width - panel.width - margin), union.top - gap - panel.height) },
  ]
  const valid = candidates.find(c => c.left >= margin && c.top >= margin && c.right <= viewport.width - margin && c.bottom <= viewport.height - margin && !intersects(c, outline) && (!context || !intersects(c, context)))
  if (valid) return { left: valid.left, top: valid.top, side: valid.side }
  const corners = [box(viewport.width - margin - panel.width, margin), box(viewport.width - margin - panel.width, viewport.height - margin - panel.height), box(margin, margin), box(margin, viewport.height - margin - panel.height)]
  const best = corners.reduce((winner, candidate) => area(candidate, outline) + (context ? area(candidate, context) : 0) < area(winner, outline) + (context ? area(winner, context) : 0) ? candidate : winner)
  return { left: best.left, top: best.top, side: 'corner' }
}
