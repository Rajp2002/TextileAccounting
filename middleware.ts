import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkAuthRateLimit } from '@/lib/rate-limit'

// ─── JWT Parse Utility ─────────────────────────────────────────────────────────

/**
 * Decodes a JWT payload without verification.
 * Safe to use here because Supabase middleware validates the token
 * cryptographically before we read it; we only consume the claims.
 */
function parseJWTClaims(token: string): Record<string, any> {
    try {
        const payload = token.split('.')[1]
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    } catch {
        return {}
    }
}

// ─── Route Classification ─────────────────────────────────────────────────────

/** Auth routes to rate-limit */
function isAuthRoute(pathname: string): boolean {
    return (
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/join') ||
        pathname.startsWith('/auth')
    )
}

/** Public routes — no session required */
function isPublicRoute(pathname: string): boolean {
    return (
        pathname === '/' ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/join') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/verify') ||
        pathname.startsWith('/privacy') ||
        pathname.startsWith('/terms') ||
        pathname.startsWith('/refund-policy')
    )
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: { headers: request.headers },
    })

    const { pathname } = request.nextUrl

    // ── IP-based rate limiting for auth routes ─────────────────────────────
    if (isAuthRoute(pathname)) {
        const ip =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            '127.0.0.1'

        const isSignup = pathname.startsWith('/signup') || pathname.startsWith('/join')
        const resetAt = await checkAuthRateLimit(ip, isSignup)

        if (resetAt !== null) {
            const retryAfterSecs = Math.ceil(Math.max(0, resetAt - Date.now()) / 1000)
            return new NextResponse('Too Many Requests', {
                status: 429,
                headers: {
                    'Content-Type': 'text/plain',
                    'Retry-After': String(retryAfterSecs),
                    'X-RateLimit-Reset': String(resetAt),
                },
            })
        }
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // ── Check Instant Session Revocation ──────────────────────────────────
    if (user) {
        const { isUserRevoked } = await import('@/lib/rate-limit')
        if (await isUserRevoked(user.id)) {
            await supabase.auth.signOut()
            response = NextResponse.redirect(new URL('/login', request.url))
            response.cookies.delete('last_activity')
            return response
        }
    }

    // ── Inactivity Timeout (1 hour) ───────────────────────────────────────
    const lastActivity = request.cookies.get('last_activity')?.value
    const now = Date.now()

    if (user && lastActivity) {
        const timeSinceLastActivity = now - parseInt(lastActivity, 10)
        if (timeSinceLastActivity > 3600000) {
            await supabase.auth.signOut()
            response = NextResponse.redirect(new URL('/login', request.url))
            response.cookies.delete('last_activity')
            return response
        }
    }

    if (user) {
        response.cookies.set('last_activity', now.toString(), {
            path: '/',
            maxAge: 3600,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
        })
    }

    // ── Route Guards ───────────────────────────────────────────────────────

    // 1. Authenticated user hitting public/auth pages → redirect to their home
    if (user && isPublicRoute(pathname) && pathname !== '/auth/callback') {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            const jwt = parseJWTClaims(session.access_token)
            const role = jwt.user_role
            const onboardingComplete = jwt.onboarding_complete

            if (role === 'owner') {
                // Owner hasn't completed onboarding → send to checklist
                if (!onboardingComplete) {
                    return NextResponse.redirect(new URL('/onboarding', request.url))
                }
                return NextResponse.redirect(new URL('/owner/analytics', request.url))
            } else if (role === 'supervisor') {
                return NextResponse.redirect(new URL('/supervisor/production', request.url))
            }
            // Role unknown → let them through to the public page (edge case)
        }
        return response
    }

    // 2. Unauthenticated user hitting protected route → /login
    if (!user && !isPublicRoute(pathname)) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // 3. Authenticated user on protected routes — enforce guards
    if (user && !isPublicRoute(pathname)) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        const jwt = parseJWTClaims(session.access_token)
        const role = jwt.user_role
        const onboardingComplete = jwt.onboarding_complete
        const orgId = jwt.org_id

        // Missing org_id in JWT = profile/org doesn't exist → back to login
        if (!orgId && !pathname.startsWith('/onboarding')) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // Onboarding guard: owners must complete setup before accessing ops routes
        if (
            role === 'owner' &&
            !onboardingComplete &&
            !pathname.startsWith('/onboarding') &&
            !pathname.startsWith('/owner/machines') &&
            !pathname.startsWith('/owner/inventory') &&
            !pathname.startsWith('/owner/workers') &&
            !pathname.startsWith('/owner/settings')
        ) {
            return NextResponse.redirect(new URL('/onboarding', request.url))
        }

        // If onboarding is complete and they navigate to /onboarding → push to dashboard
        if (role === 'owner' && onboardingComplete && pathname === '/onboarding') {
            return NextResponse.redirect(new URL('/owner/analytics', request.url))
        }

        // ── Strict role boundary enforcement ──────────────────────────────
        // Supervisor trying to access /owner/* routes
        if (role === 'supervisor' && pathname.startsWith('/owner')) {
            return NextResponse.redirect(new URL('/supervisor/production', request.url))
        }

        // Owner trying to access /supervisor/* routes
        if (role === 'owner' && pathname.startsWith('/supervisor')) {
            return NextResponse.redirect(new URL('/owner/analytics', request.url))
        }
    }

    return response
}

export async function middleware(request: NextRequest) {
    return await updateSession(request)
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mov|mp4|webm|ogg|mp3|wav|flac|webmanifest|ico)$).*)',
    ],
}
