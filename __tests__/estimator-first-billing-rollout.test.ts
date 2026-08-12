import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BILLING_PLANS,
  BILLING_SELF_SERVE_DEFAULT_TIER,
  BILLING_SELF_SERVE_PLAN_TIERS,
  isSelfServePlanTier,
} from '../lib/billing-constants'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Estimator-first billing rollout', () => {
  it('limits new self-serve selection to Base without removing Full Suite architecture', () => {
    expect(BILLING_SELF_SERVE_DEFAULT_TIER).toBe('base')
    expect(BILLING_SELF_SERVE_PLAN_TIERS).toEqual(['base'])
    expect(BILLING_PLANS.premium.name).toBe('Weavly Full Suite')
    expect(isSelfServePlanTier('base')).toBe(true)
    expect(isSelfServePlanTier('premium')).toBe(false)
    expect(isSelfServePlanTier('forged')).toBe(false)

    const billingPage = read('app/(dashboard)/owner/billing/page.tsx')
    expect(billingPage).toContain('visibleTiers.includes(plan.tier)')
    expect(billingPage).toContain('BILLING_SELF_SERVE_PLAN_TIERS')
    expect(billingPage).toContain('Premium self-serve checkout is paused for the Base pilot.')
  })

  it('routes onboarding checkout through the same Base-only rollout switch', () => {
    const onboarding = read('app/(auth)/onboarding/checklist.tsx')
    expect(onboarding).toContain('BILLING_SELF_SERVE_DEFAULT_TIER')
    expect(onboarding).not.toContain('planTier="premium"')
  })
})
