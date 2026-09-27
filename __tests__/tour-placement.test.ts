import { describe, expect, it } from 'vitest'
import { placeTourPanel, type TourBox } from '../lib/tours/placement'
const box = (left: number, top: number, width: number, height: number): TourBox => ({ left, top, right: left + width, bottom: top + height, width, height })
describe('tour panel placement', () => {
  it('uses the first available side and expands the target outline', () => expect(placeTourPanel({ target: box(100, 100, 50, 50), panel: { width: 100, height: 80 }, viewport: { width: 500, height: 400 } })).toEqual({ left: 172, top: 94, side: 'right' }))
  it('places beside the whole context', () => expect(placeTourPanel({ target: box(100, 100, 20, 20), context: box(50, 50, 200, 200), panel: { width: 100, height: 80 }, viewport: { width: 500, height: 400 } }).left).toBe(266))
  it('falls back to a least-overlap corner in a narrow viewport', () => expect(placeTourPanel({ target: box(0, 0, 390, 844), panel: { width: 358, height: 500 }, viewport: { width: 390, height: 844 } }).side).toBe('corner'))
})
