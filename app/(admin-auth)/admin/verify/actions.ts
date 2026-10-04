'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { establishFounderSession, requireFounderCandidate } from '@/lib/admin/founder'
import { founderChallengeInput, founderMutationOriginAllowed, type FounderAuthState } from '@/lib/admin/auth-input'
import { safeFounderReturnPath } from '@/lib/admin/routes'
import { checkAuthRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { founderMfaEnrollmentEnabled } from '@/lib/admin/founder'
import { FOUNDER_FACTOR_NAME, founderMfaSetup, type FounderEnrollmentState } from '@/lib/admin/founder-mfa'
import { AdminError } from '@/lib/admin/errors'
import QRCode from 'qrcode'

export async function founderBeginEnrollment(restart = false): Promise<FounderEnrollmentState> {
    const requestId = crypto.randomUUID()
    const requestHeaders = await headers()
    if (!founderMutationOriginAllowed(requestHeaders)) return { code: 'FORBIDDEN', message: 'Refresh this page and try again.', requestId }
    if (await checkAuthRateLimit(`founder:${getClientIpFromHeaders(requestHeaders)}`) !== null) return { code: 'THROTTLED', message: 'Too many attempts. Wait a few minutes and try again.', requestId }
    if (!founderMfaEnrollmentEnabled()) return { code: 'UNAVAILABLE', message: 'Authenticator setup is awaiting approval. Access remains closed.', requestId }
    let candidate: Awaited<ReturnType<typeof requireFounderCandidate>> | undefined
    let intentId: string | undefined
    try {
        candidate = await requireFounderCandidate()
        if (candidate.aal !== 'aal1') return { code: 'EXISTING_FACTOR', message: 'Sign in again to verify your connected authenticator.', requestId }
        const supabase = await createClient()
        const factors = await supabase.auth.mfa.listFactors()
        if (factors.error || !factors.data) throw new Error('Factor source unavailable')
        if (factors.data.all.some(factor => factor.status === 'verified')) return { code: 'EXISTING_FACTOR', message: 'An authenticator is already connected. Reload to enter its code.', requestId }
        // Recover only metadata for this verified provider session. A stale
        // client cannot nominate or restart another session's intent.
        const previous = restart === true ? await founderMfaSetup(candidate, 'status') : undefined
        const intent = previous?.intentId
            ? await founderMfaSetup(candidate, 'restart', previous.intentId)
            : await founderMfaSetup(candidate, 'begin')
        intentId = intent.intentId
        if (!intentId) throw new Error('Setup intent unavailable')
        // No factor is removed here. Even an unverified snapshot can become
        // verified while a delayed provider request completes. Pending factors
        // from interrupted attempts stay for the approved recovery process.
        const latest = await supabase.auth.mfa.listFactors()
        if (latest.error || !latest.data || latest.data.all.some(factor => factor.status === 'verified')) throw new Error('Factor state changed')
        const current = await founderMfaSetup(candidate, 'status')
        if (current.intentId !== intentId) throw new Error('Setup intent changed')
        const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: FOUNDER_FACTOR_NAME, issuer: 'Weavly' })
        if (enrolled.error || !enrolled.data) throw new Error('Enrollment unavailable')
        const uri = new URL(enrolled.data.totp.uri)
        if (uri.protocol !== 'otpauth:' || uri.hostname !== 'totp' || enrolled.data.totp.uri.length > 2048) throw new Error('Invalid enrollment format')
        // Render our own PNG rather than inserting provider SVG markup. Return
        // no raw URI/secret and never log provider payloads or errors.
        const qrCode = await QRCode.toDataURL(enrolled.data.totp.uri, { width: 256, margin: 2, errorCorrectionLevel: 'M' })
        await founderMfaSetup(candidate, 'bind', intentId, enrolled.data.id)
        return { setup: { factorId: enrolled.data.id, intentId, qrCode }, requestId }
    } catch (error) {
        if (candidate && intentId) await founderMfaSetup(candidate, 'abandon', intentId).catch(() => undefined)
        return { code: error instanceof AdminError ? error.code : 'SETUP_FAILED', message: error instanceof AdminError && error.code === 'SETUP_IN_PROGRESS'
            ? 'Setup is already in progress. Use the open setup tab, or wait 30 seconds before restarting here.'
            : 'Authenticator setup could not be completed. Reload or restart setup to try again.', requestId }
    }
}

export async function founderVerify(_previous: FounderAuthState, form: FormData): Promise<FounderAuthState> {
    const requestId = crypto.randomUUID()
    const requestHeaders = await headers()
    if (!founderMutationOriginAllowed(requestHeaders)) return { code: 'FORBIDDEN', message: 'This request could not be accepted. Refresh and try again.', requestId }
    if (await checkAuthRateLimit(`founder:${getClientIpFromHeaders(requestHeaders)}`) !== null) return { code: 'THROTTLED', message: 'Too many attempts. Wait a few minutes and try again.', requestId }
    const parsed = founderChallengeInput.safeParse({ factorId: form.get('factorId'), code: form.get('code'), enrollmentIntentId: form.get('enrollmentIntentId') ?? undefined })
    if (!parsed.success) return { code: 'VALIDATION', message: 'Enter the six-digit authenticator code.', requestId }
    try {
        const candidate = await requireFounderCandidate()
        const supabase = await createClient()
        const factors = await supabase.auth.mfa.listFactors()
        let verificationId: string | undefined
        let approved = factors.data?.totp.some(factor => factor.id === parsed.data.factorId && factor.status === 'verified')
        if (!approved && parsed.data.enrollmentIntentId && founderMfaEnrollmentEnabled()
            && factors.data?.all.some(factor => factor.id === parsed.data.factorId && factor.factor_type === 'totp' && factor.status === 'unverified' && factor.friendly_name === FOUNDER_FACTOR_NAME)) {
            const lease = await founderMfaSetup(candidate, 'verify', parsed.data.enrollmentIntentId, parsed.data.factorId)
            if (!lease.verificationId) throw new Error('Verification lease unavailable')
            verificationId = lease.verificationId
            approved = true
        }
        if (factors.error || !approved) return { code: 'VERIFICATION_FAILED', message: 'Unable to verify access. Sign in again or use the approved recovery process.', requestId }
        const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code })
        if (verified.error) {
            if (parsed.data.enrollmentIntentId && ['mfa_verification_failed', 'mfa_verification_rejected'].includes(verified.error.code ?? '')) {
                // Only a definitive rejected code releases the lease. A lost
                // provider response keeps the lease until its bounded expiry.
                await founderMfaSetup(candidate, 'verify_failed', parsed.data.enrollmentIntentId, parsed.data.factorId, verificationId)
            }
            return { code: 'VERIFICATION_FAILED', message: 'Unable to verify that code. Check your authenticator and try again.', requestId }
        }
        // Refresh verified claims after MFA. No actor, assurance or provider
        // session identity from this form is accepted by the session guard.
        if (parsed.data.enrollmentIntentId) await founderMfaSetup(candidate, 'complete', parsed.data.enrollmentIntentId, parsed.data.factorId)
        await establishFounderSession()
    } catch {
        return { code: 'VERIFICATION_FAILED', message: 'Unable to verify access. Sign out and sign in again, or use the approved recovery process.', requestId }
    }
    redirect(safeFounderReturnPath(form.get('returnTo')))
}
