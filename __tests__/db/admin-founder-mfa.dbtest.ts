import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/test-db/cluster.mjs'
import { asServiceRole, asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

let db: Db
let founder: string
let session: string
let otherSession: string
let customer: { userId: string; orgId: string }
type SetupResult = { allowed: boolean; code?: string; intentId?: string; factorId?: string; verificationId?: string; abandonedFactorId?: string; status?: string; retryAfterSeconds?: number }

async function setup(operation: string, factor: string | null = null, intent: string | null = null, sid = session, client = db, verification: string | null = null): Promise<SetupResult> {
    return (await client.query('SELECT public.admin_founder_mfa_setup($1,$2,$3,$4,$5,$6) AS result', [founder, sid, operation, factor, intent, verification])).rows[0].result
}
async function sessionOperation(operation: string) {
    return (await db.query('SELECT public.admin_founder_session($1,$2,$3) AS result', [founder, session, operation])).rows[0].result
}
async function factor(user = founder, status = 'unverified', type = 'totp') {
    const id = randomUUID()
    await asSuperuser(db)
    // Synthetic local Auth schema state; this does not call provider enrollment.
    await db.query('INSERT INTO auth.mfa_factors(id,user_id,status,factor_type) VALUES($1,$2,$3,$4)', [id, user, status, type])
    await asServiceRole(db)
    return id
}
async function pending() {
    const begun = await setup('begin')
    expect(begun.allowed).toBe(true)
    const id = await factor()
    expect(await setup('bind', id, begun.intentId)).toMatchObject({ allowed: true, status: 'pending', factorId: id })
    return { intent: begun.intentId!, factor: id }
}
async function ageLease() {
    await asSuperuser(db)
    await db.query("UPDATE private.platform_founder_mfa_setup_intents SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1", [founder])
    await asServiceRole(db)
}

beforeAll(async () => {
    db = await freshDatabase()
    customer = await seedOwnerOrg(db)
    founder = randomUUID(); session = randomUUID(); otherSession = randomUUID()
    await asSuperuser(db)
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'mfa-founder@example.test',now())", [founder])
    await db.query("INSERT INTO public.profiles(id,role,org_id,email) VALUES($1,'admin',NULL,'stale-profile@example.test')", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email) VALUES($1,true,'Synthetic isolated MFA fixture','mfa-founder@example.test')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$3,'aal1'),($2,$3,'aal1')", [session, otherSession, founder])
})
beforeEach(async () => {
    await asSuperuser(db)
    await db.query('DELETE FROM private.platform_founder_mfa_setup_intents WHERE user_id=$1', [founder])
    await db.query('DELETE FROM private.platform_admin_sessions WHERE user_id=$1', [founder])
    await db.query('DELETE FROM auth.mfa_factors WHERE user_id IN ($1,$2)', [founder, customer.userId])
    await db.query("UPDATE auth.users SET email='MFA-Founder@Example.Test',email_confirmed_at=now() WHERE id=$1", [founder])
    await db.query("UPDATE public.profiles SET role='admin',access_revoked_at=NULL WHERE id=$1", [founder])
    await db.query('UPDATE private.platform_founder_grants SET enabled=true,revoked_at=NULL WHERE user_id=$1', [founder])
    await db.query("UPDATE auth.sessions SET aal='aal1',factor_id=NULL,not_after=NULL WHERE user_id=$1", [founder])
    await asServiceRole(db)
})
afterAll(async () => { await db?.end() })

