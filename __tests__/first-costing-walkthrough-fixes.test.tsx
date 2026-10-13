import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  buildCostingResult,
  calcFullTotals,
  getEffectiveCommercialInputs,
  makeDefaultEstimateState,
  type EstimateState,
} from '@/lib/estimator'
import {
  FREE_ESTIMATE_VALIDATION_OPTIONS,
  getEstimatorReadiness,
  requiresFactoryCapacity,
  validateEstimatorSnapshot,
  validateFactoryCostProfile,
} from '@/lib/estimator-validation'
import { getEstimatorDraftStorageKey, parseEstimatorDraft, createEstimatorDraft } from '@/lib/estimator-drafts'
import { makeFreeEstimate } from '@/lib/free-estimator-defaults'
import { parseFreeEstimate } from '@/lib/free-estimator-input'
import { getFreeCalculateBlock } from '@/lib/free-calculate-block'
import { clearFreeEstimatorDraft, readFreeEstimatorDraft, writeFreeEstimatorDraft } from '@/lib/free-estimator-draft'
import { freeText } from '@/lib/i18n/free-tier'
import { FreeCalculateBlockedNote } from '@/components/estimator/FreeCalculateBlockedNote'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

/** A complete Lite costing with the grey-weaver sections: every optional section flag off. */
function brokerCosting(): EstimateState {
  const state = makeDefaultEstimateState()
  state.warpRows = [{ ...state.warpRows[0], id: 'warp', calcDenier: 50, beamEnds: 5200, yarnRate: 350 }]
  state.weftRows = [{ ...state.weftRows[0], id: 'weft', picks: 68, reedSpace: 112, calcDenier: 50, yarnRate: 350 }]
  state.perPickCostPaisa = 0.12
  state.overheadItems = []
  state.overheadMode = 'direct'
  state.overheadOverridePerM = 5.75
  state.profitPct = 12
  state.orderQuantityM = 1000
  state.commissionPct = 2
  state.transportPerM = 1.5
  return state
}

/** A complete Free costing, as typed on /free. */
function freeCosting(): EstimateState {
  const state = makeFreeEstimate()
  state.warpRows[0] = { ...state.warpRows[0], calcDenier: 100, beamEnds: 4000, yarnRate: 200 }
  state.weftRows[0] = { ...state.weftRows[0], calcDenier: 150, picks: 60, reedSpace: 150, yarnRate: 230 }
  state.perPickCostPaisa = 0.16
  state.overheadOverridePerM = 21.5
  state.profitPct = 20
  state.commissionPct = 2
  state.transportPerM = 1.25
  state.orderQuantityM = 1000
  return { ...state, isConfigured: true }
}

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
  }
}

describe('Bug 1: broker commission and transport are not gated by hidden section flags', () => {
  it('lets a normal broker costing save without a warning to acknowledge', () => {
    const state = brokerCosting()
    expect(state.enabledSections.commission).toBe(false)
    expect(state.enabledSections.transport).toBe(false)

    const validation = validateEstimatorSnapshot(state, { requireTapeLength: false, requireCapacity: false })
    expect(validation.valid).toBe(true)
    expect(validation.warnings ?? []).toEqual([])

    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)
    const readiness = getEstimatorReadiness({ validation, result, totals, warningsAcknowledged: false })
    expect(readiness.status).toBe('ready')
    expect(readiness.canPersist).toBe(true)
  })

  it('prices the entered commission and transport the same whatever a stored flag says', () => {
    const off = brokerCosting()
    const on = { ...brokerCosting(), enabledSections: { ...off.enabledSections, commission: true, transport: true } }
    const offResult = buildCostingResult(off, calcFullTotals(off))
    const onResult = buildCostingResult(on, calcFullTotals(on))

    expect(offResult.commissionPct).toBe(2)
    expect(offResult.transportPerM).toBe(1.5)
    expect(offResult.suggestedSellingPricePerM).toBe(onResult.suggestedSellingPricePerM)
    expect(getEffectiveCommercialInputs(off)).toEqual({ commissionPct: 2, transportPerM: 1.5 })
  })

  it('does not demand a charge because a stored flag is on', () => {
    const state = brokerCosting()
    state.enabledSections = { ...state.enabledSections, commission: true, transport: true }
    state.commissionPct = 0
    state.transportPerM = 0
    const validation = validateEstimatorSnapshot(state, { requireTapeLength: false, requireCapacity: false })
    expect(validation.valid).toBe(true)
    expect(validation.warnings ?? []).toEqual([])

    const profile = validateFactoryCostProfile({
      warping_rate_per_kg: 0,
      sizing_rate_per_kg: 0,
      winding_rate_per_kg: 0,
      overhead_mode: 'direct',
      overhead_override_per_m: 12,
      default_commission_pct: 0,
      default_transport_per_m: 0,
      enabled_sections: { winding: false, processing: false, finishing: false, commission: true, transport: true },
    })
    expect(profile.valid).toBe(true)
  })

  it('no longer lists commission and transport as switchable sections in the save review', () => {
    const review = estimator.slice(estimator.indexOf('function CostingSaveReview'), estimator.indexOf('function EstimatorLiveCostActions'))
    expect(review).not.toContain("['commission', 'Commission']")
    expect(review).not.toContain("['transport', 'Transport']")
  })
})

