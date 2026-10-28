import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
    tables: {} as Record<string, Row[]>,
    reads: [] as string[],
    tier: 'base' as string,
    saveEstimatorQuoteV3: vi.fn(),
    updateSavedCostingLibraryState: vi.fn(),
    revalidatePath: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }))
vi.mock('@/lib/auth', () => ({
    requireRole: async () => ({ user: { id: 'user-1' }, profile: { org_id: 'org-1', role: 'owner' } }),
}))
vi.mock('@/lib/subscription', () => ({ getCachedOrgTier: async () => state.tier }))
vi.mock('@/app/(dashboard)/owner/estimator/actions', () => ({
    saveEstimatorQuoteV3: (...args: unknown[]) => state.saveEstimatorQuoteV3(...args),
    updateSavedCostingLibraryState: (...args: unknown[]) => state.updateSavedCostingLibraryState(...args),
}))
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        from(table: string) {
            state.reads.push(table)
            let rows = [...(state.tables[table] ?? [])]
            const builder: Record<string, unknown> = {
                select: () => builder,
                eq: (column: string, value: unknown) => { rows = rows.filter(row => row[column] === value); return builder },
                in: (column: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[column])); return builder },
                // The keyset cursor: the fake serves everything on the first page.
                or: () => { rows = []; return builder },
                order: () => builder,
                limit: () => builder,
                maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
                rpc: async () => ({ data: null, error: null }),
                then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
            }
            return builder
        },
        rpc: async () => ({ data: null, error: null }),
    }),
}))

import {
    applyYarnRatePropagation,
    getCostingsBehindRateBook,
    getYarnRatePropagationCounts,
    previewYarnRatePropagation,
    updateCostingsToRateBook,
} from '@/app/(dashboard)/owner/rates/propagation-actions'
import { PROPAGATION_BATCH_SIZE } from '@/lib/yarn-rate-propagation'
import { buildPropagationRequestId, buildRateBookUpdateRequestId } from '@/lib/yarn-rate-propagation-request.server'

const RATE_ID = '5b1e0c4a-1111-4111-8111-aaaaaaaaaaaa'
const WEFT_RATE_ID = '5b1e0c4a-2222-4222-8222-bbbbbbbbbbbb'
const RATE_UPDATED_AT = '2026-10-18T09:00:00.000Z'
const ACTIVE_QUALITY = '7c1e0c4a-3333-4333-8333-cccccccccccc'
const INACTIVE_QUALITY = '7c1e0c4a-4444-4444-8444-dddddddddddd'

function yarnRow(kind: 'warp' | 'weft', label: string, yarnRate: number, extra: Row = {}): Row {
    return kind === 'warp'
        ? { id: `w-${label}`, label, calcDenier: 75, beamEnds: 3200, yarnRate, gstPct: 5, shortagePct: 0, ...extra }
        : { id: `f-${label}`, label, picks: 60, reedSpace: 150, effectiveCostingWidthCm: 150, calcDenier: 75, yarnRate, gstPct: 5, shortagePct: 0, ...extra }
}

function costing(id: string, group: string, version: number, overrides: Row = {}): Row {
    return {
        id,
        org_id: 'org-1',
        record_kind: 'costing',
        costing_group_id: group,
        version_number: version,
        created_at: `2026-10-0${version}T00:00:00Z`,
        updated_at: `2026-10-0${version}T01:00:00Z`,
        is_archived: false,
        template_id: ACTIVE_QUALITY,
        quality_label: `Quality ${group}`,
        party_name: null,
        warp_instruction: null,
        weft_instruction: null,
        warp_rows: [yarnRow('warp', '75D Poly', 100)],
        weft_rows: [yarnRow('weft', '75D Poly', 100)],
        per_pick_cost_paise: 16,
        warping_rate_per_kg: 5,
        sizing_rate_per_kg: 8,
        winding_rate_per_kg: 2,
        loom_count: 10,
        avg_output_per_loom_per_day: 100,
        monthly_working_days: 26,
        monthly_output_m: 26000,
        ...overrides,
    }
}

