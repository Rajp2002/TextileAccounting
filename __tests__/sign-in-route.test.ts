import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    signIn: vi.fn(),
    getClaims: vi.fn(),
    limiter: vi.fn(),
    revoked: vi.fn(),
}))
vi.mock('@/app/(auth)/actions/auth', () => ({ signIn: mocks.signIn }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getClaims: mocks.getClaims } }) }))
vi.mock('@/lib/rate-limit', () => ({ checkAuthRateLimit: mocks.limiter, getClientIpFromHeaders: () => '192.0.2.1', isUserRevoked: mocks.revoked }))

import { POST } from '@/app/auth/signin/route'
import { updateSession } from '../proxy'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const authCookieName = `sb-${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID ?? 'example'}-auth-token`

function request(body: string, { origin = 'https://weavly.example' as string | null, fetchSite = 'same-origin' as string | null, cookie = '' } = {}) {
    return new NextRequest('https://weavly.example/auth/signin', {
        method: 'POST',
        body,
        headers: {
            'content-type': 'application/json',
            ...(origin ? { origin } : {}),
            ...(fetchSite ? { 'sec-fetch-site': fetchSite } : {}),
            ...(cookie ? { cookie } : {}),
        },
    })
}

const credentials = JSON.stringify({ email: 'owner@example.test', password: 'synthetic-only', traceId: '89b0ec11-6db8-4b64-8695-b538c59c49c1' })

beforeEach(() => {
    vi.resetAllMocks()
    mocks.signIn.mockResolvedValue({ redirectTo: '/owner/estimator' })
    mocks.limiter.mockResolvedValue(null)
    mocks.revoked.mockResolvedValue(false)
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: 'synthetic-owner', app_metadata: { role: 'owner', onboarding_complete: true } } }, error: null })
})

describe('sign-in route', () => {
    it('signs in with the posted credentials and returns only the destination, uncached', async () => {
        const response = await POST(request(credentials))
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ redirectTo: '/owner/estimator' })
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(mocks.signIn).toHaveBeenCalledWith({
            email: 'owner@example.test', password: 'synthetic-only', traceId: '89b0ec11-6db8-4b64-8695-b538c59c49c1',
        })
    })

    it('returns sign-in errors as they are', async () => {
        mocks.signIn.mockResolvedValue({ error: 'Incorrect email or password.' })
        const response = await POST(request(credentials))
        expect(await response.json()).toEqual({ error: 'Incorrect email or password.' })
    })

    it.each([
        ['no Origin', { origin: null }],
        ['another origin', { origin: 'https://unrelated.example' }],
        ['a cross-site fetch hint', { fetchSite: 'cross-site' }],
    ])('rejects %s before any sign-in work', async (_label, options) => {
        const response = await POST(request(credentials, options))
        expect(response.status).toBe(403)
        expect(mocks.signIn).not.toHaveBeenCalled()
    })

    it.each(['not json', '[]', 'null', JSON.stringify({ email: 1, password: ['x'] })])('passes malformed input %s to validation as empty fields', async (body) => {
        mocks.signIn.mockResolvedValue({ error: 'Invalid email address' })
        expect(await (await POST(request(body))).json()).toEqual({ error: 'Invalid email address' })
        expect(mocks.signIn).toHaveBeenCalledWith({ email: '', password: '', traceId: undefined })
    })
})

describe('Proxy for the sign-in request', () => {
    it('throttles it like every auth post and lets it through without an Auth lookup', async () => {
        const response = await updateSession(request(credentials))
        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
        expect(mocks.limiter).toHaveBeenCalledWith('192.0.2.1', false)
        expect(mocks.getClaims).not.toHaveBeenCalled()
    })

    it('never redirects a browser that still has a session, so switching accounts works', async () => {
        const response = await updateSession(request(credentials, { cookie: `${authCookieName}=synthetic; last_activity=${Date.now()}` }))
        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
        expect(mocks.getClaims).not.toHaveBeenCalled()
    })

    it('answers 429 once the auth limit is spent', async () => {
        mocks.limiter.mockResolvedValue(Date.now() + 60_000)
        expect((await updateSession(request(credentials))).status).toBe(429)
    })
})

describe('login form', () => {
    it('posts to the route instead of calling a Server Action', () => {
        const loginForm = read('app/(auth)/login/login-form.tsx')
        expect(loginForm).not.toContain("from '@/app/(auth)/actions/auth'")
        expect(loginForm).toContain("fetch('/auth/signin', {")
        expect(loginForm).toContain("redirect: 'manual'")
        expect(loginForm).toContain('requestSignIn({ email: email.trim(), password, traceId })')
    })
})
