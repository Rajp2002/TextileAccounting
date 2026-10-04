import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { WarpRow, WeftRow } from '@/lib/estimator'
import { reconcileTemplateRateUpdate } from '@/lib/template-rate-reconciliation'

// LT03 (LC26): when a saved-quality rate update has no confirmed answer, the
// proposal is kept and the outcome is reconciled against the saved quality.
// A matching current state is not proof that this request committed.

const warp = (yarnRate: number): WarpRow[] => [{ id: 'w1', label: '80/72 Micro', calcDenier: 80, beamEnds: 4200, yarnRate, gstPct: 5, shortagePct: null }]
const weft = (yarnRate: number): WeftRow[] => [{ id: 'f1', label: '75D Roto', calcDenier: 75, picks: 68, reedSpace: 160, yarnRate, gstPct: 5, shortagePct: null }]
const expectedUpdatedAt = '2026-10-04T08:00:00.000Z'
const proposal = { expectedUpdatedAt, proposedWarp: warp(150), proposedWeft: weft(140) }

describe('reconcileTemplateRateUpdate', () => {
    it('reports not applied when the quality is still at the version the update expected', () => {
        expect(reconcileTemplateRateUpdate({ ...proposal, current: { updated_at: expectedUpdatedAt, warp_rows: warp(145), weft_rows: weft(135) } })).toBe('not_applied')
    })

    it('reports a matching current state, without claiming which request wrote it', () => {
        expect(reconcileTemplateRateUpdate({ ...proposal, current: { updated_at: '2026-10-04T08:00:05.000Z', warp_rows: warp(150), weft_rows: weft(140) } })).toBe('matches_proposal')
    })

    it('treats key order and row ids as stored, not as a difference', () => {
        const reordered = warp(150).map(row => Object.fromEntries(Object.entries(row).reverse())) as unknown as WarpRow[]
        expect(reconcileTemplateRateUpdate({ ...proposal, current: { updated_at: 'later', warp_rows: reordered, weft_rows: weft(140) } })).toBe('matches_proposal')
    })

    it('reports a conflict when the quality changed to something else', () => {
        expect(reconcileTemplateRateUpdate({ ...proposal, current: { updated_at: 'later', warp_rows: warp(152), weft_rows: weft(140) } })).toBe('conflict')
    })

    it('reports missing when the quality is gone or archived', () => {
        expect(reconcileTemplateRateUpdate({ ...proposal, current: null })).toBe('missing')
    })
})

describe('estimator keeps an uncertain rate update visible', () => {
    const source = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
    const handler = source.slice(source.indexOf('const handleSaveRatesAndApply = async'), source.indexOf('/** Apply template directly (without editing rates). */'))

    it('waits with a timeout and turns a lost answer into an unknown outcome, not a failure toast', () => {
        expect(handler).toContain('runMutationWithTimeout(() => updateTemplateRates(')
        expect(handler).toContain("if (rateOutcome.status === 'unknown')")
        expect(handler).toContain('setRateUpdateUnknown(')
        expect(handler).not.toContain('Rate update could not be confirmed. Reopen the quality')
    })

    it('blocks a resend until the outcome is checked, and checks by reconciling', () => {
        expect(handler).toContain('if (rateUpdateUnknown) return')
        expect(source).toContain('reconcileTemplateRateUpdate({')
        expect(source).toContain("data-lite-rate-unknown")
        expect(source).toContain("disabled={savingRates || Boolean(rateUpdateUnknown)}")
    })
})

describe('unresolved rate update copy is translated', () => {
    it('has Hindi and Gujarati for every message in the panel and its toasts', async () => {
        const { BASE_PLAN_PHRASES } = await import('@/lib/i18n/base-plan-phrases')
        const source = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
        const panel = source.slice(source.indexOf('{rateUpdateUnknown && ('), source.indexOf('<DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">'))
        const check = source.slice(source.indexOf('const checkUnresolvedRateUpdate = async'), source.indexOf('const discardUnresolvedRateUpdate'))
        const phrases = [...`${panel}${check}`.matchAll(/tx\('([^']+)'/g)].map(match => match[1])
        expect(phrases.length).toBe(9)
        for (const phrase of phrases) {
            expect(BASE_PLAN_PHRASES.hi[phrase], phrase).toBeTruthy()
            expect(BASE_PLAN_PHRASES.gu[phrase], phrase).toBeTruthy()
        }
    })
})
