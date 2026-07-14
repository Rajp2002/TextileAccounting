import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkAuthRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { PHASE_1_ARCHIVE_REDIRECT, isPhase1ArchivedRoute } from '@/lib/phase1-scope'
import type { User } from '@supabase/supabase-js'

function getRoleHomePath(role?: string): string {
    if (role === 'owner') return '/owner/today'
    if (role === 'supervisor') return '/supervisor/dashboard'
    if (role === 'admin') return '/admin'
    return '/login'
}

// ─── JWT Parse Utility ─────────────────────────────────────────────────────────

/**
 * Decodes a JWT payload without verification.
 * Safe to use here because Supabase middleware validates the token
 * cryptographically before we read it; we only consume the claims.
 * Uses `atob` for Node/Edge cross-compatibility (Buffer is missing on Edge).
 */
function parseJWTClaims(token: string): Record<string, unknown> {
    try {
        let payload = token.split('.')[1]
        // Convert base64url to standard base64
        payload = payload.replace(/-/g, '+').replace(/_/g, '/')
        // Decrypt base64
        const decoded = atob(payload)
        
        // Supabase custom claims are placed inside app_metadata.custom_claims 
        // or directly at the root depending on the Supabase version. We will attempt 
        // to grab them from everywhere safely.
        const parsed = JSON.parse(decoded) as Record<string, unknown>
        const appMetadata = parsed.app_metadata as { custom_claims?: Record<string, unknown> } | undefined
        const userMetadata = parsed.user_metadata as { role?: unknown; org_id?: unknown } | undefined
        const customClaims = appMetadata?.custom_claims || parsed
        
        return {
            ...parsed,
            ...customClaims,
            user_role: customClaims.user_role ?? userMetadata?.role,
            org_id: customClaims.org_id ?? userMetadata?.org_id,
            onboarding_complete: customClaims.onboarding_complete ?? false
        }
    } catch {
        return {}
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

function getClaimsFromUser(user: User): Record<string, unknown> {
    const appMetadata = asRecord(user.app_metadata)
    const userMetadata = asRecord(user.user_metadata)
    const customClaims = asRecord(appMetadata.custom_claims)
    const role = appMetadata.role ?? customClaims.user_role ?? userMetadata.role

    return {
        ...appMetadata,
        ...customClaims,
        user_role: role,
        org_id: appMetadata.org_id ?? customClaims.org_id ?? userMetadata.org_id,
        onboarding_complete: appMetadata.onboarding_complete ?? customClaims.onboarding_complete ?? false,
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

// ─── Middleware ────────────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: { headers: request.headers },
    })

    const { pathname } = request.nextUrl

    // ── 0. API Route Protection (CRITICAL FOR SAFARI) ──────────────────────────
    // API routes MUST return JSON, never HTML redirects.
    // We check this first to prevent any later redirects from sending HTML to fetch().
    if (pathname.startsWith('/api/') && !isPublicRoute(pathname)) {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return request.cookies.getAll() },
                    setAll() {},
                },
            }
        )
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
        }
    }

    // ── IP-based rate limiting for auth routes ─────────────────────────────
    if (isAuthRoute(pathname)) {
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

    // 1. Authenticated user hitting auth pages or landing → redirect to their home
    if (user && (isAuthRoute(pathname) || pathname === '/') && pathname !== '/auth/callback' && !isPasswordRecoveryRoute(pathname)) {
        const token = request.cookies.get('sb-' + process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID + '-auth-token')
        
        let jwt: Record<string, unknown> = {}
        if (token) {
             // Supabase stores cookies as JSON arrays, so parse and take the first item token
             try {
                 const parsedToken = JSON.parse(token.value);
                 if (Array.isArray(parsedToken) && parsedToken.length > 0) {
                     jwt = parseJWTClaims(parsedToken[0]);
                 }
             } catch {
                 // Ignore parsing errors, JWT will just be empty
             }
        }
        
        // If cookie parsing failed, rely on getting session from supabase
        if(Object.keys(jwt).length === 0){
             jwt = getClaimsFromUser(user)
        }
        
        const role = typeof jwt.user_role === 'string' ? jwt.user_role : undefined
        const onboardingComplete = jwt.onboarding_complete === true

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
        const token = request.cookies.get('sb-' + process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID + '-auth-token')
        
        let jwt: Record<string, unknown> = {}
        if (token) {
             try {
                 const parsedToken = JSON.parse(token.value);
                 if (Array.isArray(parsedToken) && parsedToken.length > 0) {
                     jwt = parseJWTClaims(parsedToken[0]);
                 }
             } catch {}
        }
        
        if(Object.keys(jwt).length === 0){
             jwt = getClaimsFromUser(user)
        }

        const role = typeof jwt.user_role === 'string' ? jwt.user_role : undefined
        const onboardingComplete = jwt.onboarding_complete === true
        const orgId = typeof jwt.org_id === 'string' ? jwt.org_id : undefined

        if (!pathname.startsWith('/api/') && isPhase1ArchivedRoute(pathname)) {
            return NextResponse.redirect(new URL(PHASE_1_ARCHIVE_REDIRECT, request.url))
        }

        if (pathname === '/owner') {
            return NextResponse.redirect(new URL('/owner/today', request.url))
        }

        let resolvedOrgId = orgId
        let resolvedOnboarding = onboardingComplete
        let isLockedDown = false

        if (!orgId && !pathname.startsWith('/onboarding') && role !== 'admin') {
            try {
                const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                if (serviceKey && supabaseUrl) {
                    const profileRes = await fetch(
                        `${supabaseUrl}/rest/v1/profiles?select=org_id&id=eq.${user!.id}&limit=1`,
                        {
                            headers: {
                                apikey: serviceKey,
                                Authorization: `Bearer ${serviceKey}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    )
                    if (profileRes.ok) {
                        const profile = (await profileRes.json())[0]
                        resolvedOrgId = profile?.org_id
                    }
                }
            } catch {}
        }

        if (resolvedOrgId && role !== 'admin' && !pathname.startsWith('/api/')) {
            try {
                const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                if (serviceKey && supabaseUrl) {
                    const orgRes = await fetch(
                        `${supabaseUrl}/rest/v1/organizations?select=onboarding_complete,is_locked_down&id=eq.${resolvedOrgId}&limit=1`,
                        {
                            headers: {
                                apikey: serviceKey,
                                Authorization: `Bearer ${serviceKey}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    )
                    if (orgRes.ok) {
                        const org = (await orgRes.json())[0]
                        if (org) {
                            resolvedOnboarding = org.onboarding_complete
                            isLockedDown = org.is_locked_down
                        }
                    }
                }
            } catch {}
        }

        // 4. Lockdown guard: redirect locked tenants to /locked
        if (isLockedDown && !pathname.startsWith('/locked') && !pathname.startsWith('/api/')) {
            return NextResponse.redirect(new URL('/locked', request.url))
        }

        // If org_id is still absent after DB fallback, the session is genuinely broken
        if (!resolvedOrgId && !pathname.startsWith('/onboarding') && role !== 'admin') {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Session incomplete. Please sign in again.' }, { status: 403 })
            }
            await supabase.auth.signOut()
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.searchParams.set('reason', 'session_incomplete')
            const signOutRedirect = NextResponse.redirect(url)
            response.cookies.getAll().forEach((cookie) =>
                signOutRedirect.cookies.set(cookie.name, cookie.value, { path: '/' })
            )
            return signOutRedirect
        }

        if (
            role === 'owner' &&
            !resolvedOnboarding &&
            !pathname.startsWith('/api/') &&
            !pathname.startsWith('/onboarding') &&
            !pathname.startsWith('/owner/billing') &&
            !pathname.startsWith('/owner/estimator') &&
            !pathname.startsWith('/owner/quotes') &&
            !pathname.startsWith('/owner/machines') &&
            !pathname.startsWith('/owner/workers') &&
            !pathname.startsWith('/owner/settings')
        ) {
            return NextResponse.redirect(new URL('/onboarding', request.url))
        }

        if (role === 'owner' && resolvedOnboarding && pathname === '/onboarding') {
            return NextResponse.redirect(new URL('/owner/today', request.url))
        }

        if (pathname.startsWith('/admin')) {
            if (role !== 'admin') {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()
                
                if (profile?.role !== 'admin') {
                    return NextResponse.redirect(new URL(getRoleHomePath(profile?.role ?? role), request.url))
                }
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