describe('Bug 2: the Free save review shows the inputs being saved', () => {
  it('builds the review from the live inputs, not the empty pre-calculation default', () => {
    expect(estimator).toContain('const saveReviewResult = useMemo(')
    const memo = estimator.slice(estimator.indexOf('const saveReviewResult = useMemo('), estimator.indexOf('const saveReviewResult = useMemo(') + 700)
    expect(memo).toContain('buildCostingResult(state, calcFullTotals(state))')

    const reviews = estimator.split('<CostingSaveReview').slice(1).map(block => block.slice(0, block.indexOf('/>')))
    expect(reviews.length).toBeGreaterThanOrEqual(3)
    for (const block of reviews) expect(block).toContain('result={saveReviewResult}')
  })

  it('shows the entered overhead, commission, transport, margin and quantity', () => {
    const state = freeCosting()
    const result = buildCostingResult(state, calcFullTotals(state))
    expect(result.overheadPerM).toBe(21.5)
    expect(result.commissionPct).toBe(2)
    expect(result.transportPerM).toBe(1.25)
    expect(result.targetMarginPct).toBe(20)
    expect(result.quantityM).toBe(1000)
  })
})

describe('Bug 3: Free can save monthly expenses ÷ output without loom capacity', () => {
  function monthlyFreeCosting() {
    const state = freeCosting()
    state.overheadMode = 'monthly_expenses'
    state.overheadOverridePerM = null
    state.overheadItems = [{ id: 'rent', label: 'Rent', monthlyAmount: 50_000, category: 'rent', source: 'manual', isPreset: false, isLocked: false }]
    state.monthlyOutputM = 20_000
    state.loomCount = 0
    return state
  }

  it('validates, parses and prices a Free monthly-expense costing with no loom count', () => {
    const state = monthlyFreeCosting()
    expect(validateEstimatorSnapshot(state, FREE_ESTIMATE_VALIDATION_OPTIONS).valid).toBe(true)
    expect(() => parseFreeEstimate(state)).not.toThrow()
    expect(buildCostingResult(state, calcFullTotals(state)).overheadPerM).toBe(2.5)
  })

  it('still requires monthly output, the divisor Free can enter', () => {
    const state = { ...monthlyFreeCosting(), monthlyOutputM: 0 }
    const validation = validateEstimatorSnapshot(state, FREE_ESTIMATE_VALIDATION_OPTIONS)
    expect(validation.valid).toBe(false)
    expect(validation.issues.map(issue => issue.field)).toContain('monthlyOutputM')
    expect(() => parseFreeEstimate(state)).toThrow('FREE_INVALID_INPUT')
  })

  it('keeps the Lite and Base capacity gate unchanged', () => {
    const state = monthlyFreeCosting()
    expect(requiresFactoryCapacity(state)).toBe(true)
    const validation = validateEstimatorSnapshot(state, { requireTapeLength: false, requireCapacity: requiresFactoryCapacity(state) })
    expect(validation.issues.map(issue => issue.field)).toContain('loomCount')
  })

  it('uses the Free rule on the page and on the server', () => {
    expect(estimator).toContain('const requireCapacityForCurrentCosting = !freeMode && requiresFactoryCapacity(state, false)')
    expect(read('lib/free-service.ts')).toContain('validateEstimatorSnapshot(estimate, FREE_ESTIMATE_VALIDATION_OPTIONS)')
    expect(read('lib/free-estimator-input.ts')).toContain('validateEstimatorSnapshot(state, FREE_ESTIMATE_VALIDATION_OPTIONS)')
  })
})

