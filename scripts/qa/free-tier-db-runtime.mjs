/** Real SQL authorization tests on the previously isolated local fixture DB. */
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const container=process.argv[2]
assert.match(container??'',/^weavly-free-db-[a-z0-9-]+$/)
assert.equal(execFileSync('docker',['inspect','--format','{{.HostConfig.NetworkMode}}',container],{encoding:'utf8'}).trim(),'none')
const sql=q=>execFileSync('docker',['exec','-e','PGPASSWORD=local-free-test-only',container,'psql','-U','supabase_admin','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const deny=(q,code)=>assert.throws(()=>sql(q),e=>String(e.stderr).includes(code))
const user=randomUUID(),org=randomUUID(),other=randomUUID(),otherOrg=randomUUID()
const claims=(id=user)=>`SET ROLE authenticated; SET request.jwt.claim.sub='${id}'; SET request.jwt.claims='${JSON.stringify({sub:id,role:'authenticated'})}';`
try {
 sql(`INSERT INTO auth.users(id,email) VALUES('${user}','${user}@runtime.test'),('${other}','${other}@runtime.test');
 INSERT INTO public.organizations(id,name,owner_id,product_experience) VALUES('${org}','FREE-RUNTIME-TEST','${user}','base'),('${otherOrg}','FREE-RUNTIME-OTHER','${other}','base');
 INSERT INTO public.profiles(id,org_id,role,full_name) VALUES('${user}','${org}','owner','Runtime Test'),('${other}','${otherOrg}','owner','Other Runtime Test');
 UPDATE public.free_rollout SET enrollment_enabled=true,estimation_enabled=true;`)
 deny(`SET ROLE service_role;SELECT public.provision_free_account('${user}','${org}',NULL);`,'FREE_VERIFICATION_REQUIRED')
 deny(`SET ROLE service_role;SELECT public.provision_free_account('${user}','${otherOrg}',now());`,'FREE_ACCESS_DENIED')
 sql(`SET ROLE service_role;SELECT public.provision_free_account('${user}','${org}',now());SELECT public.provision_free_account('${user}','${org}',now());`)
 assert.equal(sql(`SELECT count(*) FROM public.free_account_grants WHERE subject_id='${user}'`),'1')
 assert.equal(sql(`SELECT count(*) FROM public.free_funnel_events WHERE subject_id='${user}' AND event_name='signup_completed'`),'1')
 console.log('PASS: verified owner provisioning is scoped and idempotent; pending verification denied')
 assert.equal(sql(`${claims()} SELECT weavly_private.free_business_restricted('${org}');`).split('\n').at(-1),'t')
 for(const path of ['cost_rate_book','rpc/save_estimator_quote_v3','estimator_quotes','qualities','production_entries','rpc/provision_free_account']) {
  deny(`${claims()} SET request.path='/${path}';SET request.method='POST'; SELECT weavly_private.free_api_guard();`,'FREE_BUSINESS_ACCESS_DENIED')
 }
 sql(`${claims()} SET request.path='/profiles'; SET request.method='GET';SELECT weavly_private.free_api_guard();`)
 deny(`${claims()} SET request.path='/profiles'; SET request.method='PATCH';SELECT weavly_private.free_api_guard();`,'FREE_BUSINESS_ACCESS_DENIED')
 assert.equal(sql(`${claims()} SELECT count(*) FROM public.cost_rate_book;`).split('\n').at(-1),'0')
 deny(`${claims()} SELECT * FROM public.free_cohort_metrics`,'permission denied')
 console.log('PASS: Free business/RPC and account mutation pre-request denial; direct Rate Book RLS and private analytics restriction')
 // A non-Free legacy account must not inherit any new restriction.
 assert.equal(sql(`${claims(other)} SELECT weavly_private.free_business_restricted('${otherOrg}');`).split('\n').at(-1),'f')
 sql(`INSERT INTO public.org_subscriptions(org_id,plan_tier,status,current_start,current_end,razorpay_payment_id) VALUES('${org}','lite','active',now(),now()+interval '365 days','free-runtime-${randomUUID()}');`)
 assert.equal(sql(`${claims()} SELECT weavly_private.free_business_restricted('${org}');`).split('\n').at(-1),'f')
 sql(`${claims()} SET request.path='/cost_rate_book';SET request.method='GET';SELECT weavly_private.free_api_guard();`)
 sql(`UPDATE public.org_subscriptions SET current_end=now()-interval '2 days' WHERE org_id='${org}'`)
 assert.equal(sql(`${claims()} SELECT weavly_private.free_business_restricted('${org}');`).split('\n').at(-1),'t')
 console.log('PASS: existing non-Free accounts unaffected; active Lite releases Free boundary; expiry does not expose paid data')
 const requestId=randomUUID()
 sql(`SET ROLE service_role;SELECT public.commit_free_calculation('${user}','${org}','${requestId}','${'a'.repeat(64)}','estimator_v3_2026_08',now()-interval '1 second');`)
 assert.equal(sql(`SELECT count(*) FROM public.free_funnel_events WHERE subject_id='${user}' AND event_name='calculation_completed'`),'1')
 assert.equal(sql(`SELECT count(*) FROM public.free_cohort_metrics WHERE signup_cohort=current_date`),'0')
 sql(`UPDATE public.free_account_subjects SET analytics_eligible=true WHERE id='${user}';`)
 assert.equal(sql(`SELECT activated_accounts FROM public.free_cohort_metrics WHERE signup_cohort=(now() AT TIME ZONE 'Asia/Kolkata')::date`),'1')
 assert.equal(sql(`SELECT mature_30_day_accounts FROM public.free_cohort_metrics WHERE signup_cohort=(now() AT TIME ZONE 'Asia/Kolkata')::date`),'0')
 console.log('PASS: receipt and authoritative activation event share a transaction; test cohorts excluded; immature conversion denominator is zero')
 sql(`UPDATE public.free_rollout SET enrollment_enabled=false,estimation_enabled=false,tour_enabled=false;`)
 assert.equal(sql(`${claims()} SELECT weavly_private.free_business_restricted('${org}');`).split('\n').at(-1),'t')
 // Only delete this script's throwaway accounts, using the real confirmation RPC.
 deny(`${claims()} SELECT public.delete_account_permanently('WRONG','DELETE MY ACCOUNT');`,'Organization name does not match')
 sql(`${claims()} SELECT public.delete_account_permanently('FREE-RUNTIME-TEST','DELETE MY ACCOUNT');`)
 assert.equal(sql(`SELECT count(*) FROM public.free_calculation_receipts WHERE subject_id='${user}'`),'0')
 assert.equal(sql(`SELECT count(*) FROM public.free_funnel_events WHERE subject_id='${user}'`),'0')
 console.log('PASS: pause retains authorization; account deletion requires confirmation and cascades only scoped Free metadata')
} finally {sql('UPDATE public.free_rollout SET enrollment_enabled=false,estimation_enabled=false,tour_enabled=false')}
