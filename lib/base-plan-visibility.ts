import type { SubscriptionTier } from './subscription-access'

/**
 * Base launch switch. While false, Base is hidden from every new account and
 * from the public landing page. Flipping it to true is the Base launch.
 */
export const BASE_PLAN_OPEN_TO_NEW_ACCOUNTS = false

/**
 * Whether an organization may see and buy Base. Existing organizations carry a
 * per-org flag (backfilled true); any Base history or current Base access also
 * counts, so a lapsed Base owner never loses sight of the plan they paid for.
 */
export function canViewBase(input: {
  flag: boolean | null | undefined
  effectiveTier: SubscriptionTier
  subscriptionRows: readonly { plan_tier: string | null }[]
  openToAll?: boolean
}): boolean {
  if (input.openToAll ?? BASE_PLAN_OPEN_TO_NEW_ACCOUNTS) return true
  if (input.flag === true) return true
  if (input.effectiveTier === 'base') return true
  return input.subscriptionRows.some((row) => row.plan_tier === 'base')
}

/**
 * Maps a requested signup plan to one the product currently sells. Base falls
 * back to Free while it is closed; a missing plan is Free.
 */
export function normalizeSignupPlan(
  plan: 'free' | 'lite' | 'base' | undefined,
  openToAll?: boolean,
): 'free' | 'lite' | 'base' {
  if (plan === undefined) return 'free'
  if (plan === 'base' && !(openToAll ?? BASE_PLAN_OPEN_TO_NEW_ACCOUNTS)) return 'free'
  return plan
}
