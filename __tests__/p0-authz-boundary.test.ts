import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260625195248_harden_profile_authorization_boundary.sql'),
    'utf8'
)

const authLib = fs.readFileSync(path.join(process.cwd(), 'lib/auth.ts'), 'utf8')
const jwtHook = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260403010000_jwt_app_metadata_hook.sql'), 'utf8')

function compact(sql: string) {
    return sql.replace(/\s+/g, ' ').trim()
}

describe('Batch 1A profile authorization boundary', () => {
    it('removes client write grants on profile authorization fields', () => {
        const sql = compact(migration)

        expect(sql).toMatch(/REVOKE UPDATE ON TABLE public\.profiles FROM anon, authenticated/i)
        expect(sql).toMatch(/REVOKE INSERT ON TABLE public\.profiles FROM anon, authenticated/i)
        expect(sql).toMatch(/GRANT UPDATE \( full_name, phone, whatsapp_number, whatsapp_opted_in, whatsapp_opted_in_at \) ON TABLE public\.profiles TO authenticated/i)
        expect(sql).not.toMatch(/GRANT UPDATE \([^)]*\b(role|org_id|id)\b[^)]*\) ON TABLE public\.profiles TO authenticated/i)
    })

    it('replaces the own-profile update policy with TO authenticated and WITH CHECK', () => {
        const sql = compact(migration)

        expect(sql).toContain('DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles')
        expect(sql).toContain('CREATE POLICY "Users can update own non-authorization profile fields" ON public.profiles FOR UPDATE TO authenticated')
        expect(sql).toContain('USING ((select auth.uid()) = id)')
        expect(sql).toContain('WITH CHECK ((select auth.uid()) = id)')
    })

    it('adds a trigger guard for id, role, and org_id mutation from authenticated sessions', () => {
        const sql = compact(migration)

        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.prevent_profile_authorization_field_update()')
        expect(sql).toContain('IF auth.uid() IS NOT NULL')
        expect(sql).toContain('NEW.id IS DISTINCT FROM OLD.id')
        expect(sql).toContain('NEW.role IS DISTINCT FROM OLD.role')
        expect(sql).toContain('NEW.org_id IS DISTINCT FROM OLD.org_id')
        expect(sql).toContain("RAISE EXCEPTION 'profile authorization fields are server-managed'")
        expect(sql).toContain('BEFORE UPDATE OF id, role, org_id ON public.profiles')
    })

    it('keeps server authorization anchored to the protected profile row, not user metadata', () => {
        expect(authLib).toContain(".from('profiles')")
        expect(authLib).toContain(".select('role, org_id, full_name')")
        expect(authLib).toContain('const admin = createAdminClient()')
        expect(authLib).not.toContain('user.user_metadata?.role')
    })

    it('documents why token refresh is sensitive: claims are minted from profiles', () => {
        expect(jwtHook).toContain('CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)')
        expect(jwtHook).toContain('SELECT p.org_id, p.role, p.full_name')
        expect(jwtHook).toContain('FROM public.profiles p')
        expect(jwtHook).toContain("{claims,user_role}")
        expect(jwtHook).toContain("{claims,org_id}")
    })
})
