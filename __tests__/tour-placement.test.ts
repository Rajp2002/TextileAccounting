import { describe, expect, it } from 'vitest'
import { expandTourRect, placeTourPanel } from '../lib/tours/placement'
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height })

describe('tour panel placement', () => {
    it.each([
        [rect(100, 100, 100, 40), { width: 200, height: 100 }, { width: 1000, height: 600 }, { left: 222, top: 94, side: 'right' }],
        [rect(750, 100, 80, 40), { width: 200, height: 100 }, { width: 1000, height: 600 }, { left: 528, top: 94, side: 'left' }],
        [rect(200, 100, 200, 40), { width: 300, height: 200 }, { width: 600, height: 600 }, { left: 194, top: 162, side: 'below' }],
        [rect(200, 450, 200, 40), { width: 300, height: 200 }, { width: 600, height: 600 }, { left: 194, top: 228, side: 'above' }],
    ])('chooses the first fitting side for %j', (target, panel, viewport, expected) => {
        expect(placeTourPanel({ target, panel, viewport })).toEqual(expected)
    })
    it('uses top-right when all fallback corner intersections tie', () => {
        expect(placeTourPanel({ target: rect(0, 0, 1000, 600), panel: { width: 200, height: 100 }, viewport: { width: 1000, height: 600 } })).toEqual({ left: 784, top: 16, side: 'corner' })
    })
    it('chooses the least intersecting fallback corner', () => {
        expect(placeTourPanel({ target: rect(10, 10, 900, 550), panel: { width: 200, height: 100 }, viewport: { width: 1000, height: 600 } })).toEqual({ left: 784, top: 484, side: 'corner' })
    })
    it('reserves the whole sample dialog, not only the small target inside it', () => {
        const result = placeTourPanel({ target: rect(300, 200, 50, 40), context: rect(100, 100, 600, 400), panel: { width: 360, height: 280 }, viewport: { width: 1440, height: 900 } })
        expect(result).toEqual({ left: 716, top: 100, side: 'right' })
    })
    it('clamps side alignment at the viewport margin', () => {
        expect(placeTourPanel({ target: rect(100, 560, 100, 20), panel: { width: 200, height: 100 }, viewport: { width: 1000, height: 600 } }).top).toBe(484)
    })
    it('returns a corner without throwing on a 390px viewport', () => {
        expect(placeTourPanel({ target: rect(10, 0, 370, 844), panel: { width: 360, height: 280 }, viewport: { width: 390, height: 844 } }).side).toBe('corner')
    })
    it('expands the target by exactly six pixels', () => {
        expect(expandTourRect(rect(100, 100, 40, 50))).toEqual(rect(94, 94, 52, 62))
    })
})
