import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveEffectiveSubscription } from '../lib/subscription-access'
import { validateFactoryCostProfile } from '../lib/estimator-validation'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Base Estimator Go-readiness hardening', () => {
  it('keeps paid-through application access aligned with future-start and terminal status rules', () => {
    const now = Date.parse('2026-07-21T12:00:00Z')
    expect(resolveEffectiveSubscription([{ status: 'cancelled', plan_tier: 'base', current_start: '2026-01-01T00:00:00Z', current_end: '2026-07-22T00:00:00Z' }], now).tier).toBe('base')
    expect(resolveEffectiveSubscription([{ status: 'paused', plan_tier: 'base', current_start: '2026-01-01T00:00:00Z', current_end: '2026-07-22T00:00:00Z' }], now).tier).toBe('base')
    expect(resolveEffectiveSubscription([{ status: 'active', plan_tier: 'base', current_start: '2026-07-22T00:00:00Z', current_end: '2027-07-22T00:00:00Z' }], now).tier).toBe('none')
    expect(resolveEffectiveSubscription([{ status: 'failed', plan_tier: 'base', current_start: '2026-01-01T00:00:00Z', current_end: '2027-01-01T00:00:00Z' }], now).tier).toBe('none')
  })

  it('rejects invalid factory economics before persistence', () => {
    const valid = {
      warping_rate_per_kg: 2, sizing_rate_per_kg: 1.5, winding_rate_per_kg: 0,
      default_processing_rate_per_m: 3.5, default_finishing_rate_per_m: 1.25,
      overhead_pct: 8, default_commission_pct: 2, default_transport_per_m: 0,
      monthly_output_m: 10_000, loom_count: 8, monthly_working_days: 26,
      avg_output_per_loom_per_day: 50,
    }
    expect(validateFactoryCostProfile(valid).valid).toBe(true)
    expect(validateFactoryCostProfile({ ...valid, overhead_pct: Number.NaN }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, monthly_working_days: 0 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, avg_output_per_loom_per_day: 0 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, default_commission_pct: 100 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, default_processing_rate_per_m: -1 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, default_finishing_rate_per_m: Number.NaN }).valid).toBe(false)
  })

  it('uses on-canvas PDF rendering, resets recipient state, and avoids the null noopener print handle', () => {
    const dialog = source('components/estimator/CostingExportDialog.tsx')
    expect(dialog).toContain("host.style.left = '0'")
    expect(dialog).not.toContain("host.style.left = '-10000px'")
    expect(dialog).toContain('useEffect(() =>')
    expect(dialog).toContain("window.open('', '_blank')")
    expect(dialog).toContain('printWindow.opener = null')
  })

  it('shows production cost from recipe totals and distinguishes commercial break-even', () => {
    const saved = source('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    expect(saved).toContain('getProductionCostPerM')
    expect(saved).toContain('latestTotals.totalProductionCostPerM')
    expect(saved).toContain("['Commercial break-even'")
    expect(saved).toContain("costing.quality_label || 'Untitled costing'} · v")
  })

  it('gates Rate Book at route, action, RLS, and lockdown boundaries', () => {
    expect(source('app/(dashboard)/owner/rates/layout.tsx')).toContain('requiredTier="base"')
    const actions = source('app/(dashboard)/owner/rates/actions.ts')
    expect(actions.match(/requireBaseTier\(profile\.org_id\)/g)?.length).toBe(4)
    const migration = source('supabase/migrations/20260721183000_base_estimator_go_readiness.sql')
    expect(migration).toContain("public.org_has_subscription_tier(org_id, 'base')")
    expect(migration).toContain('NOT public.check_org_lockdown(org_id)')
  })

  it('saves rate book, history, factory defaults, and matching qualities in one database transaction', () => {
    const actions = source('app/(dashboard)/owner/rates/actions.ts')
    expect(actions).toContain("supabase.rpc('save_cost_rate_atomic'")
    expect(actions).not.toContain('applyProfileDefault')
    expect(actions).not.toContain('syncYarnRateToSavedQualities')

    const migration = source('supabase/migrations/20260721203000_atomic_base_rate_updates.sql')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.save_cost_rate_atomic')
    expect(migration).toContain('INSERT INTO public.cost_rate_history')
    expect(migration).toContain('UPDATE public.factory_cost_profile')
    expect(migration).toContain('UPDATE public.estimator_templates')
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.save_cost_rate_atomic')
  })

  it('keeps Base focused on saved costing analysis and removes scenario testing', () => {
    const estimator = source('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    expect(estimator).not.toContain('Scenario Analysis')
    expect(estimator).not.toContain('customTargetPrice')
    expect(estimator).toContain("accent === 'indigo' ? '2xl:grid-cols-7' : '2xl:grid-cols-5'")
    expect(estimator).toContain("variant={isStandaloneCostingSession ? 'default' : 'outline'}")

    const savedCostings = source('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    expect(savedCostings).toContain('canUseProduction && <section')
    expect(savedCostings).toContain('breakdowns, and comparison in one place')
    expect(savedCostings).toContain('expand a quality to review its costing history')
  })

  it('collects the main factory costing defaults during first-run setup', () => {
    const wizard = source('app/(dashboard)/owner/estimator/FactoryCostWizard.tsx')
    for (const label of ['Warping', 'Sizing', 'Processing', 'Finishing', 'Commission', 'Transport', 'Warp crimp', 'Default yarn waste']) {
      expect(wizard).toContain(`'${label}'`)
    }
    expect(wizard).toContain('processing: processingRate > 0')
    expect(wizard).toContain('finishing: finishingRate > 0')
    expect(wizard).toContain("step === 'defaults'")
  })

  it('uses only the official Razorpay loader and tombstones the legacy proxy', () => {
    const subscribe = source('components/billing/SubscribeButton.tsx')
    expect(subscribe).toContain('https://checkout.razorpay.com/v1/checkout.js')
    expect(subscribe).not.toContain("tryLoadScript('/api/billing/checkout-script')")
    expect(source('app/api/billing/checkout-script/route.ts')).toContain('status: 410')
  })

  it('assigns deterministic costing revisions and exposes post-expiry export', () => {
    const actions = source('app/(dashboard)/owner/estimator/actions.ts')
    expect(actions).toContain('costing_group_id: previous?.costing_group_id ?? previous?.id ?? crypto.randomUUID()')
    expect(actions).toContain('version_number: Number(previous?.version_number ?? 0) + 1')
    const migration = source('supabase/migrations/20260721183000_base_estimator_go_readiness.sql')
    expect(migration).toContain('assign_standalone_costing_revision')
    expect(source('app/(dashboard)/owner/data-export/page.tsx')).toContain("await requireRole(['owner'])")
    expect(source('app/(dashboard)/owner/settings/data-export.ts')).toContain('The organization export is incomplete')
  })
})
