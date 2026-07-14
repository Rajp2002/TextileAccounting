#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const QA_REF = 'eutycrtzzxmlkcpipgod'
const localBaseUrl = 'http://localhost:3100'
const secretDirectory = '/Users/rajpatel/.codex/secrets'
const secretPath = path.join(secretDirectory, 'weavly-b17-qa.json')
const outputPath = path.join(workspace, 'output/qa/blocked-row-campaign/B17-qa-razorpay.json')

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

const env = { ...parseEnv(await fs.readFile(path.join(workspace, '.env.qa.local'), 'utf8')), ...process.env }
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(QA_REF)) throw new Error('B17 runtime refused: isolated QA target not proven.')
if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('B17 runtime requires QA Supabase credentials.')
if (!env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') || !env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
    throw new Error('B17 runtime refused: Razorpay test mode not proven.')
}
if (!env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET) throw new Error('B17 runtime requires test provider and webhook secrets.')

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
})

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function assertCondition(assertions, id, name, passed, details = {}) {
    assertions.push({ id, name, passed, ...details })
    if (!passed) throw new Error(`${id} ${name} failed: ${JSON.stringify(details)}`)
}

async function requireData(result, label) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`)
    return result.data
}

async function readSecret() {
    return JSON.parse(await fs.readFile(secretPath, 'utf8'))
}

async function writeSecret(value) {
    await fs.mkdir(secretDirectory, { recursive: true, mode: 0o700 })
    await fs.chmod(secretDirectory, 0o700)
    await fs.writeFile(secretPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
    await fs.chmod(secretPath, 0o600)
}

async function readEvidence() {
    try {
        return JSON.parse(await fs.readFile(outputPath, 'utf8'))
    } catch (error) {
        if (error?.code === 'ENOENT') return null
        throw error
    }
}

async function writeEvidence(value) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`)
}

async function createTenant(runId, label) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `${runId.toLowerCase()}.${label}.${suffix}@qa.weavly.local`
    const password = `B17-${crypto.randomBytes(14).toString('base64url')}A1!`
    const auth = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `${runId} ${label} Owner` },
    })
    if (auth.error || !auth.data.user) throw new Error(`Create ${label} auth failed: ${auth.error?.message}`)

    const org = await requireData(await admin.from('organizations').insert({
        name: `${runId}-${label.toUpperCase()}`,
        owner_id: auth.data.user.id,
        join_code: crypto.randomBytes(4).toString('hex').toUpperCase(),
        join_code_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        onboarding_complete: true,
        production_mode: 'both',
    }).select('id, name').single(), `Create ${label} organization`)

    await requireData(await admin.from('profiles').insert({
        id: auth.data.user.id,
        org_id: org.id,
        role: 'owner',
        full_name: `${runId} ${label} Owner`,
        email,
    }), `Create ${label} profile`)

    return { label, userId: auth.data.user.id, orgId: org.id, orgName: org.name, email, password }
}

async function ownerCookieHeader(fixture) {
    const cookies = new Map()
    const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
        },
    })
    const signIn = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password })
    if (signIn.error) throw new Error(`B17 owner sign-in failed: ${signIn.error.message}`)
    return [...cookies].map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('; ')
}

