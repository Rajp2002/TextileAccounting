import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FACTORY_COST_PRESETS, getMatchingFactoryProfileId } from '../lib/factory-cost-profiles'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { validateFactoryCostProfile } from '../lib/estimator-validation'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Sprint 3 profile selection and draft recovery', () => {
  it('makes Grey Weaver the safe Rajesh-first starting profile', () => {
    const grey = FACTORY_COST_PRESETS.find(profile => profile.id === 'grey_weaver')

    expect(grey?.recommended).toBe(true)
    expect(grey?.sections).toEqual({
      winding: false,
      processing: false,
      finishing: false,
      commission: false,
      transport: false,
    })
    expect(getMatchingFactoryProfileId(grey!.sections)).toBe('grey_weaver')
  })

  it('requires a real rate when an optional charge is switched on', () => {
    const base = {
      warping_rate_per_kg: 2,
      sizing_rate_per_kg: 1.5,
      winding_rate_per_kg: 0,
      overhead_mode: 'direct' as const,
      overhead_override_per_m: 12,
      default_commission_pct: 0,
      default_transport_per_m: 0,
    }

    expect(validateFactoryCostProfile({ ...base, enabled_sections: FACTORY_COST_PRESETS[0].sections }).valid).toBe(true)
    const invalid = validateFactoryCostProfile({
      ...base,
      enabled_sections: { ...FACTORY_COST_PRESETS[0].sections, processing: true },
      default_processing_rate_per_m: 0,
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.issues[0]?.message).toContain('switch Processing / Dyeing off')
  })

  it('keeps irrelevant charges out of a realistic 50-loom grey-weaver costing', () => {
    const grey = makeDefaultEstimateState()
    grey.enabledSections = { ...FACTORY_COST_PRESETS[0].sections }
    grey.overheadMode = 'direct'
    grey.overheadOverridePerM = 12
    grey.loomCount = 50
    grey.monthlyOutputM = 45_000
    grey.processingRatePerM = 18
    grey.finishingRatePerM = 7
    grey.commissionPct = 2
    grey.transportPerM = 3
    grey.orderQuantityM = 5_000

    const greyTotals = calcFullTotals(grey)
    expect(greyTotals.audit.postProcessingCostPerMeter).toBe(0)
    expect(greyTotals.audit.logisticsCostPerMeter).toBe(0)

    const integrated = {
      ...grey,
      enabledSections: FACTORY_COST_PRESETS.find(profile => profile.id === 'full_mill')!.sections,
    }
    const integratedTotals = calcFullTotals(integrated)
    expect(integratedTotals.audit.postProcessingCostPerMeter).toBeGreaterThan(0)
    expect(integratedTotals.audit.logisticsCostPerMeter).toBe(0)
    expect(integratedTotals.totalProductionCostPerM).toBeGreaterThan(greyTotals.totalProductionCostPerM)
  })

  it('makes setup scope, save scope, and draft recovery explicit in the UI code', () => {
    const wizard = read('app/(dashboard)/owner/estimator/FactoryCostWizard.tsx')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const autosave = read('hooks/useAutosave.ts')

    // Phase 3H: the factory-type chooser never rendered on Free, Lite or Base
    // (grey-fabric weaving only), so setup goes straight to factory expenses.
    expect(wizard).not.toContain('Choose your factory type')
    expect(wizard).toContain('Set up your grey-fabric costing')
    expect(wizard).toContain("factoryProfileKey: 'grey_weaver'")
    expect(wizard).not.toContain('13.5')
    expect(estimator).toContain('Unsaved Cost Estimate')
    expect(estimator).toContain('Cost Estimate draft discarded')
    expect(autosave).toContain('suppressAutosaveUntilChanged')
    expect(autosave).toContain('Resume is not a destructive decision')
    expect(autosave).toContain('latestPersistedDraftRef.current = selected')
  })

  it('persists only profile metadata in the Sprint 3 migration', () => {
    const migration = read('supabase/migrations/20260801143858_sprint3_factory_profile_key.sql')

    expect(migration).toContain('factory_profile_key')
    expect(migration).toContain('factory_cost_profile_factory_profile_key_check')
    expect(migration).toContain('not a costing formula input')
    expect(migration).not.toContain('estimator_quotes')
  })
})
