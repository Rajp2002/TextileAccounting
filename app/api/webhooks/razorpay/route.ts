import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { processReferralConversion, issueReferralRefund } from '@/lib/referral-webhook'
import { checkPublicPostRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'

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
    method?: string | null
}

type RazorpayWebhookEvent = {
    id?: string
    event?: string
    payload?: {
        subscription?: { entity?: RazorpaySubscriptionEntity }
        payment?: { entity?: RazorpayPaymentEntity }
    }
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

    const { error: eventInsertError } = await supabase
        .from('razorpay_webhook_events')
        .insert({
            event_id: eventId,
            event_type: eventType,
            payload_hash: payloadHash,
            status: 'processing',
            attempts: 1,
        })

    if (eventInsertError) {
        if (eventInsertError.code !== '23505') {
            Sentry.captureException(eventInsertError, { tags: { route: 'razorpay_webhook', phase: 'idempotency_insert' } })
            return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
        }

        const { data: existingEvent, error: existingError } = await supabase
            .from('razorpay_webhook_events')
            .select('status')
            .eq('event_id', eventId)
            .maybeSingle()

        if (existingError) {
            Sentry.captureException(existingError, { tags: { route: 'razorpay_webhook', phase: 'idempotency_lookup' } })
            return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
        }

        if (existingEvent?.status === 'processed' || existingEvent?.status === 'processing') {
            return NextResponse.json({ received: true })
        }

        const { error: retryUpdateError } = await supabase
            .from('razorpay_webhook_events')
            .update({
                status: 'processing',
                last_error: null,
                updated_at: new Date().toISOString(),
            })
            .eq('event_id', eventId)

        if (retryUpdateError) {
            Sentry.captureException(retryUpdateError, { tags: { route: 'razorpay_webhook', phase: 'idempotency_retry' } })
            return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
        }
    }

    try {
        switch (eventType) {
            case 'subscription.authenticated': {
                const sub = event.payload?.subscription?.entity
                if (!sub?.id) break

                const { error } = await supabase
                    .from('org_subscriptions')
                    .update({
                        status: 'authenticated',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('razorpay_subscription_id', sub.id)
                if (error) throw error
                break
            }

            case 'subscription.activated': {
                const sub = event.payload?.subscription?.entity
                if (!sub?.id) break

                const { data: activeSubData, error } = await supabase
                    .from('org_subscriptions')
                    .update({
                        status: 'active',
                        current_start: toISO(sub.current_start),
                        current_end: toISO(sub.current_end),
                        charge_at: toISO(sub.charge_at),
                        paid_count: sub.paid_count ?? 0,
                        remaining_count: sub.remaining_count ?? null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('razorpay_subscription_id', sub.id)
                    .select('org_id')
                    .single()
                if (error) throw error

                if (activeSubData) {
                    await processReferralConversion(activeSubData.org_id)
                }
                break
            }

            case 'subscription.charged': {
                const sub = event.payload?.subscription?.entity
                const payment = event.payload?.payment?.entity
                if (!sub?.id) break

                if (payment?.id) {
                    const { data: existingPayment } = await supabase
                        .from('subscription_payments')
                        .select('id')
                        .eq('razorpay_payment_id', payment.id)
                        .maybeSingle()

                    if (existingPayment) {
                        Sentry.captureMessage(`Payment ${payment.id} already processed`, 'info')
                        break
                    }
                }

                const { error: updateError } = await supabase
                    .from('org_subscriptions')
                    .update({
                        status: 'active',
                        current_start: toISO(sub.current_start),
                        current_end: toISO(sub.current_end),
                        charge_at: toISO(sub.charge_at),
                        paid_count: sub.paid_count ?? 0,
                        remaining_count: sub.remaining_count ?? null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('razorpay_subscription_id', sub.id)
                if (updateError) throw updateError

                if (payment?.id) {
                    const { data: orgSub, error: orgSubError } = await supabase
                        .from('org_subscriptions')
                        .select('id, org_id')
                        .eq('razorpay_subscription_id', sub.id)
                        .single()
                    if (orgSubError) throw orgSubError

                    if (orgSub) {
                        const { error: insertError } = await supabase.from('subscription_payments').insert({
                            org_id: orgSub.org_id,
                            subscription_id: orgSub.id,
                            razorpay_payment_id: payment.id,
                            razorpay_order_id: payment.order_id ?? null,
                            amount_paise: payment.amount,
                            status: 'captured',
                            method: payment.method ?? null,
                            captured_at: new Date().toISOString(),
                        })

                        if (insertError) {
                            if (insertError.code === '23505') {
                                Sentry.captureMessage(`Concurrent payment insert for ${payment.id}; skipping refund`, 'warning')
                                break
                            }
                            Sentry.captureException(insertError, { tags: { route: 'razorpay_webhook', phase: 'payment_insert' } })
                            throw insertError
                        }

                        await issueReferralRefund(orgSub.org_id, payment.id, payment.amount)
                    }
                }
                break
            }

            case 'subscription.halted':
            case 'subscription.cancelled':
            case 'subscription.completed':
            case 'subscription.expired': {
                const sub = event.payload?.subscription?.entity
                if (!sub?.id) break

                const statusMap: Record<string, string> = {
                    'subscription.halted': 'halted',
                    'subscription.cancelled': 'cancelled',
                    'subscription.completed': 'completed',
                    'subscription.expired': 'expired',
                }

                const { error } = await supabase
                    .from('org_subscriptions')
                    .update({
                        status: statusMap[eventType],
                        updated_at: new Date().toISOString(),
                    })
                    .eq('razorpay_subscription_id', sub.id)
                if (error) throw error
                break
            }

            case 'payment.failed': {
                const payment = event.payload?.payment?.entity
                if (!payment?.id || !payment?.subscription_id) break

                const { data: existingFailed } = await supabase
                    .from('subscription_payments')
                    .select('id')
                    .eq('razorpay_payment_id', payment.id)
                    .maybeSingle()

                if (existingFailed) {
                    Sentry.captureMessage(`Failed payment ${payment.id} already recorded`, 'info')
                    break
                }

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
                        amount_paise: payment.amount,
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
