import { NextResponse, type NextRequest } from 'next/server'
import { signIn } from '@/app/(auth)/actions/auth'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * Password sign-in for the login form. A Route Handler rather than a Server
 * Action: an action that sets cookies makes Next re-render the whole login
 * page into its response, which the browser throws away when it navigates to
 * the workspace, and an action ID can go stale across a deploy. Proxy throttles
 * this request like every auth POST and lets it through without a session
 * lookup; `signIn` does all validation and sets the session cookies.
 */
export async function POST(request: NextRequest) {
    // Same-origin only, as for log out: another site must not be able to sign
    // this browser in to an account of its choosing.
    const origin = request.headers.get('origin')
    const fetchSite = request.headers.get('sec-fetch-site')
    if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== 'same-origin')) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers: NO_STORE })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        body = null
    }
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
    const result = await signIn({
        email: typeof input.email === 'string' ? input.email : '',
        password: typeof input.password === 'string' ? input.password : '',
        traceId: typeof input.traceId === 'string' ? input.traceId : undefined,
    })
    return NextResponse.json(result, { headers: NO_STORE })
}
