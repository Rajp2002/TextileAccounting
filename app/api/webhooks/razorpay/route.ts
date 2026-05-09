import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { processReferralConversion, issueReferralRefund } from '@/lib/referral-webhook'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/razorpay
 *
 * Handles all Razorpay subscription lifecycle webhook events.
 * Verifies HMAC-SHA256 signature before processing.
 *
 * Uses createAdminClient (service_role) to bypass RLS — webhooks are
 * not user-scoped, they come from Razorpay's servers.
 *
 * Events handled:
 *   subscription.authenticated → status update
 *   subscription.activated     → status + billing period update
 *   subscription.charged       → billing period update + payment logged
 *   subscription.halted        → status update
 *   subscription.cancelled     → status update
 *   subscription.completed     → status update
 *   subscription.expired       → status update
 *   payment.failed             → failed payment logged
 */

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

function verifyRazorpaySignature(rawBody: string, signature: string): boolean {
    if (!WEBHOOK_SECRET) {
        console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting all requests')
        return false
    }
    const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    } catch {
        return false
    }
}

/** Convert Razorpay Unix timestamp to ISO string safely */
function toISO(unixTs: number | null | undefined): string | null {
    if (!unixTs) return null
    return new Date(unixTs * 1000).toISOString()
}

export async function POST(req: NextRequest) {
    // ── 1. Read raw body (must happen before any parsing) ────────────────────
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature') ?? ''

    // ── 2. Verify signature ───────────────────────────────────────────────────
    if (!verifyRazorpaySignature(rawBody, signature)) {
        console.warn('[razorpay-webhook] Invalid signature — request rejected')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // ── 3. Parse event ────────────────────────────────────────────────────────
    let event: any
    try {
        event = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const supabase = createAdminClient() // service_role — bypasses RLS

    console.log(`[razorpay-webhook] Event received: ${event.event}`)

    // ── 4. Route event ────────────────────────────────────────────────────────
    switch (event.event) {

        // ── Subscription mandate authenticated (NACH/UPI autopay) ───────────
        case 'subscription.authenticated': {
            const sub = event.payload?.subscription?.entity
            if (!sub?.id) break

            await supabase
                .from('org_subscriptions')
                .update({
                    status: 'authenticated',
                    updated_at: new Date().toISOString(),
                })
                .eq('razorpay_subscription_id', sub.id)
            break
        }

        // ── Subscription activated (first charge succeeded) ──────────────────
        case 'subscription.activated': {
            const sub = event.payload?.subscription?.entity
            if (!sub?.id) break

            const { data: activeSubData } = await supabase
                .from('org_subscriptions')
                .update({
                    status: 'active',
                    current_start:   toISO(sub.current_start),
                    current_end:     toISO(sub.current_end),
                    charge_at:       toISO(sub.charge_at),
                    paid_count:      sub.paid_count ?? 0,
                    remaining_count: sub.remaining_count ?? null,
                    updated_at:      new Date().toISOString(),
                })
                .eq('razorpay_subscription_id', sub.id)
                .select()
                .single()
                
            if (activeSubData) {
                await processReferralConversion(activeSubData.org_id)
            }
            break
        }

        // ── Subscription charged (recurring payment) ─────────────────────────
        case 'subscription.charged': {
            const sub     = event.payload?.subscription?.entity
            const payment = event.payload?.payment?.entity
            if (!sub?.id) break

            // Idempotency check: Skip if payment already processed
            if (payment?.id) {
                const { data: existingPayment } = await supabase
                    .from('subscription_payments')
                    .select('id')
                    .eq('razorpay_payment_id', payment.id)
                    .maybeSingle()

                if (existingPayment) {
                    console.log(`[razorpay-webhook] Payment ${payment.id} already processed — skipping side effects`)
                    break
                }
            }

            // Update billing period
            await supabase
                .from('org_subscriptions')
                .update({
                    status:          'active',
                    current_start:   toISO(sub.current_start),
                    current_end:     toISO(sub.current_end),
                    charge_at:       toISO(sub.charge_at),
                    paid_count:      sub.paid_count ?? 0,
                    remaining_count: sub.remaining_count ?? null,
                    updated_at:      new Date().toISOString(),
                })
                .eq('razorpay_subscription_id', sub.id)

            // Log the payment (if payment entity present)
            if (payment?.id) {
                const { data: orgSub } = await supabase
                    .from('org_subscriptions')
                    .select('id, org_id')
                    .eq('razorpay_subscription_id', sub.id)
                    .single()

                if (orgSub) {
                    const { error: insertError } = await supabase.from('subscription_payments').insert({
                        org_id:              orgSub.org_id,
                        subscription_id:     orgSub.id,
                        razorpay_payment_id: payment.id,
                        razorpay_order_id:   payment.order_id ?? null,
                        amount_paise:        payment.amount,
                        status:              'captured',
                        method:              payment.method ?? null,
                        captured_at:         new Date().toISOString(),
                    })

                    if (insertError) {
                        // Postgres unique_violation = 23505
                        // This happens when a concurrent duplicate webhook beat us to the insert
                        if (insertError.code === '23505') {
                            console.log(`[razorpay-webhook] Payment ${payment.id} already inserted by concurrent delivery — skipping refund`)
                        } else {
                            console.error('[razorpay-webhook] Failed to insert subscription_payments:', insertError)
                        }
                        // Either way: do not issue a duplicate referral refund
                        break
                    }

                    // Insert succeeded — now safe to issue referral refund
                    await issueReferralRefund(orgSub.org_id, payment.id, payment.amount)
                }
            }
            break
        }

        // ── Subscription terminal states ─────────────────────────────────────
        case 'subscription.halted':
        case 'subscription.cancelled':
        case 'subscription.completed':
        case 'subscription.expired': {
            const sub = event.payload?.subscription?.entity
            if (!sub?.id) break

            const statusMap: Record<string, string> = {
                'subscription.halted':    'halted',
                'subscription.cancelled': 'cancelled',
                'subscription.completed': 'completed',
                'subscription.expired':   'expired',
            }

            await supabase
                .from('org_subscriptions')
                .update({
                    status:     statusMap[event.event],
                    updated_at: new Date().toISOString(),
                })
                .eq('razorpay_subscription_id', sub.id)
            break
        }

        // ── Payment failed ────────────────────────────────────────────────────
        case 'payment.failed': {
            const payment = event.payload?.payment?.entity
            if (!payment?.id || !payment?.subscription_id) break

            // Idempotency check: skip if already logged
            const { data: existingFailed } = await supabase
                .from('subscription_payments')
                .select('id')
                .eq('razorpay_payment_id', payment.id)
                .maybeSingle()

            if (existingFailed) {
                console.log(`[razorpay-webhook] Failed payment ${payment.id} already recorded — skipping`)
                break
            }

            const { data: orgSub } = await supabase
                .from('org_subscriptions')
                .select('id, org_id')
                .eq('razorpay_subscription_id', payment.subscription_id)
                .single()

            if (orgSub) {
                const { error: failedInsertError } = await supabase.from('subscription_payments').insert({
                    org_id:              orgSub.org_id,
                    subscription_id:     orgSub.id,
                    razorpay_payment_id: payment.id,
                    amount_paise:        payment.amount,
                    status:              'failed',
                    method:              payment.method ?? null,
                })

                if (failedInsertError && failedInsertError.code === '23505') {
                    console.log(`[razorpay-webhook] Failed payment ${payment.id} inserted by concurrent delivery — ignoring`)
                } else if (failedInsertError) {
                    console.error('[razorpay-webhook] Failed to insert failed payment:', failedInsertError)
                }
            }
            break
        }

        default:
            console.log(`[razorpay-webhook] Unhandled event type: ${event.event} — acknowledged`)
    }

    // Always return 200 so Razorpay doesn't retry known-unhandled events
    return NextResponse.json({ received: true })
}
