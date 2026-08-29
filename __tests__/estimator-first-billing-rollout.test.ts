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
  it('exposes Lite and Base self-serve selection while retaining legacy records', () => {
    expect(BILLING_SELF_SERVE_DEFAULT_TIER).toBe('lite')
    expect(BILLING_SELF_SERVE_PLAN_TIERS).toEqual(['lite', 'base'])
    expect(BILLING_PLANS.premium.name).toBe('Weavly legacy operations')
    expect(BILLING_PLANS.lite.firstYearTotalPaise).toBe(299900)
    expect(BILLING_PLANS.base.firstYearTotalPaise).toBe(999900)
    expect(BILLING_PLANS.lite.renewalTotalPaise).toBe(149900)
    expect(BILLING_PLANS.base.renewalTotalPaise).toBe(499900)
    expect(isSelfServePlanTier('lite')).toBe(true)
    expect(isSelfServePlanTier('base')).toBe(true)
    expect(isSelfServePlanTier('premium')).toBe(false)
    expect(isSelfServePlanTier('forged')).toBe(false)

    const billingPage = read('app/(dashboard)/owner/billing/page.tsx')
    expect(billingPage).toContain('visibleTiers.includes(plan.tier)')
    expect(billingPage).toContain('BILLING_SELF_SERVE_PLAN_TIERS')
    expect(billingPage).toContain('Choose Weavly Lite or Base')
  })

  it('keeps Lite and Base purchase and users out of legacy factory onboarding', () => {
    const onboardingPage = read('app/(auth)/onboarding/page.tsx')
    const onboardingChecklist = read('app/(auth)/onboarding/checklist.tsx')

    expect(onboardingPage).toContain("if (tier === 'none') redirect('/owner/billing')")
    expect(onboardingPage).toContain("if (tier === 'lite' || tier === 'base') redirect('/owner/estimator')")
    expect(onboardingChecklist).not.toContain('BILLING_SELF_SERVE_DEFAULT_TIER')
    expect(onboardingChecklist).not.toContain('Choose your plan')
    expect(onboardingChecklist).not.toContain('PlanSelectionForm')
  })
})
