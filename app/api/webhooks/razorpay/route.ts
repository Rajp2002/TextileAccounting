import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { processReferralConversion, issueReferralRefund } from '@/lib/referral-webhook'
import { checkPublicPostRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { razorpay } from '@/lib/razorpay'
import { activateInitialPurchase } from '@/lib/billing-activation'
import { readBillingOrderContext } from '@/lib/billing-lifecycle'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

type RazorpaySubscriptionEntity = {
    id: string
    current_start?: number | null
    current_end?: number | null
    charge_at?: number | null
    paid_count?: number | null
    remaining_count?: number | null
}

type RazorpayPaymentEntity = {
    id: string
    subscription_id?: string | null
    order_id?: string | null
    amount: number
    currency?: string | null
    method?: string | null
    notes?: Record<string, string> | null
}

type RazorpayOrderEntity = {
    id: string
    amount: number
    notes?: Record<string, string> | null
}

type RazorpayWebhookEvent = {
    id?: string
    event?: string
    created_at?: number
    payload?: {
        subscription?: { entity?: RazorpaySubscriptionEntity }
        payment?: { entity?: RazorpayPaymentEntity }
        order?: { entity?: RazorpayOrderEntity }
    }
}

type WebhookClaimResult = {
    process: boolean
    conflict?: boolean
    duplicate?: boolean
    retry?: boolean
    attempts?: number
}

type SubscriptionEventResult = {
    applied: boolean
    missing?: boolean
    orgId?: string
    status?: string
}

function verifyRazorpaySignature(rawBody: Buffer, signature: string): boolean {
    if (!WEBHOOK_SECRET) {
        Sentry.captureMessage('RAZORPAY_WEBHOOK_SECRET is not set', 'error')
        return false
    }

    const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')

    const expectedBuffer = Buffer.from(expected, 'hex')
    const signatureBuffer = Buffer.from(signature, 'hex')
    if (expectedBuffer.length !== signatureBuffer.length) return false

    try {
        return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    } catch {
        return false
    }
}

function toISO(unixTs: number | null | undefined): string | null {
    if (!unixTs) return null
    return new Date(unixTs * 1000).toISOString()
}

function requireEventTimestamp(event: RazorpayWebhookEvent): string {
    const timestamp = toISO(event.created_at)
    if (!timestamp) throw new Error('Razorpay lifecycle event is missing a valid created_at timestamp.')
    return timestamp
}

async function applySubscriptionEvent({
    supabase,
    event,
    eventId,
    status,
}: {
    supabase: ReturnType<typeof createAdminClient>
    event: RazorpayWebhookEvent
    eventId: string
    status: string
}): Promise<SubscriptionEventResult> {
    const subscription = event.payload?.subscription?.entity
    if (!subscription?.id) return { applied: false, missing: true }

    const { data, error } = await supabase.rpc('apply_razorpay_subscription_event', {
        p_razorpay_subscription_id: subscription.id,
        p_status: status,
        p_event_created_at: requireEventTimestamp(event),
        p_event_id: eventId,
        p_current_start: toISO(subscription.current_start),
        p_current_end: toISO(subscription.current_end),
        p_charge_at: toISO(subscription.charge_at),
        p_paid_count: subscription.paid_count ?? null,
        p_remaining_count: subscription.remaining_count ?? null,
    })
    if (error) throw error
    return (data ?? { applied: false }) as SubscriptionEventResult
}

function eventIdForRequest(req: NextRequest, event: RazorpayWebhookEvent, rawBody: Buffer): string {
    return req.headers.get('x-razorpay-event-id')
        || event.id
        || crypto.createHash('sha256').update(rawBody).digest('hex')
}

async function markWebhookEventFailed(supabase: ReturnType<typeof createAdminClient>, eventId: string, error: unknown) {
    await supabase
        .from('razorpay_webhook_events')
        .update({
            status: 'failed',
            last_error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown webhook processing error',
            updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
}

export async function POST(req: NextRequest) {
    const clientIp = getClientIpFromHeaders(req.headers)
    const rateLimitReset = await checkPublicPostRateLimit(clientIp, 'razorpay-webhook')
    if (rateLimitReset) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const rawBody = Buffer.from(await req.arrayBuffer())
    const signature = req.headers.get('x-razorpay-signature') ?? ''

    if (!verifyRazorpaySignature(rawBody, signature)) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    let event: RazorpayWebhookEvent
    try {
        event = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookEvent
    } catch {
        return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const eventType = typeof event.event === 'string' ? event.event : 'unknown'
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex')
    const eventId = eventIdForRequest(req, event, rawBody)

    const { data: claimData, error: claimError } = await supabase.rpc('claim_razorpay_webhook_event', {
        p_event_id: eventId,
        p_event_type: eventType,
        p_payload_hash: payloadHash,
        p_stale_after_seconds: 300,
    })
    if (claimError) {
        Sentry.captureException(claimError, { tags: { route: 'razorpay_webhook', phase: 'idempotency_claim' } })
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }

    const claim = claimData as WebhookClaimResult | null
    if (claim?.conflict) {
        Sentry.captureMessage(`Razorpay event identity conflict: ${eventId}`, 'warning')
        return NextResponse.json({ error: 'Webhook event identity mismatch' }, { status: 409 })
    }
    if (!claim?.process) {
        return NextResponse.json({ received: true, duplicate: true })
    }

    try {
        switch (eventType) {
            case 'payment.captured': {
                const hintedPayment = event.payload?.payment?.entity
                if (!hintedPayment?.id) break

                // Webhook payloads are snapshots and may arrive out of order.
                // Fetch the canonical payment before changing entitlement.
                const payment = await razorpay.payments.fetch(hintedPayment.id)
                if (payment.status !== 'captured') break

                // If it is a subscription-based payment, subscription.charged will handle it.
                if (payment.subscription_id) {
                    break
                }

                const orderId = payment.order_id
                if (!orderId) break

                // Payment notes are not authoritative. Always fetch and validate
                // the canonical order before activating a one-time purchase.
                const order = await razorpay.orders.fetch(orderId)
                const orderContext = readBillingOrderContext(order)

                console.log(`[razorpay-webhook] payment.captured: id=${payment.id}, order_id=${orderId}`)

                if (
                    !orderContext ||
                    Number(payment.amount) !== orderContext.amountPaise ||
                    payment.currency !== 'INR' ||
                    payment.order_id !== orderId
                ) {
                    Sentry.captureMessage(`Invalid billing context on captured order ${orderId}`, 'warning')
                    break
                }

                console.log(`[razorpay-webhook] Triggering activateInitialPurchase for payment.captured...`)
                await activateInitialPurchase({
                    orgId: orderContext.orgId,
                    razorpayOrderId: orderId,
                    razorpayPaymentId: payment.id,
                    amountPaise: Number(payment.amount),
                    method: payment.method ?? null,
                    planTier: orderContext.planTier,
                    purchaseType: orderContext.purchaseType,
                })
                break
            }

            case 'order.paid': {
                const order = event.payload?.order?.entity
                if (!order?.id) break

                const fetchedOrder = await razorpay.orders.fetch(order.id)
                const orderContext = readBillingOrderContext(fetchedOrder)
                console.log(`[razorpay-webhook] order.paid: id=${order.id}`)

                if (!orderContext) {
                    Sentry.captureMessage(`Invalid billing context on paid order ${order.id}`, 'warning')
                    break
                }

                console.log(`[razorpay-webhook] Fetching payments for order ${order.id}...`)
                const paymentsList = await razorpay.orders.fetchPayments(order.id)
                const successfulPayment = paymentsList.items?.find((p: { status: string; amount: string | number; currency: string }) => (
                    p.status === 'captured' &&
                    Number(p.amount) === orderContext.amountPaise &&
                    p.currency === 'INR'
                ))
                if (successfulPayment) {
                    console.log(`[razorpay-webhook] Triggering activateInitialPurchase for order.paid (payment: ${successfulPayment.id})...`)
                    await activateInitialPurchase({
                        orgId: orderContext.orgId,
                        razorpayOrderId: order.id,
                        razorpayPaymentId: successfulPayment.id,
                        amountPaise: Number(successfulPayment.amount),
                        method: successfulPayment.method ?? null,
                        planTier: orderContext.planTier,
                        purchaseType: orderContext.purchaseType,
                    })
                } else {
                    console.log('[razorpay-webhook] No captured payment found for order.paid')
                }
                break
            }

            case 'subscription.authenticated': {
                await applySubscriptionEvent({ supabase, event, eventId, status: 'authenticated' })
                break
            }

            case 'subscription.activated':
            case 'subscription.resumed': {
                const result = await applySubscriptionEvent({ supabase, event, eventId, status: 'active' })
                if (result.applied && result.orgId) {
                    await processReferralConversion(result.orgId)
                }
                break
            }

            case 'subscription.charged': {
                const sub = event.payload?.subscription?.entity
                const hintedPayment = event.payload?.payment?.entity
                if (!sub?.id) break

                await applySubscriptionEvent({ supabase, event, eventId, status: 'active' })

                if (hintedPayment?.id) {
                    const payment = await razorpay.payments.fetch(hintedPayment.id)
                    if (
                        payment.status !== 'captured' ||
                        payment.subscription_id !== sub.id ||
                        payment.currency !== 'INR'
                    ) break

                    const { data: orgSub, error: orgSubError } = await supabase
                        .from('org_subscriptions')
                        .select('id, org_id')
                        .eq('razorpay_subscription_id', sub.id)
                        .single()
                    if (orgSubError) throw orgSubError

                    if (orgSub) {
                        const { data: existingPayment, error: existingError } = await supabase
                            .from('subscription_payments')
                            .select('id, org_id, subscription_id, amount_paise, status')
                            .eq('razorpay_payment_id', payment.id)
                            .maybeSingle()
                        if (existingError) throw existingError

                        if (existingPayment?.status === 'captured') {
                            Sentry.captureMessage(`Payment ${payment.id} already processed`, 'info')
                            break
                        }
                        if (
                            existingPayment &&
                            (
                                existingPayment.org_id !== orgSub.org_id ||
                                existingPayment.subscription_id !== orgSub.id ||
                                Number(existingPayment.amount_paise) !== Number(payment.amount)
                            )
                        ) {
                            throw new Error('Failed payment context does not match the captured subscription payment.')
                        }

                        const paymentWrite = existingPayment
                            ? supabase.from('subscription_payments').update({
                                status: 'captured',
                                razorpay_order_id: payment.order_id ?? null,
                                method: payment.method ?? null,
                                captured_at: new Date().toISOString(),
                            }).eq('id', existingPayment.id).eq('status', 'failed')
                            : supabase.from('subscription_payments').insert({
                                org_id: orgSub.org_id,
                                subscription_id: orgSub.id,
                                razorpay_payment_id: payment.id,
                                razorpay_order_id: payment.order_id ?? null,
                                amount_paise: Number(payment.amount),
                                status: 'captured',
                                method: payment.method ?? null,
                                captured_at: new Date().toISOString(),
                            })

                        const { error: paymentWriteError } = await paymentWrite
                        if (paymentWriteError) {
                            if (paymentWriteError.code === '23505') {
                                Sentry.captureMessage(`Concurrent payment insert for ${payment.id}; skipping refund`, 'warning')
                                break
                            }
                            Sentry.captureException(paymentWriteError, { tags: { route: 'razorpay_webhook', phase: 'payment_insert' } })
                            throw paymentWriteError
                        }

                        await issueReferralRefund(orgSub.org_id, payment.id, Number(payment.amount))
                    }
                }
                break
            }

            case 'subscription.pending':
            case 'subscription.paused':
            case 'subscription.halted':
            case 'subscription.cancelled':
            case 'subscription.completed':
            case 'subscription.expired': {
                const statusMap: Record<string, string> = {
                    'subscription.pending': 'pending',
                    'subscription.paused': 'paused',
                    'subscription.halted': 'halted',
                    'subscription.cancelled': 'cancelled',
                    'subscription.completed': 'completed',
                    'subscription.expired': 'expired',
                }
                await applySubscriptionEvent({ supabase, event, eventId, status: statusMap[eventType] })
                break
            }

            case 'payment.failed': {
                const hintedPayment = event.payload?.payment?.entity
                if (!hintedPayment?.id) break

                // A late failure snapshot must never override a payment that
                // the provider now reports as captured.
                const payment = await razorpay.payments.fetch(hintedPayment.id)
                if (payment.status !== 'failed') break

                const { data: existingPayment, error: existingPaymentError } = await supabase
                    .from('subscription_payments')
                    .select('id, status')
                    .eq('razorpay_payment_id', payment.id)
                    .maybeSingle()
                if (existingPaymentError) throw existingPaymentError
                if (existingPayment) {
                    Sentry.captureMessage(`Failed payment ${payment.id} already recorded as ${existingPayment.status}`, 'info')
                    break
                }

                if (payment.subscription_id) {
                    const { data: orgSub, error: orgSubError } = await supabase
                        .from('org_subscriptions')
                        .select('id, org_id')
                        .eq('razorpay_subscription_id', payment.subscription_id)
                        .single()
                    if (orgSubError) throw orgSubError

                    if (orgSub) {
                        const { error: failedInsertError } = await supabase.from('subscription_payments').insert({
                            org_id: orgSub.org_id,
                            subscription_id: orgSub.id,
                            razorpay_payment_id: payment.id,
                            razorpay_order_id: payment.order_id ?? null,
                            amount_paise: Number(payment.amount),
                            status: 'failed',
                            method: payment.method ?? null,
                        })

                        if (failedInsertError) {
                            if (failedInsertError.code === '23505') {
                                Sentry.captureMessage(`Failed payment ${payment.id} already recorded by concurrent webhook`, 'warning')
                                break
                            }
                            Sentry.captureException(failedInsertError, { tags: { route: 'razorpay_webhook', phase: 'failed_payment_insert' } })
                            throw failedInsertError
                        }
                    }
                } else if (payment.order_id) {
                    const order = await razorpay.orders.fetch(payment.order_id)
                    const orderContext = readBillingOrderContext(order)
                    if (
                        !orderContext ||
                        payment.currency !== 'INR' ||
                        Number(payment.amount) !== orderContext.amountPaise
                    ) break

                    const { data: orgSub, error: orgSubError } = await supabase
                        .from('org_subscriptions')
                        .select('id, org_id')
                        .eq('razorpay_order_id', payment.order_id)
                        .maybeSingle()
                    if (orgSubError) throw orgSubError

                    if (orgSub?.org_id === orderContext.orgId) {
                        const { error: failedInsertError } = await supabase.from('subscription_payments').insert({
                            org_id: orderContext.orgId,
                            subscription_id: orgSub.id,
                            razorpay_payment_id: payment.id,
                            razorpay_order_id: payment.order_id,
                            amount_paise: Number(payment.amount),
                            status: 'failed',
                            method: payment.method ?? null,
                        })

                        if (failedInsertError) {
                            if (failedInsertError.code === '23505') {
                                Sentry.captureMessage(`Failed payment ${payment.id} already recorded by concurrent webhook`, 'warning')
                                break
                            }
                            Sentry.captureException(failedInsertError, { tags: { route: 'razorpay_webhook', phase: 'failed_payment_insert' } })
                            throw failedInsertError
                        }
                    }
                }
                break
            }

            default:
                break
        }
    } catch (error) {
        Sentry.captureException(error, { tags: { route: 'razorpay_webhook', event_type: eventType } })
        await markWebhookEventFailed(supabase, eventId, error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }

    const { error: processedUpdateError } = await supabase
        .from('razorpay_webhook_events')
        .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)

    if (processedUpdateError) {
        Sentry.captureException(processedUpdateError, { tags: { route: 'razorpay_webhook', phase: 'idempotency_processed' } })
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}
