import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMobileKeyboardSnapshot, getServerMobileKeyboardSnapshot, subscribeMobileViewport } from '../lib/mobile-viewport'

const cleanups: (() => void)[] = []

function harness({ coarse = true, visualViewport = true } = {}) {
    class Element { isContentEditable = false }
    class Input extends Element { type = 'text'; readOnly = false; disabled = false; inputMode = '' }
    class Textarea extends Element { readOnly = false; disabled = false }
    const doc = Object.assign(new EventTarget(), {
        activeElement: null as Element | null,
        documentElement: { style: { setProperty: vi.fn(), removeProperty: vi.fn() }, toggleAttribute: vi.fn(), removeAttribute: vi.fn() },
    })
    const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 })
    const media = Object.assign(new EventTarget(), { matches: coarse })
    const win = Object.assign(new EventTarget(), {
        innerWidth: 390, innerHeight: 844,
        visualViewport: visualViewport ? viewport : undefined,
        matchMedia: vi.fn(() => media),
    })
    const frames = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal('window', win)
    vi.stubGlobal('document', doc)
    vi.stubGlobal('HTMLElement', Element)
    vi.stubGlobal('HTMLInputElement', Input)
    vi.stubGlobal('HTMLTextAreaElement', Textarea)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id })
    vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key))
    const flush = () => {
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach(callback => callback(0))
    }
    const subscribe = (listener = vi.fn()) => {
        const cleanup = subscribeMobileViewport(listener)
        cleanups.push(cleanup)
        return { listener, cleanup }
    }
    const focus = (element: Element | null = new Input()) => {
        doc.activeElement = element
        doc.dispatchEvent(new Event(element ? 'focusin' : 'focusout'))
        flush()
    }
    const resize = (height: number) => {
        if (visualViewport) { viewport.height = height; viewport.dispatchEvent(new Event('resize')) }
        else { win.innerHeight = height; win.dispatchEvent(new Event('resize')) }
        flush()
    }
    return { doc, win, viewport, media, frames, flush, subscribe, focus, resize, Input, Textarea, Element }
}

afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup())
    vi.unstubAllGlobals()
})

