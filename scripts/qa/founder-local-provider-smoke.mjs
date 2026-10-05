// REAL local Supabase Auth/RPC acceptance, not hosted or browser acceptance.
// Run only against the explicitly isolated, unlinked CLI stack:
//   node scripts/qa/founder-local-provider-smoke.mjs --prepare-application-schema
// Secrets come from the private CLI status file and stay in process memory.
// No Auth tables/functions are stubbed or edited. Timeout fixture changes affect
// only the synthetic platform session; factor recovery uses the provider API.
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { replayMigrations } from '../test-db/cluster.mjs'

const stackDir = '/tmp/weavly-founder-auth-staging'
const statusFile = '/tmp/weavly-founder-local-status.json'
const fixtureEmail = 'founder@example.test'
const prepare = process.argv.includes('--prepare-application-schema')
const unknownArgs = process.argv.slice(2).filter(arg => arg !== '--prepare-application-schema')
let stage = 'validate local boundary'
let passed = 0
let db
let service
const fixtureUsers = []
const clients = []
let migrationResult = { applied: 0, skipped: [] }
const totpCounters = new Map()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function check(condition, label) {
  if (!condition) throw Object.assign(new Error(label), { safeLabel: label })
}
function ok(result, label) {
  if (result.error) throw Object.assign(new Error(label), { safeLabel: label, code: result.error.code })
  return result.data
}
function pass(label) {
  passed += 1
  console.log(`PASS ${label}`)
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
function localUrl(value, protocol, port) {
  const url = new URL(value)
  check(url.protocol === protocol && url.hostname === '127.0.0.1' && url.port === port, 'non-loopback or unexpected endpoint rejected')
  return url
}
function totp(secret, counter = Math.floor(Date.now() / 30000)) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0; let value = 0
  const bytes = []
  for (const letter of secret.toUpperCase().replace(/=+$/, '')) {
    const digit = alphabet.indexOf(letter)
    check(digit >= 0, 'invalid provider TOTP encoding')
    value = (value << 5) | digit; bits += 5
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255) }
  }
  const moving = Buffer.alloc(8)
  moving.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', Buffer.from(bytes)).update(moving).digest()
  const offset = digest[digest.length - 1] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
