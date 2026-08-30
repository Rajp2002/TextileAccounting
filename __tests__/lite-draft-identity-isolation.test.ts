import { describe, expect, it } from 'vitest'
import {
  getEstimatorDraftStorageKey,
  createEstimatorDraft,
  parseEstimatorDraft,
  type EstimatorAutosaveData,
} from '../lib/estimator-drafts'
import type { EstimateState } from '../lib/estimator'

describe('LST-14 & P0 Invariant: Draft Identity & Workspace Isolation', () => {
  const sampleStateA: Partial<EstimateState> = {
    tapeLengthM: 100,
    yarnShortagePct: 3,
    warpCrimpPct: 5,
  }

  const sampleStateB: Partial<EstimateState> = {
    tapeLengthM: 250,
    yarnShortagePct: 6,
    warpCrimpPct: 8,
  }

  it('strictly isolates local drafts by orgId and userId', () => {
    const orgA = 'org-weavly-alpha-1111'
    const userA = 'user-owner-raj-2222'

    const orgB = 'org-weavly-beta-3333'
    const userB = 'user-owner-amit-4444'

    const keyA = getEstimatorDraftStorageKey(orgA, userA)
    const keyB = getEstimatorDraftStorageKey(orgB, userB)

    // Keys must be distinct and non-overlapping
    expect(keyA).toBe(`weavly-estimator-draft-${orgA}-${userA}`)
    expect(keyB).toBe(`weavly-estimator-draft-${orgB}-${userB}`)
    expect(keyA).not.toBe(keyB)

    // Simulated browser localStorage store
    const simulatedLocalStorage = new Map<string, string>()

    // 1. Account A writes local draft
    const draftA = createEstimatorDraft({
      state: sampleStateA,
      qualityLabel: '58" Poly Satin 75x80',
      partyName: 'Alpha Weaves',
      warpInstruction: '',
      weftInstruction: '',
      sourceRecordKind: 'costing',
      clientRequestId: 'req-uuid-a-1',
    })
    simulatedLocalStorage.set(keyA, JSON.stringify(draftA))

    // 2. Account B opens estimator
    const rawDraftB = simulatedLocalStorage.get(keyB)
    expect(rawDraftB).toBeUndefined() // B gets zero data from A

    // 3. Account B writes own draft
    const draftB = createEstimatorDraft({
      state: sampleStateB,
      qualityLabel: '44" Georgette 40x40',
      partyName: 'Beta Silks',
      warpInstruction: '',
      weftInstruction: '',
      sourceRecordKind: 'costing',
      clientRequestId: 'req-uuid-b-2',
    })
    simulatedLocalStorage.set(keyB, JSON.stringify(draftB))

    // 4. B's draft does not overwrite A's draft
    const restoredA = parseEstimatorDraft(simulatedLocalStorage.get(keyA)!) as EstimatorAutosaveData<typeof sampleStateA>
    const restoredB = parseEstimatorDraft(simulatedLocalStorage.get(keyB)!) as EstimatorAutosaveData<typeof sampleStateB>

    expect(restoredA.qualityLabel).toBe('58" Poly Satin 75x80')
    expect(restoredA.partyName).toBe('Alpha Weaves')
    expect(restoredA.state.tapeLengthM).toBe(100)

    expect(restoredB.qualityLabel).toBe('44" Georgette 40x40')
    expect(restoredB.partyName).toBe('Beta Silks')
    expect(restoredB.state.tapeLengthM).toBe(250)
  })
})
