import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
    getClaims: vi.fn(),
    signOut: vi.fn(),
}))
const rateLimitMock = vi.hoisted(() => vi.fn(async () => null as number | null))

vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => ({ auth: authMock })),
}))

vi.mock('@/lib/rate-limit', () => ({
    checkAuthRateLimit: rateLimitMock,
    getClientIpFromHeaders: vi.fn(() => '198.51.100.20'),
    isUserRevoked: vi.fn(async () => false),
}))

vi.mock('@/lib/phase1-scope', () => ({
    PHASE_1_ARCHIVE_REDIRECT: '/feature-archived',
    isPhase1ArchivedRoute: vi.fn(() => false),
}))

vi.mock('@/lib/pwa-auth-recovery', () => ({
    isRecentPwaLoginRedirect: vi.fn(() => false),
    PWA_LOGIN_RECOVERY_COOKIE: 'weavly_pwa_login_recovery',
    PWA_LOGIN_RECOVERY_HEADER: 'x-weavly-pwa-login-recovery',
    PWA_LOGIN_RECOVERY_WINDOW_MS: 10_000,
}))

vi.mock('@/lib/supabase/auth-cookie', () => ({
    isSupabaseAuthSessionCookie: (name: string) => /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(name),
    getTerminalAuthSessionErrorCode: (error: unknown) => {
        if (!error || typeof error !== 'object' || !('code' in error)) return null
        const code = error.code
        return typeof code === 'string' && [
            'refresh_token_not_found',
            'refresh_token_already_used',
            'session_not_found',
            'session_expired',
        ].includes(code) ? code : null
    },
}))

import { updateSession } from '../proxy'

const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID ?? 'exampleprojectref'
const authCookieBase = `sb-${projectId}-auth-token`

function requestFor(
    pathname: string,
    method = 'GET',
    lastActivity = '1700000000000',
) {
    return new NextRequest(`https://textile-accounting.vercel.app${pathname}`, {
        method,
        headers: {
            cookie: [
                `${authCookieBase}.0=stale-part-zero`,
                `${authCookieBase}.1=stale-part-one`,
                `last_activity=${lastActivity}`,
                'unrelated_cookie=keep-me',
            ].join('; '),
        },
    })
}

function anonymousRequestFor(pathname: string, method = 'GET') {
    return new NextRequest(`https://textile-accounting.vercel.app${pathname}`, {
        method,
    })
}

beforeEach(() => {
    authMock.getClaims.mockReset()
    authMock.signOut.mockReset()
    rateLimitMock.mockReset()
    rateLimitMock.mockResolvedValue(null)
})

describe('Proxy terminal Auth session recovery', () => {
    it('expires every auth chunk and redirects a protected request to login', async () => {
        authMock.getClaims.mockRejectedValue(Object.assign(
            new Error('Invalid Refresh Token: Refresh Token Not Found'),
            { code: 'refresh_token_not_found', status: 400 },
        ))

        const response = await updateSession(requestFor('/owner/today'))

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/login')
        expect(response.cookies.get(`${authCookieBase}.0`)?.value).toBe('')
        expect(response.cookies.get(`${authCookieBase}.1`)?.value).toBe('')
        expect(response.cookies.get('last_activity')?.value).toBe('')
        expect(response.cookies.get('unrelated_cookie')).toBeUndefined()
    })

    it('renders a clean login request when Auth returns a terminal session error', async () => {
        authMock.getClaims.mockResolvedValue({
            data: { claims: null },
            error: { code: 'session_not_found', status: 403, message: 'Session not found' },
        })

        const response = await updateSession(requestFor('/login'))
        const forwardedCookie = response.headers.get('x-middleware-request-cookie') ?? ''

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
        expect(forwardedCookie).not.toContain(authCookieBase)
        expect(forwardedCookie).toContain('unrelated_cookie=keep-me')
        expect(response.cookies.get(`${authCookieBase}.0`)?.value).toBe('')
        expect(response.cookies.get(`${authCookieBase}.1`)?.value).toBe('')
    })
})

describe('Proxy post-login session handling', () => {
    it('does not count auth page loads or prefetches as password attempts', async () => {
        await updateSession(anonymousRequestFor('/login'))

        expect(rateLimitMock).not.toHaveBeenCalled()

        await updateSession(anonymousRequestFor('/login', 'POST'))

        expect(rateLimitMock).toHaveBeenCalledOnce()
    })

    it('accepts the activity timestamp refreshed by a successful login', async () => {
        const loginActivity = Date.now()
        authMock.getClaims.mockResolvedValue({
            data: {
                claims: {
                    sub: 'owner-user-id',
                    app_metadata: {
                        role: 'owner',
                        onboarding_complete: true,
                    },
                },
            },
            error: null,
        })

        const response = await updateSession(requestFor(
            '/owner/estimator',
            'GET',
            loginActivity.toString(),
        ))

        expect(response.status).toBe(200)
        expect(authMock.signOut).not.toHaveBeenCalled()
        expect(Number(response.cookies.get('last_activity')?.value)).toBeGreaterThanOrEqual(loginActivity)
    })

    it('still expires a genuinely idle current session locally', async () => {
        authMock.getClaims.mockResolvedValue({
            data: {
                claims: {
                    sub: 'owner-user-id',
                    app_metadata: {
                        role: 'owner',
                        onboarding_complete: true,
                    },
                },
            },
            error: null,
        })

        const response = await updateSession(requestFor('/owner/estimator'))

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/login')
        expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'local' })
        expect(response.cookies.get('last_activity')?.value).toBe('')
    })
})