function seed(quotes: Row[], rateOverrides: Row = {}) {
    state.tables = {
        cost_rate_book: [
            { id: RATE_ID, org_id: 'org-1', name: '75D Poly', category: 'yarn_warp', unit: 'per_kg', current_value: 120, updated_at: RATE_UPDATED_AT, is_active: true, ...rateOverrides },
            { id: WEFT_RATE_ID, org_id: 'org-1', name: 'Never Used', category: 'yarn_weft', unit: 'per_kg', current_value: 90, updated_at: RATE_UPDATED_AT, is_active: true },
            { id: 'sizing-rate', org_id: 'org-1', name: 'Sizing', category: 'sizing', unit: 'per_kg', current_value: 8, updated_at: RATE_UPDATED_AT, is_active: true },
        ],
        estimator_templates: [
            { id: ACTIVE_QUALITY, org_id: 'org-1', is_active: true, updated_at: '2026-10-05T00:00:00Z' },
            { id: INACTIVE_QUALITY, org_id: 'org-1', is_active: false, updated_at: '2026-10-05T00:00:00Z' },
        ],
        estimator_quotes: quotes,
    }
}

beforeEach(() => {
    state.reads = []
    state.tier = 'base'
    state.saveEstimatorQuoteV3.mockReset()
    state.updateSavedCostingLibraryState.mockReset()
    state.updateSavedCostingLibraryState.mockResolvedValue({ data: {} })
    state.revalidatePath.mockReset()
})

describe('getYarnRatePropagationCounts', () => {
    it('counts only the latest active version that uses the yarn at a different rate', () => {
        seed([
            costing('a1', 'g1', 1),
            costing('a2', 'g1', 2),
            costing('b1', 'g2', 1, { is_archived: true }),
            costing('c1', 'g3', 1, { template_id: INACTIVE_QUALITY }),
            costing('d1', 'g4', 1, { warp_rows: [yarnRow('warp', 'Other Yarn', 100)] }),
            costing('e1', 'g5', 1, { warp_rows: [yarnRow('warp', '75D Poly', 120)] }),
        ])
        return getYarnRatePropagationCounts().then(result => {
            expect(result.error).toBeUndefined()
            expect(result.data).toEqual({ [RATE_ID]: 1 })
        })
    })

    it('omits a yarn rate that no costing uses and ignores non-yarn rates', async () => {
        seed([costing('a1', 'g1', 1)])
        const result = await getYarnRatePropagationCounts()
        expect(result.data).not.toHaveProperty(WEFT_RATE_ID)
        expect(result.data).not.toHaveProperty('sizing-rate')
    })

    it('returns the plan error and reads nothing when the plan lacks the rate book', async () => {
        seed([costing('a1', 'g1', 1)])
        state.tier = 'free'
        const result = await getYarnRatePropagationCounts()
        expect(result.error).toMatch(/Lite or Weavly Base/)
        expect(state.reads).toEqual([])
    })
})

