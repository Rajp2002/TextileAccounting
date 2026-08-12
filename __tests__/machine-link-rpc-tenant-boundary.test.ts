import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260812133643_harden_security_advisor_boundaries.sql'),
    'utf8',
)
const overloadMigration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260812134540_clarify_machine_link_overloads.sql'),
    'utf8',
)
const normalizedMigration = migration.replace(/\s+/g, ' ')

const serviceOnlyOverloads = ['link_batch_to_machine', 'link_order_to_machine'] as const

describe('machine-link RPC tenant boundary', () => {
    it.each(serviceOnlyOverloads)('%s explicit-org overload is service-role only', (functionName) => {
        expect(normalizedMigration).toContain(
            `REVOKE ALL ON FUNCTION public.${functionName}(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;`,
        )
        expect(normalizedMigration).toContain(
            `GRANT EXECUTE ON FUNCTION public.${functionName}(uuid, uuid, uuid) TO service_role;`,
        )
        expect(migration).toMatch(
            new RegExp(
                `CREATE OR REPLACE FUNCTION public\\.${functionName}\\([\\s\\S]*?p_org_id uuid DEFAULT NULL[\\s\\S]*?IF \\(auth\\.jwt\\(\\) ->> 'role'\\) <> 'service_role' OR p_org_id IS NULL THEN`,
            ),
        )
    })

    it('keeps the authenticated batch path profile-derived', () => {
        expect(normalizedMigration).toContain(
            'REVOKE ALL ON FUNCTION public.link_batch_to_machine(uuid, uuid) FROM PUBLIC, anon;',
        )
        expect(normalizedMigration).toContain(
            'GRANT EXECUTE ON FUNCTION public.link_batch_to_machine(uuid, uuid) TO authenticated;',
        )
        expect(migration).toContain('WHERE profile.id = auth.uid();')
    })

    it('removes default arguments from service-only overloads so SQL calls stay unambiguous', () => {
        expect(overloadMigration).toContain('DROP FUNCTION public.link_batch_to_machine(uuid, uuid, uuid);')
        expect(overloadMigration).toContain('DROP FUNCTION public.link_order_to_machine(uuid, uuid, uuid);')
        expect(overloadMigration).not.toMatch(
            /CREATE OR REPLACE FUNCTION public\.link_batch_to_machine\([\s\S]*?p_org_id uuid DEFAULT NULL/,
        )
        expect(overloadMigration).not.toMatch(
            /CREATE OR REPLACE FUNCTION public\.link_order_to_machine\([\s\S]*?p_org_id uuid DEFAULT NULL/,
        )
    })
})
