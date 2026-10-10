import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20261011120000_base_suppression_and_lite_trial.sql'),
    'utf8',
)

describe('Base suppression and Lite trial migration', () => {
    it('runs its SECURITY DEFINER trial RPC with an empty search path and service-role-only execute', () => {
        expect(migration).toMatch(/SECURITY DEFINER\s+SET search_path = ''/)
        expect(migration).toContain('REVOKE ALL ON FUNCTION public.start_lite_trial(uuid) FROM PUBLIC, anon, authenticated')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.start_lite_trial(uuid) TO service_role')
    })

    it('backfills existing organizations to Base visible and not trial-eligible, before the guard trigger exists', () => {
        const addFlags = migration.indexOf('ADD COLUMN base_plan_visible')
        const backfill = migration.search(/UPDATE public\.organizations\s+SET base_plan_visible = true,\s+lite_trial_eligible = false/)
        const guard = migration.indexOf('CREATE TRIGGER guard_organization_plan_flags')
        expect(addFlags).toBeGreaterThan(-1)
        expect(backfill).toBeGreaterThan(addFlags)
        expect(guard).toBeGreaterThan(backfill)
    })

    it('defaults new organizations to Base hidden and trial-eligible', () => {
        expect(migration).toContain('base_plan_visible boolean NOT NULL DEFAULT false')
        expect(migration).toContain('lite_trial_eligible boolean NOT NULL DEFAULT true')
    })

    it('limits trial rows to Lite without Razorpay ids and one trial per organization', () => {
        expect(migration).toContain('is_trial boolean NOT NULL DEFAULT false')
        expect(migration).toMatch(/CHECK \(\s*NOT is_trial/)
        expect(migration).toMatch(/CREATE UNIQUE INDEX org_subscriptions_one_trial_per_org\s+ON public\.org_subscriptions \(org_id\)\s+WHERE is_trial/)
    })
})
