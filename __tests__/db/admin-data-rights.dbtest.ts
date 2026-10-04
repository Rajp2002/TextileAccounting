import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/test-db/cluster.mjs'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'
let db: Db
beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })
async function preflight(owner: { userId: string; orgId: string }) {
    await asServiceRole(db)
    return (await db.query('SELECT public.admin_account_deletion_preflight($1,$2) AS result', [owner.userId, owner.orgId])).rows[0].result
}
async function seedTicket(owner: { userId: string; orgId: string }, requester: string | null = owner.userId, source = 'in_app') {
    await asSuperuser(db)
    const id = randomUUID()
    await db.query("INSERT INTO public.support_tickets(id,org_id,requester_user_id,created_by_user_id,source,subject,category,external_reference,next_action,client_request_id,idempotency_actor_key,request_payload_hash) VALUES($1,$2,$3,$3,$4,'Synthetic public ticket','other','PRIVATE-REFERENCE','Private founder next action',gen_random_uuid(),'synthetic','fixture')", [id, owner.orgId, requester, source])
    return id
}
async function exportPage(owner: { userId: string; orgId: string }, cursor: unknown = null) {
    await asServiceRole(db)
    return (await db.query("SELECT public.admin_requester_support_export($1,$2,now(),100,$3) AS result", [owner.userId, owner.orgId, cursor])).rows[0].result
}
describe('AD09 requester export and retained-record deletion compatibility', () => {
    it('denies direct client RPC and wrong tenant, revoked or non-owner identity', async () => {
        const owner = await seedOwnerOrg(db, { tier: null }), other = await seedOwnerOrg(db, { tier: null })
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query('SELECT public.admin_requester_support_export($1,$2,now())', [owner.userId, owner.orgId]))).code).toBe('42501')
        expect((await pgError(db.query('SELECT public.admin_account_deletion_preflight($1,$2)', [owner.userId, owner.orgId]))).code).toBe('42501')
        expect((await pgError(db.query("SELECT private.delete_account_pre_admin('Test Weaving Works','DELETE MY ACCOUNT')"))).code).toBe('42501')
        await asServiceRole(db)
        expect((await pgError(db.query('SELECT public.admin_requester_support_export($1,$2,now())', [owner.userId, other.orgId]))).code).toBe('42501')
        await asSuperuser(db); await db.query("UPDATE public.profiles SET access_revoked_at=now() WHERE id=$1", [owner.userId])
        expect((await pgError(preflight(owner))).code).toBe('42501')
        await asSuperuser(db); await db.query("UPDATE public.profiles SET access_revoked_at=NULL,role='supervisor' WHERE id=$1", [owner.userId])
        expect((await pgError(preflight(owner))).code).toBe('42501')
    })
    it('exports the entire own public history, including bound manual intake; peers, foreign/unbound tickets and private values stay excluded', async () => {
        const owner = await seedOwnerOrg(db, { tier: null, locked: true }), peer = await seedOwnerOrg(db, { tier: null }), other = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db); await db.query('UPDATE public.profiles SET org_id=$1 WHERE id=$2', [owner.orgId, peer.userId])
        const ticket = await seedTicket(owner), manual = await seedTicket(owner, owner.userId, 'manual_email')
        await seedTicket(owner, peer.userId); await seedTicket(owner, null, 'manual_phone'); await seedTicket(other)
        await db.query("INSERT INTO public.support_messages(ticket_id,author_user_id,author_kind,message_kind,body,message_seq,client_request_id,idempotency_actor_key,request_payload_hash,created_at) SELECT $1,$2,'customer','public_reply','Synthetic message '||g,g,gen_random_uuid(),'private-actor-key','private-hash','2026-01-01' FROM generate_series(1,205)g", [ticket, owner.userId])
        await db.query("INSERT INTO public.support_messages(ticket_id,author_user_id,author_kind,message_kind,body,message_seq,client_request_id,idempotency_actor_key,request_payload_hash) VALUES($1,$2,'founder','initial_intake','Bound email intake',1,gen_random_uuid(),'private-key','private-hash')", [manual, owner.userId])
        await db.query("INSERT INTO private.support_internal_notes(ticket_id,author_user_id,body,client_request_id,idempotency_actor_key,request_payload_hash) VALUES($1,$2,'PRIVATE NOTE',gen_random_uuid(),'private-key','private-hash')", [ticket, owner.userId])
        await db.query("INSERT INTO public.support_ticket_events(ticket_id,event_type,before_safe,after_safe,public_visible,request_id,created_at) SELECT $1,'status_changed','{\"externalReference\":\"SECRET INTERNAL LINK\"}','{\"status\":\"in_progress\",\"nextAction\":\"PRIVATE ACTION\"}',true,gen_random_uuid(),'2026-01-01' FROM generate_series(1,205)", [ticket])
        await db.query("INSERT INTO public.support_ticket_events(ticket_id,event_type,after_safe,public_visible,request_id) VALUES($1,'private_event','{\"status\":\"PRIVATE STATUS\"}',false,gen_random_uuid())", [ticket])
        const records: Array<{ kind: string; value: { id: string; source?: string } }> = []
        let cursor: unknown = null, pages = 0
        do { const page = await exportPage(owner, cursor); expect(page.items.length).toBeLessThanOrEqual(100); records.push(...page.items); cursor = page.nextCursor; pages++ } while (cursor)
        expect(pages).toBe(5); expect(records.filter(r => r.kind === 'ticket')).toHaveLength(2)
        expect(records.filter(r => r.kind === 'message')).toHaveLength(206)
        expect(records.filter(r => r.kind === 'event')).toHaveLength(205)
        expect(records.some(r => r.kind === 'ticket' && r.value.source === 'manual_email')).toBe(true)
        expect(new Set(records.map(r => r.value.id)).size).toBe(records.length)
        expect(JSON.stringify(records)).not.toMatch(/PRIVATE|private-key|private-hash|private-actor-key|SECRET INTERNAL LINK/)
    })
    it('keeps the established empty-account deletion path working and the foreign tenant intact', async () => {
        const owner = await seedOwnerOrg(db, { tier: null }), other = await seedOwnerOrg(db, { tier: null })
        await asServiceRole(db)
        expect((await db.query('SELECT public.admin_requester_support_export($1,$2,now()) AS result', [owner.userId, owner.orgId])).rows[0].result).toEqual({ items: [], nextCursor: null })
        expect(await preflight(owner)).toEqual({ allowed: true, reason: 'ready' })
        await asUser(db, owner.userId, owner.orgId)
        expect((await db.query("SELECT public.delete_account_permanently('Test Weaving Works','DELETE MY ACCOUNT') AS result")).rows[0].result.success).toBe(true)
        await asSuperuser(db)
        expect((await db.query('SELECT id FROM public.organizations WHERE id=$1', [owner.orgId])).rowCount).toBe(0)
        expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [other.userId])).rowCount).toBe(1)
    })
    it.each(['support', 'classification', 'billing', 'idempotency', 'mfa_setup'])('preflights %s records and direct RPC recheck preserves all rows', async (kind) => {
        const owner = await seedOwnerOrg(db, { tier: null })
        if (kind === 'support') await seedTicket(owner, null, 'manual_phone')
        else if (kind === 'classification') await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason)VALUES($1,'unclassified','Synthetic fixture')", [owner.orgId])
        else if (kind === 'billing') await db.query("INSERT INTO private.admin_billing_facts(kind,provider,provider_account_id,provider_object_id,source_record_type,source_record_id,org_id,currency,amount_minor,time_basis,mode,verification_state)VALUES('capture','fixture','synthetic-account',$1,'fixture','synthetic-source',$2,'INR',0,'unknown','unknown','unverified')", [randomUUID(), owner.orgId])
        else if (kind === 'idempotency') await db.query("INSERT INTO private.support_request_results(actor_key,request_id,scope,payload_hash,result)VALUES($1,gen_random_uuid(),'create','synthetic','{}')", [owner.userId])
        else await db.query("INSERT INTO private.platform_founder_mfa_setup_intents(user_id,session_id,state,lease_expires_at,expires_at)VALUES($1,gen_random_uuid(),'enrolling',now()+interval '1 minute',now()+interval '5 minutes')", [owner.userId])
        expect(await preflight(owner)).toEqual({ allowed: false, reason: 'review_required' })
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query("SELECT public.delete_account_permanently('Test Weaving Works','DELETE MY ACCOUNT')"))).code).toBe('55000')
        await asSuperuser(db)
        expect((await db.query('SELECT id FROM public.organizations WHERE id=$1', [owner.orgId])).rowCount).toBe(1)
        expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [owner.userId])).rowCount).toBe(1)
    })
    it('a blocker committed while deletion waits on the org lock is seen before the legacy sweep', async () => {
        const owner = await seedOwnerOrg(db, { tier: null }), params = db.connectionParameters
        expect((await preflight(owner)).allowed).toBe(true)
        const second = connect({ host: params.host, port: params.port, database: params.database }); await second.connect()
        try {
            await second.query('BEGIN'); await second.query('SELECT id FROM public.organizations WHERE id=$1 FOR UPDATE', [owner.orgId])
            await asUser(db, owner.userId, owner.orgId)
            const deletion = pgError(db.query("SELECT public.delete_account_permanently('Test Weaving Works','DELETE MY ACCOUNT')"))
            await second.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason)VALUES($1,'unclassified','Concurrent fixture')", [owner.orgId])
            await second.query('COMMIT')
            expect((await deletion).code).toBe('55000')
            expect((await second.query('SELECT org_id FROM private.admin_org_reporting WHERE org_id=$1', [owner.orgId])).rowCount).toBe(1)
            expect((await second.query('SELECT id FROM public.organizations WHERE id=$1', [owner.orgId])).rowCount).toBe(1)
        } finally { await second.query('ROLLBACK'); await second.end() }
    })
})
