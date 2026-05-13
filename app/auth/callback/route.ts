import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJWT } from '@/lib/auth'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { error, data } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('Auth Code Exchange Error:', error)
            return NextResponse.redirect(`${origin}/auth/auth-code-error`)
        }

        if (data.session) {
            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'
            const base = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin)

            const jwt = parseJWT(data.session.access_token)
            const role = jwt.user_role
            const onboardingComplete = jwt.onboarding_complete

            if (role === 'owner') {
                if (!onboardingComplete) return NextResponse.redirect(`${base}/onboarding`)
                return NextResponse.redirect(`${base}/owner/today`)
            } else if (role === 'supervisor') {
                return NextResponse.redirect(`${base}/supervisor/production`)
            }

            return NextResponse.redirect(`${base}${next}`)
        }
    }

    // No code or exchange failed
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
