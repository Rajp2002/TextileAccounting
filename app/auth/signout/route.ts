import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && origin !== request.nextUrl.origin) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    if (claimsData?.claims) {
        await supabase.auth.signOut()
    }

    // A 303 converts the form POST into a fresh GET and avoids a client-side
    // React/Server Action transition after the session cookies are removed.
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
