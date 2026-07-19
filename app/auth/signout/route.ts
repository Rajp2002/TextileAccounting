import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAuthSessionCookieNames } from '@/lib/supabase/auth-cookie'

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    try {
        const supabase = await createClient()
        const { data: claimsData } = await supabase.auth.getClaims()
        if (claimsData?.claims) {
            await supabase.auth.signOut()
        }
    } catch {
        // Cookie expiry below is the authoritative local logout. A stale or
        // malformed remote session must not prevent the browser from leaving it.
    }

    // A 303 converts the form POST into a fresh GET and avoids a client-side
    // React/Server Action transition after the session cookies are removed.
    const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
    getSupabaseAuthSessionCookieNames(request.cookies.getAll())
        .forEach((name) => response.cookies.delete(name))
    response.cookies.delete('last_activity')
    return response
}
