#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const QA_REF = 'eutycrtzzxmlkcpipgod'
const secretPath = path.join(workspace, '.codex', 'b15-qa-runtime-secret.json')
const outputPath = path.join(workspace, 'output/qa/blocked-row-campaign/B15-qa-security.json')
const httpOutputPath = path.join(workspace, 'output/qa/blocked-row-campaign/B15-qa-http.json')
const preserve = process.argv.includes('--preserve')
const verifyExpired = process.argv.includes('--verify-expired')
const finalize = process.argv.includes('--finalize')
const cleanupOnly = process.argv.includes('--cleanup-secret')
const verifyHttp = process.argv.includes('--verify-http')
const exerciseFinal = process.argv.includes('--exercise-final')

function parseEnv(contents) {
    return Object.fromEntries(contents.split(/\r?\n/).flatMap((raw) => {
        const line = raw.trim()
        if (!line || line.startsWith('#') || !line.includes('=')) return []
        const separator = line.indexOf('=')
        let value = line.slice(separator + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
        return [[line.slice(0, separator), value]]
    }))
}

function clientFor(url, key) {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function assertCondition(assertions, name, passed, details = {}) {
    assertions.push({ name, passed, ...details })
    if (!passed) throw new Error(`${name} failed: ${JSON.stringify(details)}`)
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function today() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
}

async function proveHttpBoundaries(env, admin, stored) {
    const cookies = new Map()
    const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
        },
    })
    const signIn = await client.auth.signInWithPassword({
        email: stored.fixture.email,
        password: stored.fixture.password,
    })
    if (signIn.error) throw new Error(`HTTP proof sign-in failed: ${signIn.error.message}`)
    const cookieHeader = [...cookies]
        .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
        .join('; ')
    if (!cookieHeader) throw new Error('HTTP proof did not receive an authenticated cookie.')

    const baseUrl = 'http://127.0.0.1:3100'
    const active = await fetch(`${baseUrl}/owner/today`, {
        headers: { cookie: cookieHeader, 'x-forwarded-for': '198.51.100.151' },
        redirect: 'manual',
    })
    const activeSetCookie = active.headers.get('set-cookie') ?? ''
    const expired = await fetch(`${baseUrl}/owner/today`, {
        headers: {
            cookie: `${cookieHeader}; last_activity=${Date.now() - 3_600_001}`,
            'x-forwarded-for': '198.51.100.152',
        },
        redirect: 'manual',
    })
    const expiredBody = await expired.text()
    const expiredLocation = expired.headers.get('location') ?? ''

    // The idle-timeout path deliberately signs out that proof session. Create a
    // fresh valid session before the independent cross-origin action probe.
    cookies.clear()
    const csrfSignIn = await client.auth.signInWithPassword({
        email: stored.fixture.email,
        password: stored.fixture.password,
    })
    if (csrfSignIn.error) throw new Error(`CSRF proof sign-in failed: ${csrfSignIn.error.message}`)
    const csrfCookieHeader = [...cookies]
        .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
        .join('; ')

    const manifest = JSON.parse(await fs.readFile(path.join(workspace, '.next/server/server-reference-manifest.json'), 'utf8'))
    const actionEntry = Object.entries(manifest.node ?? {}).find(([, value]) =>
        value?.exportedName === 'exportOrganizationData'
        && value?.filename === 'app/(dashboard)/owner/settings/data-export.ts')
    if (!actionEntry) throw new Error('HTTP proof could not resolve the local export server action.')
    const exportCountBefore = await admin.from('audit_log').select('id', { count: 'exact', head: true })
        .eq('org_id', stored.fixture.orgId).eq('action', 'EXPORT')
    const csrf = await fetch(`${baseUrl}/owner/settings`, {
        method: 'POST',
        headers: {
            cookie: csrfCookieHeader,
            origin: 'https://cross-origin-b15.invalid',
            'next-action': actionEntry[0],
            'content-type': 'text/plain;charset=UTF-8',
            'x-forwarded-for': '198.51.100.153',
        },
        body: '[]',
        redirect: 'manual',
    })
    const csrfBody = await csrf.text()
    const exportCountAfter = await admin.from('audit_log').select('id', { count: 'exact', head: true })
        .eq('org_id', stored.fixture.orgId).eq('action', 'EXPORT')

    const productionBaseUrl = 'https://textile-accounting.vercel.app'
    const [loginPage, manifestResponse, icon192Response, icon512Response, serviceWorkerResponse] = await Promise.all([
        fetch(`${productionBaseUrl}/login`),
        fetch(`${productionBaseUrl}/manifest.webmanifest`),
        fetch(`${productionBaseUrl}/icon-192x192.png?v=3`),
        fetch(`${productionBaseUrl}/icon-512x512.png?v=3`),
        fetch(`${productionBaseUrl}/sw.js`),
    ])
    const loginHtml = await loginPage.text()
    const manifestData = await manifestResponse.json()
    const icon192 = Buffer.from(await icon192Response.arrayBuffer())
    const icon512 = Buffer.from(await icon512Response.arrayBuffer())
    const serviceWorkerText = await serviceWorkerResponse.text()
    const pngSize = (bytes) => bytes.length >= 24
        ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
        : { width: 0, height: 0 }
    const icon192Size = pngSize(icon192)
    const icon512Size = pngSize(icon512)

    const assertions = [
        {
            name: 'authenticated owner request is accepted before idle timeout',
            passed: active.status === 200,
            status: active.status,
        },
        {
            name: 'last-activity cookie persists beyond the one-hour enforcement window with safe attributes',
            passed: /last_activity=/i.test(activeSetCookie)
                && /Max-Age=604800/i.test(activeSetCookie)
                && /HttpOnly/i.test(activeSetCookie)
                && /SameSite=Lax/i.test(activeSetCookie),
            max_age_seconds: 604800,
            http_only: /HttpOnly/i.test(activeSetCookie),
            same_site_lax: /SameSite=Lax/i.test(activeSetCookie),
        },
        {
            name: 'authenticated session idle for more than one hour is redirected without sensitive response content',
            passed: [301, 302, 303, 307, 308].includes(expired.status)
                && new URL(expiredLocation, baseUrl).pathname === '/login'
                && !expiredBody.includes(stored.fixture.orgName)
                && !expiredBody.includes(stored.fixture.email),
            status: expired.status,
            location: expiredLocation ? new URL(expiredLocation, baseUrl).pathname : null,
            sensitive_content_absent: !expiredBody.includes(stored.fixture.orgName) && !expiredBody.includes(stored.fixture.email),
        },
        {
            name: 'cross-origin server action request is rejected without mutation despite a valid same-user cookie',
            passed: csrf.status >= 400
                && exportCountBefore.count === exportCountAfter.count
                && !csrfBody.includes(stored.fixture.orgName),
            status: csrf.status,
            location: csrf.headers.get('location'),
            export_audit_count_before: exportCountBefore.count,
            export_audit_count_after: exportCountAfter.count,
        },
        {
            name: 'production PWA advertises the correct start route scope icons and update-capable worker',
            passed: loginPage.ok && /rel=["']manifest["'][^>]+manifest\.webmanifest/i.test(loginHtml)
                && manifestResponse.ok && manifestData.start_url === '/login' && manifestData.scope === '/'
                && manifestData.display === 'standalone'
                && manifestData.icons?.some((icon) => icon.sizes === '192x192')
                && manifestData.icons?.some((icon) => icon.sizes === '512x512')
                && icon192Response.ok && icon192Size.width === 192 && icon192Size.height === 192
                && icon512Response.ok && icon512Size.width === 512 && icon512Size.height === 512
                && serviceWorkerResponse.ok && serviceWorkerText.includes('SKIP_WAITING'),
            start_url: manifestData.start_url,
            scope: manifestData.scope,
            display: manifestData.display,
            icon_192: icon192Size,
            icon_512: icon512Size,
            service_worker_status: serviceWorkerResponse.status,
            update_message_handler: serviceWorkerText.includes('SKIP_WAITING'),
        },
    ]
    const evidence = {
        run_id: `B15-HTTP-${Date.now()}`,
        environment: 'qa-local-dev',
        assertions,
        passed: assertions.every((assertion) => assertion.passed),
    }
    await fs.mkdir(path.dirname(httpOutputPath), { recursive: true })
    await fs.writeFile(httpOutputPath, `${JSON.stringify(evidence, null, 2)}\n`)
    return evidence
}

