import 'server-only'
import { canEnrollFree, finishFreeProvisioning, getFreeGrant } from './free-account'
import { createAdminClient } from './supabase/admin'
import { getOrgPlanAccess } from './subscription'

const NOT_AVAILABLE = 'Your free trial is not available for this account.'
const FREE_SETUP_FAILED = 'Free setup could not finish. Please try again.'

/**
 * Starts the one-time Lite trial for a verified owner's organization. The caller
 * must run assertOrgWritable first, and orgId must come from the verified profile.
 * The Free grant is provisioned before the trial row because provision_free_account
 * refuses organizations that already have subscription rows.
 */
export async function startLiteTrialForOwner(
    user: { id: string; email?: string; email_confirmed_at?: string; app_metadata: Record<string, unknown> },
    orgId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const access = await getOrgPlanAccess(orgId)
    if (access.liteTrialEligible !== true) return { ok: false, error: NOT_AVAILABLE }

    // finishFreeProvisioning confirms an unverified email through the admin API,
    // so the verification gate must run here before it, as the Free path does.
    if (!user.email) return { ok: false, error: 'An email address is required to enroll in Free.' }
    if (!user.email_confirmed_at) return { ok: false, error: 'Please verify your email address before activating Free access.' }

    // Read the grant before provisioning: getFreeGrant is cache()-wrapped, so a read
    // after provisioning in the same request can return the earlier null. The
    // checks match the Free branch of completePlanSelection.
    const grant = await getFreeGrant(orgId)
    if (grant?.state === 'suspended') return { ok: false, error: 'Free access is not active for this account.' }
    if (grant?.state === 'pending') return { ok: false, error: 'Free access is pending verification.' }
    if (!grant && !await canEnrollFree(user.email)) {
        return { ok: false, error: 'Free enrollment is not available for this account yet.' }
    }

    try {
        const provisioned = await finishFreeProvisioning(user, orgId)
        if (!provisioned) return { ok: false, error: FREE_SETUP_FAILED }
    } catch {
        return { ok: false, error: FREE_SETUP_FAILED }
    }

    const { error } = await createAdminClient().rpc('start_lite_trial', { p_org_id: orgId })
    if (error) {
        if (error.message.includes('LITE_TRIAL_INELIGIBLE')) {
            // A double-clicked or concurrent request may have started the trial first.
            // The owner then has the trial they asked for, so this is success.
            const after = await getOrgPlanAccess(orgId)
            if (after.effectiveTier === 'lite') return { ok: true }
            return { ok: false, error: NOT_AVAILABLE }
        }
        return { ok: false, error: FREE_SETUP_FAILED }
    }
    return { ok: true }
}
