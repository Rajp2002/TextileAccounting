import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackMobileTourTarget } from '../lib/mobile-tour-positioning'

function harness() {
    vi.useFakeTimers()
    let top = 900
    let clock = 0
    let id = 0
    const frames = new Map<number, FrameRequestCallback>()
    const events = new Map<string, (() => void)[]>()
    const viewportEvents = new Map<string, (() => void)[]>()
    const listen = (map: typeof events) => (event: string, callback: () => void) => map.set(event, [...(map.get(event) ?? []), callback])
    const remove = (map: typeof events) => (event: string, callback: () => void) => map.set(event, (map.get(event) ?? []).filter(cb => cb !== callback))
    const rect = (y: number, height = 40) => ({ left: 20, right: 370, top: y, bottom: y + height, width: 350, height })
    const root = { style: { paddingBottom: '0px' }, parentElement: null, getBoundingClientRect: () => rect(-1000, 10000) }
    const body = { style: { paddingBottom: '12px' }, parentElement: root, getBoundingClientRect: () => rect(-1000, 10000) }
    const target = {
        isConnected: true, parentElement: body,
        getClientRects: () => [rect(top)], getBoundingClientRect: () => rect(top),
        closest: () => null, scrollIntoView: vi.fn(),
    } as unknown as HTMLElement
    const panel = { getBoundingClientRect: () => rect(550, 250) } as unknown as HTMLElement
    const scrollBy = vi.fn(({ top: delta }: { top: number }) => { top -= delta })
    const style = () => ({ display: 'block', visibility: 'visible', opacity: '1', overflowX: 'visible', overflowY: 'visible' })
    let notifyResize = () => {}
    vi.stubGlobal('document', { documentElement: root, scrollingElement: root, body })
    vi.stubGlobal('getComputedStyle', style)
    vi.stubGlobal('window', {
        innerWidth: 393, innerHeight: 852, getComputedStyle: style, scrollBy,
        addEventListener: listen(events), removeEventListener: remove(events),
        visualViewport: { offsetTop: 0, height: 852, addEventListener: listen(viewportEvents), removeEventListener: remove(viewportEvents) },
    })
    vi.stubGlobal('performance', { now: () => clock })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id })
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
    vi.stubGlobal('ResizeObserver', class {
        constructor(cb: () => void) { notifyResize = cb }
        observe() {}
        disconnect() { notifyResize = () => {} }
    })
    const tick = () => {
        clock += 16
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach(cb => cb(clock))
    }
    const drain = () => {
        let iterations = 0
        while (frames.size && iterations++ < 200) {
            clock += 16
            const pending = [...frames.values()]
            frames.clear()
            pending.forEach(cb => cb(clock))
        }
        expect(iterations).toBeLessThan(200)
    }
    const resize = () => {
        notifyResize()
        for (const callbacks of [...events.values(), ...viewportEvents.values()]) callbacks.forEach(cb => cb())
    }
    return { target, panel, scrollBy, tick, drain, resize, frames, root, body, setTop: (value: number) => { top = value } }
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('mobile tour event feedback', () => {
    it('does not scroll again in response to repeated iOS viewport and panel resize events', () => {
        const h = harness()
        const measured = vi.fn()
        const cleanup = trackMobileTourTarget(() => h.target, () => h.panel, measured)
        h.drain()
        expect(h.scrollBy).toHaveBeenCalledTimes(1)
        expect(h.target.scrollIntoView).not.toHaveBeenCalled()
        for (let i = 0; i < 50; i++) { h.resize(); h.drain() }
        expect(h.scrollBy).toHaveBeenCalledTimes(1)
        expect(measured.mock.lastCall?.[0]).toMatchObject({ height: 40 })
        expect(h.root.style.paddingBottom).toBe('0px')
        cleanup()
        expect(h.body.style.paddingBottom).toBe('12px')
        h.resize()
        expect(h.frames.size).toBe(0)
    })
    it('clears a highlight when delayed browser scrolling moves its field offscreen', () => {
        const h = harness()
        const measured = vi.fn()
        const cleanup = trackMobileTourTarget(() => h.target, () => h.panel, measured)
        h.drain()
        h.scrollBy.mockImplementation(() => {})
        h.setTop(-200)
        h.resize()
        h.drain()
        expect(measured).toHaveBeenLastCalledWith(null)
        // Retries remain bounded even if scrolling is unable to move the target.
        expect(h.scrollBy.mock.calls.length).toBeLessThanOrEqual(3)
        cleanup()
    })
    it('refreshes after a delayed scroll even when the browser emits no scroll event', () => {
        const h = harness()
        h.scrollBy.mockImplementation(() => {})
        const measured = vi.fn()
        const cleanup = trackMobileTourTarget(() => h.target, () => h.panel, measured)
        h.tick() // Issue the single scroll command.
        h.tick() // Still outside the visible band; wait for layout within the budget.
        expect(measured).toHaveBeenLastCalledWith(null)
        // Layout catches up on a later frame, with no scroll/resize notification or timer.
        h.setTop(240)
        h.drain()
        expect(measured).toHaveBeenLastCalledWith(expect.objectContaining({ top: 240, height: 40 }))
        expect(h.scrollBy).toHaveBeenCalledTimes(1)
        cleanup()
        expect(vi.getTimerCount()).toBe(0)
    })
    it('stops waiting for a missing target without starving navigation or scheduling forever', () => {
        const h = harness()
        const measured = vi.fn()
        const cleanup = trackMobileTourTarget(() => null, () => h.panel, measured)
        h.drain()
        expect(h.frames.size).toBe(0)
        expect(h.scrollBy).not.toHaveBeenCalled()
        expect(measured).toHaveBeenLastCalledWith(null)
        cleanup()
    })
    it('cancels the old step before the next step can measure', () => {
        const h = harness()
        const previous = vi.fn()
        const cleanup = trackMobileTourTarget(() => h.target, () => h.panel, previous)
        cleanup()
        h.drain()
        expect(previous).not.toHaveBeenCalled()
        expect(h.scrollBy).not.toHaveBeenCalled()
    })
})
