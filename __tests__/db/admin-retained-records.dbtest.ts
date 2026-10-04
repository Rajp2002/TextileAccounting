import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/test-db/cluster.mjs'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

let db: Db, founder: string, session: string
type Owner = { userId: string; orgId: string }
beforeAll(async () => {
    db = await freshDatabase(); founder = randomUUID(); session = randomUUID()
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at)VALUES($1,'retained-founder@example.test',now())", [founder])
    await db.query("INSERT INTO public.profiles(id,role,org_id)VALUES($1,'admin',NULL)", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email)VALUES($1,true,'Synthetic local regression','retained-founder@example.test')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal)VALUES($1,$2,'aal2')", [session, founder])
    await asServiceRole(db)
    expect((await db.query("SELECT public.admin_founder_session($1,$2,'establish') AS r", [founder, session])).rows[0].r.allowed).toBe(true)
})
afterAll(async () => { await db?.end() })
async function preflight(owner: Owner) {
    await asServiceRole(db)
    return (await db.query('SELECT public.admin_account_deletion_preflight($1,$2) AS r', [owner.userId, owner.orgId])).rows[0].r
}
async function preview(owner: Owner, actor = founder, sid = session) {
    await asServiceRole(db)
    return (await db.query('SELECT public.admin_retained_record_review_preview($1,$2,$3,$4) AS r', [actor, sid, owner.orgId, randomUUID()])).rows[0].r
}
async function assertPreserved(owner: Owner) {
    expect(await preflight(owner)).toEqual({ allowed: false, reason: 'review_required' })
    await asUser(db, owner.userId, owner.orgId)
    expect(await pgError(db.query("SELECT public.delete_account_permanently('Test Weaving Works','DELETE MY ACCOUNT')"))).toMatchObject({ code: '55000', message: 'ACCOUNT_DELETION_REVIEW_REQUIRED' })
    await asSuperuser(db)
    expect((await db.query('SELECT id FROM public.organizations WHERE id=$1', [owner.orgId])).rowCount).toBe(1)
    expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [owner.userId])).rowCount).toBe(1)
}
async function grievance(org: string | null) {
    const id = randomUUID()
    await db.query("INSERT INTO public.grievances(id,org_id,subject,description,status,target_entity,grievance_type)VALUES($1,$2,'Synthetic privacy evidence','SECRET CASE CONTENT','resolved','WEAVLY','DATA_PRIVACY')", [id, org])
    return id
}
async function formalCase(requester: string | null = null) {
    const id = await grievance(null)
    await db.query("INSERT INTO private.admin_formal_cases(id,kind,grievance_id,requester_user_id,category,intake_source,next_action)VALUES($1,'privacy',$1,$2,'other','manual_email','Review this synthetic case')", [id, requester])
    return id
}
async function payment(owner: Owner) {
    const id = randomUUID()
    await db.query("INSERT INTO public.subscription_payments(id,org_id,amount_paise,status,razorpay_payment_id)VALUES($1,$2,299900,'captured',$3)", [id, owner.orgId, `pay_synthetic_${id}`])
    return id
}
describe('retained evidence is reviewed before any account sweep', () => {
    it('bare Lite/Base entitlement rows and failed evidence-free local intents remain deletable', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' }), foreign = await seedOwnerOrg(db, { tier: null })
        await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status)VALUES($1,'lite','failed')", [owner.orgId])
        await db.query("INSERT INTO public.subscription_payments(org_id,amount_paise,status)VALUES($1,0,'failed')", [owner.orgId])
        await db.query("INSERT INTO public.billing_checkout_attempts(org_id,client_request_id,plan_tier,purchase_type,billing_model,base_amount_paise,gst_amount_paise,total_amount_paise,status)VALUES($1,'synthetic-empty-intent','lite','initial_purchase','annual',1,0,1,'failed')", [owner.orgId])
        expect(await preflight(owner)).toEqual({ allowed: true, reason: 'ready' })
        expect((await preview(owner)).reviewRequired).toBe(false)
        await asUser(db, owner.userId, owner.orgId)
        expect((await db.query("SELECT public.delete_account_permanently('Test Weaving Works','DELETE MY ACCOUNT') AS r")).rows[0].r.success).toBe(true)
        await asSuperuser(db)
        expect((await db.query('SELECT id FROM public.organizations WHERE id=$1', [foreign.orgId])).rowCount).toBe(1)
    })
    it.each(['expired', 'cancelled', 'failed', 'completed', 'active'])('any recurring reference in %s state requires review regardless dates', async status => {
        const owner = await seedOwnerOrg(db, { tier: null })
        await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status,current_end,razorpay_subscription_id)VALUES($1,'lite',$2,'2000-01-01',$3)", [owner.orgId, status, `sub_synthetic_${randomUUID()}`])
        await assertPreserved(owner)
    })
    it.each(['capture', 'refund', 'invoice', 'provider_order', 'paid_history'])('preserves %s financial evidence without changing it', async kind => {
        const owner = await seedOwnerOrg(db, { tier: null })
        if (kind === 'capture') await payment(owner)
        else if (kind === 'refund') await db.query("INSERT INTO public.billing_payment_refunds(org_id,razorpay_payment_id,amount_paise,reason,idempotency_key,status)VALUES($1,$2,100,'Synthetic review',$3,'pending')", [owner.orgId, `pay_${randomUUID()}`, randomUUID()])
        else if (kind === 'provider_order') await db.query("INSERT INTO public.billing_checkout_attempts(org_id,client_request_id,plan_tier,purchase_type,billing_model,base_amount_paise,gst_amount_paise,total_amount_paise,status,provider_order_id)VALUES($1,$2,'lite','initial_purchase','annual',1,0,1,'failed',$3)", [owner.orgId, randomUUID(), `order_${randomUUID()}`])
        else if (kind === 'paid_history') await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status,paid_count)VALUES($1,'base','expired',1)", [owner.orgId])
        else {
            const pid = await payment(owner)
            await db.query(`INSERT INTO public.billing_invoices(org_id,subscription_payment_id,invoice_number,financial_year,supplier_legal_name,supplier_address,supplier_state,supplier_state_code,supplier_postal_code,customer_legal_name,customer_address,customer_city,customer_state,customer_state_code,customer_postal_code,customer_email,place_of_supply,sac,taxable_amount_paise,total_amount_paise,status)
                VALUES($1,$2,$3,'2026-27','Synthetic supplier','Synthetic address','Gujarat','24','380001','Synthetic customer','Synthetic address','Ahmedabad','Gujarat','24','380001','synthetic@example.test','Gujarat','9983',299900,299900,'voided')`, [owner.orgId, pid, `SYN-${randomUUID()}`])
        }
        const before = await preview(owner)
        await assertPreserved(owner)
        const after = await preview(owner)
        expect(after.groups).toEqual(before.groups)
        expect(after.groups.find((g: { key: string }) => g.key === 'billing_evidence').count).toBeGreaterThan(0)
    })
    it.each(['grievance', 'security', 'breach', 'legal_acceptance', 'consent', 'signed_dpa'])('preserves retained %s evidence, including closed records', async kind => {
        const owner = await seedOwnerOrg(db, { tier: null })
        if (kind === 'grievance') await grievance(owner.orgId)
        else if (kind === 'security') await db.query("INSERT INTO public.security_incidents(org_id,title,source,incident_type,status,aware_at,cert_in_assessment_due_at,summary,created_by,updated_by,closed_at)VALUES($1,'Synthetic closed incident','internal','other','closed',now(),now(),'SECRET INVESTIGATION CONTENT',$2,$2,now())", [owner.orgId, founder])
        else if (kind === 'breach') await db.query("INSERT INTO public.breach_reports(org_id,severity,description,filed_by)VALUES($1,'high','SECRET BREACH BODY',$2)", [owner.orgId, founder])
        else if (kind === 'legal_acceptance') await db.query("INSERT INTO public.legal_document_acceptances(org_id,actor_user_id,document_type,document_version,document_identifier,document_path,acceptance_method)VALUES($1,$2,'privacy','synthetic-v1','privacy:synthetic-v1','/privacy','signup_checkbox')", [owner.orgId, owner.userId])
        else if (kind === 'consent') {
            const notice = randomUUID()
            await db.query("INSERT INTO public.notice_registry(id,version_string,notice_type,content_hash)VALUES($1,$2,'consent','synthetic-hash')", [notice, `synthetic-${notice}`])
            await db.query("INSERT INTO public.worker_consent_artifacts(org_id,worker_id,notice_version_id,audit_hash)VALUES($1,1,$2,'synthetic-proof')", [owner.orgId, notice])
        } else await db.query("INSERT INTO public.organization_dpas(org_id,dpa_id,status,signed_by,signed_at)SELECT $1,id,'signed',$2,now() FROM public.dpas LIMIT 1", [owner.orgId, owner.userId])
        await assertPreserved(owner)
    })
    it.each(['requester', 'note_author', 'event_actor', 'request_actor'])('unbound formal %s identity evidence also blocks erasure', async kind => {
        const owner = await seedOwnerOrg(db, { tier: null }), cid = await formalCase(kind === 'requester' ? owner.userId : null)
        if (kind === 'note_author') await db.query("INSERT INTO private.admin_formal_notes(case_id,author_user_id,body)VALUES($1,$2,'SECRET PRIVATE NOTE')", [cid, owner.userId])
        if (kind === 'event_actor') await db.query("INSERT INTO private.admin_formal_events(case_id,actor_user_id,event_type,request_id)VALUES($1,$2,'synthetic',gen_random_uuid())", [cid, owner.userId])
        if (kind === 'request_actor') await db.query("INSERT INTO private.admin_formal_request_results(actor_id,request_id,scope,payload_hash,case_id,result)VALUES($1,gen_random_uuid(),'synthetic','hash',$2,'{}')", [owner.userId, cid])
        await assertPreserved(owner)
    })
    it('a revision actor on an unbound formal case alone requires review and preserves correction evidence', async () => {
        const owner = await seedOwnerOrg(db, { tier: null }), cid = await formalCase(), revision = randomUUID()
        await db.query("INSERT INTO private.admin_formal_revisions(id,case_id,version,actor_user_id,request_id,before_values,after_values)VALUES($1,$2,1,$3,gen_random_uuid(),'{\"outcomeSummary\":\"SECRET FORMER EVIDENCE\"}','{\"outcomeSummary\":\"SECRET CORRECTED EVIDENCE\"}')", [revision, cid, owner.userId])
        const result = await preview(owner)
        expect(result.foundationReviewRequired).toBe(false)
        expect(result.groups.find((g: { key: string }) => g.key === 'formal_register_records').count).toBe(0)
        expect(result.groups.find((g: { key: string }) => g.key === 'formal_sidecars_and_retention')).toEqual({ key: 'formal_sidecars_and_retention', count: 1, more: false })
        expect(JSON.stringify(result)).not.toContain('SECRET')
        await assertPreserved(owner)
        expect((await db.query('SELECT before_values,after_values FROM private.admin_formal_revisions WHERE id=$1', [revision])).rows[0]).toEqual({ before_values: { outcomeSummary: 'SECRET FORMER EVIDENCE' }, after_values: { outcomeSummary: 'SECRET CORRECTED EVIDENCE' } })
    })
    it.each(['approved_policy', 'placed_hold', 'released_hold', 'live_link'])('review metadata %s retains linked identity/source evidence', async kind => {
        const owner = await seedOwnerOrg(db, { tier: null })
        if (kind === 'approved_policy') await db.query("INSERT INTO private.admin_retention_policies(record_class,version,policy_mode,retention_anchor,summary,approval_reference,approved_by,approved_at,effective_from)VALUES('ordinary_support',1,'manual_review','manual_review','Synthetic reviewed setting','synthetic-review',$1,now(),now())", [owner.userId])
        else {
            const aid = randomUUID()
            await db.query("INSERT INTO private.admin_audit_events(id,actor_id,action,target_type,target_id,outcome,request_id)VALUES($1,$2,'synthetic','fixture','fixture','success',gen_random_uuid())", [aid, kind === 'live_link' ? owner.userId : founder])
            const hold = randomUUID()
            await db.query("INSERT INTO private.admin_retention_holds(id,record_class,source_type,source_id,reason,reference,placed_by)VALUES($1,'security_incidents_audit','admin_audit_event',$2,'Synthetic hold','synthetic-review',$3)", [hold, aid, kind === 'placed_hold' ? owner.userId : founder])
            if (kind === 'released_hold') await db.query("UPDATE private.admin_retention_holds SET released_at=now(),released_by=$2,release_reason='Synthetic reviewed release' WHERE id=$1", [hold, owner.userId])
        }
        await assertPreserved(owner)
    })
    it('preview is founder/session guarded, counts-only, bounded and audited; it cannot approve deletion', async () => {
        const owner = await seedOwnerOrg(db, { tier: null })
        await db.query("INSERT INTO public.grievances(org_id,subject,description,status)SELECT $1,'Synthetic retained case','SECRET CUSTOMER BODY','resolved' FROM generate_series(1,1005)", [owner.orgId])
        const r = await preview(owner)
        expect(r).toMatchObject({ reviewRequired: true, countLimit: 1000, automaticDeletion: false, scope: 'retained_record_review' })
        expect(r.groups.find((g: { key: string }) => g.key === 'formal_register_records')).toEqual({ key: 'formal_register_records', count: 1000, more: true })
        expect(JSON.stringify(r)).not.toMatch(/SECRET|description|payment_id|requester_user_id|approvalToken/)
        await asSuperuser(db)
        expect((await db.query("SELECT count(*)::integer AS n FROM private.admin_audit_events WHERE action='data_rights.review_preview' AND target_id=$1", [owner.orgId])).rows[0].n).toBe(1)
        await asUser(db, owner.userId, owner.orgId)
        expect((await pgError(db.query('SELECT public.admin_retained_record_review_preview($1,$2,$3,$4)', [founder, session, owner.orgId, randomUUID()]))).code).toBe('42501')
        expect((await pgError(preview(owner, owner.userId))).code).toBe('42501')
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal1' WHERE id=$1", [session])
        expect((await pgError(preview(owner))).code).toBe('42501')
        await asSuperuser(db); await db.query("UPDATE auth.sessions SET aal='aal2' WHERE id=$1", [session])
        await assertPreserved(owner)
    })
    it('a formal record committed while deletion waits on the org lock is preserved', async () => {
        const owner = await seedOwnerOrg(db, { tier: null }), params = db.connectionParameters
        expect((await preflight(owner)).allowed).toBe(true)
        const writer = connect({ host: params.host, port: params.port, database: params.database }); await writer.connect()
        try {
            await writer.query('BEGIN'); await writer.query('SELECT id FROM public.organizations WHERE id=$1 FOR UPDATE', [owner.orgId])
            await asUser(db, owner.userId, owner.orgId)
            const deleting = pgError(db.query("SELECT public.delete_account_permanently('Test Weaving Works','DELETE MY ACCOUNT')"))
            await writer.query("INSERT INTO public.grievances(org_id,subject,status)VALUES($1,'Concurrent retained case','pending')", [owner.orgId])
            await writer.query('COMMIT')
            expect((await deleting).code).toBe('55000')
            expect((await writer.query('SELECT id FROM public.grievances WHERE org_id=$1', [owner.orgId])).rowCount).toBe(1)
        } finally { await writer.query('ROLLBACK'); await writer.end() }
    })
    it('later formal/retention tables may be absent without weakening mandatory evidence checks', async () => {
        const older = await freshDatabase()
        try {
            await older.query('DROP TABLE private.admin_retention_holds,private.admin_retention_policies,private.admin_formal_request_results,private.admin_formal_revisions,private.admin_formal_events,private.admin_formal_notes,private.admin_formal_cases CASCADE')
            const owner = await seedOwnerOrg(older, { tier: 'base' })
            await asServiceRole(older)
            expect((await older.query('SELECT public.admin_account_deletion_preflight($1,$2) AS r', [owner.userId, owner.orgId])).rows[0].r).toEqual({ allowed: true, reason: 'ready' })
            await asSuperuser(older)
            await older.query("INSERT INTO public.grievances(org_id,subject,status)VALUES($1,'Synthetic earlier-schema case','resolved')", [owner.orgId])
            await asServiceRole(older)
            expect((await older.query('SELECT public.admin_account_deletion_preflight($1,$2) AS r', [owner.userId, owner.orgId])).rows[0].r).toEqual({ allowed: false, reason: 'review_required' })
        } finally { await older.end() }
    })
})
