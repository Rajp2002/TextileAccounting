import { describe, expect, it } from 'vitest'
import { captureFocusReturn } from '../hooks/use-guided-tour'

// Package 2D: the page tours share one modal hook; each tour names how focus
// returns when it closes. These tests pin the three strategies the tours used
// before they were merged (Machines, Workers, Configuration, Stock and Dispatch
// use `launcher`; Payroll `return-focus-at-close`; Production
// `return-focus-or-launcher`).

type FakeElement = { name: string; isConnected: boolean }
const element = (name: string, isConnected = true): FakeElement => ({ name, isConnected })

/** A launcher whose tour button can be swapped, as a re-render would. */
function launcherWith(button: FakeElement | null) {
    const state = { button }
    const container = { querySelector: () => state.button }
    return { ref: { current: container as unknown as HTMLElement }, swap: (next: FakeElement | null) => { state.button = next } }
}
const ref = (value: FakeElement | null) => ({ current: value as unknown as HTMLElement | null })

describe('guided tour focus return', () => {
    it('INVARIANT launcher: returns to the tour button found when the tour opened', () => {
        const launcher = launcherWith(element('take-tour'))
        const restore = captureFocusReturn('launcher', launcher.ref, undefined)
        launcher.swap(element('replacement'))
        expect(restore()).toMatchObject({ name: 'take-tour' })
    })

    it('INVARIANT return-focus-at-close: the starting control if still on the page, else the tour button at close', () => {
        const launcher = launcherWith(element('take-tour'))
        const start = element('help-button')
        const restore = captureFocusReturn('return-focus-at-close', launcher.ref, ref(start))
        expect(restore()).toBe(start)
        start.isConnected = false
        launcher.swap(element('button-at-close'))
        expect(restore()).toMatchObject({ name: 'button-at-close' })
        const withoutStart = captureFocusReturn('return-focus-at-close', launcher.ref, ref(null))
        expect(withoutStart()).toMatchObject({ name: 'button-at-close' })
    })

    it('INVARIANT return-focus-or-launcher: the starting control or the tour button found at open; re-queried only when it left the page', () => {
        const launcher = launcherWith(element('take-tour'))
        const start = element('detail-button')
        expect(captureFocusReturn('return-focus-or-launcher', launcher.ref, ref(start))()).toBe(start)

        const openButton = element('button-at-open')
        launcher.swap(openButton)
        const restore = captureFocusReturn('return-focus-or-launcher', launcher.ref, ref(null))
        launcher.swap(element('button-at-close'))
        expect(restore()).toBe(openButton)
        openButton.isConnected = false
        expect(restore()).toMatchObject({ name: 'button-at-close' })
    })
})
