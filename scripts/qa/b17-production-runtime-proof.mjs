#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const workspace = process.cwd()
const productionRef = 'vzhwahudircrpgtitwzd'
const productionBaseUrl = 'https://textile-accounting.vercel.app'
const outputPath = path.join(workspace, 'output/qa/blocked-row-campaign/B17-production-runtime.json')
const runId = `B17PROD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
const deploymentId = process.env.B17_DEPLOYMENT_ID ?? null
const commitSha = process.env.B17_COMMIT_SHA ?? null

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(productionRef)) {
    throw new Error('B17 production proof refused: production Supabase target not proven.')
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('B17 production proof requires production Supabase credentials.')
}
if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('B17 production proof requires the production webhook secret.')
}
const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
if (!razorpayKeyId?.startsWith('rzp_test_')) {
    throw new Error('B17 production proof refused: Razorpay TEST mode not proven.')
}
if (!deploymentId || !/^dpl_/.test(deploymentId) || !commitSha || !/^[0-9a-f]{40}$/.test(commitSha)) {
    throw new Error('B17 production proof requires exact deployment and commit identity.')
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
})
const assertions = []
const fixture = { organizations: [], users: [], eventPrefix: runId }

function safeId(value) {
    return typeof value === 'string' ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function assertCondition(id, name, passed, details = {}) {
    assertions.push({ id, name, passed, ...details })
    if (!passed) throw new Error(`${id} ${name} failed: ${JSON.stringify(details)}`)
}

async function requireData(result, label) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`)
    return result.data
}

async function createTenant(label) {
    const suffix = crypto.randomBytes(5).toString('hex')
    const email = `${runId.toLowerCase()}.${label.toLowerCase()}.${suffix}@prod-proof.weavly.local`
    const password = `B17-${crypto.randomBytes(14).toString('base64url')}A1!`
    const auth = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `${runId} ${label} Owner` },
    })
    if (auth.error || !auth.data.user) throw new Error(`Create ${label} auth failed: ${auth.error?.message}`)
    fixture.users.push(auth.data.user.id)

    const organization = await requireData(await admin.from('organizations').insert({
        name: `${runId}-${label}`,
        owner_id: auth.data.user.id,
        join_code: crypto.randomBytes(4).toString('hex').toUpperCase(),
        join_code_expires_at: new Date(Date.now() + 86400000).toISOString(),
        onboarding_complete: true,
        production_mode: 'both',
    }).select('id, name').single(), `Create ${label} organization`)
    fixture.organizations.push(organization.id)

    await requireData(await admin.from('profiles').insert({
        id: auth.data.user.id,
        org_id: organization.id,
        role: 'owner',
        full_name: `${runId} ${label} Owner`,
        email,
    }), `Create ${label} profile`)

    return { orgId: organization.id, userId: auth.data.user.id, email, password, name: organization.name }
}

async function ownerCookieHeader(owner) {
    const cookies = new Map()
    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
            setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
        },
    })
    const signIn = await client.auth.signInWithPassword({ email: owner.email, password: owner.password })
    if (signIn.error) throw new Error(`Production proof sign-in failed: ${signIn.error.message}`)
    return [...cookies].map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('; ')
}

async function sendWebhook(event, eventId, { validSignature = true } = {}) {
    const raw = JSON.stringify(event)
    const signature = validSignature
        ? crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex')
        : '0'.repeat(64)
    const response = await fetch(`${productionBaseUrl}/api/webhooks/razorpay`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-razorpay-signature': signature,
            'x-razorpay-event-id': eventId,
        },
        body: raw,
        redirect: 'manual',
    })
    return { status: response.status, body: await response.json().catch(() => null) }
}

