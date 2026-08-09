import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSignInServerTimer } from '@/lib/sign-in-telemetry.server'

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    const supabase = await createClient()
    const formData = await request.formData()
    const traceId = formData.get('traceId')
    const telemetry = createSignInServerTimer('auth_logout', traceId)
    const claimsResult = await telemetry.measure(
        'claims_validation',
        () => supabase.auth.getClaims(),
    )

    let signOutFailed = false
    try {
        // Keep Supabase's default global scope for this sprint. The call is
        // independent of local cleanup and still clears the server-side
        // session/cookies before the 303 response.
        const signOutResult = await telemetry.measure(
            'supabase_signout',
            () => supabase.auth.signOut(),
        )
        signOutFailed = Boolean(signOutResult.error)
    } catch {
        signOutFailed = true
    }
    telemetry.log(signOutFailed ? 'signout_error' : 'success', {
        claims_valid: Boolean(claimsResult.data?.claims),
    })

    // A 303 converts the form POST into a fresh GET and avoids a client-side
    // React/Server Action transition after the session cookies are removed.
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
