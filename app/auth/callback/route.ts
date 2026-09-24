import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJWT } from '@/lib/auth'

/**
 * Validates that a `next` redirect target is a safe internal path.
 *
 * Rules (prevent open redirect):
 *  - must start with "/"
 *  - must NOT start with "//" (protocol-relative external URL)
 *  - must NOT contain "://" (absolute URL smuggled as a path)
 */
function isSafeNext(next: string): boolean {
    if (!next.startsWith('/')) return false
    if (next.startsWith('//')) return false
    if (next.includes('://')) return false
    return true
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const rawNext = searchParams.get('next') ?? '/'
    const type = searchParams.get('type')

    // Validate next before using it — prevent open redirect attacks
    if (!isSafeNext(rawNext)) {
        return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`)
    }

    const next = rawNext

    if (code) {
        const supabase = await createClient()
        const { error, data } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('Auth Code Exchange Error:', error.message)
            // Redirect to forgot-password with error flag so the user can request a fresh link.
            // Do not expose the raw error — just signal that the link was invalid/expired.
            return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`)
        }

        if (data.session) {
            // Recovery flow detection — three signals, any one is sufficient:
            // 1. `type=recovery` in the callback URL (passed by our redirectTo)
            // 2. `next=/reset-password` in the callback URL (passed by our redirectTo)
            // 3. AMR claim in the JWT contains method=recovery (reliable even when
            //    redirectTo was overridden by Supabase and next/type are absent)
            const jwt = parseJWT(data.session.access_token)
            const isRecoverySession =
                type === 'recovery' ||
                next === '/reset-password' ||
                next.startsWith('/reset-password') ||
                (Array.isArray(jwt.amr) && jwt.amr.some((a: { method: string }) => a.method === 'recovery'))

            if (isRecoverySession) {
                return NextResponse.redirect(`${origin}/reset-password`)
            }

            // Standard post-auth flow: role-based redirect (jwt already parsed above)
            const role = jwt.user_role
            const onboardingComplete = jwt.onboarding_complete

            if (role === 'owner') {
                if (!onboardingComplete) return NextResponse.redirect(`${origin}/onboarding`)
                return NextResponse.redirect(`${origin}/owner/estimator`)
            } else if (role === 'supervisor') {
                return NextResponse.redirect(`${origin}/feature-archived`)
            }

            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // No code or session — redirect to forgot-password so user can request a fresh link
    return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`)
}
