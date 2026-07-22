import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { buildSavedQualityRecipeState, normalizeSavedWarpRows, normalizeSavedWeftRows } from '../lib/saved-costings'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('saved quality costing library', () => {
  it('loads saved qualities alongside costing snapshots', () => {
    const page = read('app/(dashboard)/owner/quotes/page.tsx')
    const client = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')

    expect(page).toContain('getEstimatorTemplates()')
    expect(page).toContain('initialTemplates={templates ?? []}')
    expect(client).toContain('Latest costing breakdown')
    expect(client).toContain('Applied production')
    expect(client).toContain('Costing history')
    expect(client).toContain('No costing saved for this quality yet')
    expect(client).toContain('Current recipe')
    expect(client).toContain('live estimate from the saved yarn recipe and current factory costs')
  })

  it('links new costing and market-run snapshots to the selected quality', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const drafts = read('lib/estimator-drafts.ts')

    expect(estimator).toContain('templateId:              appliedTemplate?.id')
    expect(actions.match(/template_id:\s+params\.templateId \?\? null/g)).toHaveLength(2)
    expect(actions).toContain('production_logs ( meters )')
    expect(drafts).toContain('templateId?: string')
  })

  it('creates a first costing snapshot whenever a quality is saved without mutating data during page render', () => {
    const page = read('app/(dashboard)/owner/quotes/page.tsx')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(estimator).toContain('estimate:         { ...state, warpRows, weftRows }')
    expect(actions).toContain('const snapshot = await saveEstimatorQuoteV3({')
    expect(actions).toContain('getInitialQualitySnapshotRequestId(saved.id)')
    expect(actions).toContain('getInitialQualitySnapshotRequestId(template.id)')
    expect(actions).toContain("recordKind: 'costing'")
    expect(actions).toContain(".from('estimator_templates')\n            .delete()")
    expect(actions).toContain('export async function ensureCostingSnapshotsForSavedQualities()')
    expect(page).not.toContain('ensureCostingSnapshotsForSavedQualities')
  })

  it('normalizes legacy yarn rows before calculating their breakdown', () => {
    const state = makeDefaultEstimateState()
    state.warpRows = normalizeSavedWarpRows(
      [{ label: 'Legacy warp', denier: 75, ends: 3444, yarnRate: 116 }],
      state.warpRows[0],
    )
    state.weftRows = normalizeSavedWeftRows(
      [{ label: 'Legacy weft', denier: 75, picks: 82, yarnRate: 118 }],
      state.weftRows[0],
      { reedSpace: 170 },
    )

    expect(state.warpRows[0]).toMatchObject({ calcDenier: 75, beamEnds: 3444, yarnRate: 116, gstPct: 0 })
    expect(state.weftRows[0]).toMatchObject({ calcDenier: 75, picks: 82, reedSpace: 170, yarnRate: 118, gstPct: 0 })
    expect(() => calcFullTotals(state)).not.toThrow()
  })

  it('reconstructs empty legacy rows from flat snapshot columns', () => {
    const state = makeDefaultEstimateState()
    const warp = normalizeSavedWarpRows([{}], state.warpRows[0], {
      beamEnds: 3200,
      warpDenier: 60,
      yarnRate: 105,
    })
    const weft = normalizeSavedWeftRows([{}], state.weftRows[0], {
      picks: 72,
      reedSpace: 165,
      weftDenier: 80,
      yarnRate: 110,
    })

    expect(warp[0]).toMatchObject({ beamEnds: 3200, calcDenier: 60, yarnRate: 105 })
    expect(weft[0]).toMatchObject({ picks: 72, reedSpace: 165, calcDenier: 80, yarnRate: 110 })
  })

  it('restores retired finished-width snapshots as costing width without retaining the old field', () => {
    const state = makeDefaultEstimateState()
    const [weft] = normalizeSavedWeftRows(
      [{ finishedWidthCm: 157.48, picks: 72, calcDenier: 80, yarnRate: 110 }],
      state.weftRows[0],
    )

    expect(weft).toMatchObject({ reedSpace: 157.48, effectiveCostingWidthCm: 157.48 })
    expect(weft).not.toHaveProperty('finishedWidthCm')
  })

  it('calculates a current recipe cost without creating a costing snapshot', () => {
    const state = buildSavedQualityRecipeState({
      id: 'quality-1',
      name: 'D.NO:246N AASHAM SILK',
      warp_rows: [{ id: 'warp-1', calcDenier: 75, beamEnds: 3444, yarnRate: 116, gstPct: 0, shortagePct: null }],
      weft_rows: [{ id: 'weft-1', picks: 82, reedSpace: 170, calcDenier: 75, yarnRate: 118, gstPct: 0, shortagePct: null }],
      per_pick_cost_paise: 0.16,
      warp_crimp_pct: 5,
      yarn_shortage_pct: 2,
    }, {
      warping_rate_per_kg: 2,
      sizing_rate_per_kg: 1.5,
      overhead_override_per_m: 5,
      enabled_sections: { winding: false, processing: false, finishing: false, commission: true, transport: false },
    })

    const totals = calcFullTotals(state)
    expect(totals.totalProductionCostPerM).toBeGreaterThan(0)
    expect(totals.overheadPerM).toBe(5)
  })
})
