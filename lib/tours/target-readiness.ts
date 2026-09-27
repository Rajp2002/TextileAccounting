import { isTourTargetVisible } from '@/lib/tutorial-target'
import type { TourBox } from './placement'

const rectBox = (r: DOMRect): TourBox => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height })
export function resolveTourTarget(anchor: string, context?: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(anchor)).filter(isTourTargetVisible)
  if (process.env.NODE_ENV !== 'production' && matches.length > 1) console.warn('[tour] duplicate target', anchor)
  return (context ? matches.find(element => element.closest(context)) : undefined) ?? matches[0] ?? null
}
export function watchTourTarget({ resolve, onReady, onUnavailable, budgetMs = 1500, stableFrames = 2, raf = requestAnimationFrame, caf = cancelAnimationFrame, now = () => performance.now() }: {
  resolve: () => HTMLElement | null; onReady: (element: HTMLElement, rect: TourBox) => void; onUnavailable: () => void; budgetMs?: number; stableFrames?: number; raf?: (callback: FrameRequestCallback) => number; caf?: (id: number) => void; now?: () => number
}): () => void {
  const started = now(); let frame = 0; let previous: TourBox | null = null; let stable = 0; let stopped = false
  const tick = () => {
    if (stopped) return
    const element = resolve()
    if (isTourTargetVisible(element)) {
      const rect = rectBox(element.getBoundingClientRect())
      stable = previous && ['left', 'top', 'right', 'bottom'].every(key => Math.abs(rect[key as keyof TourBox] - previous![key as keyof TourBox]) <= 1) ? stable + 1 : 0
      previous = rect
      if (stable >= stableFrames) { onReady(element, rect); return }
    } else { previous = null; stable = 0 }
    if (now() - started >= budgetMs) { onUnavailable(); return }
    frame = raf(tick)
  }
  frame = raf(tick)
  return () => { stopped = true; caf(frame) }
}