async function providerRequest(resourcePath) {
    const authorization = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')
    const response = await fetch(`https://api.razorpay.com${resourcePath}`, {
        headers: { authorization: `Basic ${authorization}` },
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(`Razorpay test API ${resourcePath} failed with HTTP ${response.status}.`)
    return body
}

let webhookIpCounter = 20
async function sendWebhook(event, eventId, { validSignature = true } = {}) {
    const raw = JSON.stringify(event)
    const signature = validSignature
        ? crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex')
        : '0'.repeat(64)
    webhookIpCounter += 1
    const response = await fetch(`${localBaseUrl}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-razorpay-signature': signature,
            'x-razorpay-event-id': eventId,
            'x-forwarded-for': `198.51.100.${webhookIpCounter}`,
        },
        body: raw,
    })
    return { status: response.status, body: await response.json().catch(() => null), raw }
}

async function setup(runId) {
    try {
        await fs.access(secretPath)
        throw new Error(`Refusing to overwrite existing B17 secret: ${secretPath}`)
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error
    }

    const purchaser = await createTenant(runId, 'purchaser')
    const source = await createTenant(runId, 'source-referrer')
    const discountReferee = await createTenant(runId, 'discount-referee')

    const sourceCode = await requireData(await admin.from('referral_codes').insert({
        org_id: source.orgId,
        code: `B17S${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    }).select('id').single(), 'Create source referral code')
    const pendingUse = await requireData(await admin.from('referral_uses').insert({
        referral_code_id: sourceCode.id,
        referee_org_id: purchaser.orgId,
        status: 'pending',
    }).select('id').single(), 'Create pending referral use')

    const secret = {
        runId,
        projectRef: QA_REF,
        providerMode: 'test',
        purchaser,
        source,
        discountReferee,
        sourceCodeId: sourceCode.id,
        pendingUseId: pendingUse.id,
        createdAt: new Date().toISOString(),
    }
    await writeSecret(secret)

    const counts = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).in('id', [purchaser.orgId, source.orgId, discountReferee.orgId]),
        admin.from('profiles').select('id', { count: 'exact', head: true }).in('id', [purchaser.userId, source.userId, discountReferee.userId]),
    ])
    const assertions = []
    assertCondition(assertions, 'SETUP-001', 'three isolated prefixed QA tenants and owner profiles exist once',
        counts[0].count === 3 && counts[1].count === 3,
        { organizations: counts[0].count, profiles: counts[1].count })

    await writeEvidence({
        run_id: runId,
        environment: 'qa-razorpay-test-mode',
        project_ref: QA_REF,
        real_money_charged: false,
        provider_mode: 'test',
        assertions,
        fixture: {
            purchaser: { email: purchaser.email, role: 'owner', factory: purchaser.orgName, org: safeId(purchaser.orgId), profile: safeId(purchaser.userId) },
            source: { email: source.email, role: 'owner', factory: source.orgName, org: safeId(source.orgId), profile: safeId(source.userId) },
            discount_referee: { email: discountReferee.email, role: 'owner', factory: discountReferee.orgName, org: safeId(discountReferee.orgId), profile: safeId(discountReferee.userId) },
        },
        checkout_phases: [],
        cleanup: 'pending',
        passed: false,
    })

    process.stdout.write(`${JSON.stringify({
        runId,
        environment: 'qa-razorpay-test-mode',
        purchaser: { email: purchaser.email, role: 'owner', factory: purchaser.orgName, org: safeId(purchaser.orgId) },
        privateSecret: secretPath,
        next: 'complete one successful Base checkout in the local browser',
    }, null, 2)}\n`)
}