async function cleanup() {
    const errors = []
    const orgIds = fixture.organizations
    const userIds = fixture.users
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
        if (orgIds.length === 0) continue
        const result = await admin.from(table).delete().in(column, orgIds)
        if (result.error) errors.push(`${table}: ${result.error.message}`)
    }
    const events = await admin.from('razorpay_webhook_events').delete().like('event_id', `${runId}-%`)
    if (events.error) errors.push(`razorpay_webhook_events: ${events.error.message}`)
    if (userIds.length > 0) {
        const profiles = await admin.from('profiles').delete().in('id', userIds)
        if (profiles.error) errors.push(`profiles: ${profiles.error.message}`)
    }
    if (orgIds.length > 0) {
        const organizations = await admin.from('organizations').delete().in('id', orgIds)
        if (organizations.error) errors.push(`organizations: ${organizations.error.message}`)
    }
    for (const userId of userIds) {
        const result = await admin.auth.admin.deleteUser(userId)
        if (result.error && result.error.code !== 'user_not_found') errors.push(`auth ${safeId(userId)}: ${result.error.message}`)
    }

    const [orgCount, profileCount, subCount, paymentCount, eventCount, refundCount, authReads] = await Promise.all([
        admin.from('organizations').select('id', { count: 'exact', head: true }).in('id', orgIds),
        admin.from('profiles').select('id', { count: 'exact', head: true }).in('id', userIds),
        admin.from('org_subscriptions').select('id', { count: 'exact', head: true }).in('org_id', orgIds),
        admin.from('subscription_payments').select('id', { count: 'exact', head: true }).in('org_id', orgIds),
        admin.from('razorpay_webhook_events').select('event_id', { count: 'exact', head: true }).like('event_id', `${runId}-%`),
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
    return { errors, reconciliation, reconciled: errors.length === 0 && Object.values(reconciliation).every((value) => value === 0) }
}

let cleanupResult = null
let primary = null
let referee = null
try {
    primary = await createTenant('PRIMARY')
    referee = await createTenant('REFEREE')
    assertCondition('PROD-SETUP', 'two isolated prefixed production-proof tenants exist', true, { organizations: 2, profiles: 2 })

    const referralCode = await requireData(await admin.from('referral_codes').insert({
        org_id: primary.orgId,
        code: `B17R${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    }).select('id').single(), 'Create production referral code')
    const referralUse = await requireData(await admin.from('referral_uses').insert({
        referral_code_id: referralCode.id,
        referee_org_id: referee.orgId,
        status: 'pending',
    }).select('id').single(), 'Create pending production referral')

    const nowSeconds = Math.floor(Date.now() / 1000)
    const subscriptionId = `sub_${crypto.randomBytes(8).toString('hex')}`
    const paidEnd = new Date(Date.now() + 86400000).toISOString()
    const lifecycleRow = await requireData(await admin.from('org_subscriptions').insert({
        org_id: referee.orgId,
        plan_id: null,
        plan_tier: 'base',
        status: 'active',
        razorpay_subscription_id: subscriptionId,
        current_start: new Date(Date.now() - 86400000).toISOString(),
        current_end: paidEnd,
    }).select('id').single(), 'Create paid lifecycle row')

    const cookie = await ownerCookieHeader(referee)
    const beforeAccess = await fetch(`${productionBaseUrl}/owner/quotes`, { headers: { cookie }, redirect: 'manual' })
    const beforeBody = await beforeAccess.text()
    assertCondition('BILL-010-PROD-BEFORE', 'live alias renders gated estimator history during the paid period',
        beforeAccess.status === 200 && !beforeBody.includes('NEXT_REDIRECT'),
        { status: beforeAccess.status, redirected: beforeBody.includes('NEXT_REDIRECT') })

    const lifecycleEvent = (type, createdAt) => ({
        entity: 'event',
        event: type,
        created_at: createdAt,
        payload: { subscription: { entity: {
            id: subscriptionId,
            current_start: nowSeconds - 86400,
            current_end: nowSeconds + 86400,
            paid_count: 1,
            remaining_count: 0,
        } } },
    })
    const activationEvent = lifecycleEvent('subscription.activated', nowSeconds + 5)
    const activationId = `${runId}-activation`
    const activation = await sendWebhook(activationEvent, activationId)
    const activationReplay = await sendWebhook(activationEvent, activationId)
    const activationConflict = await sendWebhook({ ...activationEvent, contains: ['changed'] }, activationId)
    const invalidId = `${runId}-invalid`
    const invalid = await sendWebhook(activationEvent, invalidId, { validSignature: false })
    const invalidLedger = await admin.from('razorpay_webhook_events').select('event_id', { count: 'exact', head: true }).eq('event_id', invalidId)
    assertCondition('SEC-007-PROD', 'live signed webhook accepts once, deduplicates replay, and rejects body conflict/invalid HMAC',
        activation.status === 200 && activationReplay.body?.duplicate === true
            && activationConflict.status === 409 && invalid.status === 400 && invalidLedger.count === 0,
        { first: activation.status, replay_duplicate: activationReplay.body?.duplicate === true, conflict: activationConflict.status, invalid: invalid.status, invalid_rows: invalidLedger.count })

    const convertedUse = await requireData(await admin.from('referral_uses').select('status, converted_at').eq('id', referralUse.id).single(), 'Load converted production referral')
    const conversionWindows = await admin.from('referral_discount_windows').select('id', { count: 'exact', head: true }).eq('referral_use_id', referralUse.id)
    assertCondition('BILL-009-CONVERSION-PROD', 'live activation converts one pending referral exactly once',
        convertedUse.status === 'converted' && Boolean(convertedUse.converted_at) && conversionWindows.count === 1,
        { status: convertedUse.status, windows: conversionWindows.count })

    const cancellation = await sendWebhook(lifecycleEvent('subscription.cancelled', nowSeconds + 20), `${runId}-cancel`)
    const staleActivation = await sendWebhook(lifecycleEvent('subscription.activated', nowSeconds + 10), `${runId}-stale-active`)
    const afterStale = await requireData(await admin.from('org_subscriptions').select('status, current_end, cancel_at_cycle_end').eq('id', lifecycleRow.id).single(), 'Load production cancelled lifecycle')
    assertCondition('BILL-006-PROD', 'live cancellation retains the paid end and a stale activation cannot regress it',
        cancellation.status === 200 && staleActivation.status === 200
            && afterStale.status === 'cancelled' && Boolean(afterStale.current_end) && afterStale.cancel_at_cycle_end === true,
        { cancel_status: cancellation.status, stale_status: staleActivation.status, lifecycle_status: afterStale.status, end_retained: Boolean(afterStale.current_end) })

    const checkoutOrderId = `order_${crypto.randomBytes(8).toString('hex')}`
    const checkoutPaymentId = `pay_${crypto.randomBytes(8).toString('hex')}`
    const checkout = await requireData(await admin.from('org_subscriptions').insert({
        org_id: primary.orgId,
        plan_id: null,
        plan_tier: 'base',
        status: 'created',
        billing_model: 'upfront_first_year_plus_annual_renewal',
        razorpay_order_id: checkoutOrderId,
        checkout_purchase_type: 'initial_purchase',
        checkout_amount_paise: 826000,
        checkout_currency: 'INR',
    }).select('id').single(), 'Create failed-to-captured checkout fixture')
    await requireData(await admin.from('subscription_payments').insert({
        org_id: primary.orgId,
        subscription_id: checkout.id,
        razorpay_payment_id: checkoutPaymentId,
        razorpay_order_id: checkoutOrderId,
        amount_paise: 826000,
        status: 'failed',
        method: 'netbanking',
    }), 'Create failed payment snapshot')
    const activationClaim = await admin.rpc('activate_order_billing_purchase', {
        p_org_id: primary.orgId,
        p_razorpay_order_id: checkoutOrderId,
        p_razorpay_payment_id: checkoutPaymentId,
        p_amount_paise: 826000,
        p_method: 'netbanking',
        p_plan_tier: 'base',
        p_purchase_type: 'initial_purchase',
        p_currency: 'INR',
    })
    if (activationClaim.error) throw activationClaim.error
    const capturedPayment = await requireData(await admin.from('subscription_payments').select('status, amount_paise').eq('razorpay_payment_id', checkoutPaymentId).single(), 'Load reconciled captured payment')
    const activatedCheckout = await requireData(await admin.from('org_subscriptions').select('status, current_end').eq('id', checkout.id).single(), 'Load reconciled checkout')
    assertCondition('BILL-007-PROD', 'production activation wrapper replaces the exact failed snapshot with one captured payment',
        capturedPayment.status === 'captured' && capturedPayment.amount_paise === 826000
            && activatedCheckout.status === 'active' && Boolean(activatedCheckout.current_end),
        { payment_status: capturedPayment.status, subscription_status: activatedCheckout.status, active_end: Boolean(activatedCheckout.current_end) })

    const firstRefundClaim = await admin.rpc('claim_referral_refund', {
        p_org_id: primary.orgId,
        p_razorpay_payment_id: checkoutPaymentId,
        p_original_amount_paise: 826000,
    })
    const secondRefundClaim = await admin.rpc('claim_referral_refund', {
        p_org_id: primary.orgId,
        p_razorpay_payment_id: checkoutPaymentId,
        p_original_amount_paise: 826000,
    })
    if (firstRefundClaim.error) throw firstRefundClaim.error
    if (secondRefundClaim.error) throw secondRefundClaim.error
    const refundRows = await requireData(await admin.from('referral_refunds').select('status, refund_amount_paise, discount_pct_applied, attempts, idempotency_key').eq('razorpay_payment_id', checkoutPaymentId), 'Load production refund claim')
    assertCondition('BILL-009-CLAIM-PROD', 'production refund reservation is 10%, stable, and non-claimable on replay',
        firstRefundClaim.data?.claimed === true && secondRefundClaim.data?.claimed === false
            && refundRows.length === 1 && refundRows[0].refund_amount_paise === 82600
            && refundRows[0].discount_pct_applied === 10 && Boolean(refundRows[0].idempotency_key),
        { first_claimed: firstRefundClaim.data?.claimed, second_claimed: secondRefundClaim.data?.claimed, rows: refundRows.length, amount_paise: refundRows[0]?.refund_amount_paise, discount_pct: refundRows[0]?.discount_pct_applied })

    await sendWebhook(lifecycleEvent('subscription.activated', nowSeconds + 30), `${runId}-recovery`)
    const expiry = await sendWebhook(lifecycleEvent('subscription.expired', nowSeconds + 40), `${runId}-expiry`)
    const postExpiryStale = await sendWebhook(lifecycleEvent('subscription.activated', nowSeconds + 35), `${runId}-post-expiry-stale`)
    const finalLifecycle = await requireData(await admin.from('org_subscriptions').select('status, provider_event_id').eq('id', lifecycleRow.id).single(), 'Load production expired lifecycle')
    const afterAccess = await fetch(`${productionBaseUrl}/owner/quotes`, { headers: { cookie }, redirect: 'manual' })
    const afterBody = await afterAccess.text()
    const streamRedirect = afterAccess.status === 200 && afterBody.includes('NEXT_REDIRECT') && afterBody.includes('/owner/billing')
    const accountCount = await admin.from('organizations').select('id', { count: 'exact', head: true }).eq('id', referee.orgId)
    const profileCount = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', referee.userId)
    assertCondition('BILL-010-PROD', 'live expiry is monotonic and removes gated access without deleting the account',
        expiry.status === 200 && postExpiryStale.status === 200
            && finalLifecycle.status === 'expired' && finalLifecycle.provider_event_id === `${runId}-expiry`
            && streamRedirect && accountCount.count === 1 && profileCount.count === 1,
        { expiry_status: expiry.status, stale_status: postExpiryStale.status, final_status: finalLifecycle.status, redirect_mode: streamRedirect ? 'next_stream' : null, organizations: accountCount.count, profiles: profileCount.count })
} finally {
    cleanupResult = await cleanup()
}

assertCondition('PROD-CLEANUP', 'all disposable production-proof database and auth state reconciles to zero', cleanupResult.reconciled, cleanupResult)
const evidence = {
    run_id: runId,
    environment: 'production-alias-razorpay-test-mode',
    project_ref: productionRef,
    base_url: productionBaseUrl,
    deployment_id: deploymentId,
    commit_sha: commitSha,
    real_money_charged: false,
    provider_mode: 'test',
    assertions,
    fixture: {
        primary: primary ? { factory: primary.name, org: safeId(primary.orgId), profile: safeId(primary.userId) } : null,
        referee: referee ? { factory: referee.name, org: safeId(referee.orgId), profile: safeId(referee.userId) } : null,
    },
    cleanup: cleanupResult,
    passed: assertions.every((assertion) => assertion.passed) && cleanupResult.reconciled,
}
await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ passed: evidence.passed, assertions: assertions.length, cleanup: cleanupResult.reconciliation, evidence: outputPath }, null, 2)}\n`)
