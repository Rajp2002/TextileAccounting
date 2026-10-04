'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { establishFounderSession, requireFounderCandidate } from '@/lib/admin/founder'
import { founderChallengeInput, founderMutationOriginAllowed, type FounderAuthState } from '@/lib/admin/auth-input'
import { safeFounderReturnPath } from '@/lib/admin/routes'
import { checkAuthRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'

export async function founderVerify(_previous: FounderAuthState, form: FormData): Promise<FounderAuthState> {
    const requestId = crypto.randomUUID()
    const requestHeaders = await headers()
    if (!founderMutationOriginAllowed(requestHeaders)) return { code: 'FORBIDDEN', message: 'This request could not be accepted. Refresh and try again.', requestId }
    if (await checkAuthRateLimit(`founder:${getClientIpFromHeaders(requestHeaders)}`) !== null) return { code: 'THROTTLED', message: 'Too many attempts. Wait a few minutes and try again.', requestId }
    const parsed = founderChallengeInput.safeParse({ factorId: form.get('factorId'), code: form.get('code') })
    if (!parsed.success) return { code: 'VALIDATION', message: 'Enter the six-digit authenticator code.', requestId }
    try {
        await requireFounderCandidate()
        const supabase = await createClient()
        const factors = await supabase.auth.mfa.listFactors()
        const approved = factors.data?.totp.some(factor => factor.id === parsed.data.factorId && factor.status === 'verified')
        if (factors.error || !approved) return { code: 'VERIFICATION_FAILED', message: 'Unable to verify access. Sign in again or use the approved recovery process.', requestId }
        const verified = await supabase.auth.mfa.challengeAndVerify(parsed.data)
        if (verified.error) return { code: 'VERIFICATION_FAILED', message: 'Unable to verify that code. Check your authenticator and try again.', requestId }
        // Refresh verified claims after MFA. No actor, assurance or provider
        // session identity from this form is accepted by the session guard.
        await establishFounderSession()
    } catch {
        return { code: 'VERIFICATION_FAILED', message: 'Unable to verify access. Sign out and sign in again, or use the approved recovery process.', requestId }
    }
    redirect(safeFounderReturnPath(form.get('returnTo')))
}
