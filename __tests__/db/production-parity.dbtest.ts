import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Fix package F3 (EVIDENCE E22): objects production had that no migration
// created are captured; free_server_time's search_path is pinned; three
// production-only legacy policies are dropped. Source hashes are
// production's as of 2026-09-26.

let db: Db

/** A signed-in user whose token carries no org_id claim. */
async function asUserWithoutOrgClaim(userId: string) {
    await db.query('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)", [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
        userId,
    ])
    await db.query('SET ROLE authenticated')
}

async function addMember(orgId: string) {
    const userId = randomUUID()
    await asSuperuser(db)
    await db.query('INSERT INTO auth.users(id, email, created_at) VALUES ($1, $2, now())', [userId, `${userId}@example.test`])
    await db.query("INSERT INTO public.profiles(id, org_id, role, full_name) VALUES ($1, $2, 'supervisor', 'Test Member')", [userId, orgId])
    return userId
}

async function rowSecurity(table: string) {
    await asSuperuser(db)
    const { rows: [row] } = await db.query('SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass', [table])
    return row.relrowsecurity as boolean
}

beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('production parity (F3)', () => {
    it('CHARACTERIZATION: the captured functions match production source, security and grants', async () => {
        await asSuperuser(db)
        const { rows } = await db.query(`SELECT proname, md5(prosrc) AS md5, prosecdef, array_to_string(proconfig, ',') AS config,
            has_function_privilege('anon', oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated,
            has_function_privilege('service_role', oid, 'EXECUTE') AS service_role
            FROM pg_proc WHERE pronamespace = 'public'::regnamespace
              AND proname IN ('get_user_org_id', 'get_user_role', 'rls_auto_enable') ORDER BY proname`)
        expect(rows).toEqual([
            { proname: 'get_user_org_id', md5: 'a83f8e452fa91c4cf3cc3930af310f41', prosecdef: true, config: 'search_path=pg_catalog, public', anon: false, authenticated: true, service_role: true },
            { proname: 'get_user_role', md5: '5f3dc6bb18a1a787267cd50c82652999', prosecdef: true, config: 'search_path=pg_catalog, public', anon: false, authenticated: true, service_role: true },
            { proname: 'rls_auto_enable', md5: '99be20677b456ea8d3be47bdd44fb369', prosecdef: true, config: 'search_path=pg_catalog', anon: false, authenticated: false, service_role: true },
        ])
    })

    it("INVARIANT: the profile helpers return only the caller's own organization and role", async () => {
        const owner = await seedOwnerOrg(db)
        await asUser(db, owner.userId, owner.orgId)
        const { rows: [own] } = await db.query('SELECT public.get_user_org_id() AS org, public.get_user_role() AS role')
        expect(own).toEqual({ org: owner.orgId, role: 'owner' })
        await db.query('RESET ROLE; SET ROLE anon')
        expect((await pgError(db.query('SELECT public.get_user_org_id()'))).code).toBe('42501')
    })

    it("CHARACTERIZATION: members read org-mates' profiles through the live-membership clause, without an org_id claim", async () => {
        const org = await seedOwnerOrg(db, { name: 'Parity Org' })
        const member = await addMember(org.orgId)
        const other = await seedOwnerOrg(db, { name: 'Other Org' })
        await asUserWithoutOrgClaim(member)
        const { rows } = await db.query('SELECT id FROM public.profiles WHERE id = ANY($1)', [[org.userId, member, other.userId]])
        expect(new Set(rows.map((row: { id: string }) => row.id))).toEqual(new Set([org.userId, member]))
    })

    it('INVARIANT: new tables in public get RLS automatically; other schemas are left alone', async () => {
        await asSuperuser(db)
        await db.query('CREATE TABLE public.parity_probe (id int)')
        await db.query('CREATE TABLE public.parity_probe_as AS SELECT 1 AS id')
        await db.query('CREATE SCHEMA parity_other; CREATE TABLE parity_other.probe (id int)')
        expect(await rowSecurity('public.parity_probe')).toBe(true)
        expect(await rowSecurity('public.parity_probe_as')).toBe(true)
        expect(await rowSecurity('parity_other.probe')).toBe(false)
    })

    it('INVARIANT: free_server_time has a fixed empty search_path and stays service-role only', async () => {
        await asSuperuser(db)
        const { rows: [fn] } = await db.query("SELECT proconfig FROM pg_proc WHERE oid = 'public.free_server_time()'::regprocedure")
        expect(fn.proconfig).toEqual(['search_path=""'])
        await asServiceRole(db)
        const { rows: [clock] } = await db.query('SELECT public.free_server_time() IS NOT NULL AS ok')
        expect(clock.ok).toBe(true)
        const owner = await seedOwnerOrg(db)
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query('SELECT public.free_server_time()'))).code).toBe('42501')
    })

    it('INVARIANT: the production-only legacy policies are dropped', async () => {
        const legacy = [
            ['machines', 'Users can view org machines'],
            ['production_logs', 'Users can view org logs'],
            ['production_logs', 'Supervisors can insert logs'],
        ]
        const present = async () => {
            await asSuperuser(db)
            const { rows } = await db.query(
                "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('machines', 'production_logs') ORDER BY 1, 2",
            )
            return rows.filter((row: { tablename: string; policyname: string }) => legacy.some(([t, p]) => row.tablename === t && row.policyname === p))
        }
        expect(await present()).toEqual([])

        // Recreate them as production defines them, then apply the migration.
        const member = 'org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())'
        await db.query(`CREATE POLICY "Users can view org machines" ON public.machines FOR SELECT TO public USING (${member})`)
        await db.query(`CREATE POLICY "Users can view org logs" ON public.production_logs FOR SELECT TO public USING (${member})`)
        await db.query(`CREATE POLICY "Supervisors can insert logs" ON public.production_logs FOR INSERT TO public WITH CHECK (${member})`)
        expect(await present()).toHaveLength(3)
        const migration = readdirSync('supabase/migrations').find(name => name.endsWith('_drop_legacy_production_only_policies.sql'))
        await db.query(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
        expect(await present()).toEqual([])
    })
})
