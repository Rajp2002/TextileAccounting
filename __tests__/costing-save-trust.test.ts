import { describe, expect, it } from 'vitest'
import { buildCostingInputFingerprint } from '../lib/costing-save-trust'
import { makeDefaultEstimateState } from '../lib/estimator'

describe('costing save trust', () => {
  it('ignores generated row ids so reopening the same costing is a no-op', () => {
    const first = makeDefaultEstimateState()
    const second = structuredClone(first)
    second.warpRows[0].id = 'new-warp-row-id'
    second.weftRows[0].id = 'new-weft-row-id'
    second.overheadItems[0].id = 'new-overhead-id'

    expect(buildCostingInputFingerprint(first)).toBe(buildCostingInputFingerprint(second))
  })

  it('changes when Rajesh changes a commercial assumption', () => {
    const first = makeDefaultEstimateState()
    const changed = structuredClone(first)
    changed.transportPerM = first.transportPerM + 1

    expect(buildCostingInputFingerprint(first)).not.toBe(buildCostingInputFingerprint(changed))
  })

  it('keeps a costing note change visible as a deliberate new snapshot', () => {
    const state = makeDefaultEstimateState()

    expect(buildCostingInputFingerprint(state, { warpInstruction: '50/48' }))
      .not.toBe(buildCostingInputFingerprint(state, { warpInstruction: '50/48 + selvedge' }))
  })
})
