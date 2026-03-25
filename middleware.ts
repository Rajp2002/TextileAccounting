import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

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
                    response = NextResponse.next({
                        request,
                    })
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

    // 1. Inactivity Timeout Check (1 hour = 3600000ms)
    // Read the last_activity cookie
    const lastActivity = request.cookies.get('last_activity')?.value
    const now = Date.now()

    if (user && lastActivity) {
        const timeSinceLastActivity = now - parseInt(lastActivity, 10)
        if (timeSinceLastActivity > 3600000) {
            // User has been inactive for > 1 hour. Log them out and clear session cookies.
            await supabase.auth.signOut()
            response = NextResponse.redirect(new URL('/login', request.url))
            // Ensure cookies are cleared correctly
            response.cookies.delete('last_activity')
            return response
        }
    }

    // 2. Refresh last_activity cookie if the user is authenticated
    if (user) {
        response.cookies.set('last_activity', now.toString(), {
            path: '/',
            maxAge: 3600, // 1 hour
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        })
    }

    // List of public routes that don't require authentication
    const isPublicRoute =
        request.nextUrl.pathname === '/' ||
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/signup') ||
        request.nextUrl.pathname.startsWith('/auth') ||   // Includes /auth/callback, /auth/confirm, /auth/verify
        request.nextUrl.pathname.startsWith('/verify') ||
        request.nextUrl.pathname.startsWith('/onboarding') ||
        request.nextUrl.pathname.startsWith('/privacy') ||
        request.nextUrl.pathname.startsWith('/terms') ||
        request.nextUrl.pathname.startsWith('/refund-policy')

    // 3. Authenticated user trying to access public auth routes -> redirect to dashboard
    if (user && isPublicRoute && request.nextUrl.pathname !== '/auth/callback') {
        const role = user.user_metadata?.role || user.app_metadata?.user_role
        if (role === 'owner') {
            return NextResponse.redirect(new URL('/owner/analytics', request.url))
        } else if (role === 'supervisor') {
            return NextResponse.redirect(new URL('/supervisor/production', request.url))
        } else if (role === 'worker') {
            // If workers eventually log in, redirect them appropriately. For now fallback to onboarding.
            return NextResponse.redirect(new URL('/onboarding', request.url))
        } else {
            return NextResponse.redirect(new URL('/onboarding', request.url))
        }
    }

    if (!user && !isPublicRoute) {
        // Redirect unauthenticated users to login
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
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mov|mp4|webm|ogg|mp3|wav|flac|webmanifest|ico)$).*)',
    ],
}
