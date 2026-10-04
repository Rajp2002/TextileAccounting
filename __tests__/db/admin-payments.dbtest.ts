import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'
import { intervalCovered } from '@/lib/admin/payments-domain'

let db: Db, founder: string, session: string, org: { userId: string; orgId: string }
const from = '2026-09-01T00:00:00Z', to = '2026-10-01T00:00:00Z'
async function report(actor = founder, sid = session, limit = 25) {
    return (await db.query('SELECT public.admin_billing_report_input($1,$2,$3,$4,\'INR\',$5,NULL,NULL) AS result', [actor, sid, from, to, limit])).rows[0].result
}
async function insertFact(kind: string, object: string, amount: string, sourceType = 'synthetic_provider_evidence', sourceId = object, orgId = org.orgId) {
    return db.query(`INSERT INTO private.admin_billing_facts(kind,provider,provider_account_id,provider_object_id,source_record_type,source_record_id,org_id,currency,amount_minor,occurred_at,time_basis,mode,verification_state,verified_at,evidence_ref)
      VALUES($1,'razorpay','synthetic',$2,$3,$4,$5,'INR',$6,'2026-09-15T00:00:00Z','provider_verified','live','verified',now(),'Synthetic isolated evidence') RETURNING id`, [kind, object, sourceType, sourceId, orgId, amount])
}
beforeAll(async () => {
    db = await freshDatabase(); org = await seedOwnerOrg(db, { tier: null })
    await asSuperuser(db); founder = randomUUID(); session = randomUUID()
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,'synthetic-report-founder@example.test')", [founder])
    await db.query("INSERT INTO public.profiles(id,role,org_id,full_name) VALUES($1,'admin',NULL,'Synthetic Founder')", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason) VALUES($1,true,'Disposable report fixture')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session, founder])
    await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'production','Isolated synthetic cohort')", [org.orgId])
    await asServiceRole(db)
    await db.query("SELECT public.admin_founder_session($1,$2,'establish')", [founder, session])
})
afterAll(async () => { await db?.end() })

