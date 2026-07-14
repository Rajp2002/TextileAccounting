#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const QA_REF = 'eutycrtzzxmlkcpipgod'
const outputPath = path.join(workspace, 'output/qa/blocked-row-campaign/B16-qa-whatsapp.json')

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

function assertCondition(assertions, id, name, passed, details = {}) {
    assertions.push({ id, name, passed, ...details })
    if (!passed) throw new Error(`${id} ${name} failed: ${JSON.stringify(details)}`)
}

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

async function invoke(env, name, body, query = '') {
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}${query}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`${name} returned ${response.status}: ${JSON.stringify(json)}`)
    return json
}

async function createFixture(admin) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `b16-owner-${suffix}@qa.weavly.local`
    const password = `B16-${crypto.randomBytes(12).toString('hex')}!A1`
    const auth = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (auth.error || !auth.data.user) throw new Error(`owner auth failed: ${auth.error?.message}`)
    const userId = auth.data.user.id
    let orgId
    try {
        const org = await admin.from('organizations').insert({
            name: `B16 WhatsApp ${suffix}`,
            owner_id: userId,
            join_code: `B16${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            join_code_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
            onboarding_complete: true,
            production_mode: 'both',
            access_code_hash: crypto.createHash('sha256').update('B16ABC').digest('hex'),
            access_code_expires_at: new Date(Date.now() + 900_000).toISOString(),
        }).select('id, name, access_code_hash').single()
        if (org.error || !org.data) throw new Error(`org failed: ${org.error?.message}`)
        orgId = org.data.id
        const ownerPhone = '9000001699'
        const profile = await admin.from('profiles').insert({
            id: userId,
            org_id: orgId,
            role: 'owner',
            full_name: 'B16 Owner',
            email,
            whatsapp_number: ownerPhone,
            whatsapp_opted_in: true,
            whatsapp_opted_in_at: new Date().toISOString(),
        })
        if (profile.error) throw new Error(`profile failed: ${profile.error.message}`)
        return { orgId, orgName: org.data.name, userId, ownerPhone, accessCodeHash: org.data.access_code_hash }
    } catch (error) {
        if (orgId) await admin.from('organizations').delete().eq('id', orgId)
        await admin.auth.admin.deleteUser(userId)
        throw error
    }
}

async function createWorker(admin, fixture, label, phone) {
    const worker = await admin.from('workers').insert({
        org_id: fixture.orgId,
        name: `B16 ${label}`,
        whatsapp_number: phone,
        whatsapp_language: 'en',
        is_active: true,
        date_of_birth: '1990-01-01',
        age_verification_method: 'government_id',
        age_verification_reference: `b16-${crypto.randomUUID()}`,
        age_verified_at: new Date().toISOString(),
        age_verified_by: fixture.userId,
    }).select('id, name, whatsapp_number').single()
    if (worker.error || !worker.data) throw new Error(`${label} worker failed: ${worker.error?.message}`)
    return worker.data
}

async function setConsent(admin, fixture, worker, status, phone = worker.whatsapp_number) {
    const consent = await admin.from('notification_consents').insert({
        org_id: fixture.orgId,
        person_type: 'worker',
        person_id: String(worker.id),
        phone,
        channel: 'whatsapp',
        consent_status: status,
        consent_source: 'b16_simulator',
        consented_at: status === 'opted_in' ? new Date().toISOString() : null,
        withdrawn_at: status === 'opted_out' ? new Date().toISOString() : null,
        captured_by_user_id: fixture.userId,
    })
    if (consent.error) throw new Error(`consent failed: ${consent.error.message}`)
}

async function createAdvance(admin, fixture, worker, label, amount = 100) {
    const advance = await admin.from('worker_advances').insert({
        org_id: fixture.orgId,
        meter_worker_id: worker.id,
        amount,
        description: `B16 ${label}`,
        status: 'pending',
    }).select('id, amount, status').single()
    if (advance.error || !advance.data) throw new Error(`${label} advance failed: ${advance.error?.message}`)
    return advance.data
}

async function sendAdvance(env, fixture, worker, advance, simulationMode = 'success') {
    return invoke(env, 'send-advance-receipt', {
        org_id: fixture.orgId,
        advance_id: advance.id,
        worker_id: worker.id,
        worker_type: 'meter',
        simulation_mode: simulationMode,
    })
}

async function createSettlement(admin, fixture, worker, month) {
    const settlement = await admin.from('payroll_settlements').insert({
        org_id: fixture.orgId,
        worker_type: 'meter',
        meter_worker_id: worker.id,
        month,
        gross_pay: 1200,
        advance_deducted: 200,
        net_payout: 1000,
        carried_forward_debt: 50,
        status: 'paid',
        payment_mode: 'cash',
        itemization_payload: {
            bonuses: [{ category: 'Extra work', amount: 100 }],
            fines: [{ category: 'Quality', amount: 25 }],
            advances_recovered: [{ date: `${month}-05`, label: 'Upaad', recovered: 200, carried_forward: 50 }],
            pf: { employee: 0 },
            esic: { employee: 0 },
        },
    }).select('id, meter_worker_id, gross_pay, net_payout, itemization_payload').single()
    if (settlement.error || !settlement.data) throw new Error(`settlement failed: ${settlement.error?.message}`)
    return settlement.data
}

async function cleanup(admin, fixture) {
    if (!fixture) return { reconciled: false, errors: ['fixture unavailable'] }
    const errors = []
    for (const table of [
        'whatsapp_delivery_log', 'whatsapp_cooldowns', 'daily_brief_logs', 'notification_consents',
        'worker_advances', 'payroll_settlements', 'workers', 'audit_log',
    ]) {
        const result = await admin.from(table).delete().eq('org_id', fixture.orgId)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const profile = await admin.from('profiles').delete().eq('id', fixture.userId)
    if (profile.error) errors.push(`profiles: ${profile.error.message}`)
    const org = await admin.from('organizations').delete().eq('id', fixture.orgId)
    if (org.error) errors.push(`organizations: ${org.error.message}`)
    const auth = await admin.auth.admin.deleteUser(fixture.userId)
    if (auth.error && auth.error.code !== 'user_not_found') errors.push(`auth: ${auth.error.message}`)
    const [orgs, profiles, logs, authRead] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', fixture.orgId),
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        admin.from('whatsapp_delivery_log').select('id', { count: 'exact', head: true }).eq('org_id', fixture.orgId),
        admin.auth.admin.getUserById(fixture.userId),
    ])
    const reconciliation = {
        organizations: orgs.count,
        profiles: profiles.count,
        delivery_logs: logs.count,
        auth_users_exist: authRead.data.user ? 1 : 0,
    }
    return { errors, reconciliation, reconciled: errors.length === 0 && Object.values(reconciliation).every((value) => value === 0) }
}

async function main() {
    const env = { ...process.env, ...parseEnv(await fs.readFile(path.join(workspace, '.env.qa.local'), 'utf8')) }
    if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_REF)) throw new Error('B16 refused: QA target was not proven.')
    if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('B16 refused: QA service key is unavailable.')
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    const assertions = []
    const evidence = {
        run_id: `B16-QA-${Date.now()}`,
        environment: 'qa-simulated-provider',
        project_ref: QA_REF,
        live_provider_contacted: false,
        assertions,
        blocked_rows: ['WA-010'],
        cleanup: 'pending',
    }
    let fixture
    try {
        fixture = await createFixture(admin)
        const opted = await createWorker(admin, fixture, 'Opted In', '9000001601')
        const optedOut = await createWorker(admin, fixture, 'Opted Out', '9000001602')
        const missingConsent = await createWorker(admin, fixture, 'Missing Consent', '9000001603')
        const missingPhone = await createWorker(admin, fixture, 'Missing Phone', null)
        const mismatch = await createWorker(admin, fixture, 'Phone Mismatch', '9000001605')
        await setConsent(admin, fixture, opted, 'opted_in')
        await setConsent(admin, fixture, optedOut, 'opted_out')
        await setConsent(admin, fixture, mismatch, 'opted_in', '9000001698')

        const sentAdvance = await createAdvance(admin, fixture, opted, 'sent advance', 125)
        const sentResult = await sendAdvance(env, fixture, opted, sentAdvance)
        let logs = await admin.from('whatsapp_delivery_log').select('*').eq('org_id', fixture.orgId).eq('notification_type', 'advance_receipt').eq('payload_snapshot->>advance_id', String(sentAdvance.id))
        assertCondition(assertions, 'WA-001', 'opted-in simulated advance is sent and the business write persists',
            sentResult.success === true && logs.data?.length === 1 && logs.data[0].status === 'sent'
            && logs.data[0].recipient_phone === opted.whatsapp_number && logs.data[0].meta_message_id?.startsWith('sim_template_wamid_')
            && sentAdvance.status === 'pending', { advance_id: sentAdvance.id, log_status: logs.data?.[0]?.status })

        const optedOutAdvance = await createAdvance(admin, fixture, optedOut, 'opted-out advance')
        const optedOutResult = await sendAdvance(env, fixture, optedOut, optedOutAdvance)
        logs = await admin.from('whatsapp_delivery_log').select('status, error_message').eq('org_id', fixture.orgId).eq('payload_snapshot->>advance_id', String(optedOutAdvance.id))
        assertCondition(assertions, 'WA-002', 'opted-out worker is skipped and logged without rolling back the advance',
            optedOutResult.skipped === true && optedOutResult.reason === 'opted_out'
            && logs.data?.[0]?.status === 'skipped_opted_out' && optedOutAdvance.status === 'pending', { result: optedOutResult, log: logs.data?.[0] })

        const missingConsentAdvance = await createAdvance(admin, fixture, missingConsent, 'missing-consent advance')
        const missingPhoneAdvance = await createAdvance(admin, fixture, missingPhone, 'missing-phone advance')
        const [missingConsentResult, missingPhoneResult] = await Promise.all([
            sendAdvance(env, fixture, missingConsent, missingConsentAdvance),
            sendAdvance(env, fixture, missingPhone, missingPhoneAdvance),
        ])
        logs = await admin.from('whatsapp_delivery_log').select('status, payload_snapshot').eq('org_id', fixture.orgId).in('status', ['skipped_missing_consent', 'skipped_missing_phone'])
        assertCondition(assertions, 'WA-003', 'missing consent and missing phone produce distinct persisted skip reasons',
            missingConsentResult.reason === 'missing_consent' && missingPhoneResult.reason === 'missing_phone'
            && new Set(logs.data?.map((row) => row.status)).size === 2
            && missingConsentAdvance.status === 'pending' && missingPhoneAdvance.status === 'pending', {
                results: [missingConsentResult.reason, missingPhoneResult.reason], statuses: logs.data?.map((row) => row.status),
            })

        const timeoutAdvance = await createAdvance(admin, fixture, opted, 'timeout advance', 175)
        const timeoutResult = await sendAdvance(env, fixture, opted, timeoutAdvance, 'timeout')
        const timeoutLog = await admin.from('whatsapp_delivery_log').select('*').eq('org_id', fixture.orgId).eq('payload_snapshot->>advance_id', String(timeoutAdvance.id)).single()
        assertCondition(assertions, 'WA-004', 'provider timeout is logged while the core advance remains committed',
            timeoutResult.success === false && timeoutLog.data?.status === 'failed'
            && timeoutLog.data?.error_message?.includes('provider_timeout') && timeoutLog.data?.error_message?.includes('business write is retained')
            && timeoutAdvance.status === 'pending', { advance_id: timeoutAdvance.id, log_status: timeoutLog.data?.status })

        const settlement = await createSettlement(admin, fixture, opted, '2026-07')
        const payslipResult = await invoke(env, 'send-payslip', {
            org_id: fixture.orgId, worker_id: opted.id, worker_type: 'meter', settlement_id: settlement.id,
            simulation_mode: 'success', freeform_simulation_mode: 'success',
        })
        const mismatchSettlement = await createSettlement(admin, fixture, mismatch, '2026-07')
        const mismatchResult = await invoke(env, 'send-payslip', {
            org_id: fixture.orgId, worker_id: mismatch.id, worker_type: 'meter', settlement_id: mismatchSettlement.id,
            simulation_mode: 'success', freeform_simulation_mode: 'success',
        })
        const payslipLogs = await admin.from('whatsapp_delivery_log').select('*').eq('org_id', fixture.orgId).in('notification_type', ['payslip_summary', 'payslip'])
        const summary = payslipLogs.data?.find((row) => row.payload_snapshot?.settlement_id === settlement.id)
        const mismatchSkip = payslipLogs.data?.find((row) => row.payload_snapshot?.settlement_id === mismatchSettlement.id)
        assertCondition(assertions, 'WA-005', 'payslip summary and itemized follow-up stay bound to the settled worker consent phone',
            payslipResult.success === true && payslipResult.detail_sent === true
            && summary?.recipient_phone === opted.whatsapp_number && summary?.payload_snapshot?.detail_sent === true
            && summary?.payload_snapshot?.itemization?.bonuses?.[0]?.amount === 100
            && mismatchResult.skipped === true && mismatchResult.reason === 'phone_mismatch'
            && mismatchSkip?.status === 'skipped_phone_mismatch'
            && !payslipLogs.data?.some((row) => row.recipient_phone === '9000001698' && row.status === 'sent'), {
                settlement_id: settlement.id, summary_phone: summary?.recipient_phone, mismatch_status: mismatchSkip?.status,
            })

        const accessResult = await invoke(env, 'send-access-code', {
            org_id: fixture.orgId, code: 'B16ABC', expires_at: new Date(Date.now() + 900_000).toISOString(), simulation_mode: 'success', requested_by: 'B16 Supervisor',
        })
        const accessLog = await admin.from('whatsapp_delivery_log').select('*').eq('org_id', fixture.orgId).eq('notification_type', 'access_code').eq('status', 'sent').single()
        const orgAfterAccess = await admin.from('organizations').select('access_code_hash').eq('id', fixture.orgId).single()
        assertCondition(assertions, 'WA-006', 'access code reaches only the opted-in tenant owner and plaintext is absent from logs',
            accessResult.success === true && accessLog.data?.recipient_phone === fixture.ownerPhone
            && accessLog.data?.owner_profile_id === fixture.userId && orgAfterAccess.data?.access_code_hash === fixture.accessCodeHash
            && !JSON.stringify(accessLog.data?.payload_snapshot).includes('B16ABC')
            && !accessLog.data?.error_message?.includes('B16ABC'), { recipient: accessLog.data?.recipient_phone, owner: safeId(accessLog.data?.owner_profile_id) })

        const dailyFirst = await invoke(env, 'send-daily-brief', { org_id: fixture.orgId, simulation_mode: 'success' })
        const dailySecond = await invoke(env, 'send-daily-brief', { org_id: fixture.orgId, simulation_mode: 'success' })
        const monthlyFirst = await invoke(env, 'monthly-brief', { org_id: fixture.orgId, simulation_mode: 'success' }, '?month=2026-06')
        const monthlySecond = await invoke(env, 'monthly-brief', { org_id: fixture.orgId, simulation_mode: 'success' }, '?month=2026-06')
        const [briefLogs, dailyLocks] = await Promise.all([
            admin.from('whatsapp_delivery_log').select('notification_type').eq('org_id', fixture.orgId).in('notification_type', ['daily_brief', 'monthly_brief']),
            admin.from('whatsapp_cooldowns').select('*').eq('org_id', fixture.orgId).eq('alert_type', 'daily_brief'),
        ])
        const deadlineInsert = await admin.from('whatsapp_cooldowns').insert({ org_id: fixture.orgId, alert_type: 'deadline_risk', ref_id: 'b16-order', sent_at: new Date().toISOString() })
        const deadlineDuplicate = await admin.from('whatsapp_cooldowns').insert({ org_id: fixture.orgId, alert_type: 'deadline_risk', ref_id: 'b16-order', sent_at: new Date().toISOString() })
        assertCondition(assertions, 'WA-007', 'deadline daily and monthly cooldown grains suppress duplicates independently',
            !deadlineInsert.error && deadlineDuplicate.error?.code === '23505'
            && dailyFirst.sent === 1 && dailySecond.skipped === 1
            && Array.isArray(monthlyFirst) && monthlyFirst[0]?.status === 'sent'
            && Array.isArray(monthlySecond) && monthlySecond[0]?.reason === 'already_sent'
            && briefLogs.data?.filter((row) => row.notification_type === 'daily_brief').length === 1
            && briefLogs.data?.filter((row) => row.notification_type === 'monthly_brief').length === 1
            && dailyLocks.data?.length === 1, { dailyFirst, dailySecond, monthlyFirst, monthlySecond })

        const retryResult = await invoke(env, 'retry-failed-messages', {
            log_id: timeoutLog.data.id, org_id: fixture.orgId, simulation_mode: 'success',
        })
        const retried = await admin.from('whatsapp_delivery_log').select('status, retry_count, last_retry_at').eq('id', timeoutLog.data.id).single()
        const directFailures = await admin.from('whatsapp_delivery_log').insert([
            {
                org_id: fixture.orgId, recipient_phone: opted.whatsapp_number, template_name: 'b16_capped', notification_type: 'b16_retry',
                status: 'failed', retry_count: 3, sent_at: new Date().toISOString(),
                payload_snapshot: { bodyValues: ['capped'] }, error_message: 'manual fallback required',
            },
            {
                org_id: fixture.orgId, recipient_phone: opted.whatsapp_number, template_name: 'b16_stale', notification_type: 'b16_retry',
                status: 'failed', retry_count: 0, sent_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
                payload_snapshot: { bodyValues: ['stale'] }, error_message: 'manual fallback required',
            },
        ]).select('id, retry_count, sent_at')
        if (directFailures.error) throw new Error(`retry fixtures failed: ${directFailures.error.message}`)
        const [cappedResult, staleResult] = await Promise.all(directFailures.data.map((row) => invoke(env, 'retry-failed-messages', {
            log_id: row.id, org_id: fixture.orgId, simulation_mode: 'success',
        })))
        const untouched = await admin.from('whatsapp_delivery_log').select('id, retry_count, status').in('id', directFailures.data.map((row) => row.id)).order('retry_count', { ascending: false })
        assertCondition(assertions, 'WA-009', 'targeted retry recovers once while capped and stale failures remain untouched',
            retryResult.recovered === 1 && retried.data?.status === 'sent' && retried.data?.retry_count === 1 && retried.data?.last_retry_at
            && cappedResult.retried === 0 && staleResult.retried === 0
            && untouched.data?.some((row) => row.retry_count === 3 && row.status === 'failed')
            && untouched.data?.some((row) => row.retry_count === 0 && row.status === 'failed'), {
                recovered: retryResult.recovered, retry_count: retried.data?.retry_count, capped: cappedResult, stale: staleResult,
            })

        const [rejected, expired] = await Promise.all([
            invoke(env, 'send-access-code', { org_id: fixture.orgId, code: 'B16ABC', simulation_mode: 'template_rejected' }),
            invoke(env, 'send-access-code', { org_id: fixture.orgId, code: 'B16ABC', simulation_mode: 'expired_token' }),
        ])
        const operationalFailures = await admin.from('whatsapp_delivery_log').select('error_message, status').eq('org_id', fixture.orgId).eq('notification_type', 'access_code').eq('status', 'failed')
        assertCondition(assertions, 'WA-010-PARTIAL', 'simulated rejection and expired token create clear operational logs with manual fallback',
            rejected.success === false && expired.success === false && operationalFailures.data?.length === 2
            && operationalFailures.data.some((row) => row.error_message.includes('template_rejected') && row.error_message.includes('manual fallback'))
            && operationalFailures.data.some((row) => row.error_message.includes('expired_token') && row.error_message.includes('manual fallback')), {
                simulated_only: true, live_provider_contacted: false, blocked: 'Live consented Meta rejection/token proof remains unavailable.',
            })

        evidence.fixture = { org: safeId(fixture.orgId), owner: safeId(fixture.userId) }
        evidence.passed = assertions.every((assertion) => assertion.passed)
    } catch (error) {
        evidence.error = String(error?.message ?? error)
        evidence.passed = false
    } finally {
        const cleanupResult = await cleanup(admin, fixture)
        evidence.cleanup_result = cleanupResult
        evidence.cleanup = cleanupResult.reconciled ? 'complete' : 'failed'
        evidence.passed = evidence.passed === true && cleanupResult.reconciled
        await fs.mkdir(path.dirname(outputPath), { recursive: true })
        await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
    }
    process.stdout.write(`${JSON.stringify({ path: outputPath, passed: evidence.passed, assertions: assertions.length, blocked_rows: evidence.blocked_rows, cleanup: evidence.cleanup, error: evidence.error }, null, 2)}\n`)
    if (!evidence.passed) process.exitCode = 1
}

await main()
