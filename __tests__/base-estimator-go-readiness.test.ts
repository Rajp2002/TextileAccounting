import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hasPaidBaseHistory, resolveEffectiveSubscription, resolveOrgPlanAccess } from '../lib/subscription-access'
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

  it('retains the Lite costing desk after a paid Base period expires', () => {
    const now = Date.parse('2026-08-30T12:00:00Z')
    const expiredBase = {
      status: 'expired',
      plan_tier: 'base',
      current_start: '2025-08-30T00:00:00Z',
      current_end: '2026-08-29T00:00:00Z',
      razorpay_payment_id: 'pay_base_paid',
    }

    expect(hasPaidBaseHistory([expiredBase], now)).toBe(true)
    expect(resolveOrgPlanAccess('none', true)).toMatchObject({
      subscriptionTier: 'none',
      effectiveTier: 'lite',
    })
    expect(resolveOrgPlanAccess('none', false).effectiveTier).toBe('none')
  })

  it('rejects invalid factory economics before persistence', () => {
    const valid = {
      warping_rate_per_kg: 2, sizing_rate_per_kg: 1.5, winding_rate_per_kg: 0,
      default_processing_rate_per_m: 3.5, default_finishing_rate_per_m: 1.25,
      overhead_mode: 'monthly_expenses' as const, default_commission_pct: 2, default_transport_per_m: 0,
      monthly_output_m: 10_000, loom_count: 8, monthly_working_days: 26,
      avg_output_per_loom_per_day: 50,
    }
    expect(validateFactoryCostProfile(valid).valid).toBe(true)
    expect(validateFactoryCostProfile({ ...valid, overhead_pct: Number.NaN }).valid).toBe(true)
    expect(validateFactoryCostProfile({ ...valid, overhead_mode: 'direct', overhead_override_per_m: null }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, monthly_working_days: 0 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, avg_output_per_loom_per_day: 0 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, default_commission_pct: 100 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, default_processing_rate_per_m: -1 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...valid, default_finishing_rate_per_m: Number.NaN }).valid).toBe(false)
  })

  it('uses on-canvas PDF rendering, resets recipient state, and avoids the null noopener print handle', () => {
    const dialog = source('components/estimator/CostingExportDialog.tsx')
    const renderer = source('lib/document-pdf.ts')
    expect(dialog).toContain('renderDocumentPdf(')
    expect(renderer).toContain("host.style.left = '0'")
    expect(renderer).not.toContain("host.style.left = '-10000px'")
    expect(dialog).toContain('useEffect(() =>')
    expect(dialog).toContain("window.open('', '_blank')")
    expect(dialog).toContain('printWindow.opener = null')
  })

  it('shows production cost from recipe totals and distinguishes commercial break-even', () => {
    const saved = source('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    expect(saved).toContain('getProductionCostPerM')
    // The breakdown's cost and price tiles render inside the margin control, from the saved result.
    expect(saved).toContain('saved={latestResult}')
    expect(source('components/estimator/SavedCostingMargin.tsx')).toContain('shown.productionCostPerM')
  })

  it('gates Rate Book at route, action, RLS, and lockdown boundaries', () => {
    expect(source('app/(dashboard)/owner/rates/layout.tsx')).toContain('requiredCapability="rate_book"')
    const actions = source('app/(dashboard)/owner/rates/actions.ts')
    expect(actions.match(/requireBaseTier\(profile\.org_id\)/g)?.length).toBeGreaterThanOrEqual(4)
    const migration = source('supabase/migrations/20260721183000_base_estimator_go_readiness.sql')
    expect(migration).toContain("public.org_has_subscription_tier(org_id, 'base')")
    expect(migration).toContain('NOT public.check_org_lockdown(org_id)')
  })

  it('saves rate book, history, factory defaults, and matching qualities in one database transaction', () => {
    const actions = source('app/(dashboard)/owner/rates/actions.ts')
    expect(actions).toContain("supabase.rpc('save_cost_rate_atomic_versioned'")
    expect(actions).toContain('p_expected_updated_at')
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

  it('learns warp and weft yarn rates in the same transaction that saves a costing', () => {
    const migration = source('supabase/migrations/20260722113210_sync_costing_yarns_to_rate_book.sql')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.sync_saved_costing_yarns_to_rate_book')
    expect(migration).toContain("SELECT 'yarn_warp'::text AS category")
    expect(migration).toContain("SELECT 'yarn_weft'::text AS category")
    expect(migration).toContain('INSERT INTO public.cost_rate_book')
    expect(migration).toContain("WHEN (NEW.record_kind = 'costing')")
    expect(migration).toContain('SECURITY INVOKER')
    expect(migration).not.toContain('SECURITY DEFINER')
  })

  it('keeps Base focused on saved costing analysis and removes scenario testing', () => {
    const estimator = source('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    expect(estimator).not.toContain('Scenario Analysis')
    expect(estimator).not.toContain('customTargetPrice')
    expect(estimator).toContain("accent === 'indigo' ? 'lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4' : 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5'")
    expect(estimator).toContain('<div className="space-y-2 2xl:w-[520px]">')
    expect(estimator).toContain('<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">')
    expect(estimator).toContain('data-testid="save-as-new-quality"')
    expect(estimator).toContain('id="export-cost-sheet-hint" className="w-full text-xs')
    // Phase 3H: the costing save is always the primary action.
    expect(estimator).toContain('id="legacy-btn-save-accept"')
    expect(estimator).toContain("onClick={() => void handlePrimaryCostingAction()}")

    const savedCostings = source('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    // Phase 3H: Saved Costings has no production-usage or quotation variant.
    expect(savedCostings).not.toMatch(/\bcanUseProduction\b/)
    expect(savedCostings).not.toContain('canUseQuotationWorkflow')
    const savedCostingsHeader = savedCostings.match(/<PageHeader\b([\s\S]*?)\/>/)?.[0] ?? ''
    expect(savedCostingsHeader).toContain("title={t('common.saved_costings_title')}")
    // The catalogue redesign (2026-10-10) brings back one short intro line, as on the stock pages.
    expect(savedCostingsHeader).toContain('description={<span data-i18n-skip="true" lang={language}>{catalogue.intro}</span>}')
    expect(savedCostings).toContain('expand a quality to review its costing history')
  })

  it('collects the main factory costing defaults during first-run setup', () => {
    const wizard = source('app/(dashboard)/owner/estimator/FactoryCostWizard.tsx')
    for (const label of ['Warping', 'Sizing', 'Processing', 'Finishing', 'Broker commission', 'Transport charge', 'Warp crimp', 'Default yarn waste']) {
      expect(wizard).toContain(`'${label}'`)
    }
    expect(wizard).toContain("label === 'Processing' ? selectedSections.processing")
    expect(wizard).toContain("label === 'Finishing' ? selectedSections.finishing")
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
    expect(actions).toContain("save_estimator_costing_revision_v2")
    expect(actions).toContain('outcome: costingResult.outcome')
    expect(actions).toContain('        factoryProfileUpdatedAt,\n')
    expect(source('lib/estimator-quote-payload.ts')).toContain('factory_profile_updated_at: input.factoryProfileUpdatedAt')
    const migration = source('supabase/migrations/20260721183000_base_estimator_go_readiness.sql')
    expect(migration).toContain('assign_standalone_costing_revision')
    // LT07: still owner-only; Free-account redirects are left to the owner layout,
    // which keeps pure Free accounts out and lets retained owners in.
    expect(source('app/(dashboard)/owner/data-export/page.tsx')).toContain("await requireRole(['owner'], { allowFreeAccount: true })")
    expect(source('app/(dashboard)/owner/settings/data-export.ts')).toContain('The organization export is incomplete')
  })
})
