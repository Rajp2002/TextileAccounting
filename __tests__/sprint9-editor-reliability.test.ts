import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_WARP_ROW, DEFAULT_WEFT_ROW, makeDefaultEstimateState } from '../lib/estimator'
import { validateEstimatorSnapshot } from '../lib/estimator-validation'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

function completeBaseEstimate() {
  const estimate = makeDefaultEstimateState()
  estimate.tapeLengthM = 1_000
  estimate.perPickCostPaisa = 0.14
  estimate.monthlyOutputM = 10_000
  estimate.loomCount = 24
  estimate.warpRows[0] = {
    ...estimate.warpRows[0],
    label: 'Main Warp',
    calcDenier: 75,
    beamEnds: 3_200,
    yarnRate: 107,
  }
  estimate.weftRows[0] = {
    ...estimate.weftRows[0],
    label: 'Main Weft',
    calcDenier: 75,
    picks: 68,
    effectiveCostingWidthCm: 112,
    yarnRate: 107,
  }
  return estimate
}

describe('Sprint 9 editor and draft reliability', () => {
  it('hard-blocks a newly added blank warp or weft component', () => {
    const estimate = completeBaseEstimate()
    estimate.warpRows.push({ id: 'blank-warp', ...DEFAULT_WARP_ROW, label: '' })
    estimate.weftRows.push({ id: 'blank-weft', ...DEFAULT_WEFT_ROW, label: '' })

    const result = validateEstimatorSnapshot(estimate, { requireTapeLength: false })

    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'warpRows.1',
        message: expect.stringContaining('Remove this blank warp component'),
      }),
      expect.objectContaining({
        field: 'weftRows.1',
        message: expect.stringContaining('Remove this blank weft component'),
      }),
    ]))
  })

  it('keeps save review, reset cleanup, and dialog rollback explicit in the editor', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const autosave = read('hooks/useAutosave.ts')

    expect(estimator).toContain('warningContinuationRef.current')
    expect(estimator).toContain('Review and save')
    expect(estimator).toContain('warningAlreadyReviewed = false')
    expect(estimator).toContain('Save New Version creates a new immutable costing snapshot')
    expect(estimator).toContain('Save Costing creates the reusable quality and its first immutable costing version')
    expect(estimator).toContain('rollbackSaveAsNewQualityDialog')
    expect(estimator).toContain('setPendingStaleRateSave(null)')
    expect(estimator).toContain('setPendingQualityVersionSave(null)')
    expect(autosave).toContain('markUserEdit')
    expect(autosave).toContain('if (suppressUntilChangeRef.current) return false')
  })
})