describe('shared mobile viewport', () => {
    it('provides a stable server snapshot without reading browser globals', () => {
        expect(getServerMobileKeyboardSnapshot()).toBe(false)
    })

    it('keeps navigation visible for hardware keyboards and browser toolbar resizing', () => {
        const h = harness()
        const { listener } = h.subscribe()
        h.focus()
        h.resize(790)
        expect(getMobileKeyboardSnapshot()).toBe(false)
        expect(listener).not.toHaveBeenCalled()
    })

    it('hides for the software keyboard and restores after Done even if the input stays focused', () => {
        const h = harness()
        const { listener } = h.subscribe()
        h.focus()
        h.resize(490)
        expect(getMobileKeyboardSnapshot()).toBe(true)
        expect(h.doc.documentElement.toggleAttribute).toHaveBeenLastCalledWith('data-mobile-keyboard', true)
        h.resize(844)
        expect(getMobileKeyboardSnapshot()).toBe(false)
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it('keeps controls hidden during the keyboard dismissal animation', () => {
        const h = harness()
        h.subscribe()
        h.focus()
        h.resize(490)
        h.focus(null)
        expect(getMobileKeyboardSnapshot()).toBe(true)
        h.resize(844)
        expect(getMobileKeyboardSnapshot()).toBe(false)
    })

    it('does not mistake pinch zoom for a keyboard or resize the reading surface while zoomed', () => {
        const h = harness()
        h.subscribe()
        h.focus()
        h.doc.documentElement.style.setProperty.mockClear()
        h.viewport.scale = 2
        h.resize(422)
        expect(getMobileKeyboardSnapshot()).toBe(false)
        expect(h.doc.documentElement.style.setProperty).not.toHaveBeenCalled()
        h.viewport.scale = 1
        h.resize(844)
        expect(getMobileKeyboardSnapshot()).toBe(false)
    })

    it('preserves an open keyboard state during zoom', () => {
        const h = harness()
        h.subscribe()
        h.focus()
        h.resize(490)
        h.viewport.scale = 2
        h.resize(245)
        expect(getMobileKeyboardSnapshot()).toBe(true)
    })

    it('recalibrates on rotation instead of treating landscape as a keyboard', () => {
        const h = harness()
        h.subscribe()
        h.focus()
        h.win.innerWidth = 844
        h.win.innerHeight = 390
        h.resize(390)
        expect(getMobileKeyboardSnapshot()).toBe(false)
        h.resize(210)
        expect(getMobileKeyboardSnapshot()).toBe(true)
    })

    it('leaves desktop window resizing alone', () => {
        const h = harness({ coarse: false })
        h.subscribe()
        h.focus()
        h.resize(400)
        expect(getMobileKeyboardSnapshot()).toBe(false)
    })

    it.each(['readOnly', 'disabled', 'inputMode', 'type'] as const)('does not treat a non-editing input as keyboard entry: %s', property => {
        const h = harness()
        h.subscribe()
        const input = new h.Input()
        if (property === 'inputMode') input.inputMode = 'none'
        else if (property === 'type') input.type = 'checkbox'
        else input[property] = true
        h.focus(input)
        h.resize(490)
        expect(getMobileKeyboardSnapshot()).toBe(false)
    })

    it('supports multiline and contenteditable fields', () => {
        const h = harness()
        h.subscribe()
        h.focus(new h.Textarea())
        h.resize(490)
        expect(getMobileKeyboardSnapshot()).toBe(true)
        h.resize(844)
        const editor = new h.Element()
        editor.isContentEditable = true
        h.focus(editor)
        h.resize(490)
        expect(getMobileKeyboardSnapshot()).toBe(true)
    })

    it('falls back to window dimensions without VisualViewport', () => {
        const h = harness({ visualViewport: false })
        h.subscribe()
        h.focus()
        h.resize(490)
        expect(getMobileKeyboardSnapshot()).toBe(true)
        h.resize(844)
        expect(getMobileKeyboardSnapshot()).toBe(false)
    })

    it('shares one listener set and batches viewport events into a single frame', () => {
        const h = harness()
        const add = vi.spyOn(h.viewport, 'addEventListener')
        const remove = vi.spyOn(h.viewport, 'removeEventListener')
        const first = h.subscribe()
        const second = h.subscribe()
        expect(add.mock.calls.map(([name]) => name)).toEqual(['resize', 'scroll'])
        h.doc.documentElement.style.setProperty.mockClear()
        h.viewport.offsetTop = 35
        for (let i = 0; i < 50; i++) h.viewport.dispatchEvent(new Event('scroll'))
        expect(h.frames.size).toBe(1)
        h.flush()
        expect(h.doc.documentElement.style.setProperty).toHaveBeenCalledExactlyOnceWith('--mobile-viewport-top', '35px')
        expect(first.listener).not.toHaveBeenCalled()
        expect(second.listener).not.toHaveBeenCalled()
        first.cleanup()
        expect(remove).not.toHaveBeenCalled()
        second.cleanup()
        expect(remove).toHaveBeenCalledTimes(2)
        expect(h.doc.documentElement.style.removeProperty).toHaveBeenCalledWith('--mobile-viewport-height')
        h.viewport.dispatchEvent(new Event('resize'))
        expect(h.frames.size).toBe(0)
    })

    it('resyncs restored pages and cancels pending frames on unmount', () => {
        const h = harness()
        const { cleanup } = h.subscribe()
        h.viewport.height = 780
        h.win.dispatchEvent(new Event('pageshow'))
        h.flush()
        expect(h.doc.documentElement.style.setProperty).toHaveBeenCalledWith('--mobile-viewport-height', '780px')
        h.viewport.dispatchEvent(new Event('resize'))
        cleanup()
        expect(h.frames.size).toBe(0)
        expect(getMobileKeyboardSnapshot()).toBe(false)
    })
})
