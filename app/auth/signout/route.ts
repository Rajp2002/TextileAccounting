import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSignInServerTimer } from '@/lib/sign-in-telemetry.server'
import { WORKSPACE_HINT_COOKIE } from '@/lib/workspace-hint'
import { revokeFounderSessionsOf, verifyFounderRevocationActor, type FounderCandidate } from '@/lib/admin/founder'
import { isSupabaseAuthSessionCookie } from '@/lib/supabase/auth-cookie'

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    const fetchSite = request.headers.get('sec-fetch-site')
    if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== 'same-origin')) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    const supabase = await createClient()
    const formData = await request.formData()
    const traceId = formData.get('traceId')
    const telemetry = createSignInServerTimer('auth_logout', traceId)
    // Treat any Supabase session cookie as potential authentication. A project
    // hint mismatch must not turn a cookie-bearing failed logout into anonymous.
    const authCookies = request.cookies.getAll().filter(({ name }) => isSupabaseAuthSessionCookie(name, ''))
    let claimsValid = false
    try {
        const claimsResult = await telemetry.measure('claims_validation', () => supabase.auth.getClaims())
        claimsValid = Boolean(claimsResult.data?.claims)
    } catch { /* Continue trying both independent sign-out authorities. */ }

    // The founder revocation binds to a fresh Auth identity, which only the
    // live session can give, so that check finishes before sign-out ends it.
    // The revocation itself never reads the provider session, so it runs
    // alongside sign-out rather than before it.
    let founderActor: FounderCandidate | null | undefined
    try { founderActor = await telemetry.measure('founder_identity', () => verifyFounderRevocationActor(supabase)) }
    catch { /* Unavailable is never treated as proof of revocation. */ }
    const [founderRevocation, signOutFailed] = await Promise.all([
        founderActor === undefined
            ? 'unavailable' as const
            : revokeFounderSessionsOf(founderActor).catch(() => 'unavailable' as const),
        // Keep Supabase's default global scope for this sprint. The call is
        // independent of local cleanup and still clears the server-side
        // session/cookies before the 303 response.
        telemetry.measure('supabase_signout', () => supabase.auth.signOut())
            .then(signOutResult => Boolean(signOutResult.error), () => true),
    ])
    const confirmed = !signOutFailed || founderRevocation === 'revoked' || (authCookies.length === 0 && !claimsValid)
    telemetry.log(confirmed ? 'success' : 'signout_error', {
        claims_valid: claimsValid, founder_revocation: founderRevocation,
    })

    // Missing profile/claims or a no-op revoke is not evidence of termination.
    // A cookie-bearing session needs one confirmed authority before redirect.
    if (!confirmed) {
        return NextResponse.json({ code: 'SIGNOUT_UNAVAILABLE', message: 'Sign-out could not be confirmed. Please try again.', requestId: crypto.randomUUID() }, {
            status: 503, headers: { 'Cache-Control': 'private, no-store' },
        })
    }

    // A 303 converts the form POST into a fresh GET and avoids a client-side
    // React/Server Action transition after the session cookies are removed.
    const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
    // Do not carry inactivity state into the next session if Supabase cleanup
    // is unavailable or an older browser retained this app-owned cookie.
    response.cookies.delete('last_activity')
    response.cookies.delete(WORKSPACE_HINT_COOKIE)
    for (const { name } of authCookies) response.cookies.delete(name)
    response.headers.set('Cache-Control','private, no-store')
    return response
}
