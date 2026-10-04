'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { founderConsoleEnabled, requireFounderCandidate } from '@/lib/admin/founder'
import { founderPasswordInput, founderMutationOriginAllowed, type FounderAuthState } from '@/lib/admin/auth-input'
import { safeFounderReturnPath } from '@/lib/admin/routes'
import { founderEmailAllowed } from '@/lib/admin/founder-email'
import { checkAuthRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'

export async function founderSignIn(_previous: FounderAuthState, form: FormData): Promise<FounderAuthState> {
    const requestId = crypto.randomUUID()
    const requestHeaders = await headers()
    if (!founderMutationOriginAllowed(requestHeaders)) return { code: 'FORBIDDEN', message: 'This request could not be accepted. Refresh and try again.', requestId }
    // An action can be invoked by ID from another route. Its own limiter is
    // independent from Proxy's routing limiter and always protects Auth calls.
    if (await checkAuthRateLimit(`founder:${getClientIpFromHeaders(requestHeaders)}`) !== null) return { code: 'THROTTLED', message: 'Too many attempts. Wait a few minutes and try again.', requestId }
    if (!founderConsoleEnabled()) return { code: 'UNAVAILABLE', message: 'Founder access is awaiting approved setup.', requestId }
    const parsed = founderPasswordInput.safeParse({ email: form.get('email'), password: form.get('password') })
    if (!parsed.success) return { code: 'VALIDATION', message: 'Enter a valid email address and password.', requestId }
    if (!founderEmailAllowed(parsed.data.email)) return { code: 'WRONG_EMAIL', message: 'Wrong email. Use the approved founder email to continue.', requestId }
    let supabase: Awaited<ReturnType<typeof createClient>> | undefined
    try {
        supabase = await createClient()
        const result = await supabase.auth.signInWithPassword({ ...parsed.data, email: parsed.data.email.toLowerCase() })
        if (result.error) return { code: 'SIGN_IN_FAILED', message: 'Unable to sign in with these details. Check them and try again.', requestId }
        // Password success grants no console data. UUID grant and live identity
        // are checked before the candidate sees any challenge metadata.
        await requireFounderCandidate()
    } catch {
        if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
        return { code: 'SIGN_IN_FAILED', message: 'Unable to sign in with these details. Check them and try again.', requestId }
    }
    const returnTo = safeFounderReturnPath(form.get('returnTo'))
    redirect(`/admin/verify?returnTo=${encodeURIComponent(returnTo)}`)
}