describe('previewYarnRatePropagation', () => {
    it('recomputes before and after from the database rate', async () => {
        seed([costing('a1', 'g1', 1), costing('a2', 'g1', 2)])
        const result = await previewYarnRatePropagation(RATE_ID)
        expect(result.error).toBeUndefined()
        expect(result.data?.rateUpdatedAt).toBe(RATE_UPDATED_AT)
        expect(result.data?.rateValue).toBe(120)
        expect(result.data?.items).toHaveLength(1)
        const item = result.data!.items[0]
        expect(item.id).toBe('a2')
        expect(item.versionNumber).toBe(2)
        expect(item.templateId).toBe(ACTIVE_QUALITY)
        expect(item.layers).toEqual([{ layer: 'warp', index: 0 }])
        expect(item.before.productionCostPerM).toBeGreaterThan(0)
        expect(item.after.productionCostPerM).toBeGreaterThan(item.before.productionCostPerM)
    })

    it('shows the saved prices as "before", so the review matches what Saved Costings shows', async () => {
        seed([costing('a1', 'g1', 1, { production_cost_per_meter: 44, quote_price_per_meter: 50 })])
        const result = await previewYarnRatePropagation(RATE_ID)
        const item = result.data!.items[0]
        expect(item.before).toEqual({ productionCostPerM: 44, sellingPricePerM: 50 })
        expect(item.after.productionCostPerM).toBeGreaterThan(0)
    })

    it('lists an unpriceable costing as skipped and still returns the others', async () => {
        seed([
            costing('ok', 'g1', 1),
            costing('bad', 'g2', 1, { warp_rows: [yarnRow('warp', '75D Poly', 100, { beamEnds: 0 })], quality_label: 'Broken Quality' }),
        ])
        const result = await previewYarnRatePropagation(RATE_ID)
        expect(result.data?.items.map(item => item.id)).toEqual(['ok'])
        expect(result.data?.skipped).toEqual([{ id: 'bad', qualityLabel: 'Broken Quality', reason: "This costing can't be priced with the new rate." }])
    })

    it('skips every affected costing when the rate is zero, because zero cannot be priced', async () => {
        seed([costing('a1', 'g1', 1)], { current_value: 0 })
        const result = await previewYarnRatePropagation(RATE_ID)
        expect(result.data?.items).toEqual([])
        expect(result.data?.skipped.map(entry => entry.id)).toEqual(['a1'])
    })

    it('rejects an invalid, missing, other-org, archived or non-yarn rate', async () => {
        seed([costing('a1', 'g1', 1)])
        expect((await previewYarnRatePropagation('not-a-uuid')).error).toBe('Rate identifier is invalid.')
        expect((await previewYarnRatePropagation('5b1e0c4a-9999-4999-8999-eeeeeeeeeeee')).error).toBe('This rate no longer exists.')
        seed([costing('a1', 'g1', 1)], { org_id: 'org-2' })
        expect((await previewYarnRatePropagation(RATE_ID)).error).toBe('This rate no longer exists.')
        seed([costing('a1', 'g1', 1)], { is_active: false })
        expect((await previewYarnRatePropagation(RATE_ID)).error).toBe('This rate is archived.')
        seed([costing('a1', 'g1', 1)], { category: 'sizing' })
        expect((await previewYarnRatePropagation(RATE_ID)).error).toBe('Only yarn rates can be propagated.')
    })
})

