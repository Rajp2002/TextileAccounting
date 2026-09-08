import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkAuthRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { PHASE_1_ARCHIVE_REDIRECT, isPhase1ArchivedRoute } from '@/lib/phase1-scope'
import {
    isRecentPwaLoginRedirect,
    PWA_LOGIN_RECOVERY_COOKIE,
    PWA_LOGIN_RECOVERY_HEADER,
    PWA_LOGIN_RECOVERY_WINDOW_MS,
} from '@/lib/pwa-auth-recovery'
import {
    getTerminalAuthSessionErrorCode,
    isSupabaseAuthSessionCookie,
} from '@/lib/supabase/auth-cookie'

function getRoleHomePath(role?: string): string {
    if (role === 'owner') return '/owner/today'
    if (role === 'supervisor') return '/supervisor/dashboard'
    if (role === 'admin') return '/admin'
    return '/login'
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

/**
 * Claims are used only for optimistic routing decisions. The authoritative
 * role, tenant, entitlement, and lockdown checks remain in the server data
 * layer, Server Actions, Route Handlers, and RLS policies.
 */
function normalizeOptimisticClaims(value: unknown): Record<string, unknown> {
    const claims = asRecord(value)
    const appMetadata = asRecord(claims.app_metadata)
    const customClaims = asRecord(appMetadata.custom_claims)

    return {
        ...claims,
        ...customClaims,
        user_role: customClaims.user_role ?? appMetadata.role ?? claims.user_role,
        org_id: appMetadata.org_id ?? customClaims.org_id ?? claims.org_id,
        onboarding_complete: appMetadata.onboarding_complete
            ?? customClaims.onboarding_complete
            ?? claims.onboarding_complete
            ?? false,
    }
}

// ─── Route Classification ─────────────────────────────────────────────────────

/** Auth routes to rate-limit */
function isAuthRoute(pathname: string): boolean {
    return (
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/join') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/auth')
    )
}

/** Password recovery routes must remain reachable during a temporary recovery session */
function isPasswordRecoveryRoute(pathname: string): boolean {
    return (
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/reset-password')
    )
}

/** Public routes — no session required */
function isPublicRoute(pathname: string): boolean {
    return (
        pathname === '/' ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/join') ||
        isPasswordRecoveryRoute(pathname) ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/verify') ||
        pathname.startsWith('/privacy') ||
        pathname.startsWith('/terms') ||
        pathname.startsWith('/refund-policy') ||
        pathname.startsWith('/offline') ||
        pathname.startsWith('/_offline') ||
        pathname.startsWith('/track/') ||
        // Webhooks authenticate via HMAC signature inside the route — no cookie auth needed
        pathname.startsWith('/api/webhooks/')
    )
}

