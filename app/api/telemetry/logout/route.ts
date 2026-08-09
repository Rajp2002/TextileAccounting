import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { classifySignInClient, sanitizeTimingMs } from '@/lib/sign-in-trace'
import { isLogoutTraceId, type LogoutClientStage } from '@/lib/logout-trace'

const ALLOWED_STAGES = new Set<LogoutClientStage>([
    'logout_clicked',
    'cache_namespace_rotated',
    'signout_navigation_started',
    'login_painted',
    'login_primary_ready',
    'legacy_cleanup_completed',
])

export async function POST(request: Request) {
    let body: Record<string, unknown>
    try {
        body = await request.json() as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'Invalid telemetry payload.' }, { status: 400 })
    }

    const stage = body.stage
    if (
        !isLogoutTraceId(body.traceId) ||
        typeof stage !== 'string' ||
        !ALLOWED_STAGES.has(stage as LogoutClientStage)
    ) {
        return NextResponse.json({ error: 'Invalid telemetry payload.' }, { status: 400 })
    }

    const requestHeaders = await headers()
    const client = classifySignInClient(requestHeaders.get('user-agent') ?? '')

    console.info(JSON.stringify({
        level: 'info',
        event: 'logout_client_timing',
        trace_id: body.traceId,
        stage,
        platform: client.platform,
        browser: client.browser,
        tap_to_feedback_ms: sanitizeTimingMs(body.tapToFeedbackMs),
        tap_to_cache_namespace_rotated_ms: sanitizeTimingMs(body.tapToCacheNamespaceRotatedMs),
        tap_to_signout_navigation_started_ms: sanitizeTimingMs(body.tapToSignoutNavigationStartedMs),
        tap_to_login_painted_ms: sanitizeTimingMs(body.tapToLoginPaintedMs),
        tap_to_login_primary_ready_ms: sanitizeTimingMs(body.tapToLoginPrimaryReadyMs),
        tap_to_legacy_cleanup_completed_ms: sanitizeTimingMs(body.tapToLegacyCleanupCompletedMs),
        observed_ms: sanitizeTimingMs(body.observedMs),
        cleanup_succeeded: typeof body.cleanupSucceeded === 'boolean' ? body.cleanupSucceeded : null,
    }))

    return new NextResponse(null, { status: 204 })
}
