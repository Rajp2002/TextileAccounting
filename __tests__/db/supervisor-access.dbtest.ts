import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asSupervisor, asUser, freshDatabase, pgError, seedOwnerOrg, seedSupervisor, type Db } from './helpers'

// Owner management of supervisors, the factory-code join path, and the
// supervisor's own status, through the real functions.

let db: Db
type Owner = { userId: string; orgId: string }

type AccessState = {
    joining_enabled: boolean
    code: string | null
    pending: Array<{ user_id: string; full_name: string; email: string; phone: string | null; requested_at: string }>
    approved: Array<{ user_id: string; full_name: string; decided_at: string }>
}

async function asOwner(owner: Owner) { await asUser(db, owner.userId, owner.orgId) }

async function enableJoining(owner: Owner) {
    await asOwner(owner)
    const { rows } = await db.query('SELECT public.set_supervisor_joining(true) AS state')
    return rows[0].state as AccessState
}

async function lookup(code: string) {
    await asServiceRole(db)
    const { rows } = await db.query('SELECT public.lookup_supervisor_join_code($1) AS result', [code])
    return rows[0].result as { org_id: string; factory_name: string } | null
}

/** What the join action does after creating the auth user. */
async function register(code: string, name = 'Ramesh Patel') {
    const userId = randomUUID()
    await asSuperuser(db)
    await db.query('INSERT INTO auth.users(id, email, created_at) VALUES ($1, $2, now())', [userId, `${userId}@example.test`])
    await asServiceRole(db)
    const { rows } = await db.query(
        'SELECT public.register_supervisor_join_request($1, $2, $3, $4, $5) AS result',
        [userId, code, name, `${userId}@Example.test`, '9876543210'],
    )
    return { userId, result: rows[0].result as { org_id: string; factory_name: string } }
}

async function status(userId: string) {
    await asSupervisor(db, userId)
    const { rows } = await db.query('SELECT public.get_supervisor_status() AS status')
    return rows[0].status as { status: string; org_id: string | null; factory_name: string | null; plan_active: boolean; locked: boolean; today: string }
}

beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('factory code', () => {
    it('joining starts off; turning it on creates a code', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base', name: 'Shree Weaving' })
        await asOwner(owner)
        const before = (await db.query('SELECT public.get_supervisor_access() AS state')).rows[0].state as AccessState
        expect(before).toEqual({ joining_enabled: false, code: null, pending: [], approved: [] })
        const after = await enableJoining(owner)
        expect(after.joining_enabled).toBe(true)
        expect(after.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
        expect(await lookup(after.code!)).toEqual({ org_id: owner.orgId, factory_name: 'Shree Weaving' })
    })

    it('lookup accepts lowercase, spaces and a hyphen', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const { code } = await enableJoining(owner)
        const typed = `${code!.slice(0, 4).toLowerCase()} - ${code!.slice(4).toLowerCase()}`
        expect((await lookup(typed))?.org_id).toBe(owner.orgId)
    })

    it('regenerating replaces the code and the old one stops working', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const { code } = await enableJoining(owner)
        await asOwner(owner)
        const next = (await db.query('SELECT public.regenerate_supervisor_join_code() AS code')).rows[0].code as string
        expect(next).not.toBe(code)
        expect(await lookup(code!)).toBeNull()
        expect((await lookup(next))?.org_id).toBe(owner.orgId)
    })

    it('turning joining off stops the code', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const { code } = await enableJoining(owner)
        await asOwner(owner)
        await db.query('SELECT public.set_supervisor_joining(false)')
        expect(await lookup(code!)).toBeNull()
    })

    it('a code from a Lite, lapsed or locked factory, or an unknown code, finds nothing', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const { code } = await enableJoining(owner)
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = true WHERE id = $1', [owner.orgId])
        expect(await lookup(code!)).toBeNull()
        await asSuperuser(db)
        await db.query('UPDATE public.organizations SET is_locked_down = false WHERE id = $1', [owner.orgId])
        await db.query("UPDATE public.org_subscriptions SET plan_tier = 'lite' WHERE org_id = $1", [owner.orgId])
        expect(await lookup(code!)).toBeNull()
        expect(await lookup('ABCD2345')).toBeNull()
        expect(await lookup('not a code')).toBeNull()
    })

    it('only an owner of a Base factory manages its code', async () => {
        const lite = await seedOwnerOrg(db, { tier: 'lite' })
        await asOwner(lite)
        expect((await pgError(db.query('SELECT public.set_supervisor_joining(true)'))).code).toBe('42501')
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const supervisor = await seedSupervisor(db, owner.orgId, 'approved')
        await asSupervisor(db, supervisor.userId)
        expect((await pgError(db.query('SELECT public.get_supervisor_access()'))).code).toBe('42501')
    })

    it('a locked factory cannot change its code', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base', locked: true })
        await asOwner(owner)
        expect((await pgError(db.query('SELECT public.set_supervisor_joining(true)'))).code).toBe('42501')
    })

    it('signed-in clients cannot call the join functions', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        await asOwner(owner)
        expect((await pgError(db.query("SELECT public.lookup_supervisor_join_code('ABCD2345')"))).code).toBe('42501')
        expect((await pgError(db.query("SELECT public.register_supervisor_join_request($1, 'ABCD2345', 'X', 'x@example.test', NULL)", [randomUUID()]))).code).toBe('42501')
    })
})