function logProxyPhase(phase: string, pathname: string, startedAt: number) {
    if (process.env.WEAVLY_PERF_LOGS !== 'true') return
    const configuredRate = Number(process.env.WEAVLY_PERF_SAMPLE_RATE ?? '0.1')
    const sampleRate = Number.isFinite(configuredRate)
        ? Math.min(1, Math.max(0, configuredRate))
        : 0.1
    if (Math.random() > sampleRate) return
    console.info('[weavly-perf]', {
        surface: 'proxy',
        phase,
        route: pathname,
        duration_ms: Math.round((performance.now() - startedAt) * 10) / 10,
        region: process.env.VERCEL_REGION ?? 'unknown',
    })
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest) {
    const forwardedHeaders = new Headers(request.headers)
    // These internal request markers are written only by Proxy. Never trust
    // values supplied by the browser.
    forwardedHeaders.delete('x-weavly-revocation-checked')
    forwardedHeaders.delete(PWA_LOGIN_RECOVERY_HEADER)
    const applySessionCookies: Array<(target: NextResponse) => void> = []
    let response = NextResponse.next({
        request: { headers: forwardedHeaders },
    })

    const { pathname } = request.nextUrl
    const authSessionCookieNames = request.cookies
        .getAll()
        .filter(({ name }) => isSupabaseAuthSessionCookie(name))
        .map(({ name }) => name)
    const hasAuthSessionCookie = authSessionCookieNames.length > 0
    const isSignOutRequest = request.method === 'POST' && pathname === '/auth/signout'

    // ── IP-based rate limiting for auth mutations ──────────────────────────
    // GET/HEAD requests include page loads and Next.js prefetches. Counting
    // those as password attempts lets a routing loop lock the login page with
    // a 429, which hides the real session error and amplifies the flicker.
    if (request.method === 'POST' && isAuthRoute(pathname) && !isSignOutRequest) {
        const ip = getClientIpFromHeaders(request.headers)

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

    // Auth mutations manage their own cookie lifecycle. Let them run directly
    // instead of validating or redirecting the session before their handlers run.
    const isLoginActionRequest = request.method === 'POST' && pathname === '/login'
    if (isLoginActionRequest || isSignOutRequest) {
        return response
    }

    // A browser without a Supabase session cookie cannot be authenticated. Avoid
    // an Auth lookup for the login page/server action and for anonymous public
    // traffic. Cookies that are present still flow through getClaims() so they
    // are cryptographically validated before any protected render.
    if (!hasAuthSessionCookie) {
        if (!isPublicRoute(pathname)) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        return response
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
                    applySessionCookies.push(...cookiesToSet.map(({ name, value, options }) => (target: NextResponse) => {
                        target.cookies.set(name, value, options)
                    }))
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    forwardedHeaders.set('cookie', request.cookies.toString())
                    response = NextResponse.next({ request: { headers: forwardedHeaders } })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const recoverTerminalAuthSession = (code: string) => {
        authSessionCookieNames.forEach(name => request.cookies.delete(name))
        request.cookies.delete('last_activity')
        request.cookies.delete(PWA_LOGIN_RECOVERY_COOKIE)
        forwardedHeaders.set('cookie', request.cookies.toString())

        const target = pathname.startsWith('/api/') && !isPublicRoute(pathname)
            ? NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 })
            : isPublicRoute(pathname)
                ? NextResponse.next({ request: { headers: forwardedHeaders } })
                : NextResponse.redirect(new URL('/login', request.url))

        const expireCookie = (name: string) => target.cookies.set(name, '', {
            path: '/',
            expires: new Date(0),
            maxAge: 0,
        })

        authSessionCookieNames.forEach(expireCookie)
        expireCookie('last_activity')
        expireCookie(PWA_LOGIN_RECOVERY_COOKIE)

        console.warn(JSON.stringify({
            level: 'warning',
            event: 'terminal_auth_session_recovered',
            code,
            route: pathname,
        }))

        return target
    }

    // Supabase verifies asymmetric JWTs locally with the cached JWKS when the
    // project uses asymmetric signing keys. For projects that still use
    // symmetric signing, getClaims() deliberately falls back to Auth network
    // validation; keep this behavior until the deployed signing mode is
    // measured rather than assuming a latency win.
    const claimsStartedAt = performance.now()
    let claimsResult: Awaited<ReturnType<typeof supabase.auth.getClaims>>
    try {
        claimsResult = await supabase.auth.getClaims()
    } catch (error) {
        const terminalCode = getTerminalAuthSessionErrorCode(error)
        if (terminalCode) return recoverTerminalAuthSession(terminalCode)
        throw error
    }
    logProxyPhase('claims', pathname, claimsStartedAt)
    // Compatibility note for the previous auth contract: the old
    // `await supabase.auth.getUser()` lookup is intentionally replaced here by
    // getClaims(), while symmetric-signing projects may still perform the
    // equivalent Auth network validation internally.
    const claims = claimsResult.data?.claims
    const claimsError = claimsResult.error
    const terminalClaimsCode = getTerminalAuthSessionErrorCode(claimsError)
    if (terminalClaimsCode) return recoverTerminalAuthSession(terminalClaimsCode)
    const optimisticClaims = normalizeOptimisticClaims(claims)
    const userId = typeof optimisticClaims.sub === 'string' ? optimisticClaims.sub : null
    const user = claimsError || !userId ? null : { id: userId }

    // API routes must return JSON, never an HTML login redirect. Keep this check
    // immediately after the single validated user lookup.
    if (pathname.startsWith('/api/') && !isPublicRoute(pathname) && !user) {
        return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    // ── Check Instant Session Revocation ──────────────────────────────────
    if (userId) {
        const { isUserRevoked } = await import('@/lib/rate-limit')
        const revocationStartedAt = performance.now()
        const userIsRevoked = await isUserRevoked(userId)
        logProxyPhase('revocation', pathname, revocationStartedAt)
        if (userIsRevoked) {
            await supabase.auth.signOut()
            response = NextResponse.redirect(new URL('/login', request.url))
            response.cookies.delete('last_activity')
            return response
        }
        // The cached server auth helper skips its normal-request fallback
        // check only when this marker was set by this Proxy invocation.
        forwardedHeaders.set('x-weavly-revocation-checked', '1')
        forwardedHeaders.set('cookie', request.cookies.toString())
        response = NextResponse.next({ request: { headers: forwardedHeaders } })
        applySessionCookies.forEach(applyCookie => applyCookie(response))
    }

    // ── Inactivity Timeout (1 hour) ───────────────────────────────────────
    const lastActivity = request.cookies.get('last_activity')?.value
    const now = Date.now()

    if (userId && lastActivity) {
        const lastActivityAt = Number(lastActivity)
        const timeSinceLastActivity = now - lastActivityAt

        if (
            Number.isFinite(timeSinceLastActivity)
            && timeSinceLastActivity > 3600000
        ) {
            console.warn(JSON.stringify({
                level: 'warning',
                event: 'auth_session_inactivity_expired',
                route: pathname,
                idle_ms: timeSinceLastActivity,
            }))
            await supabase.auth.signOut({ scope: 'local' })
            response = NextResponse.redirect(new URL('/login', request.url))
            response.cookies.delete('last_activity')
            return response
        }
    }

    if (userId) {
        response.cookies.set('last_activity', now.toString(), {
            path: '/',
            // Keep the timestamp longer than the inactivity window. If this
            // cookie expired at one hour, an idle authenticated session would
            // arrive without a timestamp and be silently treated as active.
            maxAge: 7 * 24 * 60 * 60,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
        })
    }

    // ── Route Guards ───────────────────────────────────────────────────────

    const role = typeof optimisticClaims.user_role === 'string' ? optimisticClaims.user_role : undefined
    const onboardingComplete = optimisticClaims.onboarding_complete === true
    const roleDestination = role === 'owner' && !onboardingComplete
        ? '/onboarding'
        : getRoleHomePath(role)

    const applyAuthenticatedResponseCookies = (target: NextResponse) => {
        applySessionCookies.forEach(applyCookie => applyCookie(target))
        target.cookies.set('last_activity', now.toString(), {
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
        })
    }

    // A stale installed PWA can repeatedly request /login from an obsolete
    // client-side auth guard while the current server redirects it home. On
    // the second request, render the current login boundary once instead of
    // continuing the 307 loop. That boundary shows a visible recovery action
    // and leaves the login form usable without another automatic navigation.
    if (user && pathname === '/login' && roleDestination !== '/login') {
        const previousRedirect = request.cookies.get(PWA_LOGIN_RECOVERY_COOKIE)?.value

        if (isRecentPwaLoginRedirect(previousRedirect, now)) {
            forwardedHeaders.set(PWA_LOGIN_RECOVERY_HEADER, roleDestination)
            forwardedHeaders.set('cookie', request.cookies.toString())
            const recoveryResponse = NextResponse.next({ request: { headers: forwardedHeaders } })
            applyAuthenticatedResponseCookies(recoveryResponse)
            return recoveryResponse
        }

        const redirectResponse = NextResponse.redirect(new URL(roleDestination, request.url))
        applyAuthenticatedResponseCookies(redirectResponse)
        redirectResponse.cookies.set(PWA_LOGIN_RECOVERY_COOKIE, now.toString(), {
            path: '/',
            maxAge: Math.ceil(PWA_LOGIN_RECOVERY_WINDOW_MS / 1000),
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
        })
        return redirectResponse
    }

    // 1. Authenticated user hitting auth pages or landing → redirect to their home
    if (user && (isAuthRoute(pathname) || pathname === '/') && pathname !== '/auth/callback' && !isPasswordRecoveryRoute(pathname)) {
        if (role === 'owner') {
            if (!onboardingComplete) {
                return NextResponse.redirect(new URL('/onboarding', request.url))
            }
            return NextResponse.redirect(new URL('/owner/today', request.url))
        } else if (role === 'supervisor') {
            return NextResponse.redirect(new URL('/supervisor/dashboard', request.url))
        } else if (role === 'admin') {
            return NextResponse.redirect(new URL('/admin', request.url))
        }
        
        return response
    }

    // 2. Unauthenticated user hitting protected route → /login (JSON 401 for API routes)
    if (!user && !isPublicRoute(pathname)) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // 3. Authenticated user on protected routes — enforce guards
    if (user && !isPublicRoute(pathname)) {
        if (!pathname.startsWith('/api/') && isPhase1ArchivedRoute(pathname)) {
            return NextResponse.redirect(new URL(PHASE_1_ARCHIVE_REDIRECT, request.url))
        }

        if (pathname === '/owner') {
            return NextResponse.redirect(new URL('/owner/today', request.url))
        }

        if (
            role === 'owner' &&
            !onboardingComplete &&
            !pathname.startsWith('/api/') &&
            !pathname.startsWith('/onboarding') &&
            !pathname.startsWith('/owner/billing') &&
            !pathname.startsWith('/owner/estimator') &&
            !pathname.startsWith('/owner/quotes') &&
            !pathname.startsWith('/owner/rates') &&
            !pathname.startsWith('/owner/production') &&
            !pathname.startsWith('/owner/stock') &&
            !pathname.startsWith('/owner/operations') &&
            !pathname.startsWith('/owner/payroll') &&
            !pathname.startsWith('/owner/machines') &&
            !pathname.startsWith('/owner/workers') &&
            !pathname.startsWith('/owner/settings')
        ) {
            return NextResponse.redirect(new URL('/onboarding', request.url))
        }

        if (role === 'owner' && onboardingComplete && pathname === '/onboarding') {
            return NextResponse.redirect(new URL('/owner/today', request.url))
        }

        if (pathname.startsWith('/admin')) {
            if (role !== 'admin') {
                // The Admin layout performs the authoritative profile-role
                // check. Proxy only provides an optimistic redirect hint.
                return NextResponse.redirect(new URL(getRoleHomePath(role), request.url))
            }
        }

        // 2. Owner restricted routes (Admins can access for support/audit)
        if (pathname.startsWith('/owner') && role === 'supervisor') {
            return NextResponse.redirect(new URL(getRoleHomePath(role), request.url))
        }

        const ownerSupervisorRouteAllowed = pathname === '/supervisor/dashboard'

        // 3. Supervisor restricted routes (Admins can access for support/audit)
        if (pathname.startsWith('/supervisor') && role === 'owner' && !ownerSupervisorRouteAllowed) {
            return NextResponse.redirect(new URL(getRoleHomePath(role), request.url))
        }
    }

    return response
}

export async function proxy(request: NextRequest) {
    return await updateSession(request)
}

export const config = {
    matcher: [
        '/((?!monitoring|_next/static|_next/image|favicon.ico|sw\\.js|sw\\.js\\.map|workbox-.*\\.js|workbox-.*\\.js\\.map|worker-.*\\.js|worker-.*\\.js\\.map|fallback-.*\\.js|fallback-.*\\.js\\.map|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mov|mp4|webm|ogg|mp3|wav|flac|webmanifest|ico)$).*)',
    ],
}
