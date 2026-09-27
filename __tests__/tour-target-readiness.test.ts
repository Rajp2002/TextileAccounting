import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTourTarget, watchTourTarget } from '../lib/tours/target-readiness'

function setup() {
    let top = 100
    let clock = 0
    let counter = 0
    let hidden = false
    const frames = new Map<number, FrameRequestCallback>()
    const element = {
        isConnected: true, parentElement: null,
        getClientRects: () => hidden ? [] : [{}],
        getBoundingClientRect: () => ({ left: 10, top, right: 110, bottom: top + 40, width: 100, height: 40 }),
        closest: () => null,
    } as unknown as HTMLElement
    vi.stubGlobal('window', { getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }) })
    const raf = (callback: FrameRequestCallback) => { frames.set(++counter, callback); return counter }
    const caf = (id: number) => { frames.delete(id) }
    const tick = (ms = 16) => { clock += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(clock)) }
    return { element, raf, caf, now: () => clock, tick, frames, move: (value: number) => { top = value }, hide: () => { hidden = true } }
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('tour target readiness', () => {
    it('waits for two stable frames, including subpixel movement', () => {
        const h = setup(), ready = vi.fn()
        watchTourTarget({ ...h, resolve: () => h.element, onReady: ready, onUnavailable: vi.fn() })
        h.tick(); expect(ready).not.toHaveBeenCalled()
        h.move(100.5); h.tick(); expect(ready).toHaveBeenCalledTimes(1)
        expect(h.frames.size).toBe(0)
    })
    it('restarts stability after movement or target replacement', () => {
        const h = setup(), ready = vi.fn()
        let target = h.element
        watchTourTarget({ ...h, resolve: () => target, onReady: ready, onUnavailable: vi.fn() })
        h.tick(); h.move(105); h.tick(); expect(ready).not.toHaveBeenCalled()
        target = { ...h.element } as HTMLElement
        h.tick(); expect(ready).not.toHaveBeenCalled()
        h.tick(); expect(ready).toHaveBeenCalledTimes(1)
    })
    it('reports unavailable exactly once at the budget and stops polling', () => {
        const h = setup(), unavailable = vi.fn(), ready = vi.fn()
        watchTourTarget({ ...h, resolve: () => null, onReady: ready, onUnavailable: unavailable })
        h.tick(1499); expect(unavailable).not.toHaveBeenCalled()
        h.tick(1); h.tick(); expect(unavailable).toHaveBeenCalledTimes(1)
        expect(ready).not.toHaveBeenCalled(); expect(h.frames.size).toBe(0)
    })
    it.each(['hidden', 'disconnected'])('does not accept a %s target', kind => {
        const h = setup(), ready = vi.fn()
        if (kind === 'hidden') h.hide(); else Object.assign(h.element, { isConnected: false })
        watchTourTarget({ ...h, resolve: () => h.element, onReady: ready, onUnavailable: vi.fn() })
        h.tick(); h.tick(); expect(ready).not.toHaveBeenCalled()
    })
    it('cancel prevents every callback and removes its scheduled frame', () => {
        const h = setup(), ready = vi.fn(), unavailable = vi.fn()
        const cancel = watchTourTarget({ ...h, resolve: () => h.element, onReady: ready, onUnavailable: unavailable })
        h.tick(); cancel(); h.tick(2000)
        expect(ready).not.toHaveBeenCalled(); expect(unavailable).not.toHaveBeenCalled(); expect(h.frames.size).toBe(0)
    })
    it('prefers visible matches inside the context and warns only in development', () => {
        const h = setup(), inside = { ...h.element, closest: () => ({}) } as unknown as HTMLElement
        const hidden = { ...h.element, getClientRects: () => [] } as unknown as HTMLElement
        vi.stubGlobal('document', { querySelectorAll: () => [hidden, h.element, inside] })
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.stubEnv('NODE_ENV', 'development')
        expect(resolveTourTarget('[target]', '[context]', { tourId: 'production', stepId: 'first' })).toBe(inside)
        expect(warn).toHaveBeenCalledWith('[tour] duplicate target', 'production', 'first')
        warn.mockClear(); vi.stubEnv('NODE_ENV', 'production')
        expect(resolveTourTarget('[target]')).toBe(h.element); expect(warn).not.toHaveBeenCalled()
    })
})
