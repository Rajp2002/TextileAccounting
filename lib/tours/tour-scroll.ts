import { findTourScrollContainer } from '@/lib/tutorial-target'
import type { TourBox } from './placement'

export type ScrollRecord = Map<HTMLElement | Window, { left: number; top: number }>
export function scrollIntoSafeView(target: HTMLElement, safe: TourBox, reducedMotion: boolean, record: ScrollRecord): void {
  const rect = target.getBoundingClientRect()
  if (rect.left >= safe.left && rect.right <= safe.right && rect.top >= safe.top && rect.bottom <= safe.bottom) return
  const container = findTourScrollContainer(target); const root = document.scrollingElement ?? document.documentElement
  const destination: HTMLElement | Window = container === root ? window : container
  if (!record.has(destination)) record.set(destination, destination === window ? { left: window.scrollX, top: window.scrollY } : { left: container.scrollLeft, top: container.scrollTop })
  const viewport = destination === window ? safe : container.getBoundingClientRect()
  const delta = rect.height > viewport.height ? rect.top - viewport.top : rect.top - (viewport.top + (viewport.height - rect.height) / 2)
  destination.scrollBy({ top: delta, behavior: reducedMotion ? 'instant' : 'smooth' })
}
export function restoreScroll(record: ScrollRecord): void {
  record.forEach((position, target) => target.scrollTo({ left: position.left, top: position.top, behavior: 'instant' }))
  record.clear()
}
