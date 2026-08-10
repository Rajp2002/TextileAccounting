import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'

type ReferralConversionResult = {
    converted: boolean
    eligible?: boolean
    alreadyProcessed?: boolean
    reason?: string
    availableCredits?: number
}

/**
 * Claim a referral credit after the canonical payment path has recorded a
 * paid initial Base Plan purchase for the referee. The database function is
 * idempotent and owns the five-credit cap and active-member checks.
 */
export async function processReferralConversion(refereeOrgId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('claim_referral_conversion', {
        p_referee_org_id: refereeOrgId,
    })

    if (error) {
        Sentry.captureException(error, {
            tags: { component: 'referral_webhook', phase: 'claim_conversion' },
            extra: { refereeOrgId },
        })
        throw error
    }

    return data as ReferralConversionResult | null
}
