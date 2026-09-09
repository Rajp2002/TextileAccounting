import { afterEach, describe, expect, it, vi } from 'vitest'
import { clipTourRect, findTourTarget, isTourTargetVisible } from '../lib/tutorial-target'

function element(options: { connected?: boolean; laidOut?: boolean; width?: number; parent?: HTMLElement; style?: Record<string, string> } = {}) {
    return {
        isConnected: options.connected ?? true,
        parentElement: options.parent ?? null,
        getClientRects: () => options.laidOut === false ? [] : [{}],
        getBoundingClientRect: () => ({ left: 0, top: 1000, right: options.width ?? 100, bottom: 1040, width: options.width ?? 100, height: 40 }),
        computedStyle: { display: 'block', visibility: 'visible', opacity: '1', ...options.style },
    } as unknown as HTMLElement
}

function mockWindow() {
    vi.stubGlobal('window', { getComputedStyle: (node: { computedStyle: unknown }) => node.computedStyle })
}
afterEach(() => vi.unstubAllGlobals())

describe('tour target selection', () => {
    it('chooses a visible mobile duplicate after the hidden desktop version', () => {
        mockWindow()
        const desktop = element({ parent: element({ style: { display: 'none' } }) })
        const mobile = element()
        vi.stubGlobal('document', { querySelectorAll: () => [desktop, mobile] })
        expect(findTourTarget('[data-estimator-field="savedQualities"]')).toBe(mobile)
    })
    it.each(['hidden', 'collapse'])('rejects %s targets', visibility => {
        mockWindow()
        expect(isTourTargetVisible(element({ style: { visibility } }))).toBe(false)
    })
    it('rejects targets inside transparent ancestors', () => {
        mockWindow()
        expect(isTourTargetVisible(element({ parent: element({ style: { opacity: '0' } }) }))).toBe(false)
    })
    it.each([{ connected: false }, { laidOut: false }, { width: 0 }])('rejects detached or unlaid-out targets: %j', options => {
        mockWindow()
        expect(isTourTargetVisible(element(options))).toBe(false)
    })
    it('keeps rendered targets below the fold eligible for scrolling', () => {
        mockWindow()
        expect(isTourTargetVisible(element())).toBe(true)
    })
    it('returns no substitute when the requested control is unavailable', () => {
        mockWindow()
        vi.stubGlobal('document', { querySelectorAll: () => [element({ laidOut: false })] })
        expect(findTourTarget('[data-ratebook-field="reviewRailWidget"]')).toBeNull()
    })
})

describe('mobile spotlight clipping', () => {
    const bounds = { left: 8, right: 367, top: 72, bottom: 460 }
    it('excludes the header, page edges and reading panel from a large target', () => {
        expect(clipTourRect({ left: -20, right: 600, top: 10, bottom: 700 }, bounds)).toEqual({ ...bounds, width: 359, height: 388 })
    })
    it('does not highlight a target completely behind the reading panel', () => {
        expect(clipTourRect({ left: 20, right: 300, top: 500, bottom: 560 }, bounds)).toBeNull()
    })
    it('clips to a nested drawer scrollport', () => {
        const viewportRect = clipTourRect({ left: 20, right: 300, top: 100, bottom: 500 }, bounds)!
        expect(clipTourRect(viewportRect, { left: 0, right: 375, top: 240, bottom: 800 })).toEqual({ left: 20, right: 300, top: 240, bottom: 460, width: 280, height: 220 })
    })
    it('does not draw a zero-area spotlight on a viewport edge', () => {
        expect(clipTourRect({ left: 367, right: 400, top: 100, bottom: 150 }, bounds)).toBeNull()
    })
})
