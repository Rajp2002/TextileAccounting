import { readFileSync } from 'node:fs'
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
function request(path: string, { loggedIn = true, method = 'GET' } = {}) {
    return new NextRequest(`https://weavly.example${path}`, { method, headers: loggedIn ? { cookie: `${authCookieName}=synthetic; last_activity=${Date.now()}` } : {} })
}
const supervisorClaims = { sub: 'sup-1', user_role: 'supervisor', full_name: 'Ramesh' }
const ownerClaims = { sub: 'own-1', user_role: 'owner', org_id: 'org-1', onboarding_complete: true }
function signedInAs(claims: Record<string, unknown>) {
    auth.getClaims.mockResolvedValue({ data: { claims }, error: null })
}
const location = (response: Response) => response.headers.get('location')

beforeEach(() => {
    vi.resetAllMocks()
    limiter.mockResolvedValue(null)
    revoked.mockResolvedValue(false)
    auth.signOut.mockResolvedValue({ error: null })
    profile.from.mockReturnValue(profile)
    profile.select.mockReturnValue(profile)
    profile.eq.mockReturnValue(profile)
    profile.maybeSingle.mockResolvedValue({ data: null, error: null })
})

describe('supervisor routing', () => {
    it('sends a signed-in supervisor from the landing page to the supervisor home', async () => {
        signedInAs(supervisorClaims)
        expect(location(await updateSession(request('/')))).toBe('https://weavly.example/supervisor')
    })

    it.each(['/owner/estimator', '/owner/production/daily-sheet', '/free', '/onboarding', '/plans'])('keeps a supervisor out of %s', async (path) => {
        signedInAs(supervisorClaims)
        expect(location(await updateSession(request(path)))).toBe('https://weavly.example/supervisor')
    })

    it.each(['/supervisor', '/supervisor/daily-sheet'])('lets a supervisor open %s', async (path) => {
        signedInAs(supervisorClaims)
        const response = await updateSession(request(path))
        expect(response.status).toBe(200)
        expect(location(response)).toBeNull()
    })

    it('sends an owner away from the supervisor pages', async () => {
        signedInAs(ownerClaims)
        expect(location(await updateSession(request('/supervisor/daily-sheet')))).toBe('https://weavly.example/owner/estimator')
    })

    it('lets the server guard decide when a token has no role yet', async () => {
        signedInAs({ sub: 'new-1' })
        expect((await updateSession(request('/supervisor'))).status).toBe(200)
    })
})

describe('the join page', () => {
    it('is public', async () => {
        const response = await updateSession(request('/join', { loggedIn: false }))
        expect(response.status).toBe(200)
        expect(location(response)).toBeNull()
    })

    it('throttles join posts with the signup limit', async () => {
        await updateSession(request('/join', { loggedIn: false, method: 'POST' }))
        expect(limiter).toHaveBeenCalledWith('192.0.2.1', true)
    })

    it('sends signed-in people home', async () => {
        signedInAs(supervisorClaims)
        expect(location(await updateSession(request('/join')))).toBe('https://weavly.example/supervisor')
        signedInAs(ownerClaims)
        expect(location(await updateSession(request('/join')))).toBe('https://weavly.example/owner/estimator')
    })
})

describe('login with a supervisor token', () => {
    it('routes an active supervisor home', async () => {
        signedInAs(supervisorClaims)
        profile.maybeSingle.mockResolvedValue({ data: { role: 'supervisor', access_revoked_at: null }, error: null })
        expect(location(await updateSession(request('/login')))).toBe('https://weavly.example/supervisor')
    })

    it('shows the login page to a removed supervisor whose token is still live', async () => {
        signedInAs(supervisorClaims)
        profile.maybeSingle.mockResolvedValue({ data: { role: 'supervisor', access_revoked_at: '2026-10-07T00:00:00Z' }, error: null })
        const response = await updateSession(request('/login'))
        expect(response.status).toBe(200)
        expect(location(response)).toBeNull()
    })

    it('shows the login page to a declined supervisor whose profile is gone', async () => {
        signedInAs(supervisorClaims)
        const response = await updateSession(request('/login'))
        expect(response.status).toBe(200)
        expect(location(response)).toBeNull()
    })
})

describe('every post-auth destination knows the supervisor home', () => {
    it.each([
        'lib/auth.ts',
        'app/(auth)/actions/auth.ts',
        'app/auth/callback/route.ts',
        'app/auth/confirm/page.tsx',
        'app/(auth)/onboarding/page.tsx',
        'app/(auth)/onboarding/base/page.tsx',
        'proxy.ts',
    ])('%s no longer sends supervisors to the archive', (file) => {
        const source = readFileSync(file, 'utf8')
        expect(source).not.toMatch(/supervisor['"]\)?[^\n]*\n?[^\n]*feature-archived/)
        expect(source).toContain('SUPERVISOR_HOME_PATH')
    })

    it('signIn refuses a revoked profile instead of routing it home', () => {
        const source = readFileSync('app/(auth)/actions/auth.ts', 'utf8')
        expect(source).toContain('access_revoked_at')
        expect(source).toContain('This account no longer has access. Ask the factory owner.')
    })
})
