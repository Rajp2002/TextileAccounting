import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BILLING_PLANS, isBillingPlanTier } from '../lib/billing-constants'
import { hasCapability, resolveEffectiveSubscription } from '../lib/subscription-access'
import { visibleOwnerNavigation } from '../lib/owner-navigation'

const migration = readFileSync(
  'supabase/migrations/20260924085030_retire_full_suite_tier.sql', 'utf8',
)

describe('current plan boundary', () => {
  it('offers only Lite and Base purchases and ignores a retired subscription for access', () => {
    expect(Object.keys(BILLING_PLANS)).toEqual(['lite', 'base'])
    expect(isBillingPlanTier('premium')).toBe(false)
    expect(resolveEffectiveSubscription([
      { status: 'active', plan_tier: 'premium', current_end: null },
    ])).toMatchObject({ tier: 'none' })
    expect(resolveEffectiveSubscription([
      { status: 'active', plan_tier: 'premium', current_end: null },
      { status: 'active', plan_tier: 'base', current_end: null },
    ])).toMatchObject({ tier: 'base' })
  })

  it('keeps production in Base and removes retired navigation', () => {
    expect(hasCapability('lite', 'production')).toBe(false)
    expect(hasCapability('base', 'production')).toBe(true)
    const paths = visibleOwnerNavigation({ tier: 'base', productionMode: 'market_run' })
      .flatMap(section => section.items.map(item => item.href))
    expect(paths).toContain('/owner/production')
    expect(paths).not.toContain('/owner/market-runs')
    expect(paths).not.toContain('/owner/orders')
  })

  it('preserves payment records while closing old database grants', () => {
    expect(migration).toContain("old.plan_tier = 'premium'")
    expect(migration).toContain("payment.status = 'captured'")
    expect(migration).toContain("'weavly_base_2026', 'base'")
    expect(migration).toContain('WHERE tier NOT IN (\'lite\', \'base\')')
    expect(migration).toContain("p_required IN ('base', 'base_production')")
    expect(migration).toContain('CREATE TRIGGER enforce_current_subscription_tier')
    expect(migration).toContain('CREATE TRIGGER enforce_current_checkout_tier')
    expect(migration).toContain('RENAME TO activate_order_billing_purchase_retired')
    expect(migration).toContain('RENAME TO claim_billing_checkout_attempt_retired')
    expect(migration).not.toMatch(/DELETE FROM public\.(?:org_subscriptions|subscription_payments|billing_invoices)/)
  })
})
