// REAL built-app / browser / Supabase acceptance. No Auth fixtures or mocked RPCs.
// Run: node scripts/qa/founder-local-browser-smoke.mjs
// Creates an exact git HEAD archive with ONE source substitution: the approved
// founder email -> founder@example.test. All credentials/QR/TOTP stay in memory.
// Typography alone uses cached real founder fonts through Next's build fixture;
// unused landing Anek fonts use cached Inter bytes as an explicit fallback.
// Child processes inherit an allowlisted environment and a loopback net guard.
// No screenshots, trace, video, storageState or provider payload artifacts.
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, statSync, symlinkSync, writeFileSync, openSync, closeSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import http from 'node:http'
import net from 'node:net'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { chromium, devices, expect } from '@playwright/test'

const repository = realpathSync(path.resolve(import.meta.dirname, '../..'))
const stackDir = '/tmp/weavly-founder-auth-staging'
const statusFile = '/tmp/weavly-founder-local-status.json'
const reportFile = '/tmp/weavly-founder-local-browser-smoke-result.json'
const fixtureEmail = 'founder@example.test'
// NextURL canonicalizes loopback IPs to localhost. Browser traffic still
// reaches only pinned TCP127 through the forward proxy (no DNS lookup).
const appOrigin = 'http://localhost:55330'
const buildSiteOrigin = 'http://127.0.0.1:55330'
const fontCache = '/Users/rajpatel/Projects/textile Saas/.next/static'
// Staging-only foundation parity authorized from read-only hosted catalogue
// evidence. Source replay as postgres lacks historical service-role defaults.
// Restore SELECT on these EXISTING baseline tables only; no private/new table,
// anon/authenticated grant, RLS policy or production change is involved.
const baselineReadTables = ['profiles', 'organizations', 'org_subscriptions', 'subscription_payments', 'billing_checkout_attempts', 'billing_payment_refunds', 'billing_invoices', 'free_account_grants', 'plan_usage_events', 'grievances', 'security_incidents', 'organization_export_runs']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
let stage = 'validate loopback boundary'
let db; let service; let browser; let appProcess; let stagingDir; let browserProxy
let apiOrigin; let anonKey; let guardedFetch
let commit
let failure
let cleanupFailure
let cleanupAuthCount = null
let activePage
let safeUiState
let restoredBaselineReads = []
let outboundBlocked = 0
let cspViolationCount = 0
const fixtureUsers = []
const contexts = []
const passes = []
const diagnostics = []
const proxySignoutFacts = []
const counters = new Map()

