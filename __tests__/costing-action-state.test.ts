import { describe, expect, it } from 'vitest'
import type { WarpRow, WeftRow } from '@/lib/estimator'
import { resolveCostingActionState } from '@/lib/costing-action-state'

const warp = (overrides: Partial<WarpRow> = {}): WarpRow => ({
    id: 'w', label: '75D Poly', calcDenier: 75, beamEnds: 4800, yarnRate: 120, gstPct: 5, shortagePct: null, ...overrides,
})
const weft = (overrides: Partial<WeftRow> = {}): WeftRow => ({
    id: 'f', label: '75D Poly', picks: 60, reedSpace: 120, calcDenier: 75, yarnRate: 110, gstPct: 5, shortagePct: null, ...overrides,
})
const rows = (w: Partial<WarpRow> = {}, f: Partial<WeftRow> = {}) => ({ warpRows: [warp(w)], weftRows: [weft(f)] })

describe('resolveCostingActionState', () => {
    it('is a new fabric when nothing is loaded', () => {
        expect(resolveCostingActionState({
            hasSavedQuality: false, hasOpenedCosting: false, baseline: null, current: rows(), latestVersion: null,
        })).toEqual({ kind: 'new' })
    })

    it('updates the costing on a price-only edit of a saved quality', () => {
        expect(resolveCostingActionState({
            hasSavedQuality: true, hasOpenedCosting: false, baseline: rows(),
            current: rows({ yarnRate: 150, gstPct: 12 }), latestVersion: 2,
        })).toEqual({ kind: 'sameFabric', nextVersion: 3, firstCosting: false, canSaveQuality: false })
    })

    it('saves the first costing for a quality that has none yet', () => {
        expect(resolveCostingActionState({
            hasSavedQuality: true, hasOpenedCosting: false, baseline: rows(), current: rows(), latestVersion: null,
        })).toEqual({ kind: 'sameFabric', nextVersion: 1, firstCosting: true, canSaveQuality: false })
    })

    it('still offers a quality for an opened costing that has none', () => {
        expect(resolveCostingActionState({
            hasSavedQuality: false, hasOpenedCosting: true, baseline: rows(), current: rows({ yarnRate: 99 }), latestVersion: 1,
        })).toEqual({ kind: 'sameFabric', nextVersion: 2, firstCosting: false, canSaveQuality: true })
    })

    it('saves a new quality when the fabric changed', () => {
        const state = resolveCostingActionState({
            hasSavedQuality: true, hasOpenedCosting: false, baseline: rows(),
            current: rows({ beamEnds: 5200 }), latestVersion: 2,
        })
        expect(state.kind).toBe('fabricChanged')
        if (state.kind !== 'fabricChanged') throw new Error('unreachable')
        expect(state.changes[0]).toMatchObject({ kind: 'beamEnds', from: '4800', to: '5200' })
    })

    it('saves a new quality when an opened costing changed fabric', () => {
        expect(resolveCostingActionState({
            hasSavedQuality: false, hasOpenedCosting: true, baseline: rows(), current: rows({}, { picks: 70 }), latestVersion: 1,
        }).kind).toBe('fabricChanged')
    })

    it('returns to the same-fabric state when the fabric edit is undone', () => {
        const input = { hasSavedQuality: true, hasOpenedCosting: false, baseline: rows(), latestVersion: 1 }
        expect(resolveCostingActionState({ ...input, current: rows({ beamEnds: 5200 }) }).kind).toBe('fabricChanged')
        expect(resolveCostingActionState({ ...input, current: rows({ beamEnds: 4800 }) }).kind).toBe('sameFabric')
    })

    it('never blocks an opened costing that has no baseline', () => {
        expect(resolveCostingActionState({
            hasSavedQuality: false, hasOpenedCosting: true, baseline: null, current: rows({ beamEnds: 9999 }), latestVersion: 1,
        })).toEqual({ kind: 'sameFabric', nextVersion: 2, firstCosting: false, canSaveQuality: true })
    })

    it('does not count naming a previously blank yarn as a fabric change', () => {
        expect(resolveCostingActionState({
            hasSavedQuality: true, hasOpenedCosting: false, baseline: rows({ label: '' }, { label: undefined }),
            current: rows({ label: 'Viscose' }, { label: 'Viscose' }), latestVersion: 1,
        }).kind).toBe('sameFabric')
    })
})
