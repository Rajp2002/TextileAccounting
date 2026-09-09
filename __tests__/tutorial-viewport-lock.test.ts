import { afterEach, describe, expect, it, vi } from 'vitest'
import { lockTourViewport } from '../lib/tutorial-viewport-lock'

function setup() {
    const events = new Map<string, EventListener>()
    class Box {
        scrollTop = 0
        clientHeight = 100
        scrollHeight = 300
        button = false
        contains(node: unknown) { return node === this }
        closest() { return this.button ? this : null }
        scrollBy = vi.fn()
    }
    const area = new Box()
    const outside = new Box()
    const button = new Box()
    button.button = true
    const panel = { querySelector: () => area } as unknown as HTMLElement
    vi.stubGlobal('Node', Box)
    vi.stubGlobal('Element', Box)
    vi.stubGlobal('document', {
        addEventListener: (name: string, cb: EventListener) => events.set(name, cb),
        removeEventListener: (name: string) => events.delete(name),
    })
    const cleanup = lockTourViewport(panel)
    const fire = (type: string, options: Record<string, unknown> = {}) => {
        const event = { target: outside, preventDefault: vi.fn(), ...options }
        events.get(type)?.(event as unknown as Event)
        return event
    }
    return { area, button, events, cleanup, fire }
}
afterEach(() => vi.unstubAllGlobals())

describe('tour viewport stays aligned with the selected step', () => {
    it('blocks wheel scrolling on the underlying page and tour buttons', () => {
        const h = setup()
        expect(h.fire('wheel', { deltaY: 100 }).preventDefault).toHaveBeenCalled()
        expect(h.fire('wheel', { target: h.button, deltaY: 100 }).preventDefault).toHaveBeenCalled()
    })
    it('allows scrolling long explanations but stops scroll chaining at both boundaries', () => {
        const h = setup()
        expect(h.fire('wheel', { target: h.area, deltaY: 100 }).preventDefault).not.toHaveBeenCalled()
        expect(h.fire('wheel', { target: h.area, deltaY: -100 }).preventDefault).toHaveBeenCalled()
        h.area.scrollTop = 200
        expect(h.fire('wheel', { target: h.area, deltaY: 100 }).preventDefault).toHaveBeenCalled()
    })
    it('blocks page swipes while allowing swipes within the explanation', () => {
        const h = setup()
        h.fire('touchstart', { touches: [{ clientY: 300 }] })
        expect(h.fire('touchmove', { touches: [{ clientY: 250 }] }).preventDefault).toHaveBeenCalled()
        expect(h.fire('touchmove', { target: h.area, touches: [{ clientY: 200 }] }).preventDefault).not.toHaveBeenCalled()
    })
    it('routes keyboard scrolling into the explanation and preserves button activation', () => {
        const h = setup()
        expect(h.fire('keydown', { key: 'PageDown' }).preventDefault).toHaveBeenCalled()
        expect(h.area.scrollBy).toHaveBeenCalledWith({ top: 76, behavior: 'instant' })
        expect(h.fire('keydown', { key: ' ', target: h.button }).preventDefault).not.toHaveBeenCalled()
        expect(h.fire('keydown', { key: 'Escape' }).preventDefault).not.toHaveBeenCalled()
    })
    it('preserves pinch and browser zoom and releases every listener on close', () => {
        const h = setup()
        expect(h.fire('wheel', { ctrlKey: true, deltaY: 100 }).preventDefault).not.toHaveBeenCalled()
        expect(h.fire('touchmove', { touches: [{ clientY: 100 }, { clientY: 200 }] }).preventDefault).not.toHaveBeenCalled()
        h.cleanup()
        expect(h.events.size).toBe(0)
    })
})
