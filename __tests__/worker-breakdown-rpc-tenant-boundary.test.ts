import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const legacyMigration = readFileSync(
    join(root, 'supabase/migrations/20260714053000_b14_repair_worker_breakdown_timestamp.sql'),
    'utf8',
).toLowerCase()
const hardeningMigration = readFileSync(
    join(root, 'supabase/migrations/20260812132243_harden_security_advisor_boundaries.sql'),
    'utf8',
)
const dashboardActions = readFileSync(
    join(root, 'app/(dashboard)/owner/actions/dashboard.ts'),
    'utf8',
)

describe('worker breakdown RPC tenant boundary', () => {
    it('rechecks the authenticated profile before using the requested organization', () => {
        expect(legacyMigration).toContain('security definer')
        expect(legacyMigration).toContain('and pl.org_id = p_org_id')
        expect(legacyMigration).toContain('where w.org_id = p_org_id')

        expect(hardeningMigration).toContain(
            'CREATE OR REPLACE FUNCTION public.assert_owner_org_access(p_org_id uuid)',
        )
        expect(hardeningMigration).toMatch(
            /SELECT profile\.org_id, profile\.role::text[\s\S]+FROM public\.profiles AS profile[\s\S]+WHERE profile\.id = auth\.uid\(\);/,
        )
        expect(hardeningMigration).toMatch(
            /IF v_org_id IS NULL[\s\S]+v_role IS DISTINCT FROM 'owner'[\s\S]+v_org_id IS DISTINCT FROM p_org_id[\s\S]+Only the organization owner may access this organization/,
        )
        expect(hardeningMigration).toMatch(
            /CREATE OR REPLACE FUNCTION public\.get_worker_breakdown_today\([\s\S]+?BEGIN\s+PERFORM public\.assert_owner_org_access\(p_org_id\);/,
        )
    })

    it('preserves the owner dashboard path with a profile-derived organization', () => {
        expect(dashboardActions).toContain('const { supabase, profile } = await getAuthenticatedUser()')
        expect(dashboardActions).toContain('const org_id = profile.org_id')
        expect(dashboardActions).toContain(
            "supabase.rpc('get_worker_breakdown_today',    { p_org_id: org_id, p_date: today })",
        )
        expect(dashboardActions).toContain(
            "supabase.rpc('get_worker_breakdown_today', { p_org_id: org_id, p_date: targetDate })",
        )
    })
})
