import { NextResponse } from 'next/server'

/**
 * GET /api/billing/checkout-script
 *
 * Reverse-proxy for Razorpay's checkout.js script.
 * Ad blockers (uBlock Origin, Brave Shields, etc.) block requests to
 * checkout.razorpay.com. By serving the script through our own domain,
 * the request looks like any other first-party asset and bypasses
 * filter lists.
 *
 * The script is cached in-memory for 1 hour and served with aggressive
 * browser caching headers to avoid redundant fetches.
 */

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

let cachedScript: { body: string; fetchedAt: number } | null = null

export async function GET() {
    try {
        const now = Date.now()

        // Return in-memory cache if fresh
        if (cachedScript && now - cachedScript.fetchedAt < CACHE_DURATION_MS) {
            return new NextResponse(cachedScript.body, {
                status: 200,
                headers: {
                    'Content-Type': 'application/javascript; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
                    'X-Proxy-Cache': 'HIT',
                },
            })
        }

        // Fetch fresh copy from Razorpay
        const upstream = await fetch(RAZORPAY_SCRIPT_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WeavlyProxy/1.0)',
                'Accept': 'application/javascript, text/javascript, */*',
            },
            // Next.js fetch cache: revalidate every hour server-side
            next: { revalidate: 3600 },
        })

        if (!upstream.ok) {
            console.error(
                `[checkout-script-proxy] Upstream fetch failed: ${upstream.status} ${upstream.statusText}`
            )
            return NextResponse.json(
                { error: 'Failed to fetch payment script' },
                { status: 502 }
            )
        }

        const scriptBody = await upstream.text()

        // Validate we actually got JavaScript (not an error page)
        if (
            !scriptBody ||
            scriptBody.length < 1000 ||
            scriptBody.includes('<!DOCTYPE') ||
            scriptBody.includes('<html')
        ) {
            console.error(
                '[checkout-script-proxy] Upstream returned non-JS response:',
                scriptBody.substring(0, 200)
            )
            return NextResponse.json(
                { error: 'Upstream returned invalid response' },
                { status: 502 }
            )
        }

        // Update in-memory cache
        cachedScript = { body: scriptBody, fetchedAt: now }

        return new NextResponse(scriptBody, {
            status: 200,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
                'X-Proxy-Cache': 'MISS',
            },
        })
    } catch (error) {
        console.error('[checkout-script-proxy] Error:', error)
        return NextResponse.json(
            { error: 'Internal proxy error' },
            { status: 500 }
        )
    }
}
