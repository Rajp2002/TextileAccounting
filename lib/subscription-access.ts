/** Pure subscription access resolution shared by server code and unit tests. */
export type SubscriptionTier = 'none' | 'free' | 'trial' | 'lite' | 'base' | 'premium'
// `base` is the shared Lite/Base workspace, not a production entitlement.
export type ProductExperience = 'base' | 'full_suite'

/**
 * Customer-facing capabilities are deliberately broader than plan names. This
 * keeps route/action checks stable when another commercial tier is added and
 * prevents the estimator from being duplicated for Lite and Base.
 */
export type PlanCapability =
  | 'estimator'
  | 'saved_costings'
  | 'qualities'
  | 'rate_book'
  | 'existing_costing_tools'
  | 'account_data'
  | 'account_settings'
  | 'costing_defaults'
  | 'export_document'
  | 'production'
  | 'production_management'
  | 'production_tracking'
  | 'production_linked'
  | 'legacy_full_suite'

const LITE_CAPABILITIES = [
  'estimator',
  'saved_costings',
  'qualities',
  'rate_book',
  'existing_costing_tools',
  'account_data',
  'account_settings',
  'costing_defaults',
  'export_document',
] as const satisfies readonly PlanCapability[]

const BASE_CAPABILITIES = [
  ...LITE_CAPABILITIES,
  'production',
  'production_management',
  'production_tracking',
  'production_linked',
] as const satisfies readonly PlanCapability[]

/** Internal legacy access is retained for existing accounts only. */
export const PLAN_CAPABILITIES = {
  none: [] as const,
  // Free grants are explicit operational records, never inferred from a
  // missing subscription. account_data includes business exports/deletion;
  // account_settings is the separate non-business account surface.
  free: ['estimator', 'account_settings', 'saved_costings', 'export_document'] as const,
  lite: LITE_CAPABILITIES,
  base: BASE_CAPABILITIES,
  trial: [...BASE_CAPABILITIES, 'legacy_full_suite'] as const,
  premium: [...BASE_CAPABILITIES, 'legacy_full_suite'] as const,
} satisfies Record<SubscriptionTier, readonly PlanCapability[]>

export type OrgPlanAccess = {
  /** Paid/trial entitlement retained for billing and conversion eligibility. */
  subscriptionTier: SubscriptionTier
  /** Explicit historical Free identity, retained even when suspended or upgraded. */
  freeAccount?: boolean
  /** Tier the product should enforce for navigation, routes, and actions. */
  effectiveTier: SubscriptionTier
  productExperience: ProductExperience
  canSwitchExperience: boolean
}

type SubscriptionAccessRow = {
  status: string
  plan_tier: string | null
  current_start?: string | null
  current_end: string | null
  razorpay_payment_id?: string | null
  created_at?: string | null
}

const ACCESS_BEARING_STATUSES = new Set([
  'active',
  'authenticated',
  'pending',
  'paused',
  'halted',
  'cancelled',
  'completed',
])

const PAID_HISTORY_STATUSES = new Set([
  'active',
  'authenticated',
  'paused',
  'halted',
  'cancelled',
  'completed',
  'expired',
])

export function hasCapability(actual: SubscriptionTier, capability: PlanCapability): boolean {
  return (PLAN_CAPABILITIES[actual] as readonly PlanCapability[]).includes(capability)
}

/**
 * Compatibility helper for older costing/full-suite call sites. New code
 * should use hasCapability() so a Base production check cannot accidentally
 * become a Lite costing check.
 */
export function tierSatisfies(actual: SubscriptionTier, required: 'base' | 'premium'): boolean {
  return required === 'premium'
    ? hasCapability(actual, 'legacy_full_suite')
    : hasCapability(actual, 'existing_costing_tools')
}

export function normalizeProductExperience(value: unknown): ProductExperience {
  return value === 'base' ? 'base' : 'full_suite'
}

/**
 * A Full Suite customer may deliberately use the Base Plan workspace without
 * changing or destroying their paid subscription. The selected experience can
 * only reduce access; it can never elevate a Base subscription to Full Suite.
 */
