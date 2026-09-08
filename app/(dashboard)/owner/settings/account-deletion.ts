'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'
import { checkRateLimit, getDestructiveLimiter, getRateLimitRetrySeconds } from '@/lib/rate-limit'
import { getRazorpay } from '@/lib/razorpay'
import { ACCOUNT_DELETION_CONFIRMATION_PHRASE } from '@/lib/account-deletion'

const DeleteAccountInputSchema = z.object({
    organizationName: z.string().trim().min(1).max(200),
    confirmationPhrase: z.literal(ACCOUNT_DELETION_CONFIRMATION_PHRASE),
})

export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>
export type DeleteAccountResult = { success: true } | { error: string }

const cancellableSubscriptionStatuses = ['created', 'pending', 'authenticated', 'active', 'paused'] as const

function hasOpenBillingWindow(currentEnd: string | null | undefined, nowMs = Date.now()) {
    if (!currentEnd) return true

    const endMs = Date.parse(currentEnd)
    // An invalid non-null timestamp is treated as open so a malformed billing
    // row cannot accidentally bypass provider cancellation.
    return !Number.isFinite(endMs) || endMs > nowMs
}

/**
 * Permanently removes the authenticated owner's organization and every
 * associated account. The database RPC owns the destructive transaction; this
 * action only performs the required provider-side subscription cancellation
 * immediately before it.
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

    const { data: subscriptions, error: subscriptionError } = await admin
        .from('org_subscriptions')
        .select('razorpay_subscription_id, status, current_end')
        .eq('org_id', organization.id)
        .in('status', [...cancellableSubscriptionStatuses])
        .not('razorpay_subscription_id', 'is', null)

    if (subscriptionError) {
        console.error('Permanent account deletion subscription lookup failed', {
            code: subscriptionError.code,
        })
        return { error: 'Account billing could not be verified. Nothing was deleted.' }
    }

    const subscriptionIds = [...new Set(
        (subscriptions ?? [])
            .filter(subscription => hasOpenBillingWindow(subscription.current_end))
            .map(subscription => subscription.razorpay_subscription_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )]

    if (subscriptionIds.length > 0) {
        try {
            const razorpay = getRazorpay()
            for (const subscriptionId of subscriptionIds) {
                await razorpay.subscriptions.cancel(subscriptionId, false)
            }
        } catch (error) {
            console.error('Permanent account deletion subscription cancellation failed', {
                subscriptionCount: subscriptionIds.length,
                message: error instanceof Error ? error.message : 'unknown provider error',
            })
            return {
                error: 'The active subscription could not be cancelled, so no account data was deleted.',
            }
        }
    }

    const supabase = await createServerClient()
    const { error: deletionError } = await supabase.rpc('delete_account_permanently', {
        p_confirmation_name: parsed.data.organizationName,
        p_confirmation_phrase: ACCOUNT_DELETION_CONFIRMATION_PHRASE,
    })

    if (deletionError) {
        console.error('Permanent account deletion transaction failed', {
            code: deletionError.code,
            message: deletionError.message,
        })
        return {
            error: 'Account deletion could not be completed. No database rows were deleted; please try again.',
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
