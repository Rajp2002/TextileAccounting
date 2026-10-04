import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

let db: Db
let founder: string
let session: string
let customer: { userId: string; orgId: string }

async function seedFounder() {
    await asSuperuser(db)
    founder = randomUUID(); session = randomUUID()
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,'founder@example.test')", [founder])
    await db.query("INSERT INTO public.profiles(id,role,org_id,full_name) VALUES($1,'admin',NULL,'Synthetic Founder')", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason) VALUES($1,true,'Isolated automated fixture')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session,founder])
    await asServiceRole(db)
}
async function operation(op: string, user = founder, sid = session) {
    const result = await db.query('SELECT public.admin_founder_session($1,$2,$3) AS result', [user,sid,op])
    return result.rows[0].result
}
async function resetLiveSession() {
    await asSuperuser(db)
    await db.query("UPDATE private.platform_founder_grants SET enabled=true,revoked_at=NULL WHERE user_id=$1", [founder])
    await db.query("UPDATE public.profiles SET access_revoked_at=NULL WHERE id=$1", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2') ON CONFLICT(id) DO UPDATE SET aal='aal2',not_after=NULL", [session,founder])
    await db.query('DELETE FROM private.platform_admin_sessions WHERE session_id=$1', [session])
    await asServiceRole(db)
    expect(await operation('establish')).toEqual({ allowed: true })
}

beforeAll(async () => {
    db = await freshDatabase()
    customer = await seedOwnerOrg(db, { tier: 'base' })
    await seedFounder()
})
afterAll(async () => { await db?.end() })

describe('AD01 real database founder boundary', () => {
    it('contains no grant seeds and allows only one enabled founder', async () => {
        await asSuperuser(db)
        expect((await db.query('SELECT count(*)::integer AS count FROM private.platform_founder_grants')).rows[0].count).toBe(1)
        await expect(db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason) VALUES($1,true,'Invalid second founder fixture')", [customer.userId])).rejects.toMatchObject({ code: '23505' })
        await asServiceRole(db)
    })

    it('organization-less founder can establish a live AAL2-bound session, never from owner identity', async () => {
        expect(await operation('candidate')).toEqual({ allowed: true })
        expect(await operation('establish')).toEqual({ allowed: true })
        expect(await operation('check')).toEqual({ allowed: true })
        expect(await operation('establish',customer.userId)).toMatchObject({ allowed: false, code: 'FORBIDDEN' })
        expect(await operation('establish',founder,randomUUID())).toMatchObject({ allowed: false, code: 'SESSION_EXPIRED' })
        expect(await operation('revoke',customer.userId)).toEqual({ allowed:true,revoked:false })
    })

    it('denies AAL1, profile revocation and grant revocation', async () => {
        await resetLiveSession()
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal1' WHERE id=$1", [session]); await asServiceRole(db)
        expect(await operation('check')).toMatchObject({ allowed: false, code: 'MFA_REQUIRED' })
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal2' WHERE id=$1", [session]); await db.query('UPDATE public.profiles SET access_revoked_at=now() WHERE id=$1', [founder]); await asServiceRole(db)
        expect(await operation('check')).toMatchObject({ allowed: false, code: 'FORBIDDEN' })
        await asSuperuser(db); await db.query('UPDATE public.profiles SET access_revoked_at=NULL WHERE id=$1', [founder]); await db.query('UPDATE private.platform_founder_grants SET enabled=false,revoked_at=now() WHERE user_id=$1', [founder]); await asServiceRole(db)
        expect(await operation('check')).toMatchObject({ allowed: false, code: 'FORBIDDEN' })
    })

    it('email changes retain the UUID grant; another UUID with the same email receives nothing', async () => {
        await resetLiveSession()
        await asSuperuser(db)
        await db.query("UPDATE auth.users SET email='changed@example.test' WHERE id=$1", [founder])
        const recreated = randomUUID()
        await db.query("INSERT INTO auth.users(id,email) VALUES($1,'founder@example.test')", [recreated])
        await db.query("INSERT INTO public.profiles(id,role,org_id) VALUES($1,'admin',NULL)", [recreated])
        await asServiceRole(db)
        expect(await operation('check')).toEqual({ allowed: true })
        expect(await operation('candidate',recreated)).toMatchObject({ allowed: false, code: 'FORBIDDEN' })
    })

    it('polling never extends idle, explicit touch does, expired rows never resurrect', async () => {
        await resetLiveSession()
        await asSuperuser(db)
        await db.query("UPDATE private.platform_admin_sessions SET created_at=now()-interval '10 minutes',last_interactive_at=now()-interval '10 minutes',absolute_expires_at=now()+interval '7 hours 50 minutes' WHERE session_id=$1", [session])
        const before = (await db.query('SELECT last_interactive_at FROM private.platform_admin_sessions WHERE session_id=$1', [session])).rows[0].last_interactive_at
        await asServiceRole(db)
        expect(await operation('check')).toEqual({ allowed: true })
        await asSuperuser(db)
        expect((await db.query('SELECT last_interactive_at FROM private.platform_admin_sessions WHERE session_id=$1',[session])).rows[0].last_interactive_at).toEqual(before)
        await asServiceRole(db); expect(await operation('touch')).toEqual({ allowed: true })
        await asSuperuser(db)
        expect(new Date((await db.query('SELECT last_interactive_at FROM private.platform_admin_sessions WHERE session_id=$1',[session])).rows[0].last_interactive_at).getTime()).toBeGreaterThan(new Date(before).getTime())
        await db.query("UPDATE private.platform_admin_sessions SET created_at=now()-interval '16 minutes',last_interactive_at=now()-interval '15 minutes',absolute_expires_at=now()+interval '7 hours 44 minutes' WHERE session_id=$1",[session]); await asServiceRole(db)
        for (const op of ['check','touch','establish']) expect(await operation(op)).toMatchObject({ allowed: false, code: 'SESSION_EXPIRED' })
    })

    it('8-hour absolute expiry wins even with recent interactive activity', async () => {
        await resetLiveSession(); await asSuperuser(db)
        await db.query("UPDATE private.platform_admin_sessions SET created_at=now()-interval '8 hours',absolute_expires_at=now(),last_interactive_at=now() WHERE session_id=$1",[session]); await asServiceRole(db)
        expect(await operation('check')).toMatchObject({ allowed: false, code: 'SESSION_EXPIRED' })
        expect(await operation('establish')).toMatchObject({ allowed: false, code: 'SESSION_EXPIRED' })
    })

    it('provider session deletion, provider expiry, and server signout block token replay', async () => {
        await resetLiveSession(); await asSuperuser(db)
        await db.query('DELETE FROM auth.sessions WHERE id=$1',[session]); await asServiceRole(db)
        expect(await operation('check')).toMatchObject({ allowed: false })
        await resetLiveSession(); await asSuperuser(db)
        await db.query('UPDATE auth.sessions SET not_after=now() WHERE id=$1',[session]); await asServiceRole(db)
        expect(await operation('check')).toMatchObject({ allowed: false })
        await resetLiveSession()
        expect(await operation('revoke')).toEqual({ allowed: true, revoked: true })
        expect(await operation('check')).toMatchObject({ allowed: false })
        expect(await operation('establish')).toMatchObject({ allowed: false })
        await asSuperuser(db)
        const audit=(await db.query("SELECT action,reason_code,after_safe FROM private.admin_audit_events WHERE actor_id=$1 AND action='founder.session.revoke' ORDER BY occurred_at DESC LIMIT 1",[founder])).rows[0]
        expect(audit).toMatchObject({action:'founder.session.revoke',reason_code:'logout',after_safe:{count:1}})
    })

    it('API roles cannot reach private tables or privileged session/audit/legacy RPCs', async () => {
        await asUser(db,customer.userId,customer.orgId)
        await expect(db.query('SELECT * FROM private.platform_founder_grants')).rejects.toMatchObject({ code: '42501' })
        await expect(operation('establish')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query("SELECT public.admin_record_denial($1,$2,'FORBIDDEN',$3)",[founder,session,randomUUID()])).rejects.toMatchObject({ code:'42501' })
        await expect(db.query('SELECT public.emergency_lockdown()')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT public.lockdown_tenant($1,$2,$3)',[customer.orgId,'Forbidden','high'])).rejects.toMatchObject({ code: '42501' })
        await asSuperuser(db)
        const adminPolicies = await db.query("SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'role[^;]*admin'")
        expect(adminPolicies.rows).toEqual([])
    })

    it('denial audit is provider-bound, fixed metadata and cannot grant any access', async () => {
        await resetLiveSession()
        const requestId=randomUUID()
        const denied=await db.query("SELECT public.admin_record_denial($1,$2,'MFA_REQUIRED',$3)",[founder,session,requestId])
        expect(denied.rows[0].admin_record_denial).toMatch(/^[0-9a-f-]{36}$/)
        const mismatch=await db.query("SELECT public.admin_record_denial($1,$2,'FORBIDDEN',$3)",[customer.userId,session,randomUUID()])
        expect(mismatch.rows[0].admin_record_denial).toBeNull()
        await expect(db.query("SELECT public.admin_record_denial($1,$2,'raw customer text',$3)",[founder,session,randomUUID()])).rejects.toMatchObject({ code:'22023' })
        await asSuperuser(db)
        const event=(await db.query('SELECT * FROM private.admin_audit_events WHERE request_id=$1',[requestId])).rows[0]
        expect(event).toMatchObject({ action:'founder.access',target_type:'console',target_id:'admin',outcome:'denied',reason_code:'MFA_REQUIRED',before_safe:null,after_safe:null })
    })

    it('audit is immutable to application roles, body metadata rejected, valid operations are recorded', async () => {
        await resetLiveSession()
        const auditArgs=[founder,session,'factory.read','factory',customer.orgId,'success',randomUUID()]
        const inserted = await db.query('SELECT public.admin_record_audit($1,$2,$3,$4,$5,$6,$7)',auditArgs)
        expect(inserted.rows[0].admin_record_audit).toMatch(/^[0-9a-f-]{36}$/)
        await expect(db.query('SELECT public.admin_record_audit($1,$2,$3,$4,$5,$6,$7,NULL,NULL,$8)',[...auditArgs,{body:'Private ticket text'}])).rejects.toMatchObject({ code:'22023' })
        await expect(db.query('UPDATE private.admin_audit_events SET action=$1',['tampered'])).rejects.toMatchObject({ code:'42501' })
        await expect(db.query('DELETE FROM private.admin_audit_events')).rejects.toMatchObject({ code:'42501' })
        await asSuperuser(db)
        const event=(await db.query('SELECT * FROM private.admin_audit_events WHERE request_id=$1',[auditArgs[6]])).rows[0]
        expect(event.actor_id).toBe(founder)
        expect(event.session_hash).not.toBe(session)
        expect(event.before_safe).toBeNull()
    })
})
