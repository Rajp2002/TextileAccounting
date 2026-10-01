import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
    getClaims: vi.fn(),
    signOut: vi.fn(),
}))
const revocationMock = vi.hoisted(() => vi.fn(async () => false))
const rateLimitMock = vi.hoisted(() => vi.fn(async () => null as number | null))

vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => ({ auth: authMock })),
}))

vi.mock('@/lib/rate-limit', () => ({
    checkAuthRateLimit: rateLimitMock,
    getClientIpFromHeaders: vi.fn(() => '198.51.100.20'),
    isUserRevoked: revocationMock,
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
import { isRecentPwaLoginRedirect } from '@/lib/pwa-auth-recovery'

const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID ?? 'exampleprojectref'
const authCookieBase = `sb-${projectId}-auth-token`

function requestFor(
    pathname: string,
    method = 'GET',
    lastActivity = '1700000000000',
    extraCookies: string[] = [],
) {
    return new NextRequest(`https://textile-accounting.vercel.app${pathname}`, {
        method,
        headers: {
            cookie: [
                `${authCookieBase}.0=stale-part-zero`,
                `${authCookieBase}.1=stale-part-one`,
                `last_activity=${lastActivity}`,
                'unrelated_cookie=keep-me',
                ...extraCookies,
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
    revocationMock.mockClear()
    rateLimitMock.mockReset()
    rateLimitMock.mockResolvedValue(null)
})

describe('Proxy terminal Auth session recovery', () => {
    it('expires every auth chunk and redirects a protected request to login', async () => {
        authMock.getClaims.mockRejectedValue(Object.assign(
            new Error('Invalid Refresh Token: Refresh Token Not Found'),
            { code: 'refresh_token_not_found', status: 400 },
        ))

        const response = await updateSession(requestFor('/owner/estimator'))

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

    it('allows /owner/assignments directly for an owner before onboarding completion', async () => {
        const loginActivity = Date.now()
        authMock.getClaims.mockResolvedValue({
            data: {
                claims: {
                    sub: 'owner-user-id',
                    app_metadata: {
                        role: 'owner',
                        onboarding_complete: false,
                    },
                },
            },
            error: null,
        })

        const response = await updateSession(requestFor(
            '/owner/assignments',
            'GET',
            loginActivity.toString(),
        ))

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
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


describe('PWA idle-session cold start', () => {
    beforeEach(() => {
        authMock.getClaims.mockResolvedValue({
            data: { claims: { sub: 'owner-user-id', app_metadata: {
                role: 'owner', onboarding_complete: true,
            } } },
            error: null,
        })
    })

    it('renders login in one response and clears both browser and forwarded session cookies', async () => {
        const response = await updateSession(requestFor('/login'))

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
        expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'local' })
        expect(revocationMock).not.toHaveBeenCalled()
        for (const name of [`${authCookieBase}.0`, `${authCookieBase}.1`, 'last_activity', 'weavly_pwa_login_recovery']) {
            expect(response.cookies.get(name)?.maxAge).toBe(0)
            expect(response.headers.get('x-middleware-request-cookie')).not.toContain(name)
        }
        expect(response.headers.get('x-middleware-request-cookie')).toContain('unrelated_cookie=keep-me')
    })

    it('redirects an idle protected page with cookie deletions so login does not revalidate it', async () => {
        const response = await updateSession(requestFor('/owner/estimator'))
        expect(response.status).toBe(307)
        expect(response.cookies.get(`${authCookieBase}.0`)?.maxAge).toBe(0)
        expect(response.cookies.get(`${authCookieBase}.1`)?.maxAge).toBe(0)
        expect(revocationMock).not.toHaveBeenCalled()

        authMock.getClaims.mockClear()
        await updateSession(anonymousRequestFor('/login'))
        expect(authMock.getClaims).not.toHaveBeenCalled()
    })

    it('returns JSON and clears cookies for an idle protected API request', async () => {
        const response = await updateSession(requestFor('/api/private'))
        expect(response.status).toBe(401)
        expect(response.headers.get('location')).toBeNull()
        expect(await response.json()).toEqual({ error: 'Session expired. Please sign in again.' })
        expect(response.cookies.get(`${authCookieBase}.0`)?.maxAge).toBe(0)
    })

    it('still validates and checks revocation when reopening an active session', async () => {
        const response = await updateSession(requestFor('/login', 'GET', Date.now().toString()))
        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/owner/estimator')
        expect(authMock.getClaims).toHaveBeenCalledOnce()
        expect(revocationMock).toHaveBeenCalledWith('owner-user-id')
        expect(authMock.signOut).not.toHaveBeenCalled()
    })
})

describe('Free workspace launch hint', () => {
    const freeHint = 'weavly_workspace_hint=free.owner-user-id'
    const reopen = (pathname: string, cookies: string[] = [freeHint]) => updateSession(
        requestFor(pathname, 'GET', Date.now().toString(), cookies),
    )

    beforeEach(() => {
        authMock.getClaims.mockResolvedValue({
            data: { claims: { sub: 'owner-user-id', app_metadata: {
                role: 'owner', onboarding_complete: true,
            } } },
            error: null,
        })
    })

    it('sends a hinted owner launch straight to /free after the usual session checks', async () => {
        const response = await reopen('/login')

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/free')
        expect(authMock.getClaims).toHaveBeenCalledOnce()
        expect(revocationMock).toHaveBeenCalledWith('owner-user-id')
    })

    it('uses the hint for the signed-in landing page as well', async () => {
        const response = await reopen('/')

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/free')
    })

    it('points the stale-PWA login recovery link at /free', async () => {
        vi.mocked(isRecentPwaLoginRedirect).mockReturnValueOnce(true)

        const response = await reopen('/login')

        expect(response.status).toBe(200)
        expect(response.headers.get('x-middleware-request-x-weavly-pwa-login-recovery')).toBe('/free')
    })

    it('ignores a hint written for another account on the same browser', async () => {
        const response = await reopen('/login', ['weavly_workspace_hint=free.previous-user-id'])

        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/owner/estimator')
    })

    it('keeps the estimator home when no hint is present', async () => {
        const response = await reopen('/', [])

        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/owner/estimator')
    })

    it('never rewrites a protected owner route from the hint', async () => {
        const response = await reopen('/owner/estimator')

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
    })

    it('still sends an owner who has not finished onboarding to /onboarding', async () => {
        authMock.getClaims.mockResolvedValue({
            data: { claims: { sub: 'owner-user-id', app_metadata: {
                role: 'owner', onboarding_complete: false,
            } } },
            error: null,
        })

        const response = await reopen('/login')

        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/onboarding')
    })

    it('does not use the hint for other roles', async () => {
        authMock.getClaims.mockResolvedValue({
            data: { claims: { sub: 'owner-user-id', app_metadata: { role: 'admin' } } },
            error: null,
        })

        const response = await reopen('/login')

        expect(response.headers.get('location')).toBe('https://textile-accounting.vercel.app/admin')
    })
})