describe('applyYarnRatePropagation', () => {
    const saved = (id: string, version: number) => ({ success: true, quoteId: `new-${id}`, versionNumber: version })

    it('refuses when the rate changed since the review, and saves nothing', async () => {
        seed([costing('a1', 'g1', 1)])
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: '2026-10-17T00:00:00.000Z',
            costings: [{ id: 'a1', expectedUpdatedAt: '2026-10-01T01:00:00Z' }],
        })
        expect(result.error).toBe('This rate changed since you opened the review. Reopen Propagate.')
        expect(state.saveEstimatorQuoteV3).not.toHaveBeenCalled()
    })

    it('refuses an empty list and more than one batch', async () => {
        seed([costing('a1', 'g1', 1)])
        const base = { rateId: RATE_ID, expectedRateUpdatedAt: RATE_UPDATED_AT }
        expect((await applyYarnRatePropagation({ ...base, costings: [] })).error).toBeTruthy()
        const tooMany = Array.from({ length: PROPAGATION_BATCH_SIZE + 1 }, (_, index) => ({ id: `id-${index}`, expectedUpdatedAt: '2026-10-01T01:00:00Z' }))
        expect((await applyYarnRatePropagation({ ...base, costings: tooMany })).error).toBeTruthy()
        expect(state.saveEstimatorQuoteV3).not.toHaveBeenCalled()
    })

    it('saves each costing as a new draft version at the database rate with a deterministic request id', async () => {
        seed([costing('a2', 'g1', 2, { party_name: 'Shah Textiles', warp_instruction: 'Warp note' })])
        state.saveEstimatorQuoteV3.mockResolvedValue(saved('a2', 3))
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: [{ id: 'a2', expectedUpdatedAt: '2026-10-02T01:00:00Z' }],
        })
        expect(result.data?.outcomes).toEqual([{ id: 'a2', status: 'created', versionNumber: 3, quoteId: 'new-a2' }])
        const params = state.saveEstimatorQuoteV3.mock.calls[0][0]
        expect(params.estimate.warpRows[0].yarnRate).toBe(120)
        expect(params.estimate.weftRows[0].yarnRate).toBe(100)
        expect(params).toMatchObject({
            clientRequestId: buildPropagationRequestId('a2', RATE_ID, 120),
            sourceQuoteId: 'a2',
            expectedSourceUpdatedAt: '2026-10-02T01:00:00Z',
            templateId: ACTIVE_QUALITY,
            expectedTemplateUpdatedAt: '2026-10-05T00:00:00Z',
            status: 'draft',
            recordKind: 'costing',
            partyName: 'Shah Textiles',
            qualityLabel: 'Quality g1',
            warpInstruction: 'Warp note',
        })
        expect(params.totalProductionCostPerM).toBeGreaterThan(0)
        expect(params.quotePricePerM).toBeGreaterThan(0)
        expect(state.revalidatePath).toHaveBeenCalledWith('/owner/quotes')
        expect(state.revalidatePath).toHaveBeenCalledWith('/owner/rates')
    })

    it('marks a costing stale without saving when it changed, has a newer version, or became archived', async () => {
        seed([
            costing('changed', 'g1', 1),
            costing('old', 'g2', 1),
            costing('old2', 'g2', 2),
            costing('archived', 'g3', 1, { is_archived: true }),
        ])
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: [
                { id: 'changed', expectedUpdatedAt: '2026-09-30T00:00:00Z' },
                { id: 'old', expectedUpdatedAt: '2026-10-01T01:00:00Z' },
                { id: 'archived', expectedUpdatedAt: '2026-10-01T01:00:00Z' },
            ],
        })
        expect(result.data?.outcomes.map(outcome => [outcome.id, outcome.status])).toEqual([
            ['changed', 'stale'],
            ['old', 'stale'],
            ['archived', 'stale'],
        ])
        expect(state.saveEstimatorQuoteV3).not.toHaveBeenCalled()
    })

    it('maps no-change to unchanged, a replay to created, and a save error to failed, then continues', async () => {
        seed([costing('a1', 'g1', 1), costing('b1', 'g2', 1), costing('c1', 'g3', 1)])
        state.saveEstimatorQuoteV3
            .mockResolvedValueOnce({ success: true, quoteId: 'q', versionNumber: 1, noChange: true })
            .mockResolvedValueOnce({ success: true, quoteId: 'q2', versionNumber: 2, idempotentReplay: true })
            .mockResolvedValueOnce({ error: 'A newer costing version already exists. Reload it before saving again.' })
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: ['a1', 'b1', 'c1'].map(id => ({ id, expectedUpdatedAt: '2026-10-01T01:00:00Z' })),
        })
        expect(result.data?.outcomes).toEqual([
            { id: 'a1', status: 'unchanged' },
            { id: 'b1', status: 'created', versionNumber: 2, quoteId: 'q2' },
            { id: 'c1', status: 'failed', message: 'A newer costing version already exists. Reload it before saving again.' },
        ])
    })

    it('reports a save that already committed as created, not as changed since the review', async () => {
        const replayId = buildPropagationRequestId('a1', RATE_ID, 120)
        seed([
            costing('a1', 'g1', 1),
            costing('a1-v2', 'g1', 2, { client_request_id: replayId }),
        ])
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: [{ id: 'a1', expectedUpdatedAt: '2026-10-01T01:00:00Z' }],
        })
        expect(result.data?.outcomes).toEqual([{ id: 'a1', status: 'created', versionNumber: 2, quoteId: 'a1-v2' }])
        expect(state.saveEstimatorQuoteV3).not.toHaveBeenCalled()
    })

    it('keeps the outcomes already collected when a later save throws', async () => {
        seed([costing('a1', 'g1', 1), costing('b1', 'g2', 1)])
        state.saveEstimatorQuoteV3
            .mockResolvedValueOnce(saved('a1', 2))
            .mockRejectedValueOnce(new Error('network down'))
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: ['a1', 'b1'].map(id => ({ id, expectedUpdatedAt: '2026-10-01T01:00:00Z' })),
        })
        expect(result.error).toBeUndefined()
        expect(result.data?.outcomes.map(outcome => [outcome.id, outcome.status])).toEqual([['a1', 'created'], ['b1', 'failed']])
    })

    it('keeps the costing\'s own factory-inputs date instead of stamping today\'s', async () => {
        seed([costing('a1', 'g1', 1, { factory_profile_updated_at: '2026-09-01T00:00:00Z' })])
        state.saveEstimatorQuoteV3.mockResolvedValue(saved('a1', 2))
        await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: [{ id: 'a1', expectedUpdatedAt: '2026-10-01T01:00:00Z' }],
        })
        expect(state.saveEstimatorQuoteV3.mock.calls[0][0].factoryProfileUpdatedAt).toBe('2026-09-01T00:00:00Z')
    })

    it('puts the favourite star back on the new version when the source had one', async () => {
        seed([costing('fav', 'g1', 1, { is_favorite: true }), costing('plain', 'g2', 1, { is_favorite: false })])
        state.saveEstimatorQuoteV3
            .mockResolvedValueOnce({ success: true, quoteId: 'new-fav', versionNumber: 2, updatedAt: '2026-10-18T10:00:00Z' })
            .mockResolvedValueOnce({ success: true, quoteId: 'new-plain', versionNumber: 2, updatedAt: '2026-10-18T10:00:01Z' })
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: ['fav', 'plain'].map(id => ({ id, expectedUpdatedAt: '2026-10-01T01:00:00Z' })),
        })
        expect(state.updateSavedCostingLibraryState).toHaveBeenCalledTimes(1)
        expect(state.updateSavedCostingLibraryState).toHaveBeenCalledWith({ id: 'new-fav', expectedUpdatedAt: '2026-10-18T10:00:00Z', isFavorite: true })
        expect(result.data?.outcomes.map(outcome => outcome.status)).toEqual(['created', 'created'])
    })

    it('still reports created when restoring the star fails', async () => {
        seed([costing('fav', 'g1', 1, { is_favorite: true })])
        state.saveEstimatorQuoteV3.mockResolvedValue({ success: true, quoteId: 'new-fav', versionNumber: 2, updatedAt: '2026-10-18T10:00:00Z' })
        state.updateSavedCostingLibraryState.mockRejectedValue(new Error('boom'))
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: [{ id: 'fav', expectedUpdatedAt: '2026-10-01T01:00:00Z' }],
        })
        expect(result.data?.outcomes).toEqual([{ id: 'fav', status: 'created', versionNumber: 2, quoteId: 'new-fav' }])
    })

    it('stops the batch when the organisation is locked or the plan has lapsed', async () => {
        seed([costing('a1', 'g1', 1), costing('b1', 'g2', 1)])
        state.saveEstimatorQuoteV3.mockResolvedValueOnce({ error: 'This organization is temporarily locked. Costings cannot be changed until access is restored.' })
        const result = await applyYarnRatePropagation({
            rateId: RATE_ID,
            expectedRateUpdatedAt: RATE_UPDATED_AT,
            costings: ['a1', 'b1'].map(id => ({ id, expectedUpdatedAt: '2026-10-01T01:00:00Z' })),
        })
        expect(result.error).toMatch(/locked/)
        expect(state.saveEstimatorQuoteV3).toHaveBeenCalledTimes(1)
    })
})