async function verifyInitial() {
    const fixture = await readSecret()
    const evidence = await readEvidence()
    const assertions = []
    const subscriptions = await requireData(await admin.from('org_subscriptions')
        .select('id, status, plan_tier, razorpay_order_id, razorpay_payment_id, current_start, current_end, checkout_purchase_type, checkout_amount_paise')
        .eq('org_id', fixture.purchaser.orgId)
        .eq('status', 'active')
        .order('created_at'), 'Load initial active purchase')
    const payments = await requireData(await admin.from('subscription_payments')
        .select('id, subscription_id, razorpay_payment_id, razorpay_order_id, amount_paise, status')
        .eq('org_id', fixture.purchaser.orgId)
        .eq('status', 'captured'), 'Load initial captured payment')
    assertCondition(assertions, 'BILL-003', 'hosted test checkout recorded one active subscription and one captured payment',
        subscriptions.length === 1 && payments.length === 1 && subscriptions[0].razorpay_payment_id === payments[0].razorpay_payment_id,
        { subscriptions: subscriptions.length, payments: payments.length, plan: subscriptions[0]?.plan_tier, purchase_type: subscriptions[0]?.checkout_purchase_type })

    const providerPayment = await providerRequest(`/v1/payments/${encodeURIComponent(payments[0].razorpay_payment_id)}`)
    assertCondition(assertions, 'BILL-003-PROVIDER', 'provider confirms the captured payment belongs to the tracked order and amount',
        providerPayment.status === 'captured'
            && providerPayment.order_id === payments[0].razorpay_order_id
            && Number(providerPayment.amount) === Number(payments[0].amount_paise),
        { status: providerPayment.status, payment: safeId(providerPayment.id), order: safeId(providerPayment.order_id), amount_paise: providerPayment.amount })

    const conversion = await requireData(await admin.from('referral_uses').select('status, converted_at')
        .eq('id', fixture.pendingUseId).single(), 'Load converted referral')
    const sourceWindow = await requireData(await admin.from('referral_discount_windows').select('id')
        .eq('referral_use_id', fixture.pendingUseId), 'Load source discount window')
    assertCondition(assertions, 'BILL-009-CONVERSION', 'initial activation converted the pending referral exactly once',
        conversion.status === 'converted' && Boolean(conversion.converted_at) && sourceWindow.length === 1,
        { status: conversion.status, windows: sourceWindow.length })

    const createdAt = Math.floor(Date.now() / 1000)
    const capturedEvent = {
        entity: 'event', event: 'payment.captured', created_at: createdAt,
        payload: { payment: { entity: { id: payments[0].razorpay_payment_id } } },
    }
    const capturedEventId = `${fixture.runId}-initial-captured`
    const first = await sendWebhook(capturedEvent, capturedEventId)
    const replay = await sendWebhook(capturedEvent, capturedEventId)
    const conflict = await sendWebhook({ ...capturedEvent, contains: ['changed'] }, capturedEventId)
    const invalidId = `${fixture.runId}-invalid-signature`
    const invalid = await sendWebhook(capturedEvent, invalidId, { validSignature: false })
    assertCondition(assertions, 'BILL-004', 'signed replay is acknowledged once without a second billing mutation',
        first.status === 200 && replay.status === 200 && replay.body?.duplicate === true,
        { first_status: first.status, replay_status: replay.status, duplicate: replay.body?.duplicate === true })
    assertCondition(assertions, 'SEC-007', 'event-ID/body conflict and invalid HMAC are rejected',
        conflict.status === 409 && invalid.status === 400,
        { conflict_status: conflict.status, invalid_signature_status: invalid.status })

    const invalidLedger = await admin.from('razorpay_webhook_events').select('event_id', { count: 'exact', head: true }).eq('event_id', invalidId)
    assertCondition(assertions, 'BILL-005', 'invalid signature caused no webhook-ledger or billing state change',
        invalidLedger.count === 0,
        { invalid_event_rows: invalidLedger.count })

    const staleFailure = await sendWebhook({
        entity: 'event', event: 'payment.failed', created_at: createdAt - 30,
        payload: { payment: { entity: { id: payments[0].razorpay_payment_id } } },
    }, `${fixture.runId}-stale-payment-failed`)
    const failedForCaptured = await admin.from('subscription_payments').select('id', { count: 'exact', head: true })
        .eq('razorpay_payment_id', payments[0].razorpay_payment_id).eq('status', 'failed')
    assertCondition(assertions, 'BILL-007-PAYMENT', 'late failure snapshot cannot regress the provider-captured payment',
        staleFailure.status === 200 && failedForCaptured.count === 0,
        { webhook_status: staleFailure.status, failed_rows: failedForCaptured.count })

    const orderPaid = await sendWebhook({
        entity: 'event', event: 'order.paid', created_at: createdAt,
        payload: { order: { entity: { id: payments[0].razorpay_order_id } } },
    }, `${fixture.runId}-initial-order-paid`)
    const postReplayPayments = await admin.from('subscription_payments').select('id', { count: 'exact', head: true })
        .eq('org_id', fixture.purchaser.orgId).eq('status', 'captured')
    assertCondition(assertions, 'BILL-004-ORDER', 'payment.captured and order.paid converge on one captured payment',
        orderPaid.status === 200 && postReplayPayments.count === 1,
        { webhook_status: orderPaid.status, captured_rows: postReplayPayments.count })

    const legacySubId = `sub_${crypto.randomBytes(7).toString('hex')}`
    const legacy = await requireData(await admin.from('org_subscriptions').insert({
        org_id: fixture.source.orgId,
        plan_id: null,
        plan_tier: 'base',
        status: 'active',
        razorpay_subscription_id: legacySubId,
        current_start: new Date(Date.now() - 86400000).toISOString(),
        current_end: new Date(Date.now() + 86400000).toISOString(),
    }).select('id').single(), 'Create legacy lifecycle row')
    const lifecycleEvent = (type, timestamp) => ({
        entity: 'event', event: type, created_at: timestamp,
        payload: { subscription: { entity: {
            id: legacySubId,
            current_start: createdAt - 86400,
            current_end: createdAt + 86400,
            paid_count: 1,
            remaining_count: 0,
        } } },
    })
    await sendWebhook(lifecycleEvent('subscription.cancelled', createdAt + 20), `${fixture.runId}-lifecycle-cancel`)
    await sendWebhook(lifecycleEvent('subscription.activated', createdAt + 10), `${fixture.runId}-lifecycle-stale-active`)
    const afterStale = await requireData(await admin.from('org_subscriptions').select('status, current_end, cancel_at_cycle_end')
        .eq('id', legacy.id).single(), 'Load post-stale lifecycle')
    await sendWebhook(lifecycleEvent('subscription.activated', createdAt + 30), `${fixture.runId}-lifecycle-recovery`)
    await sendWebhook(lifecycleEvent('subscription.expired', createdAt + 40), `${fixture.runId}-lifecycle-expiry`)
    await sendWebhook(lifecycleEvent('subscription.activated', createdAt + 35), `${fixture.runId}-lifecycle-post-expiry-stale`)
    const finalLifecycle = await requireData(await admin.from('org_subscriptions').select('status, provider_event_id')
        .eq('id', legacy.id).single(), 'Load final lifecycle')
    assertCondition(assertions, 'BILL-006-CANCEL', 'cycle-end cancellation retains the purchased end date while marking renewal off',
        afterStale.status === 'cancelled' && Boolean(afterStale.current_end) && afterStale.cancel_at_cycle_end === true,
        { status: afterStale.status, current_end_retained: Boolean(afterStale.current_end), cancel_at_cycle_end: afterStale.cancel_at_cycle_end })
    assertCondition(assertions, 'BILL-007-SUBSCRIPTION', 'older activation cannot regress cancellation or expiry',
        finalLifecycle.status === 'expired' && finalLifecycle.provider_event_id === `${fixture.runId}-lifecycle-expiry`,
        { after_stale: afterStale.status, final_status: finalLifecycle.status })

    const cookie = await ownerCookieHeader(fixture.purchaser)
    const autoRenew = await fetch(`${localBaseUrl}/api/subscriptions/auto-renew`, {
        method: 'POST', headers: { cookie, 'x-forwarded-for': '198.51.100.88' }, redirect: 'manual',
    })
    const activeAfterToggle = await admin.from('org_subscriptions').select('id', { count: 'exact', head: true })
        .eq('id', subscriptions[0].id).eq('status', 'active')
    assertCondition(assertions, 'BILL-006-MODEL', 'manual annual-renewal purchase exposes no false recurring toggle or access change',
        autoRenew.status === 404 && activeAfterToggle.count === 1,
        { endpoint_status: autoRenew.status, active_purchase_rows: activeAfterToggle.count })

    Object.assign(fixture, {
        initialSubscriptionId: subscriptions[0].id,
        initialOrderId: payments[0].razorpay_order_id,
        initialPaymentId: payments[0].razorpay_payment_id,
        initialCurrentEnd: subscriptions[0].current_end,
        legacySubscriptionRowId: legacy.id,
    })
    await writeSecret(fixture)
    evidence.assertions.push(...assertions)
    evidence.checkout_phases.push({ phase: 'initial_success', payment: safeId(fixture.initialPaymentId), order: safeId(fixture.initialOrderId), passed: true })
    await writeEvidence(evidence)
    process.stdout.write(`${JSON.stringify({ verified: 'initial_success', assertions: assertions.length, next: 'seed-refund then complete one failed renewal checkout' }, null, 2)}\n`)
}

