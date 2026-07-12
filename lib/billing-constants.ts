/** Commercial prices are represented only in paise and include explicit GST. */
export const GST_RATE = 0.18

export type PurchasablePlanTier = 'base' | 'premium'
export type BillingPurchaseType = 'initial_purchase' | 'renewal'

export const BILLING_PLANS = {
  base: {
    tier: 'base',
    name: 'Weavly Estimator',
    firstYearBasePaise: 700_000,       // ₹7,000
    firstYearGstPaise: 126_000,        // ₹1,260
    firstYearTotalPaise: 826_000,      // ₹8,260
    renewalBasePaise: 200_000,         // ₹2,000
    renewalGstPaise: 36_000,           // ₹360
    renewalTotalPaise: 236_000,        // ₹2,360
  },
  premium: {
    tier: 'premium',
    name: 'Weavly Full Suite',
    firstYearBasePaise: 2_500_000,     // ₹25,000
    firstYearGstPaise: 450_000,        // ₹4,500
    firstYearTotalPaise: 2_950_000,    // ₹29,500
    renewalBasePaise: 700_000,         // ₹7,000
    renewalGstPaise: 126_000,          // ₹1,260
    renewalTotalPaise: 826_000,        // ₹8,260
  },
} as const

export function isPurchasablePlanTier(value: unknown): value is PurchasablePlanTier {
  return value === 'base' || value === 'premium'
}

export function getBillingPlan(tier: PurchasablePlanTier) {
  return BILLING_PLANS[tier]
}

export function isBillingPurchaseType(value: unknown): value is BillingPurchaseType {
  return value === 'initial_purchase' || value === 'renewal'
}

export function getBillingPrice(tier: PurchasablePlanTier, purchaseType: BillingPurchaseType) {
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
