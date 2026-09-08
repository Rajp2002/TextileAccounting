/** Real SQL tests. Runs only against a network-disabled disposable Docker DB. */
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const exec = promisify(execFile)
const container = process.argv[2]
if (!/^weavly-free-db-[a-z0-9-]+$/.test(container ?? '')) throw new Error('Provide a scoped weavly-free-db-* test container')
const network = execFileSync('docker', ['inspect', '--format', '{{.HostConfig.NetworkMode}}', container], { encoding: 'utf8' }).trim()
assert.equal(network, 'none', 'Refusing a database with network access')
const args = ['exec', '-e', 'PGPASSWORD=local-free-test-only', container, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c']
const sql = async (query) => (await exec('docker', [...args, query], { maxBuffer: 1024 * 1024 })).stdout.trim()
const denied = async (query, code) => {
  await assert.rejects(sql(query), (error) => String(error.stderr).includes(code))
}
const subject = randomUUID(), org = randomUUID(), otherUser = randomUUID(), otherOrg = randomUUID()
const issued = new Date(Date.now() - 1000).toISOString()
const request = (id, binding = 'a'.repeat(64), user = subject, organization = org, issuance = issued) =>
  `SET ROLE service_role; SELECT public.commit_free_calculation('${user}','${organization}','${id}','${binding}','estimator_v3_2026_08','${issuance}');`
const result = async (...args) => JSON.parse((await sql(request(...args))).split('\n').at(-1))
await sql('UPDATE public.free_rollout SET estimation_enabled=false; UPDATE public.free_quota_policies SET weekly_limit=2 WHERE version=1')
await sql(`
INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
VALUES ('${subject}','${subject}@free.test','{}','{}'), ('${otherUser}','${otherUser}@free.test','{}','{}');
INSERT INTO public.organizations(id,name,owner_id,product_experience,onboarding_complete)
VALUES ('${org}','FREE-FOUNDATION-TEST','${subject}','base',true), ('${otherOrg}','FREE-FOUNDATION-OTHER','${otherUser}','base',true);
INSERT INTO public.profiles(id,org_id,role,full_name)
VALUES ('${subject}','${org}','owner','Free Test'), ('${otherUser}','${otherOrg}','owner','Other Test');
INSERT INTO public.free_account_subjects(id,beta_allowed,verified_at) VALUES ('${subject}',true,now()), ('${otherUser}',true,now());
INSERT INTO public.free_account_grants(org_id,subject_id) VALUES ('${org}','${subject}'), ('${otherOrg}','${otherUser}');
`)
await denied(request(randomUUID()), 'FREE_PAUSED')
await sql('UPDATE public.free_rollout SET estimation_enabled = true WHERE singleton')
for (const role of ['anon', 'authenticated']) {
  await denied(`SET ROLE ${role}; SELECT * FROM public.free_calculation_receipts`, 'permission denied')
  await denied(`SET ROLE ${role}; SELECT public.commit_free_calculation('${subject}','${org}','${randomUUID()}','${'a'.repeat(64)}','v1','${issued}')`, 'permission denied')
}
console.log('PASS: flags disabled and client roles denied table/RPC access')
await denied(request(randomUUID(), 'a'.repeat(64), subject, otherOrg), 'FREE_ACCESS_DENIED')
const firstId = randomUUID()
const first = await result(firstId)
assert.equal(first.used, 1)
assert.equal(first.remaining, 1)
assert.equal((await result(firstId)).used, 1)
await denied(request(firstId, 'b'.repeat(64)), 'FREE_REQUEST_CONFLICT')
await denied(request(firstId, 'a'.repeat(64), otherUser, otherOrg), 'FREE_REQUEST_CONFLICT')
console.log('PASS: first debit, same-request replay, changed-input and wrong-account conflicts')
const raced = await Promise.allSettled(Array.from({ length: 20 }, () => result(randomUUID())))
assert.equal(raced.filter((r) => r.status === 'fulfilled').length, 1)
assert(raced.filter((r) => r.status === 'rejected').every((r) => String(r.reason.stderr).includes('FREE_QUOTA_EXHAUSTED')))
assert.equal(Number(await sql(`SELECT used FROM public.free_weekly_usage WHERE subject_id='${subject}'`)), 2)
assert.equal(Number(await sql(`SELECT count(*) FROM public.free_calculation_receipts WHERE subject_id='${subject}'`)), 2)
assert.equal((await result(firstId)).used, 2)
console.log('PASS: 20 simultaneous requests with one remaining permit exactly one success; retry at exhaustion still succeeds')
// The second account has no initial usage row. Many same-id requests must count once.
const otherId = randomUUID()
const duplicateRace = await Promise.all(Array.from({ length: 10 }, () => result(otherId, 'a'.repeat(64), otherUser, otherOrg)))
assert(duplicateRace.every((r) => r.used === 1))
assert.equal(Number(await sql(`SELECT count(*) FROM public.free_calculation_receipts WHERE subject_id='${otherUser}'`)), 1)
console.log('PASS: first-row creation and double-click races debit once')
await sql(`UPDATE public.free_account_subjects SET verified_at=NULL WHERE id='${otherUser}'`)
await denied(request(randomUUID(), 'a'.repeat(64), otherUser, otherOrg), 'FREE_ACCESS_DENIED')
await sql(`UPDATE public.free_account_subjects SET verified_at=now(), active=false WHERE id='${otherUser}'`)
await denied(request(randomUUID(), 'a'.repeat(64), otherUser, otherOrg), 'FREE_ACCESS_DENIED')
await sql(`UPDATE public.free_account_subjects SET active=true WHERE id='${otherUser}'`)
console.log('PASS: unverified and suspended subjects cannot consume or receive a successful receipt')
// Frozen active window survives an edited policy. Transaction rollback changes neither table.
await sql('UPDATE public.free_quota_policies SET weekly_limit = 3 WHERE version=1')
await denied(request(randomUUID()), 'FREE_QUOTA_EXHAUSTED')
await sql(`BEGIN; ${request(randomUUID(), 'c'.repeat(64), otherUser, otherOrg)} ROLLBACK;`)
assert.equal(Number(await sql(`SELECT used FROM public.free_weekly_usage WHERE subject_id='${otherUser}'`)), 1)
await denied(request(randomUUID(), 'a'.repeat(64), otherUser, otherOrg, '2020-01-01T00:00:00Z'), 'FREE_REQUEST_EXPIRED')
console.log('PASS: active allowance frozen, rollback creates no charge, expired request rejected')
// Shift only uniquely scoped test metadata to the previous week, then replay.
await sql(`BEGIN;
INSERT INTO public.free_weekly_usage(subject_id,period_start,period_end,policy_version,allowance,used)
SELECT subject_id,period_start-interval '7 days',period_end-interval '7 days',policy_version,allowance,used
FROM public.free_weekly_usage WHERE subject_id='${otherUser}';
UPDATE public.free_calculation_receipts SET period_start=period_start-interval '7 days' WHERE subject_id='${otherUser}';
DELETE FROM public.free_weekly_usage WHERE subject_id='${otherUser}' AND period_start=(SELECT max(period_start) FROM public.free_weekly_usage WHERE subject_id='${otherUser}');
COMMIT;`)
const replay = await result(otherId, 'a'.repeat(64), otherUser, otherOrg)
assert.equal(replay.replayed, true)
assert.equal(replay.used, 1)
assert.equal(Number(await sql(`SELECT count(*) FROM public.free_weekly_usage WHERE subject_id='${otherUser}'`)), 1)
console.log('PASS: replay retains original week without creating a new allowance window')
await sql('UPDATE public.free_rollout SET enrollment_enabled=false, estimation_enabled=false, tour_enabled=false; UPDATE public.free_quota_policies SET weekly_limit=2 WHERE version=1')
await denied(request(firstId), 'FREE_PAUSED')
assert.equal(Number(await sql(`SELECT used FROM public.free_weekly_usage WHERE subject_id='${subject}'`)), 2)
console.log('PASS: pause preserves receipts and usage; local flags restored to disabled')
