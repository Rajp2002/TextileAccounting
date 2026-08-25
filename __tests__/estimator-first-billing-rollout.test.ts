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

  it('keeps Base Plan purchase and users out of factory onboarding', () => {
    const onboardingPage = read('app/(auth)/onboarding/page.tsx')
    const onboardingChecklist = read('app/(auth)/onboarding/checklist.tsx')

    expect(onboardingPage).toContain("if (tier === 'none') redirect('/owner/billing')")
    expect(onboardingPage).toContain("if (tier === 'base') redirect('/owner/estimator')")
    expect(onboardingChecklist).not.toContain('BILLING_SELF_SERVE_DEFAULT_TIER')
    expect(onboardingChecklist).not.toContain('Choose your plan')
    expect(onboardingChecklist).not.toContain('PlanSelectionForm')
  })
})
