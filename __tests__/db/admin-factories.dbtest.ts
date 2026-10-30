import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'
import { factoryFiltersSchema, summarizeFactories, toFactoryRow, type FactorySource } from '@/lib/admin/metrics'
import { paginateFactories } from '@/lib/admin/factory-pagination'

let db: Db, founder: string, session: string
let owner: { userId: string; orgId: string }, secondOrg: string
async function read(orgId: string | null = null, search = '') {
    const asOf = new Date().toISOString()
    const { rows } = await db.query('SELECT public.admin_factory_snapshot($1,$2,$3,$4,$5) AS value', [founder, session, asOf, orgId, search])
    return { ...rows[0].value, asOf } as { rows: FactorySource[]; asOf: string }
}
beforeAll(async () => {
    db = await freshDatabase()
    owner = await seedOwnerOrg(db, { tier: null, name: 'Synthetic%Factory' })
    founder = randomUUID(); session = randomUUID()
    await asSuperuser(db)
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'founder-fixture@example.test',now())", [founder])
    await db.query("INSERT INTO public.profiles(id,role) VALUES($1,'admin')", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email) VALUES($1,true,'Synthetic isolated DB fixture','founder-fixture@example.test')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session, founder])
    const created = await db.query("INSERT INTO public.organizations(name,owner_id,created_at) SELECT 'Synthetic Factory '||g,$1,now()-interval '1 hour' FROM generate_series(1,999) g RETURNING id", [owner.userId])
    secondOrg = created.rows[0].id
    await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) SELECT id,'production','Explicit synthetic fixture classification' FROM public.organizations")
    await db.query("INSERT INTO public.free_account_subjects(id,verified_at,beta_allowed) VALUES($1,now(),true)", [owner.userId])
    await db.query('INSERT INTO public.free_account_grants(org_id,subject_id) VALUES($1,$3),($2,$3)', [owner.orgId, secondOrg, owner.userId])
    await db.query("INSERT INTO public.free_funnel_events(subject_id,event_id,event_name) VALUES($1,$2,'calculation_completed')", [owner.userId, randomUUID()])
    await asServiceRole(db)
    expect((await db.query("SELECT public.admin_founder_session($1,$2,'establish') value", [founder, session])).rows[0].value).toEqual({ allowed: true })
})
afterAll(async () => { await db?.end() })
describe('AD03/04 real DB guarded read models and synthetic scale', () => {
    it('counts organization keys once; missing classification counts as production', async () => {
        const snapshot = await read()
        const summary = summarizeFactories(snapshot.rows, snapshot.asOf)
        expect(summary.totalProductionFactories).toBe(1000)
        expect(summary.effectivePlans).toEqual({ none: 998, free: 2, lite: 0, base: 0, unknown: 0 })
        await asSuperuser(db)
        await db.query('DELETE FROM private.admin_org_reporting WHERE org_id=$1', [secondOrg])
        await asServiceRole(db)
        const unclassified = await read(secondOrg)
        expect(unclassified.rows[0].cohort).toBe('production')
        await asSuperuser(db)
        await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'production','Synthetic restore fixture')", [secondOrg])
        await asServiceRole(db)
    })
    it('never fans a Free subject funnel event into two factory milestones; original persisted attribution is one factory', async () => {
        const initial = await read()
        expect(initial.rows.filter(row => row.has_free_grant).every(row => !row.estimator_at && !row.last_outcome_at)).toBe(true)
        await asSuperuser(db)
        const saved = randomUUID()
        await db.query("INSERT INTO public.free_saved_costings(id,subject_id,org_id,label,estimate,result,totals,created_at) VALUES($1,$2,$3,'Synthetic original','{}','{}','{}',now()-interval '30 minutes')", [saved, owner.userId, owner.orgId])
        const createdAt = (await db.query('SELECT created_at FROM public.free_saved_costings WHERE id=$1', [saved])).rows[0].created_at
        await db.query("UPDATE public.free_saved_costings SET result='{\"syntheticRevision\":true}',revision=revision+1 WHERE id=$1", [saved])
        expect((await db.query('SELECT created_at FROM public.free_saved_costings WHERE id=$1', [saved])).rows[0].created_at).toEqual(createdAt)
        await asServiceRole(db)
        const result = await read()
        expect(result.rows.find(row => row.id === owner.orgId)?.estimator_at).toBeTruthy()
        expect(result.rows.find(row => row.id === secondOrg)?.estimator_at).toBeNull()
        expect(summarizeFactories(result.rows, result.asOf).observedActiveFactories.value).toBe(1)
        const quota = (await db.query('SELECT public.admin_factory_account_quota($1,$2,$3,$4) value', [founder, session, secondOrg, result.asOf])).rows[0].value
        expect(quota).toMatchObject({ scope: 'owner_account', sharedFactoryGrants: 2, allowance: 2, used: 0, recalculationWindowMinutes: 30, reportingZone: 'Asia/Kolkata' })
        const localParts = (value: string) => Object.fromEntries(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(part => [part.type, part.value]))
        const start = localParts(quota.periodStart), end = localParts(quota.resetsAt)
        expect(start).toMatchObject({ day: '1', hour: '00', minute: '00' })
        expect(end).toMatchObject({ day: '1', hour: '00', minute: '00' })
        expect(Number(end.month)).toBe(Number(start.month) % 12 + 1)
    })
    it('literal substring search and equal-timestamp pagination agree with SQL fixture counts', async () => {
        expect((await read(null, '%')).rows.map(row => row.id)).toEqual([owner.orgId])
        const result = await read(null, 'Synthetic Factory ')
        expect(result.rows).toHaveLength(999)
        const rows = result.rows.map(row => toFactoryRow(row, result.asOf))
        const filters = factoryFiltersSchema.parse({ limit: 100 })
        const first = paginateFactories(rows, filters, result.asOf)
        const second = paginateFactories(rows, { ...filters, cursor: first.nextCursor! }, result.asOf)
        expect(first.totalMatching).toBe(999)
        expect(first.items.map(row => row.id).filter(id => second.items.some(row => row.id === id))).toEqual([])
        expect(first.items.map(row => row.id)).toEqual([...rows.map(row => row.id)].sort().slice(0,100))
    })
    it('contact search uses authoritative confirmed Auth email and returns no unverified contact', async () => {
        await asSuperuser(db)
        await db.query("UPDATE auth.users SET email='synthetic-verified-contact@example.test',raw_user_meta_data='{\"email_confirmed_at\":\"2020-01-01\"}' WHERE id=$1", [owner.userId])
        await asServiceRole(db)
        expect((await read(owner.orgId)).rows[0].verified_email).toBeNull()
        expect((await read(null, 'synthetic-verified-contact@example.test')).rows).toHaveLength(0)
        await asSuperuser(db)
        await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [owner.userId])
        await asServiceRole(db)
        expect((await read(owner.orgId)).rows[0].verified_email).toBe('synthetic-verified-contact@example.test')
        expect((await read(null, 'synthetic-verified-contact@example.test')).rows).toHaveLength(1000)
    })
    it('unknown/test local captures never inflate paid terms; only matching verified live facts do', async () => {
        await asSuperuser(db)
        const paymentId = randomUUID(), reference = `pay_synthetic_${randomUUID()}`
        await db.query("INSERT INTO public.subscription_payments(id,org_id,razorpay_payment_id,amount_paise,status,captured_at) VALUES($1,$2,$3,299900,'captured',now()-interval '1 day')", [paymentId, secondOrg, reference])
        await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status,current_start,current_end,razorpay_payment_id) VALUES($1,'lite','active',now()-interval '1 day',now()+interval '30 days',$2)", [secondOrg, reference])
        await asServiceRole(db)
        let result = await read(secondOrg)
        expect(toFactoryRow(result.rows[0], result.asOf).access).toMatchObject({ effectivePlan: 'lite', currentPaidTerm: null })
        await asSuperuser(db)
        await db.query("INSERT INTO private.admin_billing_facts(kind,provider,provider_account_id,provider_object_id,source_record_type,source_record_id,org_id,payment_reference,currency,amount_minor,occurred_at,time_basis,mode,verification_state,verified_at,evidence_ref,plan_at_sale) VALUES('capture','razorpay','synthetic_account',$1,'subscription_payments',$2,$3,$1,'INR',299900,now()-interval '1 day','provider_verified','test','verified',now(),'fixture:test-provider-evidence','lite')", [reference, paymentId, secondOrg])
        await asServiceRole(db)
        result = await read(secondOrg)
        expect(toFactoryRow(result.rows[0], result.asOf).access.currentPaidTerm).toBeNull()
        await asSuperuser(db)
        await db.query("UPDATE private.admin_billing_facts SET mode='live',amount_minor=199900 WHERE provider_object_id=$1", [reference])
        await asServiceRole(db)
        result = await read(secondOrg)
        expect(toFactoryRow(result.rows[0], result.asOf).access.currentPaidTerm).toBeNull()
        await asSuperuser(db)
        await db.query('UPDATE private.admin_billing_facts SET amount_minor=299900 WHERE provider_object_id=$1', [reference])
        // An older capture is not undone by a later local status label.
        await db.query("UPDATE public.subscription_payments SET status='failed' WHERE id=$1", [paymentId])
        await asServiceRole(db)
        result = await read(secondOrg)
        expect(toFactoryRow(result.rows[0], result.asOf).access.currentPaidTerm).toMatchObject({ tier: 'lite', paymentReference: reference })
        expect(summarizeFactories(result.rows,result.asOf).currentPaidTerms.lite).toBe(1)
    })
    it('direct API roles, generic owner and missing/expired sessions cannot call reporting functions or classify factories', async () => {
        await asUser(db, owner.userId, owner.orgId)
        await expect(read()).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT * FROM private.admin_org_reporting')).rejects.toMatchObject({ code: '42501' })
        await asServiceRole(db)
        await expect(db.query('SELECT public.admin_factory_snapshot($1,$2,now())', [owner.userId, session])).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('SELECT public.admin_factory_snapshot($1,$2,now())', [founder, randomUUID()])).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('UPDATE private.admin_org_reporting SET cohort=$1', ['test'])).rejects.toMatchObject({ code: '42501' })
    })
    it('dates zero-to-positive corrections from immutable successful receipts, preserving milestones through retry and later zero', async () => {
        await asSuperuser(db)
        const ids = { costing: randomUUID(), job: randomUUID(), machine: randomUUID(), worker: randomUUID(), zeroRequest: randomUUID(), positiveRequest: randomUUID() }
        const { rows: [dates] } = await db.query("SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date-10)::text AS production_date, ((now() AT TIME ZONE 'Asia/Kolkata')::date-20)::text AS setup_date")
        await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status,current_start,current_end) VALUES($1,'base','active',now()-interval '20 days',now()+interval '30 days')", [owner.orgId])
        await db.query(`INSERT INTO public.estimator_quotes(id,org_id,record_kind,quality_label,yarn_denier,meters,yarn_rate_per_kg,landed_cost_per_meter,quote_price_per_meter,intended_margin_percent,worker_rate_per_m,created_at)
            VALUES($1,$2,'costing','Synthetic receipt setup',100,1000,100,20,40,50,1,now()-interval '20 days')`, [ids.costing,owner.orgId])
        await db.query("INSERT INTO public.base_production_jobs(id,org_id,costing_id,quality_label,target_meters,start_date,status,worker_rate_per_meter) VALUES($1,$2,$3,'Synthetic receipt setup',10000,$4,'active',1)", [ids.job,owner.orgId,ids.costing,dates.setup_date])
        await db.query("INSERT INTO public.base_production_machines(id,org_id,name,machine_type) VALUES($1,$2,'Synthetic receipt machine','air_jet')", [ids.machine,owner.orgId])
        await db.query('INSERT INTO public.base_machine_job_contexts(org_id,machine_id,job_id,effective_from) VALUES($1,$2,$3,$4)', [owner.orgId,ids.machine,ids.job,dates.setup_date])
        await db.query("INSERT INTO public.base_production_workers(id,org_id,name,rate_per_meter,shift_availability) VALUES($1,$2,'Synthetic receipt worker',1,'day')", [ids.worker,owner.orgId])
        await asUser(db,owner.userId,owner.orgId)
        await db.query("SELECT public.upsert_base_worker_machine_assignment($1,$2,'day',$3,false)", [ids.worker,ids.machine,dates.setup_date])
        const zero = JSON.stringify([{worker_id:ids.worker,entry_status:'zero',meters:0,allocations:[]}])
        const positive = JSON.stringify([{worker_id:ids.worker,entry_status:'entered',meters:100,allocations:[{machine_id:ids.machine,job_id:ids.job,meters:100}]}])
        const saved = (await db.query("SELECT public.save_base_daily_production_reviewed($1,'day',$2,$3,NULL,NULL) value", [dates.production_date,ids.zeroRequest,zero])).rows[0].value
        expect(saved).toMatchObject({success:true,total_meters:0,idempotent:false})
        await asSuperuser(db)
        // Only fixture metadata moves the first successful zero sheet into the
        // past; the real owner writer performs both saves and creates receipts.
        await db.query("UPDATE public.base_production_batches SET created_at=now()-interval '10 days' WHERE id=$1", [saved.batch_id])
        await db.query("UPDATE public.base_production_save_receipts SET created_at=now()-interval '10 days' WHERE org_id=$1 AND client_request_id=$2", [owner.orgId,ids.zeroRequest])
        const expected = (await db.query('SELECT updated_at FROM public.base_production_batches WHERE id=$1',[saved.batch_id])).rows[0].updated_at
        await asServiceRole(db)
        expect((await read(owner.orgId)).rows[0].production_at).toBeNull()
        await asUser(db,owner.userId,owner.orgId)
        const correction = (await db.query("SELECT public.save_base_daily_production_reviewed($1,'day',$2,$3,'Synthetic zero-to-positive correction',$4) value", [dates.production_date,ids.positiveRequest,positive,expected])).rows[0].value
        expect(correction).toMatchObject({success:true,total_meters:100,idempotent:false})
        await asSuperuser(db)
        const positiveAt = (await db.query('SELECT created_at FROM public.base_production_save_receipts WHERE org_id=$1 AND client_request_id=$2',[owner.orgId,ids.positiveRequest])).rows[0].created_at
        await asServiceRole(db)
        let observed = (await read(owner.orgId)).rows[0]
        expect(Date.parse(observed.production_at!)).toBe(Date.parse(positiveAt))
        expect(Date.parse(observed.last_outcome_at!)).toBe(Date.parse(positiveAt))
        // The same successful receipt is returned despite the stale original
        // revision, with no new write timestamp or activity from the retry.
        await asUser(db,owner.userId,owner.orgId)
        expect((await db.query("SELECT public.save_base_daily_production_reviewed($1,'day',$2,$3,'Synthetic zero-to-positive correction',$4) value", [dates.production_date,ids.positiveRequest,positive,expected])).rows[0].value).toMatchObject({idempotent:true})
        await asSuperuser(db)
        expect((await db.query('SELECT count(*)::int AS count FROM public.base_production_save_receipts WHERE org_id=$1',[owner.orgId])).rows[0].count).toBe(2)
        const nextExpected = (await db.query('SELECT updated_at FROM public.base_production_batches WHERE id=$1',[saved.batch_id])).rows[0].updated_at
        await asUser(db,owner.userId,owner.orgId)
        await db.query("SELECT public.save_base_daily_production_reviewed($1,'day',$2,$3,'Synthetic later zero correction',$4)", [dates.production_date,randomUUID(),zero,nextExpected])
        await asServiceRole(db)
        observed = (await read(owner.orgId)).rows[0]
        expect(Date.parse(observed.production_at!)).toBe(Date.parse(positiveAt))
        expect(Date.parse(observed.last_outcome_at!)).toBe(Date.parse(positiveAt))
    })
    it('records staging p95 for 1,000 organization reads under a 2-second aggregate budget', async () => {
        const durations: number[] = []
        for (let attempt = 0; attempt < 10; attempt++) {
            const start = performance.now()
            const result = await read()
            expect(result.rows).toHaveLength(1000)
            durations.push(performance.now() - start)
        }
        durations.sort((a,b) => a-b)
        const p95 = durations[Math.ceil(durations.length * .95)-1]
        console.log(JSON.stringify({ fixture: '1000 synthetic organizations', operation: 'admin_factory_snapshot aggregate', samples: durations.length, p95Ms: Math.round(p95), budgetMs: 2000, environment: 'disposable loopback PostgreSQL; no production performance claim' }))
        expect(p95).toBeLessThan(2000)
    })
    it('tags each subscription row with is_trial so a Lite trial is never read as paid history', async () => {
        await asSuperuser(db)
        const trialId = randomUUID(), paidId = randomUUID()
        // Added to the owner org (which already holds a Free grant), so the org counts above are unchanged.
        // created_at is set in the past: read() stamps as_of in JS milliseconds, so a row created by now()
        // in the same millisecond would fall after as_of and be left out of the snapshot.
        await db.query("INSERT INTO public.org_subscriptions(id,org_id,plan_tier,status,current_start,current_end,is_trial,created_at) VALUES($1,$2,'lite','active',now(),now()+interval '30 days',true,now()-interval '1 minute')", [trialId, owner.orgId])
        await db.query("INSERT INTO public.org_subscriptions(id,org_id,plan_tier,status,current_start,current_end,created_at) VALUES($1,$2,'lite','active',now()-interval '1 day',now()+interval '30 days',now()-interval '1 minute')", [paidId, owner.orgId])
        await asServiceRole(db)
        const [factory] = (await read(owner.orgId)).rows
        expect(factory.has_free_grant).toBe(true)
        const terms = factory.subscriptions ?? []
        expect(terms.find(term => term.id === trialId)).toMatchObject({ is_trial: true, plan_tier: 'lite', razorpay_payment_id: null, payment_evidenced: false })
        expect(terms.find(term => term.id === paidId)).toMatchObject({ is_trial: false, plan_tier: 'lite' })
    })
})
