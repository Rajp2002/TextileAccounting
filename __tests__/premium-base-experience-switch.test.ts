import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveOrgPlanAccess } from '../lib/subscription-access'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Full Suite to Base Plan experience switch', () => {
  it.each(['lite', 'base'] as const)('normalizes %s metadata without changing entitlement', (tier) => {
    expect(resolveOrgPlanAccess(tier, 'full_suite')).toEqual({
      subscriptionTier: tier, effectiveTier: tier, productExperience: 'base', canSwitchExperience: false,
    })
    expect(resolveOrgPlanAccess('none', 'full_suite', true)).toMatchObject({ effectiveTier: 'lite', productExperience: 'base' })
  })

  it('marks both new-signup paths as the shared Lite/Base workspace', () => {
    const auth = read('app/(auth)/actions/auth.ts')
    const inserts = [...auth.matchAll(/\.from\('organizations'\)\s*\.insert\(\{([\s\S]*?)\}\)/g)]
    expect(inserts).toHaveLength(2)
    for (const [, fields] of inserts) expect(fields).toContain("product_experience: 'base'")
  })
  it('reduces the active product tier without changing the paid tier', () => {
    expect(resolveOrgPlanAccess('premium', 'base')).toEqual({
      subscriptionTier: 'premium',
      effectiveTier: 'base',
      productExperience: 'base',
      canSwitchExperience: true,
    })

    expect(resolveOrgPlanAccess('premium', 'full_suite')).toMatchObject({
      subscriptionTier: 'premium',
      effectiveTier: 'premium',
      canSwitchExperience: true,
    })
  })

  it('never elevates a Base subscription and limits the rollout switch to paid Premium', () => {
    expect(resolveOrgPlanAccess('base', 'full_suite')).toMatchObject({
      effectiveTier: 'base',
      canSwitchExperience: false,
    })
    expect(resolveOrgPlanAccess('trial', 'base')).toMatchObject({
      effectiveTier: 'base',
      canSwitchExperience: false,
    })
  })

  it('persists a constrained organization preference and enforces it for Premium RLS checks', () => {
    const migration = read('supabase/migrations/20260808121430_premium_base_experience_switch.sql')

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS product_experience text NOT NULL DEFAULT 'full_suite'")
    expect(migration).toContain("CHECK (product_experience IN ('base', 'full_suite'))")
    expect(migration).toContain("organization.product_experience = 'full_suite'")
    expect(migration).toContain("WHEN p_required = 'premium' THEN subscription.plan_tier IN ('premium', 'trial')")
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.org_has_subscription_tier(uuid, text) FROM PUBLIC, anon')
  })

  it('exposes an owner switch and explains switched deep links without selling the plan again', () => {
    const settings = read('app/(dashboard)/owner/settings/page.tsx')
    const gate = read('components/billing/AccessGate.tsx')
    const actions = read('app/(dashboard)/owner/actions.ts')

    expect(settings).toContain('planAccess.canSwitchExperience')
    expect(settings).toContain('updateOrganizationProductExperience')
    expect(settings).toContain('Existing production and factory records are never deleted.')
    expect(gate).toContain('Costing workspace is active')
    expect(gate).toContain('/owner/settings#workspace-experience')
    expect(actions).toContain("subscription.tier !== 'premium'")
    expect(actions).toContain(".update({ product_experience: parsed.data })")
  })
})
