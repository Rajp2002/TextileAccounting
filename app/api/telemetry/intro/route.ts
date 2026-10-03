import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { parseIntroReport } from '@/lib/intro/intro-telemetry'
import { checkPublicPostRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { classifySignInClient } from '@/lib/sign-in-trace'

/** Why an installed-app intro ended (lib/intro/intro-telemetry.ts). Sent signed out, by beacon. */
export async function POST(request: Request) {
    const requestHeaders = await headers()
    if (await checkPublicPostRateLimit(getClientIpFromHeaders(requestHeaders), 'intro-telemetry') !== null) {
        return new NextResponse(null, { status: 429 })
    }

    const report = parseIntroReport(await request.text())
    if (!report) return NextResponse.json({ error: 'Invalid telemetry payload.' }, { status: 400 })

    const client = classifySignInClient(requestHeaders.get('user-agent') ?? '')
    console.info(JSON.stringify({
        level: 'info',
        event: 'intro_client_timing',
        platform: client.platform,
        browser: client.browser,
        ...report,
    }))
    return new NextResponse(null, { status: 204 })
}