async function freshCode(factor) {
  let counter = Math.floor(Date.now() / 30000)
  if (totpCounters.get(factor.id) === counter) {
    console.log('WAIT next local TOTP interval; no credential output')
    await delay(30000 - (Date.now() % 30000) + 1200)
    counter = Math.floor(Date.now() / 30000)
  }
  totpCounters.set(factor.id, counter)
  return totp(factor.secret, counter)
}
async function assertNoOutboundJobs() {
  const { rows } = await db.query("SELECT to_regclass('cron.job') IS NOT NULL AS cron_exists,to_regclass('net.http_request_queue') IS NOT NULL AS net_exists")
  if (rows[0].cron_exists) {
    const jobs = (await db.query('SELECT jobname,active,command FROM cron.job')).rows
    check(jobs.every(job => !job.active && job.jobname === 'weavly-free-retention' && job.command === 'SELECT public.prune_free_operational_metadata();'), 'unexpected or active local scheduled job')
  }
  if (rows[0].net_exists) {
    check(Number((await db.query('SELECT count(*) AS count FROM net.http_request_queue')).rows[0].count) === 0, 'unexpected queued outbound HTTP request')
  }
}
async function rpc(userId, sessionId, operation) {
  const args = { p_user_id: userId, p_session_id: sessionId, p_operation: operation }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await service.rpc('admin_founder_session', args)
    if (result.error?.code === 'PGRST202') { await delay(200); continue }
    const data = ok(result, 'service-only founder session RPC failed')
    check(typeof data?.allowed === 'boolean', 'unexpected founder session DTO')
    return data
  }
  check(false, 'PostgREST schema reload did not complete')
}
async function setup(userId, sessionId, operation, intentId = null, factorId = null, verificationId = null) {
  const data = ok(await service.rpc('admin_founder_mfa_setup', {
    p_user_id: userId, p_session_id: sessionId, p_operation: operation,
    p_intent_id: intentId, p_factor_id: factorId, p_verification_id: verificationId,
  }), 'real provider setup RPC failed')
  check(data?.allowed === true, `setup ${operation} denied`)
  return data
}
async function identity(client, userId, expectedAal) {
  const current = ok(await client.auth.getUser(), 'fresh real provider getUser failed').user
  const claims = ok(await client.auth.getClaims(), 'verified real provider getClaims failed').claims
  check(current?.id === userId && claims.sub === userId && UUID.test(claims.session_id), 'verified provider identity/session mismatch')
  check(claims.aal === expectedAal && claims.aud === 'authenticated' && claims.role === 'authenticated', 'verified provider assurance mismatch')
  check(claims.iss === `${apiOrigin}/auth/v1`, 'verified provider issuer mismatch')
  return { sessionId: claims.session_id, claims }
}
let apiOrigin
let anonKey
function freshClient() {
  const client = createClient(apiOrigin, anonKey, sdkOptions())
  clients.push(client)
  return client
}
let guardedFetch
function sdkOptions() {
  return { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `local-founder-smoke-${randomUUID()}` }, global: { fetch: guardedFetch } }
}
async function passwordLogin(userId, password) {
  const client = freshClient()
  ok(await client.auth.signInWithPassword({ email: fixtureEmail, password }), 'synthetic password login failed')
  const principal = await identity(client, userId, 'aal1')
  return { client, ...principal }
}
async function challenge(client, factor) {
  const challengeData = ok(await client.auth.mfa.challenge({ factorId: factor.id }), 'real provider MFA challenge failed')
  ok(await client.auth.mfa.verify({ factorId: factor.id, challengeId: challengeData.id, code: await freshCode(factor) }), 'real provider MFA code verification failed')
}
async function firstEnrollment(userId, login) {
  const begun = await setup(userId, login.sessionId, 'begin')
  const enrolled = ok(await login.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Synthetic local founder authenticator' }), 'real provider TOTP enrollment failed')
  check(UUID.test(enrolled.id) && typeof enrolled.totp?.secret === 'string', 'unexpected real provider enrollment DTO')
  const factor = { id: enrolled.id, secret: enrolled.totp.secret }
  await setup(userId, login.sessionId, 'bind', begun.intentId, factor.id)
  const leased = await setup(userId, login.sessionId, 'verify', begun.intentId, factor.id)
  check(UUID.test(leased.verificationId), 'setup verification lease missing')
  await challenge(login.client, factor)
  const verified = await identity(login.client, userId, 'aal2')
  check(verified.sessionId === login.sessionId, 'provider unexpectedly replaced enrollment session')
  await setup(userId, verified.sessionId, 'complete', begun.intentId, factor.id)
  const state = (await db.query('SELECT s.aal::text AS aal,s.factor_id,f.status::text AS status,f.factor_type::text AS factor_type FROM auth.sessions s JOIN auth.mfa_factors f ON f.id=s.factor_id WHERE s.id=$1 AND s.user_id=$2', [verified.sessionId, userId])).rows[0]
  check(state?.aal === 'aal2' && state.factor_id === factor.id && state.status === 'verified' && state.factor_type === 'totp', 'real Auth session/factor binding does not satisfy founder SQL')
  check((await rpc(userId, verified.sessionId, 'establish')).allowed, 'AAL2 platform session establishment denied')
  return { ...login, ...verified, factor }
}
async function existingFactorLogin(userId, password, factor) {
  const login = await passwordLogin(userId, password)
  check(!(await rpc(userId, login.sessionId, 'check')).allowed, 'password-only new session reached founder data')
  await challenge(login.client, factor)
  const verified = await identity(login.client, userId, 'aal2')
  check((await rpc(userId, verified.sessionId, 'establish')).allowed, 'verified existing factor cannot establish new founder session')
  return { ...login, ...verified }
}
async function cleanupFixtures() {
  if (!db || !service || fixtureUsers.length === 0) return
  // These rows are identified only by random UUIDs created in this run. Never
  // reset or delete unrelated application/Auth data or migration history.
  // A rejected operator template may leave its transaction aborted. Roll back
  // before starting cleanup; never let an earlier failure conceal residuals.
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  try {
    for (const userId of fixtureUsers) {
      await db.query('DELETE FROM private.platform_founder_mfa_setup_intents WHERE user_id=$1', [userId])
      await db.query('DELETE FROM private.platform_admin_sessions WHERE user_id=$1', [userId])
      await db.query('DELETE FROM private.platform_founder_grants WHERE user_id=$1', [userId])
      await db.query('DELETE FROM public.profiles WHERE id=$1', [userId])
    }
    await db.query('COMMIT')
  } catch { await db.query('ROLLBACK'); check(false, 'synthetic fixture cleanup failed') }
  for (const userId of fixtureUsers) ok(await service.auth.admin.deleteUser(userId), 'synthetic Auth fixture cleanup failed')
  check(Number((await db.query('SELECT count(*) AS count FROM auth.users')).rows[0].count) === 0, 'synthetic Auth fixture rows remain')
}

let failure
let cleanupStatus = 'not_needed'
try {
  check(unknownArgs.length === 0, 'unrecognized command argument')
  check((statSync(statusFile).mode & 0o077) === 0, 'local status file must have private0600 permissions')
  const config = readFileSync(path.join(stackDir, 'supabase/config.toml'), 'utf8')
  check(/^project_id = "weavly-founder-auth-staging"$/m.test(config), 'unexpected local stack identity')
  const localTotp = config.match(/^\[auth\.mfa\.totp\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1] ?? ''
  check(/^enroll_enabled = true$/m.test(localTotp) && /^verify_enabled = true$/m.test(localTotp), 'local TOTP enrollment/verification disabled; enable only the isolated stack')
  check(!existsSync(path.join(stackDir, 'supabase/.temp/project-ref')), 'linked Supabase project is forbidden')
  const status = JSON.parse(readFileSync(statusFile, 'utf8'))
  const api = localUrl(status.API_URL, 'http:', '55321')
  const dbUrl = localUrl(status.DB_URL, 'postgresql:', '55322')
  check(!api.username && !api.password && !api.search && !api.hash && api.pathname === '/', 'unexpected API URL structure')
  check(dbUrl.username === 'postgres' && dbUrl.pathname === '/postgres' && !dbUrl.search && !dbUrl.hash, 'unexpected local database target')
  apiOrigin = api.origin
  anonKey = status.ANON_KEY
  check(typeof anonKey === 'string' && typeof status.SERVICE_ROLE_KEY === 'string', 'local API credentials are unavailable')
  const nativeFetch = globalThis.fetch
  guardedFetch = async (input, init) => {
    const endpoint = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    check(endpoint.origin === apiOrigin && endpoint.hostname === '127.0.0.1', 'non-loopback SDK request blocked')
    const response = await nativeFetch(input, { ...init, redirect: 'manual' })
    check(response.status < 300 || response.status >= 400, 'local API redirect blocked')
    return response
  }
  // Negative URL checks happen without connecting to those hosts.
  for (const bad of ['https://example.test:55321', 'http://localhost:55321', 'http://127.0.0.1:54321']) {
    let denied = false
    try { localUrl(bad, 'http:', '55321') } catch { denied = true }
    check(denied, 'unsafe API endpoint accepted')
  }
  db = new pg.Client({ connectionString: status.DB_URL, connectionTimeoutMillis: 10000, statement_timeout: 30000 })
  await db.connect()
  check((await db.query('SELECT current_user AS role')).rows[0].role === 'postgres', 'local database is not operator role')
  check(Number((await db.query('SELECT count(*) AS count FROM auth.users')).rows[0].count) === 0, 'local Auth is not empty; refuse fixture overwrite')
  await assertNoOutboundJobs()
  pass('strict loopback/unlinked/private-file boundary; no existing Auth fixtures')

  stage = 'prepare local application schema'
  const hasProfiles = (await db.query("SELECT to_regclass('public.profiles') IS NOT NULL AS present")).rows[0].present
  if (!hasProfiles) {
    check(prepare, 'fresh local application schema requires explicit preparation flag')
    check(Number((await db.query("SELECT count(*) AS count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count) === 0, 'application schema is not empty')
    await db.query('CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions')
    await assertNoOutboundJobs()
    migrationResult = await replayMigrations(db, 'supabase/migrations')
    await db.query("NOTIFY pgrst,'reload schema'")
  }
  const installed = (await db.query("SELECT to_regprocedure('public.admin_founder_session(uuid,uuid,text)') IS NOT NULL AS session,to_regprocedure('public.admin_founder_mfa_setup(uuid,uuid,text,uuid,uuid,uuid)') IS NOT NULL AS setup,to_regclass('private.platform_founder_grants') IS NOT NULL AS grants")).rows[0]
  check(installed.session && installed.setup && installed.grants, 'local application schema is incomplete; no automatic reset performed')
  await assertNoOutboundJobs()
  pass('real schema migrations; outbound extension/job migrations skipped; retention inactive')
  service = createClient(apiOrigin, status.SERVICE_ROLE_KEY, sdkOptions())

  stage = 'synthetic founder operator setup'
  const password = `Aa1!${randomBytes(32).toString('base64url')}`
  const user = ok(await service.auth.admin.createUser({ email: fixtureEmail, password, email_confirm: true }), 'synthetic local Auth creation failed').user
  check(UUID.test(user?.id), 'provider did not create a random synthetic UUID')
  fixtureUsers.push(user.id)
  const operatorTemplate = readFileSync('docs/admin-console/FOUNDER_SELF_SETUP.sql', 'utf8')
  const fixtureSetup = operatorTemplate.replace('PASTE_YOUR_AUTH_USER_UUID_HERE', user.id).replaceAll('rajpatel86420@gmail.com', fixtureEmail)
  await db.query(fixtureSetup)
  await db.query(fixtureSetup)
  pass('real confirmed synthetic Auth UUID plus idempotent reviewed operator setup')

  stage = 'real first-factor and first TOTP setup'
  const login = await passwordLogin(user.id, password)
  check((await rpc(user.id, login.sessionId, 'candidate')).allowed, 'real AAL1 candidate denied')
  check((await rpc(user.id, login.sessionId, 'establish')).code === 'MFA_REQUIRED', 'real AAL1 was allowed to establish founder access')
  const clientAttempt = await login.client.rpc('admin_founder_session', { p_user_id: user.id, p_session_id: login.sessionId, p_operation: 'establish' })
  check(clientAttempt.error?.code === '42501', 'authenticated user directly reached service-only founder RPC')
  pass('real provider AAL1 denied; current user cannot call service-only founder RPC')
  const founder = await firstEnrollment(user.id, login)
  check((await rpc(user.id, founder.sessionId, 'check')).allowed, 'real AAL2 founder denied')
  pass('real getUser/getClaims; AAL1 denial; begin/enroll/bind/verify/complete; actual AAL2 session factor binding')

  stage = 'polling and idle limit'
  const before = (await db.query('SELECT last_interactive_at::text AS at FROM private.platform_admin_sessions WHERE session_id=$1', [founder.sessionId])).rows[0].at
  for (let read = 0; read < 3; read += 1) check((await rpc(user.id, founder.sessionId, 'check')).allowed, 'read polling unexpectedly denied')
  const after = (await db.query('SELECT last_interactive_at::text AS at FROM private.platform_admin_sessions WHERE session_id=$1', [founder.sessionId])).rows[0].at
  check(before === after, 'read polling extends founder inactivity')
  await db.query("UPDATE private.platform_admin_sessions SET created_at=now()-interval '16 minutes',last_interactive_at=now()-interval '15 minutes',absolute_expires_at=now()+interval '7 hours 44 minutes' WHERE session_id=$1", [founder.sessionId])
  for (const operation of ['check', 'touch', 'establish']) check((await rpc(user.id, founder.sessionId, operation)).code === 'SESSION_EXPIRED', '15-minute expiry or non-resurrection failed')
  pass('polling does not extend idle;15-minute server expiry and non-resurrection')

  stage = 'absolute limit'
  const absolute = await existingFactorLogin(user.id, password, founder.factor)
  await db.query("UPDATE private.platform_admin_sessions SET created_at=now()-interval '8 hours',absolute_expires_at=now(),last_interactive_at=now() WHERE session_id=$1", [absolute.sessionId])
  for (const operation of ['check', 'touch', 'establish']) check((await rpc(user.id, absolute.sessionId, operation)).code === 'SESSION_EXPIRED', '8-hour expiry or non-resurrection failed')
  pass('real fresh MFA session;8-hour absolute expiry wins over recent activity')

  stage = 'grant revocation and provider logout'
  const revoked = await existingFactorLogin(user.id, password, founder.factor)
  await db.query('UPDATE private.platform_founder_grants SET enabled=false,revoked_at=now() WHERE user_id=$1', [user.id])
  check((await rpc(user.id, revoked.sessionId, 'check')).code === 'FORBIDDEN', 'grant revocation does not immediately deny live provider token')
  await db.query('UPDATE private.platform_founder_grants SET enabled=true,revoked_at=NULL WHERE user_id=$1', [user.id])
  const accessToken = ok(await revoked.client.auth.getSession(), 'local session unavailable for logout fixture').session.access_token
  ok(await revoked.client.auth.signOut({ scope: 'local' }), 'real provider signout failed')
  check((await rpc(user.id, revoked.sessionId, 'check')).code === 'SESSION_EXPIRED', 'provider logout does not block founder token replay')
  // Provider getUser may still accept a cryptographically unexpired JWT;
  // actual auth.sessions binding, not JWT validity alone, must deny replay.
  const replay = freshClient()
  await replay.auth.getUser(accessToken)
  check(!(await rpc(user.id, revoked.sessionId, 'establish')).allowed, 'logged-out provider session was resurrected')
  pass('live grant revocation and real provider logout block token replay')

  stage = 'supported synthetic factor recovery'
  await db.query('UPDATE private.platform_founder_grants SET enabled=false,revoked_at=now() WHERE user_id=$1', [user.id])
  await rpc(user.id, founder.sessionId, 'revoke')
  ok(await service.auth.admin.mfa.deleteFactor({ userId: user.id, id: founder.factor.id }), 'supported local admin factor recovery failed')
  check(Number((await db.query('SELECT count(*) AS count FROM auth.mfa_factors WHERE user_id=$1', [user.id])).rows[0].count) === 0, 'provider factor recovery did not remove synthetic factor')
  check(!(await rpc(user.id, founder.sessionId, 'check')).allowed, 'recovery bypassed revoked founder access')
  await db.query('UPDATE private.platform_founder_grants SET enabled=true,revoked_at=NULL WHERE user_id=$1', [user.id])
  const recoveryLogin = await passwordLogin(user.id, password)
  const recovered = await firstEnrollment(user.id, recoveryLogin)
  check((await rpc(user.id, recovered.sessionId, 'check')).allowed, 'recovered local factor cannot authorize fresh session')
  check(!(await rpc(user.id, founder.sessionId, 'establish')).allowed, 'recovery revived old revoked platform session')
  pass('supported local provider factor deletion and fresh TOTP re-enrollment; old platform sessions stay revoked')
  await assertNoOutboundJobs()
  pass('no active outbound cron jobs or queued HTTP after acceptance')
} catch (error) {
  failure = { stage, reason: error.safeLabel ?? 'local provider/database operation failed', code: /^[A-Za-z0-9_]{1,40}$/.test(error.code ?? '') ? error.code : undefined }
} finally {
  if (db && service && fixtureUsers.length > 0) {
    try { await cleanupFixtures(); cleanupStatus = 'completed_zero_auth_users' }
    catch { cleanupStatus = 'failed'; failure ??= { stage: 'cleanup', reason: 'synthetic fixture cleanup failed' } }
  }
  await Promise.all(clients.map(client => client.auth.stopAutoRefresh()))
  if (db) await db.end().catch(() => {})
}
if (failure) {
  console.error(JSON.stringify({ scope: 'real loopback Supabase Auth/RPC', passed, failed: failure, fixtureCleanup: cleanupStatus, credentialsPrinted: false }))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({ scope: 'real loopback Supabase Auth/RPC', passed, migrationsApplied: migrationResult.applied, outboundMigrationsSkipped: migrationResult.skipped.length, fixtureCleanup: cleanupStatus, hostedSetup: 'not run', browserAcceptance: 'not run', limits: 'Controlled synthetic platform timestamps; local service, configuration and recovery only. No hosted backups, deployment or production MFA verified.' }))
}
