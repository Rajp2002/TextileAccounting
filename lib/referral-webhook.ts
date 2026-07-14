import * as Sentry from '@sentry/nextjs'
import { createIdempotentRazorpayRefund } from '@/lib/razorpay-refund-client'
import { createAdminClient } from '@/lib/supabase/admin'

type ReferralConversionResult = {
    converted: boolean
    alreadyProcessed?: boolean
}

type ReferralRefundClaim = {
    eligible: boolean
    claimed: boolean
    status?: string
    refundAmountPaise?: number
    discountPct?: number
    windowCount?: number
    idempotencyKey?: string
}

/** Convert a pending referral and create its discount window atomically. */
export async function processReferralConversion(refereeOrgId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('claim_referral_conversion', {
        p_referee_org_id: refereeOrgId,
    })

    if (error) {
        Sentry.captureException(error, {
            tags: { component: 'referral_webhook', phase: 'claim_conversion' },
        })
        throw error
    }

    return data as ReferralConversionResult | null
}

/**
 * Claim and issue one referral refund per captured payment.
 *
 * The database claim serializes concurrent webhook/callback deliveries. The
 * provider request uses Razorpay's X-Refund-Idempotency header, so a retry
 * after an unknown network outcome cannot create a second refund.
 */
export async function issueReferralRefund(orgId: string, paymentId: string, amountPaise: number) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('claim_referral_refund', {
        p_org_id: orgId,
        p_razorpay_payment_id: paymentId,
        p_original_amount_paise: amountPaise,
    })

    if (error) {
        Sentry.captureException(error, {
            tags: { component: 'referral_webhook', phase: 'claim_refund' },
        })
        throw error
    }

    const claim = data as ReferralRefundClaim | null
    if (!claim?.eligible || !claim.claimed) return claim
    if (
        !claim.idempotencyKey ||
        !claim.refundAmountPaise ||
        !claim.discountPct ||
        !claim.windowCount
    ) {
        throw new Error('Referral refund claim returned incomplete provider context.')
    }

    try {
        const refund = await createIdempotentRazorpayRefund({
            paymentId,
            amountPaise: claim.refundAmountPaise,
            idempotencyKey: claim.idempotencyKey,
            note: `Weavly referral discount: ${claim.discountPct}% (${claim.windowCount} referrals)`,
        })

        const { error: updateError } = await supabase
            .from('referral_refunds')
            .update({
                razorpay_refund_id: refund.id,
                status: 'issued',
                last_error: null,
                updated_at: new Date().toISOString(),
            })
            .eq('razorpay_payment_id', paymentId)
            .eq('idempotency_key', claim.idempotencyKey)

        if (updateError) throw updateError
        return { ...claim, status: 'issued', refundId: refund.id }
    } catch (refundError) {
        const message = refundError instanceof Error ? refundError.message.slice(0, 500) : 'Unknown refund error'
        const { error: updateError } = await supabase
            .from('referral_refunds')
            .update({
                status: 'failed',
                last_error: message,
                updated_at: new Date().toISOString(),
            })
            .eq('razorpay_payment_id', paymentId)
            .eq('idempotency_key', claim.idempotencyKey)

        Sentry.captureException(refundError, {
            tags: { component: 'referral_webhook', phase: 'razorpay_refund' },
            extra: { localStatusUpdateFailed: updateError?.message ?? null },
        })
        throw refundError
    }
}
