import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkAuthRateLimit } from '@/lib/rate-limit'

// ─── Auth routes that should be rate-limited ──────────────────────────────────
function isAuthRoute(pathname: string): boolean {
    return (
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/auth')
    )
}

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: { headers: request.headers },
    })

    // ── IP-based rate limiting for auth routes ─────────────────────────────
    // Prevents brute-force login and signup spam.
    // Gracefully skips if UPSTASH_REDIS_REST_URL is not configured.
    if (isAuthRoute(request.nextUrl.pathname)) {
        const ip =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            '127.0.0.1'

        const resetAt = await checkAuthRateLimit(ip)

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
                    cookiesToSet.forEach(({ name, value, options }) =>
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

    // ── Check Instant Session Revocation (Phase 3) ────────────────────────
    if (user) {
        const { isUserRevoked } = await import('@/lib/rate-limit')
        if (await isUserRevoked(user.id)) {
            await supabase.auth.signOut()
            response = NextResponse.redirect(new URL('/login', request.url))
            response.cookies.delete('last_activity')
            return response
        }
    }

    // ── Inactivity Timeout Check (1 hour = 3600000ms) ─────────────────────
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

    // ── Refresh last_activity cookie on every request for authenticated users ──
    if (user) {
        response.cookies.set('last_activity', now.toString(), {
            path: '/',
            maxAge: 3600,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,  // Prevent JS from reading/overwriting to bypass inactivity timeout
        })
    }

    // ── Route Guards ──────────────────────────────────────────────────────
    const isPublicRoute =
        request.nextUrl.pathname === '/' ||
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/signup') ||
        request.nextUrl.pathname.startsWith('/auth') ||
        request.nextUrl.pathname.startsWith('/verify') ||
        request.nextUrl.pathname.startsWith('/onboarding') ||
        request.nextUrl.pathname.startsWith('/privacy') ||
        request.nextUrl.pathname.startsWith('/terms') ||
        request.nextUrl.pathname.startsWith('/refund-policy')

    if (user && isPublicRoute && request.nextUrl.pathname !== '/auth/callback') {
        const role = user.user_metadata?.role || user.app_metadata?.user_role
        if (role === 'owner') {
            return NextResponse.redirect(new URL('/owner/analytics', request.url))
        } else if (role === 'supervisor') {
            return NextResponse.redirect(new URL('/supervisor/production', request.url))
        } else {
            return NextResponse.redirect(new URL('/onboarding', request.url))
        }
    }

    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
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