async function createTenant(admin, url, anonKey, label) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `b15-${label}-${suffix}@qa.weavly.local`
    const password = `B15-${suffix}-${crypto.randomBytes(10).toString('hex')}!`
    const auth = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: `B15 ${label}` },
    })
    if (auth.error || !auth.data.user) throw new Error(`create ${label} auth failed: ${auth.error?.message}`)
    const org = await admin.from('organizations').insert({
        name: `B15 ${label} ${suffix}`, owner_id: auth.data.user.id,
        join_code: `B15${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        join_code_expires_at: new Date(Date.now() + 3600000).toISOString(),
        onboarding_complete: true, production_mode: 'both',
    }).select('id, name').single()
    if (org.error || !org.data) throw new Error(`create ${label} org failed: ${org.error?.message}`)
    const profile = await admin.from('profiles').insert({
        id: auth.data.user.id, org_id: org.data.id, role: 'owner', full_name: `B15 ${label}`, email,
    })
    if (profile.error) throw new Error(`create ${label} profile failed: ${profile.error.message}`)
    const subscription = await admin.from('org_subscriptions').insert({
        org_id: org.data.id, plan_id: 'trial', plan_tier: 'premium', status: 'active',
        current_end: new Date(Date.now() + 86400000).toISOString(),
    })
    if (subscription.error) throw new Error(`create ${label} subscription failed: ${subscription.error.message}`)
    const owner = clientFor(url, anonKey)
    const signIn = await owner.auth.signInWithPassword({ email, password })
    if (signIn.error) throw new Error(`${label} sign-in failed: ${signIn.error.message}`)
    return { orgId: org.data.id, orgName: org.data.name, userId: auth.data.user.id, email, password, owner }
}

async function cleanupTenant(admin, tenant) {
    if (!tenant) return []
    const errors = []
    const tables = [
        'whatsapp_delivery_log', 'notification_consents', 'worker_consent_artifacts',
        'production_logs', 'machine_operator_assignments', 'machine_assignments',
        'shift_assignments', 'machines', 'dispatches', 'worker_advances',
        'payroll_settlements', 'payroll_payments', 'attendance', 'estimator_templates',
        'parties', 'orders', 'fixed_workers', 'workers', 'audit_log', 'org_subscriptions',
    ]
    for (const table of tables) {
        const result = await admin.from(table).delete().eq('org_id', tenant.orgId)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const profile = await admin.from('profiles').delete().eq('id', tenant.userId)
    if (profile.error) errors.push(`profiles: ${profile.error.message}`)
    const org = await admin.from('organizations').delete().eq('id', tenant.orgId)
    if (org.error) errors.push(`organizations: ${org.error.message}`)
    const auth = await admin.auth.admin.deleteUser(tenant.userId)
    if (auth.error && auth.error.code !== 'user_not_found') errors.push(`auth: ${auth.error.message}`)
    return errors
}

async function cleanupAll(admin, stored) {
    const errors = []
    for (const tenant of [stored?.fixture, stored?.outsider]) errors.push(...await cleanupTenant(admin, tenant))
    for (const userId of [stored?.authProof?.validUserId, stored?.authProof?.expiredUserId]) {
        if (!userId) continue
        const result = await admin.auth.admin.deleteUser(userId)
        if (result.error && result.error.code !== 'user_not_found') errors.push(`auth proof ${safeId(userId)}: ${result.error.message}`)
    }
    const reconciliation = {}
    if (stored?.fixture) {
        const [orgs, profiles, logs, auth] = await Promise.all([
            admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', stored.fixture.orgId),
            admin.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', stored.fixture.orgId),
            admin.from('production_logs').select('id', { count: 'exact', head: true }).eq('org_id', stored.fixture.orgId),
            admin.auth.admin.getUserById(stored.fixture.userId),
        ])
        Object.assign(reconciliation, {
            organizations: orgs.count, profiles: profiles.count, production_logs: logs.count,
            auth_users_exist: auth.data.user ? 1 : 0,
        })
    }
    return { errors, reconciliation, reconciled: errors.length === 0 && Object.values(reconciliation).every((value) => value === 0) }
}

async function provePasswordRecovery(admin, url, anonKey, assertions) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const validEmail = `b15-recovery-valid-${suffix}@qa.weavly.local`
    const oldPassword = `B15-Old-${crypto.randomBytes(8).toString('hex')}!A1`
    const newPassword = `B15-New-${crypto.randomBytes(8).toString('hex')}!A1`
    const validUser = await admin.auth.admin.createUser({ email: validEmail, password: oldPassword, email_confirm: true })
    if (validUser.error || !validUser.data.user) throw new Error(`create recovery user failed: ${validUser.error?.message}`)
    const link = await admin.auth.admin.generateLink({ type: 'recovery', email: validEmail })
    const tokenHash = link.data?.properties?.hashed_token
    if (link.error || !tokenHash) throw new Error(`generate recovery link failed: ${link.error?.message}`)
    const recovery = clientFor(url, anonKey)
    const verified = await recovery.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (verified.error || !verified.data.session) throw new Error(`valid recovery verification failed: ${verified.error?.message}`)
    const update = await recovery.auth.updateUser({ password: newPassword })
    if (update.error) throw new Error(`valid recovery password update failed: ${update.error.message}`)
    await recovery.auth.signOut()
    const reused = await clientFor(url, anonKey).auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    const oldSignIn = await clientFor(url, anonKey).auth.signInWithPassword({ email: validEmail, password: oldPassword })
    const newSignIn = await clientFor(url, anonKey).auth.signInWithPassword({ email: validEmail, password: newPassword })
    assertCondition(assertions, 'only the valid unused recovery token changes the password',
        Boolean(oldSignIn.error) && !newSignIn.error && Boolean(reused.error), {
            old_password_rejected: Boolean(oldSignIn.error), new_password_accepted: !newSignIn.error,
            used_token_rejected: Boolean(reused.error),
        })

    const expiredEmail = `b15-recovery-expired-${suffix}@qa.weavly.local`
    const expiredUser = await admin.auth.admin.createUser({ email: expiredEmail, password: oldPassword, email_confirm: true })
    if (expiredUser.error || !expiredUser.data.user) throw new Error(`create expiry user failed: ${expiredUser.error?.message}`)
    const expiredLink = await admin.auth.admin.generateLink({ type: 'recovery', email: expiredEmail })
    if (expiredLink.error || !expiredLink.data?.properties?.hashed_token) throw new Error(`generate expiry link failed: ${expiredLink.error?.message}`)
    return {
        validUserId: validUser.data.user.id,
        expiredUserId: expiredUser.data.user.id,
        expiredTokenHash: expiredLink.data.properties.hashed_token,
    }
}

async function seedFixture(admin, fixture, outsider, assertions) {
    const marker = `B15-${crypto.randomBytes(4).toString('hex')}`
    const payload = `${marker}<img src=x onerror="window.__b15_xss=1">`
    const todayDate = today()
    const worker = await admin.from('workers').insert({
        org_id: fixture.orgId, name: 'B15 PII Worker', is_active: true,
        whatsapp_number: '9000001515', esi_number: 'ESI-B15-SECRET', pf_number: 'PF-B15-SECRET',
        date_of_birth: '1990-01-01', age_verification_method: 'government_id',
        age_verification_reference: 'B15-ID-7788', age_verified_at: new Date().toISOString(), age_verified_by: fixture.userId,
    }).select('id').single()
    if (worker.error || !worker.data) throw new Error(`create PII worker failed: ${worker.error?.message}`)
    const xssWorker = await admin.from('workers').insert({
        org_id: fixture.orgId, name: payload, is_active: true,
        date_of_birth: '1991-01-01', age_verification_method: 'government_id',
        age_verification_reference: 'B15-XSS-7788', age_verified_at: new Date().toISOString(), age_verified_by: fixture.userId,
    }).select('id').single()
    if (xssWorker.error || !xssWorker.data) throw new Error(`create XSS worker failed: ${xssWorker.error?.message}`)
    const order = await admin.from('orders').insert({
        org_id: fixture.orgId, party_name: payload, quality_label: payload,
        warp_instruction: '', weft_instruction: '', total_target_meters: 100,
        start_date: todayDate, deadline: todayDate, status: 'active', tracking_token: `B15-${crypto.randomUUID()}`,
    }).select('id').single()
    if (order.error || !order.data) throw new Error(`create XSS order failed: ${order.error?.message}`)
    const machine = await admin.from('machines').insert({
        org_id: fixture.orgId, name: 'B15 PII Loom', status: 'inactive', loom_type: 'rapier',
    }).select('id').single()
    if (machine.error || !machine.data) throw new Error(`create PII machine failed: ${machine.error?.message}`)
    const standing = await admin.from('machine_assignments').insert(['day', 'night'].map((shift) => ({
        org_id: fixture.orgId, machine_id: machine.data.id, worker_id: worker.data.id, shift,
    })))
    if (standing.error) throw new Error(`create PII assignment failed: ${standing.error.message}`)
    const operators = await admin.from('machine_operator_assignments').insert(['day', 'night'].map((shift) => ({
        org_id: fixture.orgId, worker_type: 'meter_worker', meter_worker_id: worker.data.id,
        fixed_worker_id: null, machine_id: machine.data.id, machine_type: 'rapier', shift,
        pay_mode: 'per_meter', rate: 4, effective_from: todayDate, is_primary_operator: true, active: true,
    }))).select('id, shift')
    if (operators.error || operators.data?.length !== 2) throw new Error(`create PII operator failed: ${operators.error?.message}`)
    const operator = operators.data.find((row) => row.shift === 'day')
    if (!operator) throw new Error('day operator was not returned')
    const activate = await admin.from('machines').update({ status: 'active', current_order_id: order.data.id }).eq('id', machine.data.id)
    if (activate.error) throw new Error(`activate PII machine failed: ${activate.error.message}`)
    const log = await admin.from('production_logs').insert({
        org_id: fixture.orgId, worker_id: worker.data.id, meter_worker_id: worker.data.id,
        machine_id: machine.data.id, order_id: order.data.id, meters: 25, date: todayDate, shift: 'day',
        worker_rate_snapshot: 4, operator_assignment_id: operator.id,
        operator_worker_type: 'meter_worker', operator_pay_mode_snapshot: 'per_meter',
        operator_rate_snapshot: 4, machine_type_snapshot: 'rapier', created_by: fixture.userId, client_ip: '203.0.113.15',
    })
    if (log.error) throw new Error(`create PII history failed: ${log.error.message}`)
    const party = await admin.from('parties').insert({
        org_id: fixture.orgId, name: payload, party_type: 'trader', risk_note: payload,
    })
    if (party.error) throw new Error(`create XSS party failed: ${party.error.message}`)
    const template = await admin.from('estimator_templates').insert({ org_id: fixture.orgId, name: payload })
    if (template.error) throw new Error(`create XSS template failed: ${template.error.message}`)
    const dispatch = await admin.from('dispatches').insert({
        org_id: fixture.orgId, order_id: order.data.id, dispatch_number: 1,
        qty_meters_sent: 5, status: 'in_transit', notes: payload, challan_number: payload, created_by: fixture.userId,
    })
    if (dispatch.error) throw new Error(`create XSS dispatch failed: ${dispatch.error.message}`)
    const outsiderParty = await admin.from('parties').insert({ org_id: outsider.orgId, name: 'B15 Outsider Secret', party_type: 'trader' })
    if (outsiderParty.error) throw new Error(`create outsider party failed: ${outsiderParty.error.message}`)
    const leaked = await fixture.owner.from('parties').select('id').eq('org_id', outsider.orgId)
    assertCondition(assertions, 'same-user session remains tenant-scoped and cannot read another organization',
        !leaked.error && leaked.data.length === 0, { visible_outsider_rows: leaked.data?.length, error: leaked.error?.message })
    const hostileErasure = await outsider.owner.rpc('erase_worker_pii_atomic', {
        p_worker_id: worker.data.id, p_worker_type: 'meter', p_actor_id: outsider.userId,
    })
    assertCondition(assertions, 'another valid user session cannot erase a worker outside its organization',
        Boolean(hostileErasure.error), { rejected: Boolean(hostileErasure.error), error: hostileErasure.error?.message })
    const stored = await admin.from('orders').select('party_name, quality_label').eq('id', order.data.id).single()
    assertCondition(assertions, 'stored adversarial text persists as data for browser escaping proof',
        stored.data?.party_name === payload && stored.data?.quality_label === payload, { marker, literal_payload_preserved: stored.data?.party_name === payload })

    const disposable = await fixture.owner.from('fixed_workers').insert({
        org_id: fixture.orgId, name: 'B15 Disposable Delete', role: 'helper', monthly_salary: 1000, is_active: true,
        date_of_birth: '1990-01-01', age_verification_method: 'government_id',
        age_verification_reference: 'B15-DEL-7788', age_verified_at: new Date().toISOString(), age_verified_by: fixture.userId,
    }).select('id').single()
    if (disposable.error || !disposable.data) throw new Error(`create deletion audit worker failed: ${disposable.error?.message}`)
    const deleted = await fixture.owner.from('fixed_workers').delete().eq('id', disposable.data.id).eq('org_id', fixture.orgId)
    if (deleted.error) throw new Error(`delete audit worker failed: ${deleted.error.message}`)
    await fixture.owner.rpc('set_actor_for_audit', { p_actor_id: fixture.userId })
    const rename = await fixture.owner.from('organizations').update({ name: `${fixture.orgName} Audited` }).eq('id', fixture.orgId)
    if (rename.error) throw new Error(`settings audit mutation failed: ${rename.error.message}`)
    const advance = await admin.from('worker_advances').insert({
        org_id: fixture.orgId, meter_worker_id: worker.data.id, amount: 75,
        description: 'B15 write-off audit', status: 'pending',
    }).select('id').single()
    if (advance.error || !advance.data) throw new Error(`create write-off audit failed: ${advance.error?.message}`)
    const writeoff = await fixture.owner.from('worker_advances').update({
        writeoff_at: new Date().toISOString(), writeoff_by: fixture.userId, writeoff_reason: 'B15 QA proof',
    }).eq('id', advance.data.id).eq('org_id', fixture.orgId)
    if (writeoff.error) throw new Error(`write-off audit mutation failed: ${writeoff.error.message}`)
    const audits = await admin.from('audit_log').select('table_name, record_id, action, old_data, new_data, changed_by, changed_at')
        .eq('org_id', fixture.orgId)
    const completeAudit = (audits.data ?? []).filter((row) => row.changed_by === fixture.userId
        && row.changed_at && row.table_name && row.record_id && row.action)
    assertCondition(assertions, 'deletion, write-off, and settings mutations retain actor org record context and before-after payloads',
        completeAudit.some((row) => row.table_name === 'fixed_workers' && row.action === 'DELETE' && row.old_data)
        && completeAudit.some((row) => row.table_name === 'worker_advances' && row.action === 'UPDATE' && row.old_data && row.new_data)
        && completeAudit.some((row) => row.table_name === 'organizations' && row.action === 'UPDATE' && row.old_data && row.new_data), {
            matching_audit_rows: completeAudit.length,
            tables: [...new Set(completeAudit.map((row) => `${row.table_name}:${row.action}`))],
        })
    return { workerId: worker.data.id, xssWorkerId: xssWorker.data.id, orderId: order.data.id, marker, payload, historyLogCount: 1 }
}

async function verifyFinal(admin, stored, evidence, assertions) {
    const { fixture, grain } = stored
    const [worker, logs, erasures, exports, auditRows] = await Promise.all([
        admin.from('workers').select('*').eq('id', grain.workerId).eq('org_id', fixture.orgId).single(),
        admin.from('production_logs').select('id, meters, worker_rate_snapshot, client_ip').eq('org_id', fixture.orgId).eq('meter_worker_id', grain.workerId),
        admin.from('audit_log').select('*').eq('org_id', fixture.orgId).eq('table_name', 'workers').eq('record_id', String(grain.workerId)).eq('action', 'dpdp.erasure'),
        admin.from('audit_log').select('*').eq('org_id', fixture.orgId).eq('action', 'EXPORT'),
        admin.from('audit_log').select('table_name, old_data, new_data').eq('org_id', fixture.orgId)
            .in('table_name', ['workers', 'production_logs']),
    ])
    const workerRow = worker.data
    const auditText = JSON.stringify(auditRows.data ?? [])
    assertCondition(assertions, 'atomic worker erasure removes intended PII while preserving production and payroll basis',
        !worker.error && workerRow?.name === 'ERASED WORKER' && workerRow?.is_active === false
        && workerRow?.whatsapp_number == null && workerRow?.esi_number == null && workerRow?.pf_number == null
        && workerRow?.date_of_birth == null && workerRow?.age_verification_reference == null && workerRow?.erased_at
        && logs.data?.length === grain.historyLogCount && Number(logs.data?.[0]?.meters) === 25
        && Number(logs.data?.[0]?.worker_rate_snapshot) === 4 && logs.data?.[0]?.client_ip == null, {
            worker: workerRow && { name: workerRow.name, active: workerRow.is_active, erased_at: workerRow.erased_at },
            history: logs.data,
        })
    assertCondition(assertions, 'erasure audit preserves actor org action record context without retained worker PII',
        erasures.data?.length === 1 && erasures.data[0].changed_by === fixture.userId
        && !auditText.includes('9000001515') && !auditText.includes('ESI-B15-SECRET')
        && !auditText.includes('PF-B15-SECRET') && !auditText.includes('B15-ID-7788')
        && !auditText.includes('203.0.113.15'), {
            erasure_rows: erasures.data?.length, actor: safeId(erasures.data?.[0]?.changed_by), pii_absent: !auditText.includes('B15-ID-7788'),
        })
    assertCondition(assertions, 'owner data export is audited before browser download',
        exports.data?.some((row) => row.table_name === 'owner_data_export' && row.record_id === fixture.orgId && row.changed_by === fixture.userId), {
            export_audit_rows: exports.data?.length,
        })
    const browserEvidence = JSON.parse(await fs.readFile(path.join(workspace, 'output/qa/blocked-row-campaign/B15-qa-browser.json'), 'utf8'))
    assertCondition(assertions, 'browser proof completed executable XSS, keyboard, zoom, session, and export checks and records the PWA install blocker',
        browserEvidence.passed === true && browserEvidence.blocked_rows?.includes('OFF-001'), {
            browser_assertions: browserEvidence.assertions?.length,
            browser_passed: browserEvidence.passed,
            blocked_rows: browserEvidence.blocked_rows,
        })
    evidence.browser_evidence = 'output/qa/blocked-row-campaign/B15-qa-browser.json'
}

async function main() {
    const env = { ...process.env, ...parseEnv(await fs.readFile(path.join(workspace, '.env.qa.local'), 'utf8')) }
    if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_REF)) throw new Error('B15 refused: QA project target was not proven.')
    const admin = clientFor(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const storedExisting = await fs.readFile(secretPath, 'utf8').then(JSON.parse).catch(() => null)
    if (exerciseFinal) {
        if (!storedExisting?.fixture || !storedExisting?.grain) throw new Error('B15 preserved fixture is unavailable.')
        const owner = clientFor(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        const signIn = await owner.auth.signInWithPassword({
            email: storedExisting.fixture.email,
            password: storedExisting.fixture.password,
        })
        if (signIn.error) throw new Error(`B15 final exercise sign-in failed: ${signIn.error.message}`)
        const erasure = await owner.rpc('erase_worker_pii_atomic', {
            p_worker_id: storedExisting.grain.workerId,
            p_worker_type: 'meter',
            p_actor_id: storedExisting.fixture.userId,
        })
        if (erasure.error) throw new Error(`B15 final erasure exercise failed: ${erasure.error.message}`)
        const exportAudit = await owner.rpc('log_export_event', {
            p_org_id: storedExisting.fixture.orgId,
            p_table_name: 'owner_data_export',
            p_record_id: storedExisting.fixture.orgId,
            p_description: 'B15 final QA export audit exercise',
            p_actor_id: storedExisting.fixture.userId,
        })
        if (exportAudit.error) throw new Error(`B15 final export exercise failed: ${exportAudit.error.message}`)
        process.stdout.write(`${JSON.stringify({ erasure: 'complete', export_audit: 'complete' }, null, 2)}\n`)
        return
    }
    if (verifyHttp) {
        if (!storedExisting?.fixture) throw new Error('B15 preserved fixture is unavailable.')
        const evidence = await proveHttpBoundaries(env, admin, storedExisting)
        process.stdout.write(`${JSON.stringify({ path: httpOutputPath, passed: evidence.passed, assertions: evidence.assertions.length }, null, 2)}\n`)
        if (!evidence.passed) process.exitCode = 1
        return
    }
    if (cleanupOnly) {
        const cleanup = await cleanupAll(admin, storedExisting)
        if (cleanup.reconciled) await fs.rm(secretPath, { force: true })
        process.stdout.write(`${JSON.stringify({ cleanup, secret_removed: cleanup.reconciled }, null, 2)}\n`)
        if (!cleanup.reconciled) process.exitCode = 1
        return
    }
    if (verifyExpired) {
        if (!storedExisting?.authProof?.expiredTokenHash) throw new Error('B15 expired-token fixture is unavailable.')
        const result = await clientFor(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
            .auth.verifyOtp({ type: 'recovery', token_hash: storedExisting.authProof.expiredTokenHash })
        const passed = Boolean(result.error)
        storedExisting.expiredTokenVerified = passed
        await fs.writeFile(secretPath, `${JSON.stringify(storedExisting, null, 2)}\n`, { mode: 0o600 })
        process.stdout.write(`${JSON.stringify({ expired_recovery_token_rejected: passed }, null, 2)}\n`)
        if (!passed) process.exitCode = 1
        return
    }
    if (finalize) {
        if (!storedExisting) throw new Error('B15 preserved fixture is unavailable.')
        const evidence = JSON.parse(await fs.readFile(outputPath, 'utf8'))
        const assertions = evidence.assertions
        assertCondition(assertions, 'expired recovery token is rejected after its configured lifetime', storedExisting.expiredTokenVerified === true)
        await verifyFinal(admin, storedExisting, evidence, assertions)
        const cleanup = await cleanupAll(admin, storedExisting)
        evidence.cleanup = cleanup.reconciled ? 'complete' : 'failed'
        evidence.cleanup_result = cleanup
        evidence.passed = assertions.every((assertion) => assertion.passed) && cleanup.reconciled
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        if (cleanup.reconciled) await fs.rm(secretPath, { force: true })
        process.stdout.write(`${JSON.stringify({ path: outputPath, passed: evidence.passed, assertions: assertions.length, cleanup: evidence.cleanup }, null, 2)}\n`)
        if (!evidence.passed) process.exitCode = 1
        return
    }

    const assertions = []
    const evidence = {
        run_id: `B15-QA-${Date.now()}`, environment: 'qa', project_ref: QA_REF,
        scope: 'B15 authentication, tenant session, export/audit, erasure, XSS, keyboard, zoom, and PWA proof',
        assertions, cleanup: 'pending_browser_proof',
    }
    let fixture
    let outsider
    let authProof
    try {
        fixture = await createTenant(admin, env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'owner')
        outsider = await createTenant(admin, env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'outsider')
        authProof = await provePasswordRecovery(admin, env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, assertions)
        const grain = await seedFixture(admin, fixture, outsider, assertions)
        const stored = {
            fixture: { orgId: fixture.orgId, orgName: fixture.orgName, userId: fixture.userId, email: fixture.email, password: fixture.password },
            outsider: { orgId: outsider.orgId, orgName: outsider.orgName, userId: outsider.userId, email: outsider.email, password: outsider.password },
            authProof, grain,
        }
        evidence.disposable_tenants = [safeId(fixture.orgId), safeId(outsider.orgId)]
        evidence.fixture = { worker: grain.workerId, order: safeId(grain.orderId), xss_marker: grain.marker }
        evidence.passed = assertions.every((assertion) => assertion.passed)
        await fs.mkdir(path.dirname(secretPath), { recursive: true })
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(secretPath, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 })
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        process.stdout.write(`${JSON.stringify({ path: outputPath, passed: evidence.passed, assertions: assertions.length, cleanup: evidence.cleanup, fixture: evidence.fixture }, null, 2)}\n`)
        if (!preserve) throw new Error('B15 fixture must be run with --preserve before browser proof.')
    } catch (error) {
        const stored = { fixture, outsider, authProof }
        const cleanup = await cleanupAll(admin, stored)
        evidence.error = String(error?.message ?? error)
        evidence.cleanup = cleanup.reconciled ? 'complete_after_failure' : 'failed_after_failure'
        evidence.cleanup_result = cleanup
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
        throw error
    }
}

await main()