async function seedRefund() {
    const fixture = await readSecret()
    let purchaserCode = await requireData(await admin.from('referral_codes').select('id')
        .eq('org_id', fixture.purchaser.orgId).maybeSingle(), 'Load purchaser referral code')
    if (!purchaserCode) {
        purchaserCode = await requireData(await admin.from('referral_codes').insert({
            org_id: fixture.purchaser.orgId,
            code: `B17P${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        }).select('id').single(), 'Create purchaser referral code')
    }
    let use = await requireData(await admin.from('referral_uses').select('id')
        .eq('referral_code_id', purchaserCode.id)
        .eq('referee_org_id', fixture.discountReferee.orgId)
        .maybeSingle(), 'Load converted discount use')
    if (!use) {
        use = await requireData(await admin.from('referral_uses').insert({
            referral_code_id: purchaserCode.id,
            referee_org_id: fixture.discountReferee.orgId,
            status: 'converted',
            converted_at: new Date().toISOString(),
        }).select('id').single(), 'Create converted discount use')
    }
    let discountWindow = await requireData(await admin.from('referral_discount_windows').select('id')
        .eq('referral_use_id', use.id).maybeSingle(), 'Load active refund window')
    if (!discountWindow) {
        discountWindow = await requireData(await admin.from('referral_discount_windows').insert({
            referrer_org_id: fixture.purchaser.orgId,
            referral_use_id: use.id,
            discount_pct: 10,
            valid_from: new Date(Date.now() - 3600000).toISOString(),
            valid_until: new Date(Date.now() + 90 * 86400000).toISOString(),
        }).select('id').single(), 'Create active refund window')
    }
    Object.assign(fixture, { purchaserCodeId: purchaserCode.id, discountUseId: use.id, discountWindowId: discountWindow.id })
    await writeSecret(fixture)
    process.stdout.write(`${JSON.stringify({ refundWindowReady: true, purchaser: safeId(fixture.purchaser.orgId), next: 'complete one failed renewal checkout' }, null, 2)}\n`)
}

async function verifyFailure() {
    const fixture = await readSecret()
    const evidence = await readEvidence()
    const assertions = []
    const createdRows = await requireData(await admin.from('org_subscriptions')
        .select('id, razorpay_order_id, created_at')
        .eq('org_id', fixture.purchaser.orgId)
        .eq('status', 'created')
        .not('razorpay_order_id', 'is', null)
        .order('created_at', { ascending: false }), 'Load failed checkout candidates')
    const candidate = createdRows.find((row) => row.razorpay_order_id !== fixture.initialOrderId)
    if (!candidate) throw new Error('No failed renewal checkout order was found.')

    let failedPayment = null
    for (let attempt = 0; attempt < 10 && !failedPayment; attempt += 1) {
        const providerPayments = await providerRequest(`/v1/orders/${encodeURIComponent(candidate.razorpay_order_id)}/payments`)
        failedPayment = providerPayments.items?.find((payment) => payment.status === 'failed') ?? null
        if (!failedPayment) await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    if (!failedPayment) throw new Error('Razorpay test provider did not expose a failed payment for the renewal order.')

    const webhook = await sendWebhook({
        entity: 'event', event: 'payment.failed', created_at: Math.floor(Date.now() / 1000),
        payload: { payment: { entity: { id: failedPayment.id } } },
    }, `${fixture.runId}-renewal-payment-failed`)
    const localFailed = await requireData(await admin.from('subscription_payments')
        .select('id, status, razorpay_order_id, amount_paise')
        .eq('razorpay_payment_id', failedPayment.id).single(), 'Load recorded failed payment')
    const initialActive = await admin.from('org_subscriptions').select('id', { count: 'exact', head: true })
        .eq('id', fixture.initialSubscriptionId).eq('status', 'active')
    assertCondition(assertions, 'BILL-006-FAILURE', 'canonical test-mode failure is recorded once without revoking the paid period',
        webhook.status === 200 && localFailed.status === 'failed' && initialActive.count === 1,
        { webhook_status: webhook.status, failed_rows: 1, active_paid_periods: initialActive.count })

    Object.assign(fixture, { failedSubscriptionId: candidate.id, failedOrderId: candidate.razorpay_order_id, failedPaymentId: failedPayment.id })
    await writeSecret(fixture)
    evidence.assertions.push(...assertions)
    evidence.checkout_phases.push({ phase: 'renewal_failure', payment: safeId(failedPayment.id), order: safeId(candidate.razorpay_order_id), passed: true })
    await writeEvidence(evidence)
    process.stdout.write(`${JSON.stringify({ verified: 'renewal_failure', payment: safeId(failedPayment.id), next: 'complete one successful renewal checkout' }, null, 2)}\n`)
}

async function finalize() {
    const fixture = await readSecret()
    const evidence = await readEvidence()
    const assertions = []
    const captured = await requireData(await admin.from('subscription_payments')
        .select('id, subscription_id, razorpay_payment_id, razorpay_order_id, amount_paise, status, captured_at')
        .eq('org_id', fixture.purchaser.orgId)
        .eq('status', 'captured')
        .order('captured_at'), 'Load final captured payments')
    const activePurchases = await requireData(await admin.from('org_subscriptions')
        .select('id, status, current_start, current_end, razorpay_order_id, razorpay_payment_id, checkout_purchase_type')
        .eq('org_id', fixture.purchaser.orgId)
        .eq('status', 'active')
        .not('razorpay_payment_id', 'is', null)
        .order('current_start'), 'Load final active purchases')
    const renewal = activePurchases.find((row) => row.id !== fixture.initialSubscriptionId)
    if (!renewal) throw new Error('Successful renewal activation was not found.')
    const renewalPayment = captured.find((row) => row.subscription_id === renewal.id)
    if (!renewalPayment) throw new Error('Successful renewal payment was not found.')

    const expectedRenewalEndMs = new Date(fixture.initialCurrentEnd).getTime() + 365 * 86400000
    assertCondition(assertions, 'BILL-003-RENEWAL', 'successful test-mode renewal appends one exact paid year and one captured payment',
        captured.length === 2
            && activePurchases.length === 2
            && renewal.checkout_purchase_type === 'renewal'
            && renewal.current_start === fixture.initialCurrentEnd
            && new Date(renewal.current_end).getTime() === expectedRenewalEndMs,
        { captured_payments: captured.length, active_purchases: activePurchases.length, purchase_type: renewal.checkout_purchase_type, anchored_to_prior_end: renewal.current_start === fixture.initialCurrentEnd })

    const refunds = await requireData(await admin.from('referral_refunds')
        .select('id, razorpay_payment_id, razorpay_refund_id, refund_amount_paise, discount_pct_applied, status, attempts, idempotency_key')
        .eq('referrer_org_id', fixture.purchaser.orgId), 'Load referral refunds')
    const refund = refunds.find((row) => row.razorpay_payment_id === renewalPayment.razorpay_payment_id)
    assertCondition(assertions, 'BILL-009', 'renewal issued exactly one provider-idempotent 10% test refund',
        refunds.length === 1 && refund?.status === 'issued' && Boolean(refund.razorpay_refund_id) && Boolean(refund.idempotency_key),
        { refund_rows: refunds.length, status: refund?.status, discount_pct: refund?.discount_pct_applied, attempts: refund?.attempts, refund: safeId(refund?.razorpay_refund_id) })

    const replayClaimOne = await admin.rpc('claim_referral_refund', {
        p_org_id: fixture.purchaser.orgId,
        p_razorpay_payment_id: renewalPayment.razorpay_payment_id,
        p_original_amount_paise: renewalPayment.amount_paise,
    })
    const replayClaimTwo = await admin.rpc('claim_referral_refund', {
        p_org_id: fixture.purchaser.orgId,
        p_razorpay_payment_id: renewalPayment.razorpay_payment_id,
        p_original_amount_paise: renewalPayment.amount_paise,
    })
    const refundCountAfterClaims = await admin.from('referral_refunds').select('id', { count: 'exact', head: true })
        .eq('razorpay_payment_id', renewalPayment.razorpay_payment_id)
    assertCondition(assertions, 'BILL-009-REPLAY', 'refund replay claims remain issued and cannot reserve another provider call',
        !replayClaimOne.error && !replayClaimTwo.error
            && replayClaimOne.data?.claimed === false && replayClaimTwo.data?.claimed === false
            && refundCountAfterClaims.count === 1,
        { first_claimed: replayClaimOne.data?.claimed, second_claimed: replayClaimTwo.data?.claimed, refund_rows: refundCountAfterClaims.count })

    fixture.renewalReplayCreatedAt ??= Math.floor(Date.now() / 1000)
    await writeSecret(fixture)
    const replayEvent = {
        entity: 'event', event: 'order.paid', created_at: fixture.renewalReplayCreatedAt,
        payload: { order: { entity: { id: renewalPayment.razorpay_order_id } } },
    }
    const replayEventId = `${fixture.runId}-renewal-order-paid`
    const replayFirst = await sendWebhook(replayEvent, replayEventId)
    const replaySecond = await sendWebhook(replayEvent, replayEventId)
    const finalCapturedCount = await admin.from('subscription_payments').select('id', { count: 'exact', head: true })
        .eq('org_id', fixture.purchaser.orgId).eq('status', 'captured')
    assertCondition(assertions, 'SEC-007-REPLAY', 'a second signed renewal event is acknowledged as duplicate without extra capture or refund',
        replayFirst.status === 200 && replaySecond.body?.duplicate === true
            && finalCapturedCount.count === 2 && refundCountAfterClaims.count === 1,
        { first_status: replayFirst.status, replay_duplicate: replaySecond.body?.duplicate === true, captured_rows: finalCapturedCount.count, refund_rows: refundCountAfterClaims.count })

    const cookie = await ownerCookieHeader(fixture.purchaser)
    const beforeExpiry = await fetch(`${localBaseUrl}/owner/quotes`, { headers: { cookie }, redirect: 'manual' })
    fixture.expiryOriginalPeriods = activePurchases.map((row) => ({ id: row.id, current_end: row.current_end }))
    await writeSecret(fixture)
    await requireData(await admin.from('org_subscriptions').update({
        current_end: new Date(Date.now() - 2 * 86400000).toISOString(),
    }).eq('org_id', fixture.purchaser.orgId).in('id', activePurchases.map((row) => row.id)), 'Expire paid periods')
    const afterExpiry = await fetch(`${localBaseUrl}/owner/quotes`, { headers: { cookie }, redirect: 'manual' })
    const expiryLocation = afterExpiry.headers.get('location') ?? ''
    const afterExpiryBody = await afterExpiry.text()
    const redirectedByHttp = [301, 302, 303, 307, 308].includes(afterExpiry.status)
        && new URL(expiryLocation, localBaseUrl).pathname === '/owner/billing'
    const redirectedInStream = afterExpiry.status === 200
        && afterExpiryBody.includes('NEXT_REDIRECT')
        && afterExpiryBody.includes('/owner/billing')
    const [orgCount, profileCount, paymentCount] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', fixture.purchaser.orgId),
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', fixture.purchaser.userId),
        admin.from('subscription_payments').select('id', { count: 'exact', head: true }).eq('org_id', fixture.purchaser.orgId),
    ])
    assertCondition(assertions, 'BILL-010', 'the same authenticated session loses gated access after expiry without deleting account or billing history',
        beforeExpiry.status === 200
            && (redirectedByHttp || redirectedInStream)
            && orgCount.count === 1 && profileCount.count === 1 && paymentCount.count === 3,
        { before_status: beforeExpiry.status, after_status: afterExpiry.status, redirect_mode: redirectedByHttp ? 'http' : redirectedInStream ? 'next_stream' : null, location: expiryLocation ? new URL(expiryLocation, localBaseUrl).pathname : redirectedInStream ? '/owner/billing' : null, organizations: orgCount.count, profiles: profileCount.count, payment_history_rows: paymentCount.count })

    Object.assign(fixture, { renewalSubscriptionId: renewal.id, renewalOrderId: renewalPayment.razorpay_order_id, renewalPaymentId: renewalPayment.razorpay_payment_id, refundId: refund?.razorpay_refund_id })
    await writeSecret(fixture)
    evidence.assertions.push(...assertions)
    evidence.checkout_phases.push({ phase: 'renewal_success_and_refund', payment: safeId(renewalPayment.razorpay_payment_id), order: safeId(renewalPayment.razorpay_order_id), refund: safeId(refund?.razorpay_refund_id), passed: true })
    evidence.provider_artifacts = { orders: 3, captured_payments: 2, failed_payments: 1, test_refunds: 1 }
    evidence.passed = evidence.assertions.every((assertion) => assertion.passed)
    await writeEvidence(evidence)
    process.stdout.write(`${JSON.stringify({ verified: 'final', assertions: assertions.length, passed: evidence.passed, next: 'cleanup' }, null, 2)}\n`)
}

async function cleanup() {
    const fixture = await readSecret()
    const evidence = await readEvidence()
    const orgIds = [fixture.purchaser.orgId, fixture.source.orgId, fixture.discountReferee.orgId]
    const userIds = [fixture.purchaser.userId, fixture.source.userId, fixture.discountReferee.userId]
    const errors = []
    const deletes = [
        ['referral_refunds', 'referrer_org_id'],
        ['referral_discount_windows', 'referrer_org_id'],
        ['referral_uses', 'referee_org_id'],
        ['referral_codes', 'org_id'],
        ['subscription_payments', 'org_id'],
        ['org_subscriptions', 'org_id'],
        ['audit_log', 'org_id'],
    ]
    for (const [table, column] of deletes) {
        const result = await admin.from(table).delete().in(column, orgIds)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const events = await admin.from('razorpay_webhook_events').delete().like('event_id', `${fixture.runId}-%`)
    if (events.error) errors.push(`razorpay_webhook_events: ${events.error.message}`)
    const profiles = await admin.from('profiles').delete().in('id', userIds)
    if (profiles.error) errors.push(`profiles: ${profiles.error.message}`)
    const organizations = await admin.from('organizations').delete().in('id', orgIds)
    if (organizations.error) errors.push(`organizations: ${organizations.error.message}`)
    for (const userId of userIds) {
        const result = await admin.auth.admin.deleteUser(userId)
        if (result.error && result.error.code !== 'user_not_found') errors.push(`auth ${safeId(userId)}: ${result.error.message}`)
    }

    const [orgCount, profileCount, subCount, paymentCount, eventCount, refundCount, authReads] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).in('id', orgIds),
        admin.from('profiles').select('id', { count: 'exact', head: true }).in('id', userIds),
        admin.from('org_subscriptions').select('id', { count: 'exact', head: true }).in('org_id', orgIds),
        admin.from('subscription_payments').select('id', { count: 'exact', head: true }).in('org_id', orgIds),
        admin.from('razorpay_webhook_events').select('event_id', { count: 'exact', head: true }).like('event_id', `${fixture.runId}-%`),
        admin.from('referral_refunds').select('id', { count: 'exact', head: true }).in('referrer_org_id', orgIds),
        Promise.all(userIds.map((userId) => admin.auth.admin.getUserById(userId))),
    ])
    const reconciliation = {
        organizations: orgCount.count,
        profiles: profileCount.count,
        subscriptions: subCount.count,
        payments: paymentCount.count,
        webhook_events: eventCount.count,
        referral_refunds: refundCount.count,
        auth_users_exist: authReads.filter((row) => Boolean(row.data.user)).length,
    }
    const reconciled = errors.length === 0 && Object.values(reconciliation).every((value) => value === 0)
    evidence.cleanup = 'complete'
    evidence.cleanup_result = { errors, reconciliation, reconciled }
    evidence.passed = evidence.assertions.every((assertion) => assertion.passed) && reconciled
    await writeEvidence(evidence)
    if (!reconciled) throw new Error(`B17 cleanup failed: ${JSON.stringify({ errors, reconciliation })}`)
    await fs.rm(secretPath, { force: true })
    process.stdout.write(`${JSON.stringify({ cleaned: true, reconciliation, evidence: outputPath, passed: evidence.passed }, null, 2)}\n`)
}

const command = process.argv[2]
if (command === 'setup') await setup(process.argv[3] ?? `B17QA-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`)
else if (command === 'verify-initial') await verifyInitial()
else if (command === 'seed-refund') await seedRefund()
else if (command === 'verify-failure') await verifyFailure()
else if (command === 'finalize') await finalize()
else if (command === 'cleanup') await cleanup()
else throw new Error('Usage: b17-razorpay-runtime-proof.mjs setup [run-id]|verify-initial|seed-refund|verify-failure|finalize|cleanup')