function check(condition, label) {
  if (!condition) throw Object.assign(new Error(label), { safeLabel: label })
}
function ok(result, label) {
  if (result.error) throw Object.assign(new Error(label), { safeLabel: label, code: result.error.code })
  return result.data
}
function pass(label) { passes.push(label); console.log(`PASS ${label}`) }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
function safeFailure(error) {
  return { stage, label: error.safeLabel ?? 'Assertion or operation failed; sensitive details withheld', type: /^[A-Za-z]{1,30}$/.test(error.name ?? '') ? error.name : undefined, code: /^[A-Z0-9_]{1,40}$/i.test(error.code ?? '') ? error.code : undefined }
}
function localUrl(value, protocol, port) {
  const url = new URL(value)
  check(url.protocol === protocol && url.hostname === '127.0.0.1' && url.port === port, 'non-loopback or unexpected endpoint rejected')
  return url
}
function command(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { ...options, stdio: options.stdio ?? ['pipe', 'pipe', 'pipe'] })
    const output = []
    if (child.stdout) child.stdout.on('data', chunk => output.push(chunk))
    // Captured subprocess diagnostics are intentionally never printed. They
    // could contain secrets during native QR decoding or provider failures.
    if (child.stderr) child.stderr.on('data', () => {})
    child.on('error', () => reject(Object.assign(new Error('Subprocess could not start'), { safeLabel: 'Subprocess could not start' })))
    child.on('exit', code => code === 0 ? resolve(Buffer.concat(output)) : reject(Object.assign(new Error('Subprocess failed'), { safeLabel: 'Subprocess failed', code: `EXIT_${code}` })))
    if (options.input) child.stdin.end(options.input)
    else if (child.stdin) child.stdin.end()
  })
}
async function assertAppPortFree() {
  const probe = http.createServer()
  try {
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(55330, '127.0.0.1', resolve) })
  } catch { check(false, 'staging app port is already occupied; refuse stale-runtime acceptance') }
  finally { if (probe.listening) await new Promise(resolve => probe.close(resolve)) }
}
async function assertNoOutboundJobs() {
  const { rows } = await db.query("SELECT to_regclass('cron.job') IS NOT NULL AS cron_exists,to_regclass('net.http_request_queue') IS NOT NULL AS net_exists")
  if (rows[0].cron_exists) {
    const jobs = (await db.query('SELECT jobname,active,command FROM cron.job')).rows
    check(jobs.every(job => !job.active && job.jobname === 'weavly-free-retention' && job.command === 'SELECT public.prune_free_operational_metadata();'), 'unexpected or active local scheduled job')
  }
  if (rows[0].net_exists) check(Number((await db.query('SELECT count(*) AS count FROM net.http_request_queue')).rows[0].count) === 0, 'unexpected queued outbound HTTP request')
}
function sdkOptions() {
  return { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `local-browser-${randomUUID()}` }, global: { fetch: guardedFetch } }
}
function totp(secret, counter) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0; let value = 0
  const bytes = []
  for (const letter of secret.toUpperCase().replace(/=+$/, '')) {
    const digit = alphabet.indexOf(letter)
    check(digit >= 0, 'invalid QR TOTP encoding')
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
  if (counters.get(factor.id) === counter || Date.now() % 30000 > 25000) {
    console.log('WAIT next local TOTP interval; no credential output')
    await delay(30000 - Date.now() % 30000 + 1200)
    counter = Math.floor(Date.now() / 30000)
  }
  counters.set(factor.id, counter)
  return totp(factor.secret, counter)
}
function writeInfrastructure() {
  const guardFile = path.join(stagingDir, 'local-network-guard.mjs')
  writeFileSync(guardFile, `import net from 'node:net';
const allowed = new Set(['55321','55322','55330']);
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  const normalized = args[0];
  const target = Array.isArray(normalized) ? normalized[0] : normalized;
  if (typeof target === 'object' && target && !target.path) {
    const host = target.host ?? target.hostname ?? 'localhost';
    if (!['127.0.0.1','localhost','::1'].includes(host) || (target.port && !allowed.has(String(target.port)))) throw new Error('Non-loopback application connection blocked');
  } else if (typeof target === 'number' || /^\\d+$/.test(String(target))) {
    const host = typeof args[1] === 'string' ? args[1] : 'localhost';
    if (!['127.0.0.1','localhost','::1'].includes(host) || !allowed.has(String(target))) throw new Error('Non-loopback application connection blocked');
  }
  return original.apply(this,args);
};
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input,init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !allowed.has(url.port)) throw new Error('Non-loopback application fetch blocked');
  return nativeFetch(input,{...init,redirect:'manual'});
};
`, { mode: 0o600 })
  // Reuse exact cached Latin font bytes, without fetching Google or changing
  // app/layout.tsx. The fixture only supplies the next/font CSS/file transport.
  const styles = readdirSync(path.join(fontCache, 'css')).filter(file => file.endsWith('.css')).map(file => readFileSync(path.join(fontCache, 'css', file), 'utf8')).join('\n')
  const css = {}
  for (const family of ['Inter', 'Geist Mono']) {
    const escaped = family.replace(/ /g, '[ _]')
    const faces = [...styles.matchAll(new RegExp(`@font-face\\{font-family:(?:"|')?${escaped}(?:"|')?;[^}]+\\}`, 'g'))]
    const face = faces.find(item => /src:url\([^)]*-s\.p\.woff2\)/.test(item[0])) ?? faces.find(item => /u\+00\?\?/i.test(item[0]))
    check(face, 'cached Latin font face unavailable')
    const asset = face[0].match(/src:url\(\/_next\/static\/media\/([^)]+)\)/)?.[1]
    check(asset && existsSync(path.join(fontCache, 'media', asset)), 'cached font bytes unavailable')
    css[family] = `/* latin */\n@font-face {\nfont-family: '${family}';\nfont-style: normal;\nfont-weight: 100 900;\nfont-display: swap;\nsrc: url(${path.join(fontCache, 'media', asset)}) format('woff2');\n}`
  }
  const fontFile = path.join(stagingDir, 'cached-font-responses.cjs')
  const fontResponses = {
    'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap': css.Inter,
    'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap': css['Geist Mono'],
    'https://fonts.googleapis.com/css2?family=Anek+Latin:wdth,wght@75..125,100..800&display=swap': css.Inter.replace("font-family: 'Inter'", "font-family: 'Anek Latin'"),
    'https://fonts.googleapis.com/css2?family=Anek+Gujarati:wght@100..800&display=swap': css.Inter.replace("font-family: 'Inter'", "font-family: 'Anek Gujarati'"),
    'https://fonts.googleapis.com/css2?family=Anek+Devanagari:wght@100..800&display=swap': css.Inter.replace("font-family: 'Inter'", "font-family: 'Anek Devanagari'"),
  }
  writeFileSync(fontFile, `module.exports=${JSON.stringify(fontResponses)};`, { mode: 0o600 })
  const swiftFile = path.join(stagingDir, 'decode-local-qr.swift')
  writeFileSync(swiftFile, `import Foundation
import Vision
let input = FileHandle.standardInput.readDataToEndOfFile()
let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
do {
  try VNImageRequestHandler(data: input, options: [:]).perform([request])
  guard let payload = request.results?.first?.payloadStringValue else { exit(2) }
  let encoded = Data(payload.utf8).base64EncodedString()
  FileHandle.standardOutput.write(Data(("__WEAVLY_QR_BEGIN__" + encoded + "__WEAVLY_QR_END__").utf8))
} catch { exit(3) }
`, { mode: 0o600 })
  return { guardFile, fontFile, swiftFile, decoder: path.join(stagingDir, 'decode-local-qr') }
}
function childEnvironment(status, infra) {
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin', TMPDIR: stagingDir, NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', CI: 'true',
    NODE_OPTIONS: `--max-old-space-size=4096 --import=${infra.guardFile}`,
    NEXT_PUBLIC_SITE_URL: buildSiteOrigin, NEXT_PUBLIC_SUPABASE_URL: apiOrigin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    WEAVLY_ADMIN_ENABLED: 'true', WEAVLY_ADMIN_PRODUCTION_APPROVED: 'true',
    WEAVLY_ADMIN_MFA_ENROLLMENT_ENABLED: 'true', WEAVLY_ADMIN_MFA_SETUP_APPROVED: 'true',
    NEXT_FONT_GOOGLE_MOCKED_RESPONSES: infra.fontFile,
  }
}
async function cleanupUsers() {
  if (!db || !service) return
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  try {
    for (const id of fixtureUsers) {
      await db.query('DELETE FROM private.platform_founder_mfa_setup_intents WHERE user_id=$1', [id])
      await db.query('DELETE FROM private.platform_admin_sessions WHERE user_id=$1', [id])
      await db.query('DELETE FROM private.platform_founder_grants WHERE user_id=$1', [id])
      await db.query('DELETE FROM public.profiles WHERE id=$1', [id])
    }
    await db.query('COMMIT')
  } catch { await db.query('ROLLBACK'); check(false, 'synthetic application fixture cleanup failed') }
  for (const id of fixtureUsers) ok(await service.auth.admin.deleteUser(id), 'synthetic Auth fixture cleanup failed')
  cleanupAuthCount = Number((await db.query('SELECT count(*) AS count FROM auth.users')).rows[0].count)
  check(cleanupAuthCount === 0, 'Auth fixtures remain after cleanup')
  fixtureUsers.length = 0
}
async function startBrowserProxy() {
  // Context routing does not intercept service-worker requests. A pinned
  // forward proxy also blocks those requests before any hosted connection.
  browserProxy = http.createServer((request, response) => {
    let endpoint
    try { endpoint = new URL(request.url) } catch { response.writeHead(400).end(); return }
    if (![appOrigin, apiOrigin].includes(endpoint.origin)) {
      outboundBlocked += 1; response.writeHead(403).end(); return
    }
    const upstream = http.request({ hostname: '127.0.0.1', port: Number(endpoint.port), path: endpoint.pathname + endpoint.search, method: request.method, headers: request.headers }, reply => {
      if (endpoint.pathname === '/auth/signout' && request.method === 'POST') proxySignoutFacts.push({ status: reply.statusCode, hasLocation: typeof reply.headers.location === 'string', sameOriginLocation: reply.headers.location ? new URL(reply.headers.location, appOrigin).origin === appOrigin : false, locationPath: reply.headers.location ? new URL(reply.headers.location, appOrigin).pathname : undefined })
      response.writeHead(reply.statusCode, reply.headers); reply.pipe(response)
    })
    upstream.on('error', () => response.writeHead(502).end())
    request.pipe(upstream)
  })
  browserProxy.on('connect', (request, socket, head) => {
    let endpoint
    try { endpoint = new URL(`http://${request.url}`) } catch { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return }
    if (![appOrigin, apiOrigin].includes(endpoint.origin) || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
      outboundBlocked += 1; socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return
    }
    // Playwright's APIRequest transport uses CONNECT for HTTP proxy targets.
    // Permit only the same two explicitly pinned loopback application hosts.
    const upstream = net.connect({ host: '127.0.0.1', port: Number(endpoint.port) }, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) upstream.write(head)
      socket.pipe(upstream); upstream.pipe(socket)
    })
    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
    socket.on('close', () => upstream.destroy())
  })
  await new Promise((resolve, reject) => { browserProxy.once('error', reject); browserProxy.listen(55331, '127.0.0.1', resolve) })
}
async function newContext(mode) {
  const context = await browser.newContext(mode === 'mobile' ? { ...devices['iPhone 13'], browserName: undefined } : { viewport: { width: 1440, height: 900 } })
  contexts.push(context)
  context.on('page', page => page.on('console', message => {
    if (/Content Security Policy/i.test(message.text())) cspViolationCount += 1
  }))
  await context.route('**/*', async route => {
    const endpoint = new URL(route.request().url())
    if (endpoint.origin === appOrigin || endpoint.origin === apiOrigin || ['data:', 'blob:'].includes(endpoint.protocol)) return route.continue()
    outboundBlocked += 1
    return route.abort('blockedbyclient')
  })
  return context
}
async function assertDenied(context, label) {
  const response = await context.request.get(`${appOrigin}/api/admin/overview`, { maxRedirects: 0 })
  diagnostics.push({ operation: label, status: response.status(), contentType: response.headers()['content-type']?.split(';')[0], bodyBytes: (await response.body()).length })
  check([401, 403].includes(response.status()), label)
  check(response.headers()['content-type']?.includes('application/json'), 'denied API did not return the runtime JSON contract')
  const body = await response.json()
  check(typeof body.code === 'string' && !('summaries' in body) && !('attention' in body), 'denied API returned privileged data')
}
async function signIn(page, password) {
  activePage = page
  const scope = stage.split(' ')[0]
  stage = `${scope} open admin login`
  await page.goto(`${appOrigin}/admin/login`)
  stage = `${scope} fill admin credentials`
  await page.locator('#founder-email').fill(fixtureEmail)
  await page.locator('#founder-password').fill(password)
  await page.getByRole('button', { name: 'Continue to verification' }).click()
  stage = `${scope} wait for password redirect to verification`
  await page.waitForURL('**/admin/verify**', { timeout: 30000 })
}
async function verify(page, factor) {
  await page.locator('#founder-code').fill(await freshCode(factor))
  await page.getByRole('button', { name: 'Verify and open console' }).click()
  await page.waitForURL(`${appOrigin}/admin`, { timeout: 30000 })
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible({ timeout: 30000 })
}
async function signOut(page) {
  const scope = stage.split(' ')[0]
  stage = `${scope} confirm active session before signout`
  const active = await page.context().request.get(`${appOrigin}/api/admin/overview`)
  check(active.status() === 200, 'founder session not active before signout')
  stage = `${scope} actual signout UI form click`
  const factsBefore = proxySignoutFacts.length
  const response = page.waitForResponse(reply => new URL(reply.url()).pathname === '/auth/signout' && reply.request().method() === 'POST', { timeout: 10000 }).catch(() => null)
  await page.locator('form[action="/auth/signout"] button:visible').click()
  stage = `${scope} observe signout browser response`
  const result = await response
  diagnostics.push({ operation: 'signout response observation', observed: Boolean(result), path: new URL(page.url()).pathname, freshUpstreamFacts: proxySignoutFacts.slice(factsBefore) })
  const freshFacts = proxySignoutFacts.slice(factsBefore)
  check(freshFacts.length === 1 && freshFacts[0].status === 303 && freshFacts[0].sameOriginLocation && freshFacts[0].locationPath === '/login', 'actual backend signout303 not proven')
  // With the real PWA active, the worker follows the backend303 and returns
  // final login HTML as its response to the original POST. A boundary redirect
  // can cancel Playwright's page-response observation. Never invent that status:
  // backend303, final auth destination and independent termination checks below
  // remain mandatory even when the page event is absent.
  if (result) {
    const signoutHeaders = result.request().headers()
    const body = result.headers()['content-type']?.includes('application/json') ? await result.json().catch(() => null) : null
    diagnostics.push({ operation: 'actual signout form transport', status: result.status(), fromServiceWorker: result.fromServiceWorker(), method: result.request().method(), redirectedFromMethod: result.request().redirectedFrom()?.method(), hasLocation: typeof result.headers().location === 'string', contentType: result.headers()['content-type']?.split(';')[0], requestContentType: signoutHeaders['content-type']?.split(';')[0], originMatches: signoutHeaders.origin === appOrigin, fetchSite: ['same-origin', 'none', 'cross-site'].includes(signoutHeaders['sec-fetch-site']) ? signoutHeaders['sec-fetch-site'] : undefined, invalidOrigin: body?.error === 'Invalid request origin.', upstreamFacts: freshFacts })
    check(result.status() === 303 || (result.fromServiceWorker() && result.status() === 200), 'actual browser signout form failed')
  }
  diagnostics.push({ operation: 'actual signout form', backendStatus: freshFacts[0].status, browserResponseObserved: Boolean(result), browserStatus: result?.status(), serviceWorkerWrappedRedirect: result?.fromServiceWorker(), destination: freshFacts[0].locationPath })
  stage = `${scope} signout auth destination`
  // SensitiveBoundary may replace the generic /login destination with the
  // founder login after its outstanding validation observes the revocation.
  await page.waitForURL(url => url.origin === appOrigin && ['/login', '/admin/login'].includes(url.pathname), { timeout: 30000 })
}
async function assertSignedOut(context, userId, replayCookies, mode) {
  stage = `${mode} signed-out authoritative sessions before fixture cleanup`
  const providerSessions = Number((await db.query('SELECT count(*) AS count FROM auth.sessions WHERE user_id=$1', [userId])).rows[0].count)
  const activePlatformSessions = Number((await db.query('SELECT count(*) AS count FROM private.platform_admin_sessions WHERE user_id=$1 AND revoked_at IS NULL', [userId])).rows[0].count)
  diagnostics.push({ operation: 'real UI signout before fixture cleanup', providerSessions, activePlatformSessions })
  check(providerSessions === 0, 'real provider session remains after UI signout')
  check(activePlatformSessions === 0, 'platform session remains active after UI signout')
  stage = `${mode} signed-out and replay API denial`
  await assertDenied(context, 'signed-out direct API was allowed')
  const replay = await newContext(mode)
  await replay.addCookies(replayCookies)
  await assertDenied(replay, 'signed-out real token replay reached founder API')
  await replay.close()
}
async function browserCycle(mode, infra) {
  stage = `${mode} real first-factor / QR / OTP`
  const password = `Aa1!${randomBytes(32).toString('base64url')}`
  const founder = ok(await service.auth.admin.createUser({ email: fixtureEmail, password, email_confirm: true }), 'synthetic founder creation failed').user
  check(UUID.test(founder?.id), 'synthetic provider UUID missing')
  fixtureUsers.push(founder.id)
  const template = readFileSync(path.join(repository, 'docs/admin-console/FOUNDER_SELF_SETUP.sql'), 'utf8')
  await db.query(template.replace('PASTE_YOUR_AUTH_USER_UUID_HERE', founder.id).replaceAll('rajpatel86420@gmail.com', fixtureEmail))
  const context = await newContext(mode)
  const page = await context.newPage()
  stage = `${mode} anonymous direct API denial`
  await assertDenied(context, 'anonymous direct API was allowed')
  stage = `${mode} admin password login`
  await signIn(page, password)
  stage = `${mode} first real QR visibility`
  const qr = page.getByAltText('Scan to connect your Weavly authenticator')
  await expect(qr).toBeVisible({ timeout: 30000 })
  await assertDenied(context, 'password-only AAL1 direct API was allowed')
  const candidate = await context.request.get(`${appOrigin}/api/admin/auth/session`)
  check(candidate.status() === 200, 'real AAL1 candidate endpoint denied')
  const png = await qr.getAttribute('src')
  check(png?.startsWith('data:image/png;base64,'), 'app QR is not an in-memory PNG')
  stage = `${mode} decode real rendered QR`
  const decoded = (await command(infra.decoder, [], { input: Buffer.from(png.split(',')[1], 'base64') })).toString('utf8')
  const frame = decoded.match(/__WEAVLY_QR_BEGIN__([A-Za-z0-9+/=]+)__WEAVLY_QR_END__/)
  check(frame, 'native QR decoder payload framing unavailable')
  diagnostics.push({ operation: 'native QR decoder envelope', extraFrameworkOutput: decoded.length !== frame[0].length })
  const uri = new URL(Buffer.from(frame[1], 'base64').toString('utf8'))
  check(uri.protocol === 'otpauth:' && uri.hostname === 'totp' && uri.searchParams.get('secret'), 'real app QR payload invalid')
  const factor = { id: await page.locator('input[name=factorId]').inputValue(), secret: uri.searchParams.get('secret') }
  diagnostics.push({ operation: 'decoded QR encoding flags only', base32: /^[A-Z2-7]+=*$/i.test(factor.secret), hasWhitespace: /\s/.test(factor.secret), hasPadding: /=/.test(factor.secret), urlQueryKeys: [...uri.searchParams.keys()].filter(key => ['secret', 'issuer', 'period', 'algorithm', 'digits'].includes(key)) })
  check(UUID.test(factor.id), 'app factor identity invalid')
  stage = `${mode} first OTP and AAL2 protected data`
  await verify(page, factor)
  const overview = await context.request.get(`${appOrigin}/api/admin/overview`)
  check(overview.status() === 200 && /no-store/.test(overview.headers()['cache-control'] ?? ''), 'verified AAL2 overview denied or cacheable')
  stage = `${mode} real browser interactive session POST`
  const touch = await page.evaluate(async () => {
    const response = await fetch('/api/admin/session', { method: 'POST', credentials: 'same-origin' })
    const body = response.status === 204 ? null : await response.json().catch(() => null)
    return { status: response.status, invalidOrigin: body?.message === 'Invalid request origin.' }
  })
  diagnostics.push({ operation: 'real browser interactive session POST', ...touch })
  check(touch.status === 204, 'real same-origin interactive session POST denied')
  const live = (await db.query('SELECT s.aal::text AS aal,s.factor_id FROM auth.sessions s JOIN private.platform_admin_sessions p ON p.session_id=s.id WHERE s.user_id=$1 AND p.revoked_at IS NULL', [founder.id])).rows
  check(live.length === 1 && live[0].aal === 'aal2' && live[0].factor_id === factor.id, 'actual browser provider session/factor binding invalid')
  pass(`${mode}: real password → rendered QR → OTP → AAL2 protected data; AAL1 and anonymous API denial`)

  stage = `${mode} offline and storage boundary`
  await context.setOffline(true)
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeHidden()
  await expect(page.getByText('You are offline. Reconnect to view this private page.')).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible({ timeout: 30000 })
  const cacheSafe = await page.evaluate(async () => {
    const names = await caches.keys()
    for (const name of names) for (const request of await (await caches.open(name)).keys()) {
      if (/^\/(?:api\/)?(?:admin|support)(?:\/|$)/.test(new URL(request.url).pathname)) return false
    }
    return true
  })
  check(cacheSafe, 'sensitive response persisted in service-worker cache')
  const privateDraftsSafe = await page.evaluate(secret => {
    for (const storage of [localStorage, sessionStorage]) for (const key of Object.keys(storage)) {
      const value = storage.getItem(key) ?? ''
      if (value.includes(secret) || value.includes('otpauth://')) return false
    }
    return true
  }, factor.secret)
  check(privateDraftsSafe, 'QR secret persisted in browser storage')
  pass(`${mode}: offline conceals protected content; online revalidates; sensitive routes absent from Cache Storage`)

  stage = `${mode} signout / back / returning OTP`
  const historySequence = [new URL(page.url()).pathname]
  // Establish real interacted-with protected history entries. Chromium may
  // skip synthetic pushState entries when navigating back after logout.
  await page.getByRole('heading', { name: 'Today', exact: true }).click()
  await page.getByRole('navigation', { name: 'Founder console', exact: true }).locator('a[href="/admin/factories"]:visible').click()
  await page.waitForURL(`${appOrigin}/admin/factories`)
  await expect(page.getByRole('heading', { name: 'Factories', exact: true })).toBeVisible({ timeout: 30000 })
  historySequence.push(new URL(page.url()).pathname)
  const beforeSignoutCookies = await context.cookies(appOrigin)
  await signOut(page)
  historySequence.push(new URL(page.url()).pathname)
  await assertSignedOut(context, founder.id, beforeSignoutCookies, mode)
  stage = `${mode} browser back to prior protected Today`
  let attemptedToday = false
  const backPaths = []
  const backTargets = []
  const historyInspector = await context.newCDPSession(page)
  const recordNavigation = request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      const pathname = new URL(request.url()).pathname
      if (backPaths.length < 16) backPaths.push(pathname)
      if (pathname === '/admin') attemptedToday = true
    }
  }
  const recordFrame = frame => { if (frame === page.mainFrame()) {
    const pathname = new URL(frame.url()).pathname
    if (backPaths.length < 16) backPaths.push(pathname)
    if (pathname === '/admin') attemptedToday = true
  } }
  page.on('request', recordNavigation); page.on('framenavigated', recordFrame)
  try {
    for (let back = 0; back < 4 && !attemptedToday; back += 1) {
      // A controlled service-worker navigation may expose only the final
      // redirected auth URL to request/frame listeners. Inspect the real
      // previous history entry before issuing the genuine browser back.
      const history = await historyInspector.send('Page.getNavigationHistory')
      const previous = history.entries[history.currentIndex - 1]
      if (!previous) break
      const target = new URL(previous.url).pathname
      backTargets.push(target)
      if (target === '/admin') attemptedToday = true
      await page.goBack()
      await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeHidden()
      await expect(page.getByRole('heading', { name: 'Factories', exact: true })).toBeHidden()
    }
  } finally { page.off('request', recordNavigation); page.off('framenavigated', recordFrame); await historyInspector.detach() }
  diagnostics.push({ operation: 'actual protected history traversal', beforeBack: historySequence, backTargets, backPaths, attemptedToday, finalPath: new URL(page.url()).pathname })
  check(attemptedToday, 'browser back did not attempt prior protected Today entry')
  stage = `${mode} signed-out offline refresh`
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined)
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeHidden()
  await context.setOffline(false)
  await signIn(page, password)
  await expect(page.getByRole('heading', { name: 'Verify founder access', exact: true })).toBeVisible()
  await expect(page.getByAltText('Scan to connect your Weavly authenticator')).toHaveCount(0)
  await assertDenied(context, 'returning password-only API was allowed')
  await verify(page, factor)
  pass(`${mode}: actual signout denies API; logout/back/offline cannot reveal Today; returning OTP has no QR`)

  stage = `${mode} customer login and outsider direct denial`
  const regular = await newContext(mode)
  const regularPage = await regular.newPage()
  const sessionsBefore = Number((await db.query('SELECT count(*) AS count FROM auth.sessions WHERE user_id=$1', [founder.id])).rows[0].count)
  await regularPage.goto(`${appOrigin}/login`)
  await regularPage.locator('#email').fill(fixtureEmail)
  await regularPage.locator('#password').fill(password)
  await regularPage.locator('#login-btn').click()
  await expect(regularPage.getByText('This account is for founder access only. Sign in at /admin/login.')).toBeVisible({ timeout: 30000 })
  check(Number((await db.query('SELECT count(*) AS count FROM auth.sessions WHERE user_id=$1', [founder.id])).rows[0].count) === sessionsBefore, 'customer login minted a founder provider session')
  await assertDenied(regular, 'customer login context reached founder API')
  const outsiderPassword = `Aa1!${randomBytes(32).toString('base64url')}`
  const outsider = ok(await service.auth.admin.createUser({ email: `outsider-${mode}@example.test`, password: outsiderPassword, email_confirm: true }), 'synthetic outsider creation failed').user
  fixtureUsers.push(outsider.id)
  await db.query("INSERT INTO public.profiles(id,role,org_id,email) VALUES($1,'admin',NULL,$2)", [outsider.id, `outsider-${mode}@example.test`])
  const cookies = new Map()
  const outsiderSdk = createServerClient(apiOrigin, anonKey, { global: { fetch: guardedFetch }, cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: all => all.forEach(cookie => cookies.set(cookie.name, cookie.value)) } })
  ok(await outsiderSdk.auth.signInWithPassword({ email: `outsider-${mode}@example.test`, password: outsiderPassword }), 'real outsider provider login failed')
  const outsiderIdentity = ok(await outsiderSdk.auth.getUser(), 'real outsider identity missing').user
  check(outsiderIdentity.id === outsider.id, 'real outsider UUID mismatch')
  const outsiderContext = await newContext(mode)
  await outsiderContext.addCookies([...cookies].map(([name, value]) => ({ name, value, url: appOrigin, sameSite: 'Lax' })))
  await assertDenied(outsiderContext, 'unrelated real admin identity reached privileged API')
  const outsiderPage = await outsiderContext.newPage()
  await outsiderPage.goto(`${appOrigin}/admin`)
  await expect(outsiderPage.getByRole('heading', { name: 'Today', exact: true })).toHaveCount(0)
  pass(`${mode}: normal customer login rejects founder before provider call; real unrelated admin API/page denied`)
  await outsiderSdk.auth.signOut({ scope: 'local' })
  stage = `${mode} founder focus revalidation before final signout`
  await page.bringToFront()
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible({ timeout: 30000 })
  const refocusedOverview = await context.request.get(`${appOrigin}/api/admin/overview`)
  check(refocusedOverview.status() === 200, 'focused founder session did not revalidate')
  const beforeFinalSignoutCookies = await context.cookies(appOrigin)
  await signOut(page)
  await assertSignedOut(context, founder.id, beforeFinalSignoutCookies, mode)
  for (const current of [context, regular, outsiderContext]) await current.close()
  await cleanupUsers()
  pass(`${mode}: provider API fixture deletion; zero Auth users remain`)
}

