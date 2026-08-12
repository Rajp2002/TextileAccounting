import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const hardeningMigration = read(
    'supabase/migrations/20260812133643_harden_security_advisor_boundaries.sql',
)
const overloadMigration = read(
    'supabase/migrations/20260812134540_clarify_machine_link_overloads.sql',
)
const adminAuditMigration = read(
    'supabase/migrations/20260812141330_allow_admin_global_security_audit.sql',
)

describe('security advisor hardening', () => {
    it('pins function search paths and future function defaults', () => {
        expect(hardeningMigration).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public')
        expect(hardeningMigration).toContain('ALTER FUNCTION public.emergency_lockdown()')
        expect(hardeningMigration).toContain('SET search_path = pg_catalog, public')
    })

    it('keeps cross-tenant and server-only RPC boundaries explicit', () => {
        expect(hardeningMigration).toContain('Only the organization owner may access this organization')
        expect(hardeningMigration).toContain(
            'REVOKE ALL ON FUNCTION public.log_audit_event(uuid, uuid, text, text, bigint, jsonb)',
        )
        expect(hardeningMigration).toContain(
            'GRANT EXECUTE ON FUNCTION public.link_order_to_machine(uuid, uuid, uuid)\n  TO service_role',
        )
        expect(hardeningMigration).toContain('SECURITY INVOKER')
    })

    it('protects the explicit global admin audit exception from premium-only policy drift', () => {
        expect(adminAuditMigration).toContain('AS RESTRICTIVE')
        expect(adminAuditMigration).toContain("table_name = 'platform_security'")
        expect(adminAuditMigration).toContain("record_id = 'GLOBAL'")
        expect(adminAuditMigration).toContain("profile.role::text = 'admin'")
    })

    it('removes default arguments from service-only overloads', () => {
        expect(overloadMigration).toContain('DROP FUNCTION public.link_batch_to_machine(uuid, uuid, uuid);')
        expect(overloadMigration).toContain('DROP FUNCTION public.link_order_to_machine(uuid, uuid, uuid);')
        expect(overloadMigration).not.toMatch(/p_org_id uuid DEFAULT NULL/)
    })
})
