import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Consume one earned referral credit as the next free annual Base period. */
export async function POST() {
    try {
        const { profile } = await requireRole(['owner'])
        if (!profile.org_id) {
            return NextResponse.json({ error: 'Organization not found.' }, { status: 400 })
        }

        const admin = createAdminClient()
        const { data, error } = await admin.rpc('redeem_referral_year_credit', {
            p_org_id: profile.org_id,
        })

        if (error) {
            Sentry.captureException(error, {
                tags: { route: 'billing_redeem_referral_year', phase: 'redeem_credit' },
                extra: { orgId: profile.org_id },
            })
            return NextResponse.json({ error: 'The referral reward could not be redeemed. Please try again.' }, { status: 500 })
        }

        const result = data as {
            redeemed?: boolean
            reason?: string
            message?: string
            renewalEligibleAt?: string | null
            activeUntil?: string | null
            remainingCredits?: number
        } | null

        if (!result?.redeemed) {
            return NextResponse.json({
                error: result?.message ?? 'The referral reward is not available for redemption yet.',
                reason: result?.reason,
                renewalEligibleAt: result?.renewalEligibleAt,
            }, { status: 409 })
        }

        return NextResponse.json({
            success: true,
            activeUntil: result.activeUntil ?? null,
            remainingCredits: result.remainingCredits ?? 0,
        })
    } catch (error) {
        Sentry.captureException(error, { tags: { route: 'billing_redeem_referral_year' } })
        return NextResponse.json({ error: 'Owner access required.' }, { status: 403 })
    }
}
