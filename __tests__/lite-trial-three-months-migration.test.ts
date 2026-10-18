import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const file = '20261018120000_lite_trial_three_months.sql'
const migration = readFileSync(join(process.cwd(), 'supabase/migrations', file), 'utf8')

describe('Lite trial three-month migration', () => {
    it('runs after the migration that first defined start_lite_trial', () => {
        expect(file > '20261011120000_base_suppression_and_lite_trial.sql').toBe(true)
    })

    it('redefines start_lite_trial so new trials last 90 days and no other trial rule changes', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.start_lite_trial(p_org_id uuid)')
        expect(migration).toContain("VALUES (p_org_id, 'lite', 'active', now(), now() + interval '90 days', true)")
        expect(migration).not.toContain("interval '30 days'")
        expect(migration).toContain("RAISE EXCEPTION 'LITE_TRIAL_INELIGIBLE'")
        expect(migration).toContain("RAISE EXCEPTION 'LITE_TRIAL_FREE_GRANT_REQUIRED'")
        expect(migration).toContain('IF public.org_has_established_paid_history(p_org_id) THEN')
        expect(migration).toContain('SET lite_trial_eligible = false')
    })

    it('keeps the SECURITY DEFINER definer with an empty search path and service-role-only execute', () => {
        expect(migration).toMatch(/SECURITY DEFINER\s+SET search_path = ''/)
        expect(migration).toContain('REVOKE ALL ON FUNCTION public.start_lite_trial(uuid) FROM PUBLIC, anon, authenticated')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.start_lite_trial(uuid) TO service_role')
    })

    it('does not rewrite trial rows that already exist', () => {
        expect(migration).not.toMatch(/UPDATE public\.org_subscriptions/i)
    })
})
