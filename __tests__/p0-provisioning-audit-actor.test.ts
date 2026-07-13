import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migration = readFileSync(
    join(root, 'supabase/migrations/20260709233547_p0_fix_organization_provisioning_audit_actor.sql'),
    'utf8',
)
const smoke = readFileSync(join(root, 'scripts/qa/provisioning-smoke.mjs'), 'utf8')

describe('P0 fresh owner provisioning', () => {
    it('does not write an audit actor until the matching profile exists', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.log_settings_audit_event()')
        expect(migration).toMatch(/v_actor_id IS NOT NULL[\s\S]+AND NOT EXISTS \([\s\S]+SELECT 1[\s\S]+FROM public\.profiles AS actor_profile[\s\S]+WHERE actor_profile\.id = v_actor_id/)
        expect(migration).toMatch(/THEN\s+v_actor_id := NULL;/)
        expect(migration).toContain("VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', v_new_data, v_actor_id)")
    })

    it('keeps the trigger helper locked down', () => {
        expect(migration).toContain('SECURITY DEFINER')
        expect(migration).toContain('SET search_path = public, pg_temp')
        expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.log_settings_audit_event\(\)\s+FROM PUBLIC, anon, authenticated;/)
    })

    it('guards the live smoke test against a Supabase ref mismatch', () => {
        expect(smoke).toContain("readArgument('expected-project-ref')")
        expect(smoke).toContain('SAFETY ABORT: expected isolated QA ref')
        expect(smoke).toContain('actualProjectRef !== expectedProjectRef')
    })

    it('fails on missing org/profile/linkage and verifies the app read path', () => {
        expect(smoke).toContain('organization creation failed:')
        expect(smoke).toContain('owner profile creation failed:')
        expect(smoke).toContain('owner profile has invalid organization linkage')
        expect(smoke).toContain('authenticated app read path failed:')
        expect(smoke).toContain(".select('id, org_id, role, organizations(id, name, onboarding_complete)')")
    })

    it('reconciles auth, profile, organization, and audit cleanup', () => {
        expect(smoke).toContain('authUserCount')
        expect(smoke).toContain('organizationCount')
        expect(smoke).toContain('profileCount')
        expect(smoke).toContain('auditLogCount')
        expect(smoke).toContain('cleanupPassed')
    })
})
