import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ getClaims: vi.fn(), signOut: vi.fn() }))
const revoked = vi.hoisted(() => vi.fn())
const limiter = vi.hoisted(() => vi.fn())
const profile = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth, from: profile.from }) }))
vi.mock('@/lib/rate-limit', () => ({ checkAuthRateLimit: limiter, getClientIpFromHeaders: () => '192.0.2.1', isUserRevoked: revoked }))
vi.mock('@/lib/phase1-scope', () => ({ PHASE_1_ARCHIVE_REDIRECT: '/feature-archived', isPhase1ArchivedRoute: () => false }))

import { updateSession } from '../proxy'

const authCookieName = `sb-${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID ?? 'example'}-auth-token`
function request(path: string, { loggedIn = true, method = 'GET', idle = false } = {}) {
    return new NextRequest(`https://weavly.example${path}`, { method, headers: loggedIn ? { cookie: `${authCookieName}=synthetic; last_activity=${idle ? 1 : Date.now()}` } : {} })
}
beforeEach(() => {
    vi.resetAllMocks()
    limiter.mockResolvedValue(null)
    revoked.mockResolvedValue(false)
    auth.signOut.mockResolvedValue({ error: null })
    profile.from.mockReturnValue(profile)
    profile.select.mockReturnValue(profile)
    profile.eq.mockReturnValue(profile)
    profile.maybeSingle.mockResolvedValue({ data: null, error: null })
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'synthetic-founder', app_metadata: { role: 'owner', onboarding_complete: false, plan_selection_pending: true } } }, error: null })
})

describe('founder and requester Proxy routes', () => {
    it('anonymous exact admin login renders without an Auth lookup', async () => {
        expect((await updateSession(request('/admin/login', { loggedIn: false }))).status).toBe(200)
        expect(auth.getClaims).not.toHaveBeenCalled()
    })
    it.each(['/admin', '/admin/verify', '/admin/login/extra', '/admin/factories'])('anonymous protected route %s goes to founder login', async (path) => {
        const response = await updateSession(request(path, { loggedIn: false }))
        expect(response.status).toBe(307)
        const target = new URL(response.headers.get('location')!)
        expect(target.origin).toBe('https://weavly.example')
        expect(target.pathname).toBe('/admin/login')
        if (path === '/admin/factories') expect(target.searchParams.get('returnTo')).toBe(path)
    })
    it.each(['/api/admin/factories', '/api/support'])('anonymous %s returns structured JSON, never HTML', async (path) => {
        const response = await updateSession(request(path, { loggedIn: false }))
        expect(response.status).toBe(401)
        expect(response.headers.get('location')).toBeNull()
        expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED', message: 'Please sign in.' })
    })
    it.each(['/admin/login', '/admin/verify', '/admin/factories', '/support', '/support/123'])('stale role/plan hints do not intercept %s before its live guard', async (path) => {
        const response = await updateSession(request(path))
        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
        expect(revoked).toHaveBeenCalledWith('synthetic-founder')
    })
    it.each(['/admin/login', '/admin/verify'])('auth POST %s reaches its action with route throttling', async (path) => {
        const response = await updateSession(request(path, { loggedIn: false, method: 'POST' }))
        expect(response.status).toBe(200)
        expect(limiter).toHaveBeenCalledOnce()
        expect(auth.getClaims).not.toHaveBeenCalled()
    })
    it('does not let the customer inactivity cookie replace founder server session policy', async () => {
        expect((await updateSession(request('/admin', { idle: true }))).status).toBe(200)
        expect(auth.signOut).not.toHaveBeenCalled()
    })
    it('a revoked founder is denied JSON with expired auth cookies', async () => {
        revoked.mockResolvedValue(true)
        const response = await updateSession(request('/api/admin/overview'))
        expect(response.status).toBe(401)
        expect(response.cookies.get(authCookieName)?.maxAge).toBe(0)
    })
    it('retains existing customer onboarding routing', async () => {
        const response = await updateSession(request('/owner/settings'))
        expect(response.headers.get('location')).toBe('https://weavly.example/plans?from=onboarding')
    })
    it('normal customer login still routes an admin hint to the founder server guard', async () => {
        auth.getClaims.mockResolvedValueOnce({ data: { claims: { sub: 'synthetic-founder', app_metadata: { role: 'admin' } } }, error: null })
        expect((await updateSession(request('/login'))).headers.get('location')).toBe('https://weavly.example/admin')
    })
    it('normal login corrects a stale owner hint from the current own admin profile without requiring org', async () => {
        profile.maybeSingle.mockResolvedValueOnce({ data: { role: 'admin', access_revoked_at: null }, error: null })
        const response = await updateSession(request('/login'))
        expect(response.headers.get('location')).toBe('https://weavly.example/admin')
        expect(profile.select).toHaveBeenCalledWith('role, access_revoked_at')
        expect(profile.eq).toHaveBeenCalledWith('id', 'synthetic-founder')
    })
    it('current owner profile keeps the normal owner login destination', async () => {
        profile.maybeSingle.mockResolvedValueOnce({ data: { role: 'owner', access_revoked_at: null }, error: null })
        expect((await updateSession(request('/login'))).headers.get('location')).toBe('https://weavly.example/onboarding')
    })
    it('does not add a profile query to ordinary customer or dedicated console requests', async () => {
        await updateSession(request('/owner/settings'))
        await updateSession(request('/admin/login'))
        expect(profile.from).not.toHaveBeenCalled()
    })
    it('does not treat a revoked profile, email or source error as founder authorization', async () => {
        profile.maybeSingle.mockResolvedValueOnce({ data: { role: 'admin', access_revoked_at: '2026-10-04T00:00:00Z', email: 'founder@example.invalid' }, error: null })
        expect((await updateSession(request('/login'))).headers.get('location')).toBe('https://weavly.example/onboarding')
        profile.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } })
        expect((await updateSession(request('/login'))).headers.get('location')).toBe('https://weavly.example/onboarding')
    })
})