describe('AD07 real database reporting boundary', () => {
    it('denies customer/generic admin RPC access and direct private table access', async () => {
        await asUser(db, org.userId, org.orgId)
        await expect(report()).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT * FROM private.admin_billing_facts')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT public.admin_audit_list($1,$2,25,NULL,NULL)', [founder, session])).rejects.toMatchObject({ code: '42501' })
        await asServiceRole(db)
        await expect(report(org.userId, randomUUID())).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT * FROM private.admin_billing_facts')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query("INSERT INTO private.admin_billing_coverage DEFAULT VALUES")).rejects.toMatchObject({ code: '42501' })
    })
    it('preserves each capture and partial refund identity, exact integer sums and unknown coverage', async () => {
        await asSuperuser(db)
        await insertFact('capture', 'capture-lite', '299900'); await insertFact('capture', 'capture-base', '999900')
        await insertFact('refund', 'partial1', '60000'); await insertFact('refund', 'partial2', '40000')
        await expect(insertFact('capture', 'capture-lite', '299900')).rejects.toMatchObject({ code: '23505' })
        await asServiceRole(db)
        const result = await report()
        expect(result.summary).toMatchObject({ knownGrossMinor: '1299800', knownRefundMinor: '100000', captureCount: 2, refundCount: 2 })
        expect(result.coverage).toEqual([])
        expect(result.ledger).toHaveLength(4)
    })
    it('source amount/org/provider conflicts cannot contribute to confirmed collections or tax', async () => {
        await asSuperuser(db)
        const payment = randomUUID()
        await db.query("INSERT INTO public.subscription_payments(id,org_id,razorpay_payment_id,amount_paise,status,captured_at) VALUES($1,$2,'capture-conflict',999900,'captured','2026-09-15T00:00:00Z')", [payment, org.orgId])
        await insertFact('capture', 'capture-conflict', '299900', 'subscription_payments', payment)
        await db.query("UPDATE private.admin_billing_facts SET tax_minor=1000 WHERE provider_object_id='capture-conflict'")
        await db.query("INSERT INTO private.admin_billing_coverage(provider,provider_account_id,mode,currency,period_start,period_end,capture_state,refund_state,checked_at,evidence_ref) VALUES('razorpay','synthetic','live','INR',$1,$2,'complete','complete',now(),'Synthetic independent feed')", [from, to])
        await asServiceRole(db)
        const result = await report()
        expect(result.summary).toMatchObject({ knownGrossMinor: '1299800', unverifiedMinor: '299900', unverifiedCount: 1, taxExclusiveKnownMinor: '0' })
        expect(result.diagnostics.sourceConflicts).toBe(1)
        expect(result.exceptions.some((e: { reasonCode: string }) => e.reasonCode === 'capture_source_conflict')).toBe(true)
        // Fix amount but corrupt org: it remains excluded, without changing the economic source.
        await asSuperuser(db)
        const other = await seedOwnerOrg(db, { tier: null })
        await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'production','Synthetic second cohort')", [other.orgId])
        await db.query("UPDATE private.admin_billing_facts SET amount_minor=999900,org_id=$1 WHERE provider_object_id='capture-conflict'", [other.orgId])
        await asServiceRole(db)
        expect((await report()).summary).toMatchObject({ knownGrossMinor: '1299800', unverifiedMinor: '999900' })
    })
    it('retains conflicting overlapping reconciliation coverage and refuses complete claims', async () => {
        await asSuperuser(db)
        await db.query("INSERT INTO private.admin_billing_coverage(provider,provider_account_id,mode,currency,period_start,period_end,capture_state,refund_state,checked_at,evidence_ref,conflicts_count) VALUES('razorpay','synthetic','live','INR',$1,$2,'partial','partial',now(),'Synthetic contradictory reconciliation',1)", [from, to])
        await asServiceRole(db)
        const result = await report()
        expect(result.coverage.some((row: { captureState: string }) => row.captureState === 'complete')).toBe(true)
        expect(result.coverage.some((row: { conflictsCount: number }) => row.conflictsCount === 1)).toBe(true)
        expect(intervalCovered(result.coverage, from, to, 'capture')).toBe(false)
        expect(intervalCovered(result.coverage, from, to, 'refund')).toBe(false)
    })
    it('enforces bounded query arguments and stable ledger tie pagination', async () => {
        await asServiceRole(db)
        await expect(report(founder, session, 101)).rejects.toMatchObject({ code: '22023' })
        const first = await report(founder, session, 2)
        expect(first.ledger.length).toBe(3)
        const last = first.ledger[1]
        const second = (await db.query('SELECT public.admin_billing_report_input($1,$2,$3,$4,\'INR\',2,$5,$6) AS result', [founder, session, from, to, last.recordedAt, last.id])).rows[0].result
        expect(second.ledger.every((item: { id: string }) => item.id !== first.ledger[0].id && item.id !== first.ledger[1].id)).toBe(true)
    })
    it('verified facts need explicit provider time, mode and evidence; audit rows remain immutable to users', async () => {
        await asSuperuser(db)
        await expect(db.query("INSERT INTO private.admin_billing_facts(kind,provider,provider_account_id,provider_object_id,source_record_type,source_record_id,currency,amount_minor,time_basis,mode,verification_state) VALUES('refund','razorpay','synthetic','bad','fixture','bad','INR',1,'unknown','unknown','verified')")).rejects.toMatchObject({ code: '23514' })
        await asServiceRole(db)
        await db.query("SELECT public.admin_record_audit($1,$2,'payments.read','billing_report','INR','success',$3,NULL,NULL,'{\"count\":1}'::jsonb)", [founder, session, randomUUID()])
        const result = (await db.query('SELECT public.admin_audit_list($1,$2,25,NULL,NULL) AS result', [founder, session])).rows[0].result
        expect(result[0]).toMatchObject({ action: 'payments.read', after_safe: { count: 1 } })
        await expect(db.query('DELETE FROM private.admin_audit_events')).rejects.toMatchObject({ code: '42501' })
    })
})
