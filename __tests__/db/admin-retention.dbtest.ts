import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'
import { retentionReadSchema, retentionRecordClasses } from '@/lib/admin/retention-contracts'

let db: Db, founder: string, session: string, org: { userId: string; orgId: string }, other: { userId: string; orgId: string }
let holdTime: string
const sourceIds: Record<string, string> = {}
async function read(actor = founder, sid = session, limit = 25, at: string | null = null, id: string | null = null, asOf: string | null = null) {
    return (await db.query('SELECT public.admin_retention_review($1,$2,$3,$4,$5,$6) AS result', [actor, sid, limit, at, id, asOf])).rows[0].result
}
async function installPolicy(recordClass: string, version = 1, days: number | null = 90, mode = 'fixed_days', anchor = 'record_created') {
    return db.query(`INSERT INTO private.admin_retention_policies(record_class,version,policy_mode,retention_days,retention_anchor,summary,approval_reference,approved_by,approved_at,effective_from)
      VALUES($1,$2,$3,$4,$5,'Synthetic fixture approval only','fixture:RET-1',$6,now()-interval '3 days',now()-interval '2 days')`, [recordClass, version, mode, days, anchor, founder])
}
async function hold(recordClass: string, sourceType: string, sourceId: string, orgId: string | null = null) {
    return db.query(`INSERT INTO private.admin_retention_holds(record_class,source_type,source_id,org_id,reason,reference,placed_by,placed_at)
      VALUES($1,$2,$3,$4,'Synthetic review hold','fixture:HOLD-1',$5,$6) RETURNING id`, [recordClass, sourceType, sourceId, orgId, founder, holdTime])
}
beforeAll(async () => {
    db = await freshDatabase(); org = await seedOwnerOrg(db, { tier: null }); other = await seedOwnerOrg(db, { tier: null })
    holdTime = new Date(Date.now() - 60000).toISOString()
    await asSuperuser(db); founder = randomUUID(); session = randomUUID()
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'retention-founder@example.test',now())", [founder])
    await db.query("INSERT INTO public.profiles(id,role,org_id,full_name) VALUES($1,'admin',NULL,'Synthetic Retention Founder')", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email) VALUES($1,true,'Disposable retention fixture','retention-founder@example.test')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session, founder])
    await asServiceRole(db); await db.query("SELECT public.admin_founder_session($1,$2,'establish')", [founder, session])
})
afterAll(async () => { await db?.end() })