describe('Founder email binding and protected first TOTP setup', () => {
    it('uses current confirmed Auth email and UUID grant, independently of stale profile email', async () => {
        expect(await sessionOperation('candidate')).toEqual({ allowed: true })
        await asSuperuser(db)
        await db.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [founder]); await asServiceRole(db)
        expect(await sessionOperation('candidate')).toEqual({ allowed: false, code: 'FORBIDDEN' })
        expect(await setup('begin')).toEqual({ allowed: false, code: 'FORBIDDEN' })
        await asSuperuser(db)
        await db.query("UPDATE auth.users SET email='changed@example.test',email_confirmed_at=now() WHERE id=$1", [founder]); await asServiceRole(db)
        expect(await sessionOperation('candidate')).toEqual({ allowed: false, code: 'FORBIDDEN' })
        expect((await db.query("SELECT public.admin_founder_session($1,$2,'candidate') AS result", [customer.userId, session])).rows[0].result).toEqual({ allowed: false, code: 'FORBIDDEN' })
    })

    it('rechecks email in every privileged SQL read while revocation remains usable after an email/grant/profile change', async () => {
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal2' WHERE id=$1", [session]); await asServiceRole(db)
        expect(await sessionOperation('establish')).toEqual({ allowed: true })
        await asSuperuser(db)
        await db.query("UPDATE auth.users SET email='changed@example.test' WHERE id=$1", [founder])
        await db.query('UPDATE private.platform_founder_grants SET enabled=false,revoked_at=now() WHERE user_id=$1', [founder])
        await db.query("UPDATE public.profiles SET role='owner',access_revoked_at=now() WHERE id=$1", [founder])
        await expect(db.query('SELECT private.admin_assert_founder_session($1,$2)', [founder, session])).rejects.toMatchObject({ code: '42501' })
        await asServiceRole(db)
        expect(await sessionOperation('check')).toEqual({ allowed: false, code: 'FORBIDDEN' })
        expect(await sessionOperation('revoke')).toEqual({ allowed: true, revoked: true })
    })

    it('serializes concurrent begin requests, stores metadata only, and cannot establish an AAL1 admin session', async () => {
        const params = db.connectionParameters
        const other = connect({ host: params.host, port: params.port, database: params.database })
        await other.connect(); await asServiceRole(other)
        try {
            const results = await Promise.all([setup('begin'), setup('begin', null, null, session, other)])
            expect(results.filter(result => result.allowed)).toHaveLength(1)
            expect(results.filter(result => result.code === 'SETUP_IN_PROGRESS')).toHaveLength(1)
        } finally { await other.end() }
        expect(await sessionOperation('establish')).toEqual({ allowed: false, code: 'MFA_REQUIRED' })
        await asSuperuser(db)
        expect((await db.query('SELECT count(*)::integer AS count FROM private.platform_founder_mfa_setup_intents')).rows[0].count).toBe(1)
        const columns = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='private' AND table_name='platform_founder_mfa_setup_intents'")).rows.map((row: { column_name: string }) => row.column_name)
        for (const secret of ['secret', 'qr_code', 'uri', 'code', 'password']) expect(columns).not.toContain(secret)
        expect((await db.query('SELECT count(*)::integer AS count FROM auth.mfa_factors')).rows[0].count).toBe(0)
    })

    it('binds only an owned unverified TOTP factor to the same provider session and intent', async () => {
        const begun = await setup('begin')
        const own = await factor(); const foreign = await factor(customer.userId); const phone = await factor(founder, 'unverified', 'phone')
        expect(await setup('bind', foreign, begun.intentId)).toEqual({ allowed: false, code: 'FACTOR_NOT_PENDING' })
        expect(await setup('bind', phone, begun.intentId)).toEqual({ allowed: false, code: 'FACTOR_NOT_PENDING' })
        expect(await setup('bind', own, randomUUID())).toEqual({ allowed: false, code: 'SETUP_MISMATCH' })
        expect(await setup('bind', own, begun.intentId, otherSession)).toEqual({ allowed: false, code: 'SETUP_MISMATCH' })
        const bound = await setup('bind', own, begun.intentId)
        expect(bound).toMatchObject({ allowed: true, status: 'pending', factorId: own })
        expect(await setup('bind', own, begun.intentId)).toEqual(bound)
        await asSuperuser(db); await db.query("UPDATE auth.mfa_factors SET status='verified' WHERE id=$1", [own]); await asServiceRole(db)
        expect(await setup('bind', own, begun.intentId)).toEqual({ allowed: false, code: 'FACTOR_NOT_PENDING' })
    })

    it('denies verified factor replacement and refuses null/wrong assurance or expired provider sessions', async () => {
        await factor(founder, 'verified')
        expect(await setup('begin')).toEqual({ allowed: false, code: 'EXISTING_FACTOR' })
        expect(await setup('restart')).toEqual({ allowed: false, code: 'EXISTING_FACTOR' })
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal2' WHERE id=$1", [session]); await asServiceRole(db)
        expect(await setup('begin')).toEqual({ allowed: false, code: 'MFA_REQUIRED' })
        await asSuperuser(db); await db.query('UPDATE auth.sessions SET aal=NULL WHERE id=$1', [session]); await asServiceRole(db)
        expect(await sessionOperation('candidate')).toEqual({ allowed: false, code: 'MFA_REQUIRED' })
        expect(await setup('status')).toEqual({ allowed: false, code: 'MFA_REQUIRED' })
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal1',not_after=now() WHERE id=$1", [session]); await asServiceRole(db)
        expect(await setup('begin')).toEqual({ allowed: false, code: 'FORBIDDEN' })
    })

    it('requires explicit restart after the enrollment lease and rejects stale callbacks without deleting provider factors', async () => {
        const prior = await pending()
        expect(await setup('begin')).toMatchObject({ allowed: false, code: 'SETUP_IN_PROGRESS' })
        expect(await setup('restart', null, prior.intent)).toMatchObject({ allowed: false, code: 'SETUP_IN_PROGRESS' })
        await ageLease()
        expect(await setup('restart', null, prior.intent, otherSession)).toMatchObject({ allowed: false })
        expect(await setup('restart', null, randomUUID())).toEqual({ allowed: false, code: 'SETUP_MISMATCH' })
        const restarted = await setup('restart', null, prior.intent)
        expect(restarted).toMatchObject({ allowed: true, status: 'enrolling', abandonedFactorId: prior.factor })
        expect(restarted.intentId).not.toBe(prior.intent)
        expect(await setup('bind', prior.factor, prior.intent)).toEqual({ allowed: false, code: 'SETUP_MISMATCH' })
        await asSuperuser(db)
        expect((await db.query('SELECT status FROM auth.mfa_factors WHERE id=$1', [prior.factor])).rows[0].status).toBe('unverified')
    })

    it('serializes verification and releases the lease only for an explicit matching invalid-code outcome', async () => {
        const p = await pending()
        const verification = await setup('verify', p.factor, p.intent)
        expect(verification).toMatchObject({ allowed: true, status: 'verifying' })
        expect(await setup('verify', p.factor, p.intent)).toMatchObject({ allowed: false, code: 'SETUP_IN_PROGRESS' })
        expect(await setup('verify_failed', randomUUID(), p.intent)).toEqual({ allowed: false, code: 'FACTOR_NOT_PENDING' })
        expect(await setup('verify_failed', p.factor, randomUUID())).toEqual({ allowed: false, code: 'SETUP_MISMATCH' })
        expect(await setup('verify_failed', p.factor, p.intent)).toEqual({ allowed: false, code: 'SETUP_MISMATCH' })
        expect(await setup('verify_failed', p.factor, p.intent, session, db, verification.verificationId)).toMatchObject({ allowed: true, status: 'pending' })
        expect(await setup('verify', p.factor, p.intent)).toMatchObject({ allowed: true, status: 'verifying' })
    })

    it('a delayed rejected-code response cannot clear a newer verification lease', async () => {
        const p = await pending()
        const first = await setup('verify', p.factor, p.intent)
        await ageLease()
        const next = await setup('verify', p.factor, p.intent)
        expect(next.verificationId).toBeTruthy()
        expect(next.verificationId).not.toBe(first.verificationId)
        expect(await setup('verify_failed', p.factor, p.intent, session, db, first.verificationId)).toEqual({ allowed: false, code: 'SETUP_MISMATCH' })
        expect(await setup('verify', p.factor, p.intent)).toMatchObject({ allowed: false, code: 'SETUP_IN_PROGRESS' })
        expect(await setup('verify_failed', p.factor, p.intent, session, db, next.verificationId)).toMatchObject({ allowed: true, status: 'pending' })
    })

    it('completes only after actual provider AAL2, matching session factor and verified TOTP; audit contains safe state only', async () => {
        const p = await pending()
        await setup('verify', p.factor, p.intent)
        expect(await setup('complete', p.factor, p.intent)).toEqual({ allowed: false, code: 'MFA_REQUIRED' })
        await asSuperuser(db)
        await db.query("UPDATE auth.mfa_factors SET status='verified' WHERE id=$1", [p.factor])
        await db.query("UPDATE auth.sessions SET aal='aal2',factor_id=$2 WHERE id=$1", [session, randomUUID()]); await asServiceRole(db)
        expect(await setup('complete', p.factor, p.intent)).toEqual({ allowed: false, code: 'FACTOR_NOT_PENDING' })
        await asSuperuser(db); await db.query('UPDATE auth.sessions SET factor_id=$2 WHERE id=$1', [session, p.factor]); await asServiceRole(db)
        const completed = await setup('complete', p.factor, p.intent)
        expect(completed).toMatchObject({ allowed: true, status: 'complete' })
        expect(await setup('complete', p.factor, p.intent)).toEqual(completed)
        expect(await sessionOperation('establish')).toEqual({ allowed: true })
        await asSuperuser(db)
        const audit = (await db.query("SELECT actor_id,session_hash,after_safe,before_safe,reason_code FROM private.admin_audit_events WHERE action='founder.mfa.setup.complete' AND target_id=$1", [p.intent])).rows[0]
        expect(audit).toMatchObject({ actor_id: founder, after_safe: { status: 'complete' }, before_safe: null, reason_code: 'first_totp_setup' })
        expect(audit.session_hash).not.toBe(session)
    })

    it('expires pending setup and rejects stale intent operations without granting access', async () => {
        const p = await pending()
        await asSuperuser(db)
        await db.query("UPDATE private.platform_founder_mfa_setup_intents SET created_at=now()-interval '11 minutes',expires_at=now()-interval '1 minute',lease_expires_at=now()-interval '1 minute' WHERE user_id=$1", [founder]); await asServiceRole(db)
        expect(await setup('verify', p.factor, p.intent)).toEqual({ allowed: false, code: 'SETUP_EXPIRED' })
        expect(await sessionOperation('check')).toEqual({ allowed: false, code: 'MFA_REQUIRED' })
        const status = await setup('status')
        expect(status.retryAfterSeconds).toBe(0)
    })

    it('a new provider session can recover expired or abandoned setup without learning foreign intent IDs', async () => {
        const p = await pending()
        const active = await setup('status', null, null, otherSession)
        expect(active).toMatchObject({ allowed: false, code: 'SETUP_IN_PROGRESS' })
        expect(active.retryAfterSeconds).toBeGreaterThan(0)
        expect(active.retryAfterSeconds).toBeLessThanOrEqual(600)
        expect(active).not.toHaveProperty('intentId')
        expect(active).not.toHaveProperty('factorId')
        await asSuperuser(db)
        await db.query("UPDATE private.platform_founder_mfa_setup_intents SET created_at=now()-interval '11 minutes',expires_at=now()-interval '1 minute',lease_expires_at=now()-interval '1 minute' WHERE user_id=$1", [founder]); await asServiceRole(db)
        expect(await setup('status', null, null, otherSession)).toEqual({ allowed: true, status: 'none' })
        const next = await setup('begin', null, null, otherSession)
        expect(next).toMatchObject({ allowed: true, status: 'enrolling' })
        expect(next.intentId).not.toBe(p.intent)
        expect(await setup('abandon', null, next.intentId, otherSession)).toMatchObject({ allowed: true, status: 'abandoned' })
        expect(await setup('status')).toEqual({ allowed: true, status: 'none' })
        expect(await setup('begin')).toMatchObject({ allowed: true, status: 'enrolling' })
    })

    it('keeps intent storage/helper/RPC inaccessible to clients and rejects arbitrary operations', async () => {
        await asUser(db, customer.userId, customer.orgId)
        await expect(db.query('SELECT * FROM private.platform_founder_mfa_setup_intents')).rejects.toMatchObject({ code: '42501' })
        await expect(setup('begin')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT private.admin_founder_identity_valid($1,$2)', [founder, session])).rejects.toMatchObject({ code: '42501' })
        await db.query('RESET ROLE;SET ROLE anon')
        await expect(setup('begin')).rejects.toMatchObject({ code: '42501' })
        await asServiceRole(db)
        await expect(setup('delete_all')).rejects.toMatchObject({ code: '22023' })
        await expect(db.query('SELECT * FROM private.platform_founder_mfa_setup_intents')).rejects.toMatchObject({ code: '42501' })
        await asSuperuser(db); await db.query('UPDATE private.platform_founder_grants SET enabled=false,revoked_at=now() WHERE user_id=$1', [founder]); await asServiceRole(db)
        expect(await setup('begin')).toEqual({ allowed: false, code: 'FORBIDDEN' })
    })

    it('rolls setup metadata back when the required safe audit fails', async () => {
        await asSuperuser(db)
        await db.query("CREATE FUNCTION private.test_reject_mfa_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic audit failure';END$$;CREATE TRIGGER test_reject_mfa_audit BEFORE INSERT ON private.admin_audit_events FOR EACH ROW EXECUTE FUNCTION private.test_reject_mfa_audit()")
        await asServiceRole(db)
        try {
            await expect(setup('begin')).rejects.toMatchObject({ message: 'Synthetic audit failure' })
            await asSuperuser(db)
            expect((await db.query('SELECT count(*)::integer AS count FROM private.platform_founder_mfa_setup_intents WHERE user_id=$1', [founder])).rows[0].count).toBe(0)
        } finally {
            await asSuperuser(db)
            await db.query('DROP TRIGGER test_reject_mfa_audit ON private.admin_audit_events;DROP FUNCTION private.test_reject_mfa_audit()')
        }
    })
})
