import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import {
    classifySignInClient,
    isSignInTraceId,
    normalizeSignInDestination,
    sanitizeTimingMs,
    SIGN_IN_TRACE_COOKIE,
    type SignInClientStage,
} from '@/lib/sign-in-trace'

const ALLOWED_STAGES = new Set<SignInClientStage>([
    'route_painted',
    'dashboard_ready',
    'readiness_timeout',
])

export async function POST(request: Request) {
    let body: Record<string, unknown>
    try {
        body = await request.json() as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'Invalid telemetry payload.' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const cookieTraceId = cookieStore.get(SIGN_IN_TRACE_COOKIE)?.value
    const stage = body.stage
    const route = normalizeSignInDestination(body.route)

    if (
        !isSignInTraceId(body.traceId) ||
        body.traceId !== cookieTraceId ||
        typeof stage !== 'string' ||
        !ALLOWED_STAGES.has(stage as SignInClientStage) ||
        route === '/other'
    ) {
        return NextResponse.json({ error: 'Invalid telemetry payload.' }, { status: 400 })
    }

    const requestHeaders = await headers()
    const client = classifySignInClient(requestHeaders.get('user-agent') ?? '')

    console.info(JSON.stringify({
        level: 'info',
        event: 'sign_in_client_timing',
        trace_id: body.traceId,
        stage,
        route,
        platform: client.platform,
        browser: client.browser,
        total_ms: sanitizeTimingMs(body.totalMs),
        auth_round_trip_ms: sanitizeTimingMs(body.authRoundTripMs),
        cleanup_wait_ms: sanitizeTimingMs(body.cleanupWaitMs),
        transition_hold_ms: sanitizeTimingMs(body.transitionHoldMs),
        route_paint_ms: sanitizeTimingMs(body.routePaintMs),
        dashboard_ready_ms: sanitizeTimingMs(body.dashboardReadyMs),
        post_route_data_ms: sanitizeTimingMs(body.postRouteDataMs),
    }))

    const response = new NextResponse(null, { status: 204 })
    if (stage !== 'route_painted') response.cookies.delete(SIGN_IN_TRACE_COOKIE)
    return response
}
