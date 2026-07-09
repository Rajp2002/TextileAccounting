/**
 * Next.js Edge Middleware — session cookie refresh only.
 *
 * PURPOSE: This middleware runs at the edge (before the Node.js server) and
 * performs two lightweight tasks:
 *   1. Refreshes expiring Supabase session cookies so users don't get logged
 *      out mid-session due to token expiry.
 *   2. Redirects unauthenticated requests to /login for known protected prefixes,
 *      providing a fast first response without waiting for the full server render.
 *
 * IMPORTANT — WHAT THIS DOES NOT DO:
 *   - It does NOT enforce role-based authorization (owner vs supervisor vs admin).
 *   - It does NOT replace the requireRole() / getCachedSession() DB checks.
 *   - Role enforcement still happens server-side via requireRole() in layouts
 *     and server actions, which validates against the profiles DB row.
 *
 * This follows Supabase's recommended SSR pattern:
 * https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication — redirect to /login if no session found.
// Role-specific authorization (owner vs supervisor) is handled by server layouts.
const PROTECTED_PREFIXES = ['/owner', '/supervisor', '/admin']

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

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
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Do not add logic between createServerClient and getUser().
    // A simple mistake could make it very hard to debug issues with users being
    // randomly logged out.
    const { data: { user } } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // Redirect unauthenticated users away from protected routes.
    // Role-level authorization (e.g., owner-only vs supervisor) is handled
    // server-side by requireRole() — middleware only checks session presence.
    const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))
    if (!user && isProtected) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        // Preserve the intended destination for post-login redirect if needed
        return NextResponse.redirect(loginUrl)
    }

    // IMPORTANT: Return supabaseResponse (not NextResponse.next()) so the
    // refreshed session cookies are written back to the browser.
    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico, manifest.webmanifest, apple-icon, robots.txt
         * - /monitoring (Sentry tunnel — must be open)
         * - /api/* (API routes handle their own auth)
         * - /offline (PWA offline page — must be publicly accessible)
         * - Public marketing pages: /, /privacy, /terms, /refund-policy
         */
        '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|apple-icon\\.png|robots\\.txt|monitoring|api/|offline|privacy|terms|refund-policy).*)',
    ],
}