describe('getCostingsBehindRateBook', () => {
    it('lists the latest active costings whose yarns cost something else today, biggest rise first', async () => {
        seed([
            costing('a1', 'g1', 1),
            costing('a2', 'g1', 2, { warp_rows: [yarnRow('warp', '75D Poly', 110)] }),
            costing('b1', 'g2', 1),
            costing('c1', 'g3', 1, { is_archived: true }),
            costing('d1', 'g4', 1, { warp_rows: [yarnRow('warp', '75D Poly', 120)] }),
        ])
        const result = await getCostingsBehindRateBook()
        expect(result.error).toBeUndefined()
        expect(result.data?.yarnCount).toBe(2)
        expect(result.data?.items.map(item => item.id)).toEqual(['b1', 'a2'])
        expect(result.data?.items[0].changes).toEqual([{ layer: 'warp', index: 0, name: '75D Poly', from: 100, to: 120 }])
        expect(result.data?.items[0].after.productionCostPerM).toBeGreaterThan(result.data!.items[0].before.productionCostPerM)
        expect(result.data?.ratesKey).toContain(RATE_ID)
    })

    it('returns the plan error and reads nothing when the plan lacks the rate book', async () => {
        seed([costing('a1', 'g1', 1)])
        state.tier = 'free'
        expect((await getCostingsBehindRateBook()).error).toMatch(/Lite or Weavly Base/)
        expect(state.reads).toEqual([])
    })
})

