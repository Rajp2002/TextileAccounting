import type { SubscriptionTier } from './subscription-access'

/**
 * Base launch switch. While false, Base is hidden from every new account and
 * from the public landing page. Flipping it to true is the Base launch.
 */
export const BASE_PLAN_OPEN_TO_NEW_ACCOUNTS = false

/**
 * Whether an organization may see and buy Base. Until the launch switch opens,
 * only organizations already on Base, or with any Base row (the owner's Base
 * test accounts, a lapsed Base owner), see it. The per-org
 * `organizations.base_plan_visible` flag was backfilled true for every
 * pre-rollout account, so it no longer grants visibility on its own.
 */
export function canViewBase(input: {
  effectiveTier: SubscriptionTier
  subscriptionRows: readonly { plan_tier: string | null }[]
  openToAll?: boolean
}): boolean {
  if (input.openToAll ?? BASE_PLAN_OPEN_TO_NEW_ACCOUNTS) return true
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
