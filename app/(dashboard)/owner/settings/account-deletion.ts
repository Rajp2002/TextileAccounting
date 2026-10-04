'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'
import { checkRateLimit, getDestructiveLimiter, getRateLimitRetrySeconds } from '@/lib/rate-limit'
import { ACCOUNT_DELETION_CONFIRMATION_PHRASE } from '@/lib/account-deletion'
import { checkOwnAccountDeletion, ACCOUNT_DELETION_REVIEW_MESSAGE, ACCOUNT_DELETION_UNAVAILABLE_MESSAGE } from '@/lib/support/data-rights'

const DeleteAccountInputSchema = z.object({
    organizationName: z.string().trim().min(1).max(200),
    confirmationPhrase: z.literal(ACCOUNT_DELETION_CONFIRMATION_PHRASE),
})

export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>
export type DeleteAccountResult = { success: true } | { error: string }

/**
 * The database RPC owns the owner-bound deletion transaction and rechecks
 * retained evidence under locks. Legacy provider references require review;
 * account deletion never changes payments or provider subscriptions.
 */
export async function deleteAccountPermanently(input: DeleteAccountInput): Promise<DeleteAccountResult> {
    const { profile, user } = await requireRole(['owner'], { allowFreeAccount: true })

    const rateLimit = await checkRateLimit(getDestructiveLimiter, `delete-account:${user.id}`)
    if (!rateLimit.success) {
        return {
            error: `Too many deletion attempts. Try again in ${getRateLimitRetrySeconds(rateLimit.reset)} seconds.`,
        }
    }

    const parsed = DeleteAccountInputSchema.safeParse(input)
    if (!parsed.success) {
        return { error: 'Type the exact organization name and DELETE MY ACCOUNT to continue.' }
    }

    const admin = createAdminClient()
    const { data: organization, error: organizationError } = await admin
        .from('organizations')
        .select('id, name, owner_id')
        .eq('id', profile.org_id)
        .eq('owner_id', user.id)
        .maybeSingle()

    if (organizationError || !organization) {
        console.error('Permanent account deletion organization check failed', {
            code: organizationError?.code,
        })
        return { error: 'Account deletion could not be verified. Please try again.' }
    }

    if (organization.name.trim() !== parsed.data.organizationName) {
        return { error: 'The organization name does not match. Nothing was deleted.' }
    }

    try {
        if (!(await checkOwnAccountDeletion()).allowed) return { error: ACCOUNT_DELETION_REVIEW_MESSAGE }
    } catch {
        return { error: ACCOUNT_DELETION_UNAVAILABLE_MESSAGE }
    }

    const { data: subscriptions, error: subscriptionError } = await admin
        .from('org_subscriptions')
        .select('id')
        .eq('org_id', organization.id)
        .not('razorpay_subscription_id', 'is', null)
        .limit(1)

    if (subscriptionError) {
        console.error('Permanent account deletion subscription lookup failed', {
            code: subscriptionError.code,
        })
        return { error: 'Account billing could not be verified. Nothing was deleted.' }
    }

    if ((subscriptions ?? []).length > 0) return { error: ACCOUNT_DELETION_REVIEW_MESSAGE }

    const supabase = await createServerClient()
    const { error: deletionError } = await supabase.rpc('delete_account_permanently', {
        p_confirmation_name: parsed.data.organizationName,
        p_confirmation_phrase: ACCOUNT_DELETION_CONFIRMATION_PHRASE,
    })

    if (deletionError) {
        console.error('Permanent account deletion transaction failed', {
            code: deletionError.code,
        })
        return {
            error: deletionError.code === '55000' && deletionError.message === 'ACCOUNT_DELETION_REVIEW_REQUIRED' ? ACCOUNT_DELETION_REVIEW_MESSAGE
                : 'Account deletion could not be completed. No database rows were deleted; please try again.',
        }
    }

    // The Auth identity was hard-deleted inside the RPC. This call is best
    // effort and may already be rejected by Supabase because the user is gone.
    try {
        await supabase.auth.signOut()
    } catch {
        // The client performs a full local/session cleanup before redirecting.
    }

    revalidatePath('/owner/settings')
    return { success: true }
}