describe('updateCostingsToRateBook', () => {
    it('refuses when a yarn rate changed since the review, and saves nothing', async () => {
        seed([costing('a1', 'g1', 1)])
        const result = await updateCostingsToRateBook({ ratesKey: 'stale', costings: [{ id: 'a1', expectedUpdatedAt: '2026-10-01T01:00:00Z' }] })
        expect(result.error).toBe('Yarn rates changed since you opened the review. Reopen it.')
        expect(state.saveEstimatorQuoteV3).not.toHaveBeenCalled()
    })

    it('saves a new draft version with every yarn at today\'s rate and a deterministic request id', async () => {
        seed([costing('a1', 'g1', 1)])
        const { data } = await getCostingsBehindRateBook()
        state.saveEstimatorQuoteV3.mockResolvedValue({ success: true, quoteId: 'new-a1', versionNumber: 2 })
        const result = await updateCostingsToRateBook({ ratesKey: data!.ratesKey, costings: [{ id: 'a1', expectedUpdatedAt: '2026-10-01T01:00:00Z' }] })
        expect(result.data?.outcomes).toEqual([{ id: 'a1', status: 'created', versionNumber: 2, quoteId: 'new-a1' }])
        const params = state.saveEstimatorQuoteV3.mock.calls[0][0]
        expect(params.estimate.warpRows[0].yarnRate).toBe(120)
        expect(params.estimate.weftRows[0].yarnRate).toBe(100)
        expect(params).toMatchObject({
            clientRequestId: buildRateBookUpdateRequestId('a1', [{ layer: 'warp', index: 0, to: 120 }]),
            sourceQuoteId: 'a1',
            status: 'draft',
            recordKind: 'costing',
        })
    })

    it('marks a costing that changed since the review stale and one already at today\'s rates unchanged', async () => {
        seed([costing('a1', 'g1', 1), costing('b1', 'g2', 1, { warp_rows: [yarnRow('warp', '75D Poly', 120)] })])
        const { data } = await getCostingsBehindRateBook()
        const result = await updateCostingsToRateBook({
            ratesKey: data!.ratesKey,
            costings: [{ id: 'a1', expectedUpdatedAt: '2026-09-01T00:00:00Z' }, { id: 'b1', expectedUpdatedAt: '2026-10-01T01:00:00Z' }],
        })
        expect(result.data?.outcomes.map(outcome => outcome.status)).toEqual(['stale', 'unchanged'])
        expect(state.saveEstimatorQuoteV3).not.toHaveBeenCalled()
    })
})