export function resolveOrgPlanAccess(
  subscriptionTier: SubscriptionTier,
  productExperienceValue: unknown,
  retainLiteAfterBaseExpiry = false,
): OrgPlanAccess {
  const hasFullSuiteEntitlement = tierSatisfies(subscriptionTier, 'premium')
  const fallbackTier = retainLiteAfterBaseExpiry && subscriptionTier === 'none' ? 'lite' : subscriptionTier
  const productExperience = fallbackTier === 'free' || fallbackTier === 'lite' || fallbackTier === 'base'
    ? 'base'
    : normalizeProductExperience(productExperienceValue)

  return {
    subscriptionTier,
    effectiveTier: productExperience === 'base' && hasFullSuiteEntitlement
      ? 'base'
      : fallbackTier,
    productExperience,
    // Initial rollout conversion is limited to activated paid Full Suite orgs.
    canSwitchExperience: subscriptionTier === 'premium',
  }
}

/**
 * A paid Base period downgrades to Lite when it ends; it never removes the
 * costing desk or the customer's records. Checkout rows in `created` or
 * `pending` state are deliberately excluded because they are not payment
 * proof. The server uses this only after current access has been resolved.
 */
export function hasPaidBaseHistory(
  rows: readonly SubscriptionAccessRow[],
  nowMs = Date.now(),
): boolean {
  return rows.some((row) => {
    if (row.plan_tier !== 'base' || !row.current_end) return false
    const endMs = new Date(row.current_end).getTime()
    if (!Number.isFinite(endMs) || endMs >= nowMs) return false
    return Boolean(row.razorpay_payment_id) || PAID_HISTORY_STATUSES.has(row.status)
  })
}

/** Failed/cancelled checkout attempts are not previously purchased access. */
export function hasEstablishedPaidHistory(rows: readonly SubscriptionAccessRow[]): boolean {
  return rows.some(row => Boolean(row.razorpay_payment_id)
    || ['active', 'authenticated', 'completed', 'expired'].includes(row.status)
    || (['paused', 'halted', 'cancelled'].includes(row.status) && Boolean(row.current_start || row.current_end)))
}

function isSubscriptionRowCurrent(row: SubscriptionAccessRow, nowMs: number): boolean {
  // Paid access is period-based, not webhook-label-based. A failed renewal,
  // pause, halt, completion, or cancel-at-cycle-end must not erase the period
  // that was already purchased. `expired` is intentionally excluded because
  // it is the provider's terminal no-access state.
  if (!ACCESS_BEARING_STATUSES.has(row.status)) return false
  if (row.current_start) {
    const startMs = new Date(row.current_start).getTime()
    if (!Number.isFinite(startMs) || startMs > nowMs) return false
  }
  if (!row.current_end) return ['active', 'authenticated'].includes(row.status)

  const endMs = new Date(row.current_end).getTime()
  if (!Number.isFinite(endMs)) return false
  const gracePeriodMs = row.plan_tier === 'trial' ? 0 : 24 * 60 * 60 * 1000
  return endMs + gracePeriodMs >= nowMs
}

/**
 * Resolve all current rows so a later failed/cancelled payment attempt cannot
 * mask an older paid entitlement that has not expired. Highest access wins.
 */
export function resolveEffectiveSubscription<T extends SubscriptionAccessRow>(
  rows: T[],
  nowMs = Date.now()
): { tier: SubscriptionTier; subscription: T | null } {
  const rank: Record<SubscriptionTier, number> = { none: 0, free: 0, lite: 1, base: 2, trial: 3, premium: 4 }
  const current = rows
    .filter((row) => isSubscriptionRowCurrent(row, nowMs))
    .map((row) => ({
      row,
      tier: (['lite', 'base', 'trial', 'premium'].includes(row.plan_tier ?? '')
        ? row.plan_tier
        : 'none') as SubscriptionTier,
    }))
    .sort((a, b) => {
      const tierDelta = rank[b.tier] - rank[a.tier]
      if (tierDelta !== 0) return tierDelta
      return new Date(b.row.created_at ?? 0).getTime() - new Date(a.row.created_at ?? 0).getTime()
    })

  return current[0]
    ? { tier: current[0].tier, subscription: current[0].row }
    : { tier: 'none', subscription: null }
}
