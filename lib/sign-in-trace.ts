export const SIGN_IN_TRACE_COOKIE = 'weavly_signin_trace'
export const SIGN_IN_TRACE_STORAGE_KEY = 'weavly:signin-trace'

export type SignInClientStage = 'route_painted' | 'dashboard_ready' | 'readiness_timeout'

const SIGN_IN_DESTINATIONS = new Set([
    '/owner/estimator',
    '/free',
    '/owner/billing',
    '/onboarding',
    '/feature-archived',
    '/admin',
])

export function isSignInTraceId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9-]{20,64}$/i.test(value)
}

export function normalizeSignInDestination(value: unknown): string {
    if (typeof value !== 'string') return '/other'

    const pathname = value.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
    return SIGN_IN_DESTINATIONS.has(pathname) ? pathname : '/other'
}

export function sanitizeTimingMs(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
    return Math.round(Math.min(value, 120_000))
}

export function classifySignInClient(userAgent: string): {
    platform: 'ios' | 'android' | 'desktop' | 'other'
    browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'other'
} {
    const isIos = /iPhone|iPad|iPod/i.test(userAgent)
    const isAndroid = /Android/i.test(userAgent)
    const isEdge = /Edg(?:e|A|iOS)?\//i.test(userAgent)
    const isFirefox = /Firefox|FxiOS/i.test(userAgent)
    const isChrome = /Chrome|CriOS/i.test(userAgent) && !isEdge
    const isSafari = /Safari/i.test(userAgent) && !isChrome && !isEdge && !isFirefox

    return {
        platform: isIos ? 'ios' : isAndroid ? 'android' : /Windows|Macintosh|Linux/i.test(userAgent) ? 'desktop' : 'other',
        browser: isSafari ? 'safari' : isChrome ? 'chrome' : isFirefox ? 'firefox' : isEdge ? 'edge' : 'other',
    }
}