describe('retention review database contract (synthetic disposable fixtures only)', () => {
    it('starts with six unconfigured classes, healthy measured hold zero and no purge', async () => {
        const value = retentionReadSchema.parse(await read())
        expect(value.classes.every(item => item.policyState === 'unconfigured' && item.policy === null)).toBe(true)
        expect(value).toMatchObject({ releaseStatus: 'incomplete', automaticPurgeEnabled: false, holds: { totalActive: 0, sourceLinkageIssues: 0, items: [] } })
    })
    it('denies anonymous/customer/generic-admin direct reads, writes and source RPC calls', async () => {
        await db.query('RESET ROLE; SET ROLE anon')
        await expect(read()).rejects.toMatchObject({ code: '42501' })
        await asUser(db, org.userId, org.orgId, 'admin')
        await expect(read()).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT * FROM private.admin_retention_policies')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query("INSERT INTO private.admin_retention_holds DEFAULT VALUES")).rejects.toMatchObject({ code: '42501' })
        await asServiceRole(db)
        await expect(read(org.userId, randomUUID())).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT * FROM private.admin_retention_holds')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query("INSERT INTO private.admin_retention_policies DEFAULT VALUES")).rejects.toMatchObject({ code: '42501' })
        await expect(db.query("SELECT * FROM private.admin_retention_source_link('support_ticket',$1)", [randomUUID()])).rejects.toMatchObject({ code: '42501' })
    })
    it('requires current grant, AAL2 and nonexpired authoritative provider/admin sessions', async () => {
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal1' WHERE id=$1", [session])
        await asServiceRole(db); await expect(read()).rejects.toMatchObject({ code: '42501' })
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal2' WHERE id=$1", [session])
        await db.query('UPDATE private.platform_founder_grants SET enabled=false,revoked_at=now() WHERE user_id=$1', [founder])
        await asServiceRole(db); await expect(read()).rejects.toMatchObject({ code: '42501' })
        await asSuperuser(db); await db.query('UPDATE private.platform_founder_grants SET enabled=true,revoked_at=NULL WHERE user_id=$1', [founder])
        await db.query("UPDATE private.platform_admin_sessions SET created_at=now()-interval '16 minutes',last_interactive_at=now()-interval '16 minutes',absolute_expires_at=now()+interval '7 hours 44 minutes' WHERE session_id=$1", [session])
        await asServiceRole(db); await expect(read()).rejects.toMatchObject({ code: '42501' })
        await asSuperuser(db); await db.query("UPDATE private.platform_admin_sessions SET created_at=now(),last_interactive_at=now(),absolute_expires_at=now()+interval '8 hours',revoked_at=now() WHERE session_id=$1", [session])
        await asServiceRole(db); await expect(read()).rejects.toMatchObject({ code: '42501' })
        await asSuperuser(db); await db.query('UPDATE private.platform_admin_sessions SET revoked_at=NULL WHERE session_id=$1', [session])
        await db.query("UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=$1", [session])
        await asServiceRole(db); await expect(read()).rejects.toMatchObject({ code: '42501' })
        await asSuperuser(db); await db.query('UPDATE auth.sessions SET not_after=NULL WHERE id=$1', [session]); await asServiceRole(db)
        expect((await read()).automaticPurgeEnabled).toBe(false)
    })
    it('bounds pages and rejects malformed, future and stale snapshots', async () => {
        await asServiceRole(db)
        await expect(read(founder, session, 101)).rejects.toMatchObject({ code: '22023' })
        await expect(read(founder, session, 25, new Date().toISOString())).rejects.toMatchObject({ code: '22023' })
        await expect(read(founder, session, 25, null, null, new Date(Date.now() + 60000).toISOString())).rejects.toMatchObject({ code: '22023' })
        await expect(read(founder, session, 25, null, null, new Date(Date.now() - 25 * 3600000).toISOString())).rejects.toMatchObject({ code: '22023' })
    })
    it('validates reviewed policy periods, approval reference, class anchors and append-only versions', async () => {
        await asSuperuser(db)
        await expect(installPolicy('ordinary_support', 1, 0)).rejects.toMatchObject({ code: '23514' })
        await expect(installPolicy('ordinary_support', 1, null)).rejects.toMatchObject({ code: '23514' })
        await expect(installPolicy('ordinary_support', 1, 90, 'manual_review', 'manual_review')).rejects.toMatchObject({ code: '23514' })
        await expect(installPolicy('ordinary_support', 1, 90, 'fixed_days', 'provider_event')).rejects.toMatchObject({ code: '23514' })
        await expect(installPolicy('ordinary_support', 2)).rejects.toMatchObject({ code: '22023' })
        await installPolicy('ordinary_support', 1, null, 'manual_review', 'manual_review')
        await asServiceRole(db)
        const initial = retentionReadSchema.parse(await read())
        expect(initial.classes[0]).toMatchObject({ policyState: 'configured', policy: { policyMode: 'manual_review', retentionDays: null, approvalReference: 'fixture:RET-1' } })
        expect(initial.releaseStatus).toBe('incomplete')
        await asSuperuser(db)
        await expect(db.query("UPDATE private.admin_retention_policies SET retention_days=100")).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('DELETE FROM private.admin_retention_policies')).rejects.toMatchObject({ code: '42501' })
        await expect(installPolicy('ordinary_support', 1)).rejects.toMatchObject({ code: '22023' })
        await expect(db.query(`INSERT INTO private.admin_retention_policies(record_class,version,policy_mode,retention_days,retention_anchor,summary,approval_reference,approved_by,approved_at,effective_from)
          VALUES('billing_evidence',1,'fixed_days',90,'provider_event','Synthetic fixture','https://user:secret@example.test/path',$1,now(),now())`, [founder])).rejects.toMatchObject({ code: '23514' })
    })
    it('makes only current exact approved periods review-ready, never enabling a purge', async () => {
        await asSuperuser(db); await installPolicy('ordinary_support', 2)
        for (const recordClass of retentionRecordClasses.slice(1)) await installPolicy(recordClass)
        await asServiceRole(db)
        expect(retentionReadSchema.parse(await read())).toMatchObject({ releaseStatus: 'review_ready', automaticPurgeEnabled: false })
        await asSuperuser(db)
        await db.query(`INSERT INTO private.admin_retention_policies(record_class,version,policy_mode,retention_days,retention_anchor,summary,approval_reference,approved_by,approved_at,effective_from)
          VALUES('reporting_data',2,'manual_review',NULL,'manual_review','Synthetic future approval','fixture:RET-2',$1,now(),now()+interval '1 day')`, [founder])
        await asServiceRole(db)
        const value = retentionReadSchema.parse(await read())
        expect(value.classes[5]).toMatchObject({ policyState: 'configured', pendingPolicyCount: 1, policy: { version: 1, retentionDays: 90 } })
        expect(value.releaseStatus).toBe('review_ready')
        await asSuperuser(db)
        await db.query(`INSERT INTO private.admin_retention_policies(record_class,version,policy_mode,retention_days,retention_anchor,summary,approval_reference,approved_by,approved_at,effective_from,review_due_at)
          VALUES('billing_evidence',2,'fixed_days',90,'provider_event','Synthetic review overdue','fixture:RET-3',$1,now()-interval '2 days',now()-interval '1 day',now()-interval '1 hour')`, [founder])
        await asServiceRole(db)
        const due = retentionReadSchema.parse(await read())
        expect(due.classes[4]).toMatchObject({ policyState: 'review_due', policy: { version: 2 } })
        expect(due.releaseStatus).toBe('incomplete')
    })
    it('derives hold organizations from all fixed current source links and requires reason/actor/time', async () => {
        await asSuperuser(db)
        sourceIds.support_ticket = (await db.query("INSERT INTO public.support_tickets(org_id,requester_user_id,source,subject,category,client_request_id,idempotency_actor_key,request_payload_hash) VALUES($1,$2::uuid,'in_app','Synthetic support case','other',$3,$2::text,'fixture') RETURNING id", [org.orgId, org.userId, randomUUID()])).rows[0].id
        sourceIds.support_internal_note = (await db.query("INSERT INTO private.support_internal_notes(ticket_id,author_user_id,body,client_request_id,idempotency_actor_key,request_payload_hash) VALUES($1,$2::uuid,'Synthetic private fixture note',$3,$2::text,'fixture') RETURNING id", [sourceIds.support_ticket, founder, randomUUID()])).rows[0].id
        sourceIds.grievance = (await db.query("INSERT INTO public.grievances(org_id,subject,status,target_entity,grievance_type) VALUES($1,'Synthetic privacy case','pending','WEAVLY','DATA_PRIVACY') RETURNING id", [org.orgId])).rows[0].id
        sourceIds.security_incident = (await db.query("INSERT INTO public.security_incidents(org_id,title,source,incident_type,aware_at,cert_in_assessment_due_at,summary,created_by,updated_by) VALUES($1,'Synthetic security incident','internal','other',now(),now()+interval '6 hours','Synthetic fixture only',$2,$2) RETURNING id", [org.orgId, founder])).rows[0].id
        sourceIds.admin_audit_event = (await db.query("INSERT INTO private.admin_audit_events(actor_id,action,target_type,target_id,outcome,request_id) VALUES($1,'fixture.read','fixture','synthetic','success',$2) RETURNING id", [founder, randomUUID()])).rows[0].id
        sourceIds.billing_fact = (await db.query("INSERT INTO private.admin_billing_facts(kind,provider,provider_account_id,provider_object_id,source_record_type,source_record_id,org_id,currency,amount_minor,time_basis,mode,verification_state) VALUES('capture','fixture','fixture','fixture-capture','fixture','fixture-source',$1,'INR',0,'unknown','unknown','unverified') RETURNING id", [org.orgId])).rows[0].id
        sourceIds.billing_coverage = (await db.query("INSERT INTO private.admin_billing_coverage(provider,provider_account_id,mode,currency,period_start,period_end,capture_state,refund_state,checked_at,evidence_ref) VALUES('fixture','fixture','unknown','INR',now()-interval '1 day',now(),'unknown','unknown',now(),'fixture:coverage') RETURNING id")).rows[0].id
        await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'unclassified','Synthetic fixture only')", [org.orgId]); sourceIds.reporting_classification = org.orgId
        await expect(hold('ordinary_support', 'support_ticket', sourceIds.support_ticket, other.orgId)).rejects.toMatchObject({ code: '22023' })
        await expect(hold('privacy_cases', 'support_ticket', sourceIds.support_ticket)).rejects.toMatchObject({ code: '22023' })
        await expect(hold('ordinary_support', 'support_ticket', randomUUID())).rejects.toMatchObject({ code: '22023' })
        await expect(hold('ordinary_support', 'arbitrary_table', sourceIds.support_ticket)).rejects.toMatchObject({ code: '22023' })
        const mappings = ['ordinary_support','internal_notes','privacy_cases','security_incidents_audit','security_incidents_audit','billing_evidence','billing_evidence','reporting_data']
        for (const [index, sourceType] of Object.keys(sourceIds).entries()) await hold(mappings[index], sourceType, sourceIds[sourceType])
        await expect(hold('ordinary_support', 'support_ticket', sourceIds.support_ticket)).rejects.toMatchObject({ code: '23505' })
        await asServiceRole(db)
        const value = retentionReadSchema.parse(await read())
        expect(value.holds).toMatchObject({ totalActive: 8, sourceLinkageIssues: 0 })
        expect(value.holds.items.every(item => item.sourceLinked)).toBe(true)
        expect(value.holds.items.find(item => item.sourceType === 'support_internal_note')?.orgId).toBe(org.orgId)
        expect(value.holds.items.find(item => item.sourceType === 'admin_audit_event')?.orgId).toBeNull()
        expect(value.holds.items.find(item => item.sourceType === 'billing_coverage')?.orgId).toBeNull()
        expect(JSON.stringify(value)).not.toContain('Synthetic private fixture note')
        expect(JSON.stringify(value)).not.toContain('Synthetic fixture only')
    })
    it('paginates tied hold timestamps without duplicates and refuses client hold edits', async () => {
        const first = await read(founder, session, 2), last = first.holds.items[1]
        expect(first.holds.items).toHaveLength(3)
        const second = await read(founder, session, 2, last.placedAt, last.id, first.asOf)
        expect(second.holds.items.every((item: { id: string }) => !first.holds.items.slice(0, 2).some((prior: { id: string }) => item.id === prior.id))).toBe(true)
        expect(second.holds.totalActive).toBe(8)
        await expect(db.query('UPDATE private.admin_retention_holds SET released_at=now()')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('DELETE FROM private.admin_retention_holds')).rejects.toMatchObject({ code: '42501' })
    })
    it('keeps broken current source linkage visible and permits only explicit reviewed releases', async () => {
        await asSuperuser(db)
        // Remove synthetic classification metadata only, to simulate missing linkage.
        await db.query('DELETE FROM private.admin_org_reporting WHERE org_id=$1', [org.orgId])
        await asServiceRole(db)
        const broken = retentionReadSchema.parse(await read())
        expect(broken.holds).toMatchObject({ totalActive: 8, sourceLinkageIssues: 1 })
        expect(broken.classes[5]).toMatchObject({ activeHoldCount: 1, sourceLinkageIssues: 1 })
        expect(broken.holds.items.find(item => item.sourceType === 'reporting_classification')?.sourceLinked).toBe(false)
        await asSuperuser(db)
        await expect(db.query("UPDATE private.admin_retention_holds SET reason='Changed reason'")).rejects.toMatchObject({ code: '22023' })
        await expect(db.query("UPDATE private.admin_retention_holds SET released_at=now() WHERE source_type='reporting_classification'")).rejects.toMatchObject({ code: '23514' })
        await db.query("UPDATE private.admin_retention_holds SET released_at=now(),released_by=$1,release_reason='Synthetic reviewed release' WHERE source_type='reporting_classification'", [founder])
        await expect(db.query("UPDATE private.admin_retention_holds SET release_reason='Rewrite' WHERE source_type='reporting_classification'")).rejects.toMatchObject({ code: '22023' })
        await expect(db.query("DELETE FROM private.admin_retention_holds WHERE source_type='reporting_classification'")).rejects.toMatchObject({ code: '42501' })
        await asServiceRole(db)
        expect(retentionReadSchema.parse(await read()).holds).toMatchObject({ totalActive: 7, sourceLinkageIssues: 0 })
    })
    it('rejects unsupported infinity timestamps, missing hold evidence and nonexistent approval actors', async () => {
        await asSuperuser(db)
        await expect(db.query(`INSERT INTO private.admin_retention_policies(record_class,version,policy_mode,retention_days,retention_anchor,summary,approval_reference,approved_by,approved_at,effective_from)
          VALUES('billing_evidence',3,'fixed_days',90,'provider_event','Synthetic invalid time','fixture:RET-4',$1,now(),'infinity')`, [founder])).rejects.toMatchObject({ code: '23514' })
        await expect(db.query(`INSERT INTO private.admin_retention_policies(record_class,version,policy_mode,retention_days,retention_anchor,summary,approval_reference,approved_by,approved_at,effective_from)
          VALUES('billing_evidence',3,'fixed_days',90,'provider_event','Synthetic invalid actor','fixture:RET-4',$1,now(),now())`, [randomUUID()])).rejects.toMatchObject({ code: '23503' })
        const insert = `INSERT INTO private.admin_retention_holds(record_class,source_type,source_id,reason,reference,placed_by,placed_at)
          VALUES('reporting_data','reporting_classification',$1,$2,$3,$4,$5)`
        await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'unclassified','Synthetic hold validation')", [other.orgId])
        await expect(db.query(insert, [other.orgId, ' ', 'fixture:HOLD-2', founder, holdTime])).rejects.toMatchObject({ code: '23514' })
        await expect(db.query(insert, [other.orgId, 'Synthetic hold', 'fixture:HOLD-2', null, holdTime])).rejects.toMatchObject({ code: '23502' })
        await expect(db.query(insert, [other.orgId, 'Synthetic hold', 'fixture:HOLD-2', randomUUID(), holdTime])).rejects.toMatchObject({ code: '23503' })
        await expect(db.query(insert, [other.orgId, 'Synthetic hold', 'https://secret@example.test/?token=secret', founder, holdTime])).rejects.toMatchObject({ code: '23514' })
        await expect(db.query(insert, [other.orgId, 'Synthetic hold', 'fixture:HOLD-2', founder, 'infinity'])).rejects.toMatchObject({ code: '22023' })
        await expect(db.query(insert, [other.orgId, 'Synthetic hold', 'fixture:HOLD-2', founder, '-infinity'])).rejects.toMatchObject({ code: '23514' })
    })
})