try {
  const reuseArg = process.argv[2]
  check(process.argv.length === 2 || (process.argv.length === 3 && reuseArg?.startsWith('--reuse-build=')), 'unrecognized command argument')
  check((statSync(statusFile).mode & 0o077) === 0, 'local status file must have private0600 permissions')
  const config = readFileSync(path.join(stackDir, 'supabase/config.toml'), 'utf8')
  check(/^project_id = "weavly-founder-auth-staging"$/m.test(config) && !existsSync(path.join(stackDir, 'supabase/.temp/project-ref')), 'unexpected or linked local stack')
  const status = JSON.parse(readFileSync(statusFile, 'utf8'))
  const api = localUrl(status.API_URL, 'http:', '55321')
  const dbUrl = localUrl(status.DB_URL, 'postgresql:', '55322')
  check(api.pathname === '/' && !api.username && !api.password && !api.search && !api.hash && dbUrl.pathname === '/postgres' && dbUrl.username === 'postgres' && !dbUrl.search && !dbUrl.hash, 'unexpected local endpoint structure')
  apiOrigin = api.origin; anonKey = status.ANON_KEY
  check(typeof anonKey === 'string' && typeof status.SERVICE_ROLE_KEY === 'string', 'local SDK keys unavailable')
  const nativeFetch = globalThis.fetch
  guardedFetch = async (input, init) => {
    const endpoint = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    check(endpoint.origin === apiOrigin && endpoint.hostname === '127.0.0.1', 'non-loopback SDK request blocked')
    const response = await nativeFetch(input, { ...init, redirect: 'manual' })
    check(response.status < 300 || response.status >= 400, 'local SDK redirect blocked')
    return response
  }
  db = new pg.Client({ connectionString: status.DB_URL, connectionTimeoutMillis: 10000, statement_timeout: 30000 })
  await db.connect()
  check(Number((await db.query('SELECT count(*) AS count FROM auth.users')).rows[0].count) === 0, 'local Auth not empty; refuse fixture overwrite')
  check(Number((await db.query('SELECT count(*) AS count FROM public.organizations')).rows[0].count) === 0, 'local organizations not empty; refuse customer fixtures')
  await assertNoOutboundJobs()
  const baselinePrivileges = (await db.query("SELECT name,has_table_privilege('service_role',format('public.%I',name),'SELECT') AS allowed FROM unnest($1::text[]) AS name", [baselineReadTables])).rows
  restoredBaselineReads = baselinePrivileges.filter(row => !row.allowed).map(row => row.name)
  if (restoredBaselineReads.length) await db.query(`GRANT SELECT ON ${restoredBaselineReads.map(name => `public.${name}`).join(',')} TO service_role`)
  check((await db.query("SELECT bool_and(has_table_privilege('service_role',format('public.%I',name),'SELECT')) AS allowed FROM unnest($1::text[]) AS name", [baselineReadTables])).rows[0].allowed, 'staging baseline service-only read parity unavailable')
  service = createClient(apiOrigin, status.SERVICE_ROLE_KEY, sdkOptions())
  pass('strict unlinked loopback/private status boundary; empty real Auth/application fixtures; no active outbound jobs')

  stage = 'archive exact HEAD / synthetic email substitution'
  commit = (await command('git', ['rev-parse', 'HEAD'], { cwd: repository })).toString('utf8').trim()
  stagingDir = reuseArg ? realpathSync(reuseArg.slice('--reuse-build='.length)) : mkdtempSync(path.join(tmpdir(), 'weavly-founder-browser-'))
  check(path.basename(stagingDir).startsWith('weavly-founder-browser-') && (statSync(stagingDir).mode & 0o077) === 0 && statSync(stagingDir).uid === process.getuid(), 'unsafe staging build directory')
  const appDir = path.join(stagingDir, 'app')
  const archive = await command('git', ['archive', commit], { cwd: repository })
  if (!reuseArg) {
    mkdirSync(appDir, { mode: 0o700 })
    await command('tar', ['-xf', '-', '-C', appDir], { input: archive })
  }
  check(readdirSync(appDir).every(file => !/^\.env(?:\.|$)/.test(file)), 'git archive includes an environment file')
  const literalFile = path.join(appDir, 'lib/admin/founder-email.ts')
  const original = readFileSync(literalFile, 'utf8')
  if (!reuseArg) {
    check(original.split("const APPROVED_FOUNDER_EMAIL = 'rajpatel86420@gmail.com'").length === 2, 'approved founder literal source changed')
    writeFileSync(literalFile, original.replace("const APPROVED_FOUNDER_EMAIL = 'rajpatel86420@gmail.com'", `const APPROVED_FOUNDER_EMAIL = '${fixtureEmail}'`))
    symlinkSync(path.join(repository, 'node_modules'), path.join(appDir, 'node_modules'))
  }
  const trackedFiles = (await command('git', ['ls-tree', '-r', '-z', '--name-only', commit], { cwd: repository })).toString('utf8').split('\0').filter(file => file && file !== 'next-env.d.ts')
  const sourceHashes = Object.fromEntries(trackedFiles.map(file => [file, createHash('sha256').update(readFileSync(path.join(appDir, file))).digest('hex')]))
  const sourceArchiveHash = createHash('sha256').update(archive).digest('hex')
  const anonFingerprint = createHash('sha256').update(anonKey).digest('hex')
  const manifestFile = path.join(stagingDir, 'built-source-manifest.json')
  if (reuseArg) {
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
    check(manifest.commit === commit && manifest.sourceArchiveHash === sourceArchiveHash && manifest.anonFingerprint === anonFingerprint && manifest.apiOrigin === apiOrigin && JSON.stringify(manifest.sourceHashes) === JSON.stringify(sourceHashes) && existsSync(path.join(appDir, '.next/BUILD_ID')), 'reuse build does not match exact source/environment')
  }
  const infra = writeInfrastructure()
  const moduleCache = path.join(tmpdir(), 'weavly-founder-browser-qr-module-cache')
  if (!existsSync(moduleCache)) mkdirSync(moduleCache, { mode: 0o700 })
  check((statSync(moduleCache).mode & 0o077) === 0 && statSync(moduleCache).uid === process.getuid(), 'unsafe local compiler cache')
  const decoderSourceHash = createHash('sha256').update(readFileSync(infra.swiftFile)).digest('hex')
  const decoderHashFile = path.join(stagingDir, 'qr-decoder-source.sha256')
  if (!existsSync(infra.decoder) || !existsSync(decoderHashFile) || readFileSync(decoderHashFile, 'utf8') !== decoderSourceHash) {
    await command('xcrun', ['swiftc', '-module-cache-path', moduleCache, infra.swiftFile, '-o', infra.decoder])
    writeFileSync(decoderHashFile, decoderSourceHash, { mode: 0o600 })
  }
  const env = childEnvironment(status, infra)
  stage = 'production webpack build'
  console.log(`BUILD exact commit ${commit}; one synthetic email substitution; typography-only cached fonts`)
  if (!reuseArg) {
    const buildLog = openSync(path.join(stagingDir, 'build-private.log'), 'w', 0o600)
    try { await command(process.execPath, [path.join(appDir, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], { cwd: appDir, env, stdio: ['ignore', buildLog, buildLog] }) } finally { closeSync(buildLog) }
    check(trackedFiles.every(file => sourceHashes[file] === createHash('sha256').update(readFileSync(path.join(appDir, file))).digest('hex')), 'build changed tracked runtime source')
    writeFileSync(manifestFile, JSON.stringify({ commit, sourceArchiveHash, anonFingerprint, apiOrigin, sourceHashes }), { mode: 0o600 })
  }
  pass('actual production webpack build; sanitized environment; unchanged Auth/CSP source; typography-only local cache fixture')
  stage = 'start built app / Chromium'
  await assertAppPortFree()
  const serverLog = openSync(path.join(stagingDir, 'server-private.log'), 'w', 0o600)
  let ownReady = false
  let bootFailure = false
  appProcess = spawn(process.execPath, [path.join(appDir, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '55330'], { cwd: appDir, env, stdio: ['ignore', 'pipe', serverLog] })
  appProcess.on('error', () => { bootFailure = true })
  appProcess.stdout.on('data', chunk => {
    // Only the fixed readiness marker is inspected; raw server logs stay private.
    if (/Ready in/.test(chunk.toString('utf8'))) ownReady = true
  })
  closeSync(serverLog)
  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (appProcess.exitCode !== null || bootFailure) break
    const response = ownReady ? await nativeFetch(`${buildSiteOrigin}/admin/login`, { headers: { Host: new URL(appOrigin).host }, redirect: 'manual' }).catch(() => null) : null
    if (response?.status === 200 && appProcess.exitCode === null && !bootFailure) { ready = true; break }
    await delay(1000)
  }
  check(ready, 'built staging app did not become ready')
  await startBrowserProxy()
  browser = await chromium.launch({ headless: true, proxy: { server: 'http://127.0.0.1:55331', bypass: '<-loopback>' } })
  await browserCycle('desktop', infra)
  await browserCycle('mobile', infra)
  await assertNoOutboundJobs()
  check(Number((await db.query('SELECT count(*) AS count FROM auth.users')).rows[0].count) === 0, 'final zero Auth cleanup proof failed')
  pass('final real provider cleanup and inactive/outbound-free job checks')
} catch (error) {
  failure = safeFailure(error)
  if (activePage && !activePage.isClosed()) safeUiState = await activePage.evaluate(() => {
    const knownMessages = [
      'Wrong email. Use the approved founder email to continue.',
      'Unable to sign in with these details. Check them and try again.',
      'Founder access is awaiting approved setup.',
      'This request could not be accepted. Refresh and try again.',
      'Too many attempts. Wait a few minutes and try again.',
      'Authenticator setup could not be completed. Reload or restart setup to try again.',
      'You are offline. Reconnect to view this private page.',
    ]
    return { path: location.pathname, knownMessages: knownMessages.filter(message => document.body.innerText.includes(message)) }
  }).catch(() => ({ unavailable: true }))
  console.error(`FAIL ${failure.stage}: ${failure.label}${failure.code ? ` (${failure.code})` : ''}`)
} finally {
  for (const context of contexts) await context.close().catch(() => undefined)
  if (browser) await browser.close().catch(() => undefined)
  if (browserProxy) browserProxy.closeAllConnections()
  if (browserProxy) await new Promise(resolve => browserProxy.close(resolve))
  if (appProcess && appProcess.exitCode === null) appProcess.kill('SIGTERM')
  try { await cleanupUsers() } catch { cleanupFailure = 'Synthetic cleanup failed; inspect only the isolated local stack before retrying'; console.error(`FAIL ${cleanupFailure}`) }
  if (db) await db.end().catch(() => undefined)
  writeFileSync(reportFile, JSON.stringify({ commit, passed: passes.length, groups: passes, failure, safeUiState, cleanupFailure, cleanupAuthCount, outboundBlocked, cspViolationCount, diagnostics, restoredBaselineReads, baselineReadParityTables: baselineReadTables, buildSiteOrigin, canonicalAppOrigin: appOrigin, stagingDir, scope: 'real built production Next app and local real Supabase browser acceptance', limitations: ['Synthetic approved-email substitution only in archived staging copy', 'Canonical localhost browser origin maps only to pinned TCP127; build SITE_URL remains127; reset/email/callback flows not exercised', 'Staging service-role SELECT restored only on allowlisted existing baseline tables from independently read hosted grant metadata; private/new/client grants unchanged', 'Typography-only cached actual Inter/Geist; unused landing Anek transport uses cached Inter fallback', 'Desktop/mobile emulation uses Chromium; no physical device or hosted acceptance', 'No production credentials, migrations, recovery, deployment or actual founder setup exercised', 'No QR/auth screenshots, traces, videos, storageState or secret artifacts'] }, null, 2), { mode: 0o600 })
  console.log(`RESULT ${failure || cleanupFailure ? 'FAILED' : 'PASSED'}; ${passes.length} groups; cleanup ${cleanupFailure ? 'FAILED' : cleanupAuthCount === 0 ? 'zero Auth proof completed' : 'not verified'}; report ${reportFile}`)
  if (failure || cleanupFailure) process.exitCode = 1
}
