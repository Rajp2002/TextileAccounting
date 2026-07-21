import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { normalizeSavedWarpRows, normalizeSavedWeftRows } from '../lib/saved-costings'

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
})
