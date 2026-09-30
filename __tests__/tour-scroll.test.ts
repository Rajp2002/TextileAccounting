import { afterEach, describe, expect, it, vi } from 'vitest'
import { restoreScroll, scrollIntoSafeView, type ScrollRecord } from '../lib/tours/tour-scroll'
const rect = (top: number, height: number) => ({ left: 20, top, right: 220, bottom: top + height, width: 200, height })
const safe = { left: 16, top: 16, right: 984, bottom: 784, width: 968, height: 768 }
function setup(nested = false) {
    const root = { parentElement: null }
    const body = { parentElement: root }
    const scroller = { parentElement: body, scrollTop: 60, scrollLeft: 4, scrollHeight: 1500, clientHeight: 300, getBoundingClientRect: () => rect(150, 300), scrollTo: vi.fn() }
    let targetRect = rect(900, 40)
    const target = { parentElement: nested ? scroller : body, getBoundingClientRect: () => targetRect } as unknown as HTMLElement
    const browser = { scrollX: 13, scrollY: 30, scrollTo: vi.fn(), getComputedStyle: (el: unknown) => ({ overflowY: el === scroller ? 'auto' : 'visible' }) }
    vi.stubGlobal('window', browser); vi.stubGlobal('document', { scrollingElement: root, documentElement: root, body })
    const record: ScrollRecord = new Map()
    return { target, scroller, browser, record, place: (top: number, height = 40) => { targetRect = rect(top, height) } }
}
afterEach(() => vi.unstubAllGlobals())
describe('tour-owned scrolling', () => {
    it('leaves a fully visible target and its record untouched', () => {
        const h = setup(); h.place(100)
        expect(scrollIntoSafeView(h.target, safe, false, h.record)).toBe(false)
        expect(h.browser.scrollTo).not.toHaveBeenCalled(); expect(h.record.size).toBe(0)
    })
    it('centres an offscreen target with smooth window scrolling', () => {
        const h = setup()
        expect(scrollIntoSafeView(h.target, safe, false, h.record)).toBe(true)
        expect(h.browser.scrollTo).toHaveBeenCalledWith({ left: 13, top: 550, behavior: 'smooth' })
    })
    it('scrolls the nearest container without scrolling the window', () => {
        const h = setup(true)
        scrollIntoSafeView(h.target, safe, false, h.record)
        expect(h.scroller.scrollTo).toHaveBeenCalledWith({ left: 4, top: 680, behavior: 'smooth' })
        expect(h.browser.scrollTo).not.toHaveBeenCalled()
    })
    it('top-aligns an oversized target and uses instant scroll for reduced motion', () => {
        const h = setup(); h.place(900, 900)
        scrollIntoSafeView(h.target, safe, true, h.record)
        expect(h.browser.scrollTo).toHaveBeenCalledWith({ left: 13, top: 914, behavior: 'instant' })
    })
    it('records only the first position and restores each changed container instantly', () => {
        const h = setup(true)
        scrollIntoSafeView(h.target, safe, false, h.record)
        h.scroller.scrollTop = 680
        scrollIntoSafeView(h.target, safe, false, h.record)
        restoreScroll(h.record)
        expect(h.scroller.scrollTo).toHaveBeenLastCalledWith({ left: 4, top: 60, behavior: 'instant' })
        expect(h.record.size).toBe(0)
    })
})