describe('joining and approval', () => {
    it('joining creates a pending supervisor with no profile organization', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base', name: 'Mill One' })
        const { code } = await enableJoining(owner)
        const { userId, result } = await register(code!)
        expect(result).toEqual({ org_id: owner.orgId, factory_name: 'Mill One' })
        await asSuperuser(db)
        const profile = (await db.query('SELECT role, org_id, full_name, email, phone FROM public.profiles WHERE id = $1', [userId])).rows[0]
        expect(profile).toEqual({ role: 'supervisor', org_id: null, full_name: 'Ramesh Patel', email: `${userId}@example.test`, phone: '9876543210' })
        expect(await status(userId)).toMatchObject({ status: 'pending', org_id: owner.orgId, factory_name: 'Mill One', plan_active: true, locked: false })
        await asOwner(owner)
        const state = (await db.query('SELECT public.get_supervisor_access() AS state')).rows[0].state as AccessState
        expect(state.pending.map(row => row.user_id)).toEqual([userId])
    })

    it('a wrong code creates nothing', async () => {
        const userId = randomUUID()
        await asSuperuser(db)
        await db.query('INSERT INTO auth.users(id, email, created_at) VALUES ($1, $2, now())', [userId, `${userId}@example.test`])
        await asServiceRole(db)
        const error = await pgError(db.query("SELECT public.register_supervisor_join_request($1, 'ABCD2345', 'Name', 'a@example.test', NULL)", [userId]))
        expect(error).toEqual({ code: '22023', message: 'Check the code with your factory owner.' })
        await asSuperuser(db)
        expect((await db.query('SELECT count(*)::int AS n FROM public.profiles WHERE id = $1', [userId])).rows[0].n).toBe(0)
    })

    it('the same account cannot join twice', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const { code } = await enableJoining(owner)
        const { userId } = await register(code!)
        await asServiceRole(db)
        expect((await pgError(db.query("SELECT public.register_supervisor_join_request($1, $2, 'Again', 'b@example.test', NULL)", [userId, code]))).code).toBe('23505')
    })

    it('approving makes the supervisor active', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const { code } = await enableJoining(owner)
        const { userId } = await register(code!)
        await asOwner(owner)
        await db.query('SELECT public.approve_supervisor($1)', [userId])
        expect((await status(userId)).status).toBe('approved')
        await asOwner(owner)
        const state = (await db.query('SELECT public.get_supervisor_access() AS state')).rows[0].state as AccessState
        expect(state.pending).toEqual([])
        expect(state.approved.map(row => row.user_id)).toEqual([userId])
    })

    it('an owner cannot approve another factory’s request', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const other = await seedOwnerOrg(db, { tier: 'base' })
        const { code } = await enableJoining(owner)
        const { userId } = await register(code!)
        await asOwner(other)
        expect((await pgError(db.query('SELECT public.approve_supervisor($1)', [userId]))).code).toBe('22023')
        expect((await status(userId)).status).toBe('pending')
    })

    it('declining deletes the pending profile', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const { code } = await enableJoining(owner)
        const { userId } = await register(code!)
        await asOwner(owner)
        await db.query('SELECT public.decline_supervisor($1)', [userId])
        await asSuperuser(db)
        expect((await db.query('SELECT count(*)::int AS n FROM public.profiles WHERE id = $1', [userId])).rows[0].n).toBe(0)
        expect((await db.query('SELECT count(*)::int AS n FROM public.factory_supervisors WHERE user_id = $1', [userId])).rows[0].n).toBe(0)
    })

    it('declining an approved supervisor is refused', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const supervisor = await seedSupervisor(db, owner.orgId, 'approved')
        await asOwner(owner)
        expect((await pgError(db.query('SELECT public.decline_supervisor($1)', [supervisor.userId]))).code).toBe('22023')
    })

    it('removing revokes the supervisor and keeps the profile for attribution', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const supervisor = await seedSupervisor(db, owner.orgId, 'approved', 'Suresh')
        await asOwner(owner)
        await db.query('SELECT public.remove_supervisor($1)', [supervisor.userId])
        await asSuperuser(db)
        const row = (await db.query(
            'SELECT p.access_revoked_by, p.access_revoked_at IS NOT NULL AS revoked, m.status FROM public.profiles p JOIN public.factory_supervisors m ON m.user_id = p.id WHERE p.id = $1',
            [supervisor.userId],
        )).rows[0]
        expect(row).toEqual({ access_revoked_by: owner.userId, revoked: true, status: 'removed' })
        expect((await status(supervisor.userId)).status).toBe('none')
        await asOwner(owner)
        const names = (await db.query('SELECT public.get_supervisor_display_names() AS names')).rows[0].names
        expect(names).toEqual([{ user_id: supervisor.userId, full_name: 'Suresh' }])
    })

    it('status reports a lapsed plan and a locked factory', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const supervisor = await seedSupervisor(db, owner.orgId, 'approved')
        await asSuperuser(db)
        await db.query("UPDATE public.org_subscriptions SET current_end = now() - interval '3 days' WHERE org_id = $1", [owner.orgId])
        await db.query('UPDATE public.organizations SET is_locked_down = true WHERE id = $1', [owner.orgId])
        expect(await status(supervisor.userId)).toMatchObject({ status: 'approved', plan_active: false, locked: true })
    })

    it('an owner has no supervisor status', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        await asOwner(owner)
        const { rows } = await db.query('SELECT public.get_supervisor_status() AS status')
        expect(rows[0].status.status).toBe('none')
    })
})
