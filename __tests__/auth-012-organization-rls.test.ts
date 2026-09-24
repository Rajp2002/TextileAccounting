import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
    path.join(
        process.cwd(),
        'supabase/migrations/20260710210828_close_public_organization_join_code_policy.sql'
    ),
    'utf8'
)

describe('AUTH-012 organization tenant isolation', () => {
    it('removes every known public or owner-wide organization read policy', () => {
        expect(migration).toContain('DROP POLICY IF EXISTS "Lookup org by join code"')
        expect(migration).toContain('DROP POLICY IF EXISTS "Owner can read own org"')
        expect(migration).toContain('DROP POLICY IF EXISTS "Users can view own organization"')
        expect(migration).not.toMatch(/CREATE POLICY "Lookup org by join code"[\s\S]*USING\s*\(true\)/i)
    })

    it('scopes organization reads and updates to the protected profile tenant', () => {
        expect(migration).toMatch(
            /CREATE POLICY "Tenant Isolation"[\s\S]*FOR SELECT[\s\S]*TO authenticated[\s\S]*SELECT p\.org_id[\s\S]*p\.id = \(SELECT auth\.uid\(\)\)/i
        )
        expect(migration).toMatch(
            /CREATE POLICY "Owner can update organization"[\s\S]*FOR UPDATE[\s\S]*p\.role = 'owner'[\s\S]*WITH CHECK/i
        )
    })

})
