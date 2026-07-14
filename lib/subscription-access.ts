/** Pure subscription access resolution shared by server code and unit tests. */
export type SubscriptionTier = 'none' | 'trial' | 'base' | 'premium'

type SubscriptionAccessRow = {
  status: string
  plan_tier: string | null
  current_end: string | null
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

export function tierSatisfies(actual: SubscriptionTier, required: 'base' | 'premium'): boolean {
  if (actual === 'none') return false
  if (actual === 'trial' || actual === 'premium') return true
  return actual === 'base' && required === 'base'
}

function isSubscriptionRowCurrent(row: SubscriptionAccessRow, nowMs: number): boolean {
  // Paid access is period-based, not webhook-label-based. A failed renewal,
  // pause, halt, completion, or cancel-at-cycle-end must not erase the period
  // that was already purchased. `expired` is intentionally excluded because
  // it is the provider's terminal no-access state.
  if (!ACCESS_BEARING_STATUSES.has(row.status)) return false
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
  const rank: Record<SubscriptionTier, number> = { none: 0, base: 1, trial: 2, premium: 3 }
  const current = rows
    .filter((row) => isSubscriptionRowCurrent(row, nowMs))
    .map((row) => ({
      row,
      tier: (['base', 'trial', 'premium'].includes(row.plan_tier ?? '')
        ? row.plan_tier
        : 'premium') as SubscriptionTier,
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