describe('Bug 4: Free at zero allowance explains Calculate and keeps the inputs', () => {
  const active = { accessState: 'active', estimationEnabled: true, quota: { remaining: 0 } }

  it('names why Calculate is unavailable', () => {
    expect(getFreeCalculateBlock({ status: active, statusError: '', hasSavedCosting: false, busy: false })).toBe('allowance_used')
    expect(getFreeCalculateBlock({ status: { ...active, quota: { remaining: 1 } }, statusError: '', hasSavedCosting: false, busy: false })).toBeNull()
    expect(getFreeCalculateBlock({ status: active, statusError: '', hasSavedCosting: false, busy: true })).toBeNull()
    expect(getFreeCalculateBlock({ status: active, statusError: '', hasSavedCosting: true, busy: false })).toBeNull()
    expect(getFreeCalculateBlock({ status: null, statusError: '', hasSavedCosting: false, busy: false })).toBe('checking')
    expect(getFreeCalculateBlock({ status: null, statusError: 'FREE_TEMPORARY_ERROR', hasSavedCosting: false, busy: false })).toBe('unavailable')
    expect(getFreeCalculateBlock({ status: { ...active, estimationEnabled: false, quota: { remaining: 2 } }, statusError: '', hasSavedCosting: false, busy: false })).toBe('paused')
    expect(getFreeCalculateBlock({ status: { ...active, accessState: 'suspended', estimationEnabled: false, quota: { remaining: 2 } }, statusError: '', hasSavedCosting: false, busy: false })).toBe('account')
  })

  it('offers the Lite trial first when the account may still start it', () => {
    const html = renderToStaticMarkup(
      <FreeCalculateBlockedNote id="note" block="allowance_used" resetsAt="2026-11-01T00:00:00+05:30" draftKept baseVisible liteTrialEligible onViewPlans={() => {}} onRefresh={() => {}} />,
    )
    expect(html).toContain(freeText('en', 'noCostingsLeft'))
    expect(html).toContain(freeText('en', 'tryLiteFree'))
    expect(html).toContain(freeText('en', 'draftKept'))
    expect(html).toContain('Resets')
    expect(html).not.toContain(freeText('en', 'planExplore'))
  })

  it('offers Base only to accounts that may see it', () => {
    const withBase = renderToStaticMarkup(
      <FreeCalculateBlockedNote id="note" block="allowance_used" resetsAt={null} draftKept={false} baseVisible liteTrialEligible={false} onViewPlans={() => {}} onRefresh={() => {}} />,
    )
    expect(withBase).toContain(freeText('en', 'planExplore'))
    expect(withBase).not.toContain(freeText('en', 'draftKept'))

    const liteOnly = renderToStaticMarkup(
      <FreeCalculateBlockedNote id="note" block="allowance_used" resetsAt={null} draftKept={false} baseVisible={false} liteTrialEligible={false} onViewPlans={() => {}} onRefresh={() => {}} />,
    )
    expect(liteOnly).toContain(freeText('en', 'upgradeButton'))
    expect(liteOnly).not.toContain('Base')
  })

  it('explains the other reasons with existing Free copy', () => {
    const render = (block: 'paused' | 'unavailable' | 'account' | 'checking') => renderToStaticMarkup(
      <FreeCalculateBlockedNote id="note" block={block} resetsAt={null} draftKept={false} baseVisible={false} liteTrialEligible={false} onViewPlans={() => {}} onRefresh={() => {}} />,
    )
    expect(render('paused')).toContain(freeText('en', 'paused'))
    expect(render('unavailable')).toContain(freeText('en', 'refresh'))
    expect(render('account')).toContain(freeText('en', 'denied'))
    expect(render('checking')).toContain(freeText('en', 'checkingUsage'))
  })

  it('has every new phrase in English, Gujarati and Hindi', () => {
    for (const key of ['noCostingsLeft', 'calculateAfterReset', 'draftKept', 'draftRestored', 'tryLiteFree'] as const) {
      expect(freeText('en', key).trim()).not.toBe('')
      expect(freeText('gu', key)).toMatch(/\p{Script=Gujarati}/u)
      expect(freeText('hi', key)).toMatch(/\p{Script=Devanagari}/u)
    }
  })

  it('keeps unsubmitted Free inputs in the estimator draft slot, so Lite can offer them after a trial starts', () => {
    const storage = memoryStorage()
    const state = freeCosting()
    expect(writeFreeEstimatorDraft(storage, 'org-1', 'user-1', { state, qualityLabel: 'Rayon 60', warpInstruction: 'w', weftInstruction: '' }, 1_000)).toBe(true)

    const raw = storage.getItem(getEstimatorDraftStorageKey('org-1', 'user-1'))
    const asPaidDraft = parseEstimatorDraft<EstimateState>(raw, 2_000)
    expect(asPaidDraft?.qualityLabel).toBe('Rayon 60')
    expect(asPaidDraft?.sourceQuoteId).toBeUndefined()
    // Lite keeps its own configuration decision when it restores this draft.
    expect(asPaidDraft?.state.isConfigured).toBe(false)

    const restored = readFreeEstimatorDraft(storage, 'org-1', 'user-1', 2_000)
    expect(restored?.qualityLabel).toBe('Rayon 60')
    expect(restored?.warpInstruction).toBe('w')
    expect(restored?.state.warpRows).toEqual(state.warpRows)
    expect(restored?.state.commissionPct).toBe(2)
  })

  it('restores only drafts Free can calculate, and never a reopened paid costing', () => {
    const storage = memoryStorage()
    const key = getEstimatorDraftStorageKey('org-1', 'user-1')
    const page = { partyName: '', qualityLabel: 'Q', warpInstruction: '', weftInstruction: '' }

    storage.setItem(key, JSON.stringify(createEstimatorDraft({ ...page, state: freeCosting(), sourceQuoteId: 'quote-1' }, { savedAt: 1_000 })))
    expect(readFreeEstimatorDraft(storage, 'org-1', 'user-1', 2_000)).toBeNull()
    clearFreeEstimatorDraft(storage, 'org-1', 'user-1', 2_000)
    expect(storage.getItem(key)).not.toBeNull()

    const locked = freeCosting()
    locked.overheadItems = [{ id: 'power', label: 'Power', monthlyAmount: 0, category: 'electricity', source: 'manual', isPreset: true, isLocked: true }]
    storage.setItem(key, JSON.stringify(createEstimatorDraft({ ...page, state: locked }, { savedAt: 1_000 })))
    expect(readFreeEstimatorDraft(storage, 'org-1', 'user-1', 2_000)).toBeNull()
    // Inputs Free could not restore are not reported as kept.
    expect(writeFreeEstimatorDraft(storage, 'org-1', 'user-1', { state: locked, qualityLabel: 'Q', warpInstruction: '', weftInstruction: '' }, 1_000)).toBe(false)

    writeFreeEstimatorDraft(storage, 'org-1', 'user-1', { state: freeCosting(), qualityLabel: 'Q', warpInstruction: '', weftInstruction: '' }, 1_000)
    expect(readFreeEstimatorDraft(storage, 'org-1', 'user-1', 1_000 + 8 * 24 * 60 * 60 * 1000)).toBeNull()
    clearFreeEstimatorDraft(storage, 'org-1', 'user-1')
    expect(storage.getItem(key)).toBeNull()
  })

  it('reports a draft that could not be stored', () => {
    const failing = { getItem: () => null, setItem: () => { throw new Error('quota') }, removeItem: () => {} }
    expect(writeFreeEstimatorDraft(failing, 'org-1', 'user-1', { state: freeCosting(), qualityLabel: '', warpInstruction: '', weftInstruction: '' })).toBe(false)
  })

  it('shows the reason beside both Free Calculate buttons and keeps the draft in step with the page', () => {
    expect(estimator).toContain('<FreeCalculateBlockedNote')
    expect(estimator).toContain('renderFreeCalculateNote(FREE_CALCULATE_NOTE_ID')
    expect(estimator).toContain('renderFreeCalculateNote(FREE_CALCULATE_LIVE_NOTE_ID')
    expect(estimator).toContain('aria-describedby={freeCalculateBlock ? FREE_CALCULATE_NOTE_ID : undefined}')
    expect(estimator).toContain('freeCalculateNoteId={freeCalculateBlock ? FREE_CALCULATE_LIVE_NOTE_ID : undefined}')
    const live = estimator.slice(estimator.indexOf('function EstimatorLiveCostActions'), estimator.indexOf('function EstimatorLiveCostActions') + 4000)
    expect(live).toContain('renderFreeCalculateNote?.(onDismiss)')
    expect(estimator).toContain('writeFreeEstimatorDraft(')
    expect(estimator).toContain('readFreeEstimatorDraft(')
    expect(estimator).toContain('clearFreeEstimatorDraft(')
    // Leaving is only guarded while the page holds inputs the device draft does not.
    const reason = estimator.slice(estimator.indexOf('const freeLeaveReason'), estimator.indexOf('useFreeLeaveGuard(freeLeaveReason)'))
    expect(reason).toContain('freeDraftPage !== freePage')
  })
})
