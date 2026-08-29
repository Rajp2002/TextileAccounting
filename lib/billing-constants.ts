/** Commercial prices are represented only in paise and include explicit GST. */
export const GST_RATE = 0.18

export type PurchasablePlanTier = 'lite' | 'base'
/** Existing legacy records remain readable but are not purchasable. */
export type LegacyPlanTier = 'premium'
export type BillingPlanTier = PurchasablePlanTier | LegacyPlanTier
export type BillingPurchaseType = 'initial_purchase' | 'renewal'

/**
 * The two plans currently available to customers. The legacy operations tier
 * is intentionally absent so it cannot appear in a new checkout.
 */
export const BILLING_SELF_SERVE_PLAN_TIERS: readonly PurchasablePlanTier[] = ['lite', 'base']
export const BILLING_SELF_SERVE_DEFAULT_TIER: PurchasablePlanTier = 'lite'

export const BILLING_PLANS = {
  lite: {
    tier: 'lite',
    catalogId: 'weavly_lite_2026',
    name: 'Weavly Lite',
    positioning: 'Textile costing and rate management',
    firstYearBasePaise: 254_153,
    firstYearGstPaise: 45_747,
    firstYearTotalPaise: 299_900,
    renewalBasePaise: 127_034,
    renewalGstPaise: 22_866,
    renewalTotalPaise: 149_900,
  },
  base: {
    tier: 'base',
    catalogId: 'weavly_base_2026',
    name: 'Weavly Base',
    positioning: 'Costing and production management',
    firstYearBasePaise: 847_373,
    firstYearGstPaise: 152_527,
    firstYearTotalPaise: 999_900,
    renewalBasePaise: 423_644,
    renewalGstPaise: 76_256,
    renewalTotalPaise: 499_900,
  },
  premium: {
    tier: 'premium',
    catalogId: 'plan_SeGwtIQO8LE25h',
    name: 'Weavly legacy operations',
    firstYearBasePaise: 2_500_000,     // ₹25,000
    firstYearGstPaise: 450_000,        // ₹4,500
    firstYearTotalPaise: 2_950_000,    // ₹29,500
    renewalBasePaise: 700_000,         // ₹7,000
    renewalGstPaise: 126_000,          // ₹1,260
    renewalTotalPaise: 826_000,        // ₹8,260
  },
} as const

export function isPurchasablePlanTier(value: unknown): value is PurchasablePlanTier {
  return value === 'lite' || value === 'base'
}

export function isBillingPlanTier(value: unknown): value is BillingPlanTier {
  return isPurchasablePlanTier(value) || value === 'premium'
}

/**
 * Server-side rollout boundary.  The catalog may retain Premium for existing
 * entitlement/read-only behavior, but self-serve checkout must use this
 * explicit allowlist.
 */
export function isSelfServePlanTier(value: unknown): value is PurchasablePlanTier {
  return isPurchasablePlanTier(value) && BILLING_SELF_SERVE_PLAN_TIERS.includes(value)
}

export function getBillingPlan(tier: BillingPlanTier) {
  return BILLING_PLANS[tier]
}

export function isBillingPurchaseType(value: unknown): value is BillingPurchaseType {
  return value === 'initial_purchase' || value === 'renewal'
}

export function getBillingPrice(tier: BillingPlanTier, purchaseType: BillingPurchaseType) {
  const plan = getBillingPlan(tier)

  return purchaseType === 'renewal'
    ? {
        basePaise: plan.renewalBasePaise,
        gstPaise: plan.renewalGstPaise,
        totalPaise: plan.renewalTotalPaise,
      }
    : {
        basePaise: plan.firstYearBasePaise,
        gstPaise: plan.firstYearGstPaise,
        totalPaise: plan.firstYearTotalPaise,
      }
}

// Backwards-compatible premium aliases used by renewal and legacy tests.
export const FIRST_YEAR_BASE_PAISE = BILLING_PLANS.premium.firstYearBasePaise
export const FIRST_YEAR_GST_PAISE = BILLING_PLANS.premium.firstYearGstPaise
export const FIRST_YEAR_TOTAL_PAISE = BILLING_PLANS.premium.firstYearTotalPaise
export const RENEWAL_BASE_PAISE = BILLING_PLANS.premium.renewalBasePaise
export const RENEWAL_GST_PAISE = BILLING_PLANS.premium.renewalGstPaise
export const RENEWAL_TOTAL_PAISE = BILLING_PLANS.premium.renewalTotalPaise

export const BILLING_MODEL = 'upfront_first_year_plus_annual_renewal'
export const ACCESS_DAYS = 365

/** Same-plan manual renewals are only offered during the final 30 days. */
export const RENEWAL_ELIGIBILITY_DAYS = 30
