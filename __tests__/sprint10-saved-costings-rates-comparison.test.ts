import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import {
  compareSavedCostingSnapshots,
  compareSavedCostings,
  filterAndSortSavedCostings,
  getSavedCostingIdentity,
} from '../lib/saved-costings'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

function savedSnapshot(id: string, state: ReturnType<typeof makeDefaultEstimateState>) {
  const result = buildCostingResult(state, calcFullTotals(state))
  return {
    id,
    party_name: 'Rajesh Textiles',
    quality_label: 'D.NO:246N',
    quote_price_per_meter: result.suggestedSellingPricePerM,
    landed_cost_per_meter: result.landedCostPerM,
    intended_margin_percent: result.targetMarginPct,
    meters: result.quantityM ?? 0,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    costing_group_id: 'group-246n',
    version_number: id === 'left' ? 1 : 2,
    costing_result_snapshot: result,
    yarn_shortage_pct: state.yarnShortagePct,
    warp_crimp_pct: state.warpCrimpPct,
  }
}

describe('Sprint 10 saved costing identity and comparison', () => {
  it('filters favourites and exposes stable costing group/version identity', () => {
    const costings = [
      { ...savedSnapshot('left', makeDefaultEstimateState()), is_favorite: true },
      { ...savedSnapshot('right', makeDefaultEstimateState()), is_favorite: false },
    ]

    expect(filterAndSortSavedCostings(costings, {
      query: '', sort: 'recent', margin: 'all', favorites: true,
    }).map(item => item.id)).toEqual(['left'])
    expect(getSavedCostingIdentity(costings[0]).label).toContain('group group-246n')
    expect(getSavedCostingIdentity(costings[0]).label).toContain('v1')
  })

  it('compares immutable yarn, waste, overhead, margin, and price evidence', () => {
    const leftState = makeDefaultEstimateState()
    leftState.warpRows = [{ ...leftState.warpRows[0], label: 'Warp 75D', calcDenier: 75, beamEnds: 3200, yarnRate: 110 }]
    leftState.weftRows = [{ ...leftState.weftRows[0], label: 'Weft 75D', calcDenier: 75, picks: 68, effectiveCostingWidthCm: 112, reedSpace: 112, yarnRate: 112 }]
    leftState.yarnShortagePct = 2
    leftState.warpCrimpPct = 5
    leftState.overheadMode = 'direct'
    leftState.overheadOverridePerM = 3
    leftState.profitPct = 12
    leftState.orderQuantityM = 1_000

    const rightState = {
      ...leftState,
      warpRows: leftState.warpRows.map(row => ({ ...row, yarnRate: 125 })),
      yarnShortagePct: 4,
      warpCrimpPct: 7,
      overheadOverridePerM: 4,
      profitPct: 18,
    }

    const comparison = compareSavedCostingSnapshots(
      savedSnapshot('left', leftState),
      savedSnapshot('right', rightState),
    )

    expect(comparison.comparable).toBe(true)
    expect(comparison.canonical.source).toBe('canonical_result')
    expect(comparison.yarn.changed).toBe(true)
    expect(comparison.yarn.warp.ratePerKg.delta).toBe(15)
    expect(comparison.yarn.warp.baseKgPer100m.delta).toBe(0)
    expect(comparison.yarn.warp.baseCostPerM.delta).toBeGreaterThan(0)
    expect(comparison.waste.changed).toBe(true)
    expect(comparison.overhead.changed).toBe(true)
    expect(comparison.margin.changed).toBe(true)
    expect(comparison.price.changed).toBe(true)
  })

  it.each(['warpRows', 'weftRows'] as const)('keeps a multi-layer %s rate unavailable, never zero', (key) => {
    const single = makeDefaultEstimateState()
    single.warpRows[0] = { ...single.warpRows[0], calcDenier: 75, beamEnds: 3200, yarnRate: 180 }
    single.weftRows[0] = { ...single.weftRows[0], calcDenier: 75, picks: 68, effectiveCostingWidthCm: 112, yarnRate: 180 }
    single[key][0].yarnRate = 180
    const multi = structuredClone(single)
    if (key === 'warpRows') multi.warpRows.push({ ...multi.warpRows[0], id: 'second-layer', yarnRate: 240 })
    else multi.weftRows.push({ ...multi.weftRows[0], id: 'second-layer', yarnRate: 240 })
    const side = key === 'warpRows' ? 'warp' : 'weft'
    const comparison = compareSavedCostingSnapshots(savedSnapshot('left', single), savedSnapshot('right', multi))
    expect(comparison.yarn[side].ratePerKg).toEqual({ left: 180, right: null, delta: null })
    expect(comparison.yarn[side].right.map(layer => layer.ratePerKg)).toEqual([180, 240])
    const reversed = compareSavedCostingSnapshots(savedSnapshot('left', multi), savedSnapshot('right', single))
    expect(reversed.yarn[side].ratePerKg).toEqual({ left: null, right: 180, delta: null })
  })

  it.each([null, undefined, '', '  ', false, [], {}, Infinity, 'invalid'])('does not invent a rate from missing or invalid legacy evidence (%j)', (rate) => {
    const left = { ...savedSnapshot('left', makeDefaultEstimateState()), costing_result_snapshot: null, warp_rows: [{ yarnRate: rate }] }
    const right = { ...left, id: 'right', warp_rows: [{ yarnRate: 180 }] }
    expect(compareSavedCostingSnapshots(left, right).yarn.warp.ratePerKg).toEqual({ left: null, right: 180, delta: null })
  })

  it('preserves an explicit zero and numeric-string legacy rate', () => {
    const left = { ...savedSnapshot('left', makeDefaultEstimateState()), costing_result_snapshot: null, warp_rows: [{ yarnRate: 0 }] }
    const right = { ...left, id: 'right', warp_rows: [{ yarnRate: '180' }] }
    expect(compareSavedCostingSnapshots(left, right).yarn.warp.ratePerKg).toEqual({ left: 0, right: 180, delta: 180 })
  })

  it('does not invent order-total deltas when a saved quantity is unavailable', () => {
    const state = makeDefaultEstimateState()
    const left = savedSnapshot('left', state)
    const right = savedSnapshot('right', { ...state, orderQuantityM: 100 })
    expect(compareSavedCostings(left, right).expectedProfitDelta).toBeNull()
  })

  it.each(['warp', 'weft'] as const)('rejects missing or coerced canonical %s rates before comparison', (side) => {
    const state = makeDefaultEstimateState()
    state.warpRows[0] = { ...state.warpRows[0], calcDenier: 75, beamEnds: 3200, yarnRate: 180 }
    state.weftRows[0] = { ...state.weftRows[0], calcDenier: 75, picks: 68, effectiveCostingWidthCm: 112, yarnRate: 180 }
    const right = savedSnapshot('right', state)
    for (const rate of [null, undefined, '', ' ', false, [], {}]) {
      const left = savedSnapshot('left', state)
      Object.assign(left.costing_result_snapshot.audit![side].layers[0], { ratePerKg: rate })
      const comparison = compareSavedCostingSnapshots(left, right)
      expect(comparison.yarn[side].ratePerKg).toEqual({ left: null, right: 180, delta: null })
    }
    for (const rate of [0, '0', 180, '180']) {
      const left = savedSnapshot('left', state)
      Object.assign(left.costing_result_snapshot.audit![side].layers[0], { ratePerKg: rate })
      expect(compareSavedCostingSnapshots(left, right).yarn[side].ratePerKg.left).toBe(Number(rate))
    }
  })

  it('separates direct-overhead monthly context from monthly-expense cost drivers', () => {
    const directOld = makeDefaultEstimateState()
    directOld.overheadMode = 'direct'
    directOld.overheadOverridePerM = 3
    directOld.monthlyOutputM = 10_000
    const directNew = { ...directOld, monthlyOutputM: 20_000 }
    const directComparison = compareSavedCostingSnapshots(
      savedSnapshot('left', directOld),
      savedSnapshot('right', directNew),
    )

    expect(directComparison.overhead.monthlyOutputUsedForCosting).toEqual({ left: false, right: false })
    expect(directComparison.overhead.costDrivingChanged).toBe(false)
    expect(directComparison.overhead.referenceChanged).toBe(true)

    const monthlyOld = {
      ...directOld,
      overheadMode: 'monthly_expenses' as const,
      overheadOverridePerM: null,
      overheadItems: directOld.overheadItems.map(item => ({ ...item, monthlyAmount: 10_000 })),
    }
    const monthlyNew = { ...monthlyOld, monthlyOutputM: 20_000 }
    const monthlyComparison = compareSavedCostingSnapshots(
      savedSnapshot('left', monthlyOld),
      savedSnapshot('right', monthlyNew),
    )

    expect(monthlyComparison.overhead.monthlyOutputUsedForCosting).toEqual({ left: true, right: true })
    expect(monthlyComparison.overhead.costDrivingChanged).toBe(true)
    expect(monthlyComparison.overhead.referenceChanged).toBe(false)
  })

  it('does not recalculate historical comparison values from current defaults', () => {
    const savedCostings = read('lib/saved-costings.ts')
    const comparisonBody = savedCostings.slice(savedCostings.indexOf('export function compareSavedCostingSnapshots'))
    expect(comparisonBody).not.toContain('calcFullTotals')
  })

  it('keeps the Sprint 10 mutation boundaries explicit in the UI and database', () => {
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const costingActions = read('app/(dashboard)/owner/estimator/actions.ts')
    const rates = read('app/(dashboard)/owner/rates/actions.ts')
    const migration = read('supabase/migrations/20260802121858_sprint10_saved_costing_library_state.sql')

    expect(quotes).toContain("tx('Duplicate')")
    expect(quotes).toContain('showFavoritesOnly')
    expect(quotes).toContain('today’s Rate Book is not used')
    expect(quotes).toContain("title: 'Base yarn calculation'")
    expect(quotes).toContain("title: 'Waste'")
    expect(quotes).toContain("title: 'Overhead'")
    expect(quotes).toContain('Cost-driving changes')
    expect(quotes).toContain('Reference/context changes')
    expect(quotes).toContain('Reference only; direct ₹/m overhead is used')
    expect(quotes).toContain("title: 'Margin'")
    expect(quotes).toContain("title: 'Price'")
    expect(costingActions).toContain("supabase.rpc('update_saved_costing_library_state_atomic'")
    expect(rates).toContain("supabase.rpc('discover_yarn_rate_atomic'")
    expect(rates).not.toMatch(/from\('cost_rate_book'\)[\s\S]{0,240}\.update/)
    expect(migration).toContain('update_saved_costing_library_state_atomic')
    expect(migration).toContain('discover_yarn_rate_atomic')
    expect(migration).toContain('v_existing.updated_at IS DISTINCT FROM p_expected_updated_at')
  })
})
