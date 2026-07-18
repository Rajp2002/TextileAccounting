import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const actions = readFileSync(
    'app/(dashboard)/owner/settings/supervisor-access-actions.ts',
    'utf8'
)
const component = readFileSync(
    'components/settings/supervisor-access-manager.tsx',
    'utf8'
)
const migration = readFileSync(
    'supabase/migrations/20260718090000_supervisor_access_revocation.sql',
    'utf8'
)

describe('owner supervisor access management', () => {
    it('lists only active supervisors from the owner organization', () => {
        expect(actions).toContain("requireRole(['owner'])")
        expect(actions).toContain(".eq('org_id', profile.org_id)")
        expect(actions).toContain(".eq('role', 'supervisor')")
        expect(actions).toContain(".is('access_revoked_at', null)")
    })

    it('requires typed confirmation and scopes revocation to the owner organization', () => {
        expect(actions).toContain('confirmationName.trim().toLocaleLowerCase()')
        expect(actions).toContain(".eq('id', parsedId.data)")
        expect(actions).toContain(".eq('org_id', profile.org_id)")
        expect(actions).toContain("ban_duration: '876000h'")
        expect(actions).toContain('access_revoked_at: revokedAt')
        expect(actions).toContain('await revokeUserSession(parsedId.data)')
    })

    it('preserves the profile and records an access audit event', () => {
        expect(actions).not.toContain(".delete()")
        expect(actions).not.toContain('deleteUser(')
        expect(actions).toContain("table_name: 'profiles'")
        expect(actions).toContain("new_data: { access_status: 'revoked', access_revoked_at: revokedAt }")
    })

    it('does not mint factory claims for revoked profiles', () => {
        expect(migration).toContain('ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMPTZ')
        expect(migration).toContain('AND p.access_revoked_at IS NULL')
        expect(migration).toContain("(event->'claims') - 'org_id' - 'user_role'")
        expect(migration).toContain("event := jsonb_set(event, '{claims,user_role}'")
        expect(migration).toContain("event := jsonb_set(event, '{claims,org_id}'")
    })

    it('explains that removal preserves historical factory records', () => {
        expect(component).toContain('Remove access')
        expect(component).toContain('historical production, attendance, cash, and audit records will be preserved')
        expect(component).toContain('No supervisors connected yet')
    })
})
