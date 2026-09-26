import { afterEach, describe, expect, it, vi } from 'vitest'
import { dockUpdater } from '../hooks/use-gutter-dock'

// Package 2B: the gutter-dock measurement moved into a pure updater. These
// CHARACTERIZATION tests pin the docking rules the Free usage card relies on
// (sidebar 248px, card 248px, 16px clearance, docks only on >= 1200px screens).

const config = { sidebarWidth: 248, cardWidth: 248, minClearance: 16 }
const undocked = { isDocked: false, dockStyle: {}, gutterWidth: 0 }
const containerAt = (left: number) => ({ getBoundingClientRect: () => ({ left }) }) as unknown as HTMLElement

afterEach(() => { vi.unstubAllGlobals() })

describe('gutter dock updater', () => {
    it('CHARACTERIZATION: docks the card centred in a wide enough gutter on wide screens', () => {
        vi.stubGlobal('window', { innerWidth: 1400 })
        const next = dockUpdater(containerAt(600), config)(undocked)
        expect(next).toEqual({
            isDocked: true,
            dockStyle: { position: 'fixed', left: '300px', bottom: '1.5rem', width: '248px', zIndex: 25 },
            gutterWidth: 352,
        })
        // Re-measuring the same layout keeps the same state object (no re-render).
        expect(dockUpdater(containerAt(600), config)(next)).toBe(next)
    })

    it('CHARACTERIZATION: stays undocked below 1200px or when the gutter is under 280px', () => {
        vi.stubGlobal('window', { innerWidth: 1100 })
        expect(dockUpdater(containerAt(600), config)(undocked)).toEqual({ isDocked: false, dockStyle: {}, gutterWidth: 352 })
        vi.stubGlobal('window', { innerWidth: 1400 })
        expect(dockUpdater(containerAt(500), config)(undocked)).toEqual({ isDocked: false, dockStyle: {}, gutterWidth: 252 })
        expect(dockUpdater(containerAt(100), config)(undocked)).toEqual({ isDocked: false, dockStyle: {}, gutterWidth: 0 })
    })

    it('CHARACTERIZATION: undocks when the container is missing, otherwise keeps state', () => {
        vi.stubGlobal('window', { innerWidth: 1400 })
        const docked = dockUpdater(containerAt(600), config)(undocked)
        expect(dockUpdater(null, config)(docked)).toEqual(undocked)
        expect(dockUpdater(null, config)(undocked)).toBe(undocked)
    })

    it('CHARACTERIZATION: forceDocked overrides measurement', () => {
        vi.stubGlobal('window', { innerWidth: 800 })
        expect(dockUpdater(containerAt(0), { ...config, forceDocked: true })(undocked)).toEqual({
            isDocked: true,
            dockStyle: { position: 'fixed', left: '264px', bottom: '1.5rem', width: '248px', zIndex: 25 },
            gutterWidth: 280,
        })
        expect(dockUpdater(containerAt(0), { ...config, forceDocked: false })(undocked)).toEqual({ isDocked: false, dockStyle: {}, gutterWidth: 280 })
    })

    it('CHARACTERIZATION: without a window the state is left unchanged', () => {
        const state = { ...undocked }
        expect(dockUpdater(containerAt(600), config)(state)).toBe(state)
    })
})
