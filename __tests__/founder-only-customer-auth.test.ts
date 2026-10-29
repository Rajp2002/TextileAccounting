import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SIGNUP_LEGAL_ACCEPTANCE } from '@/lib/legal-documents'
import { FOUNDER_ONLY_LOGIN_MESSAGE, founderOnlyIdentity } from '@/lib/admin/founder-email'

const mocks = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), password: vi.fn(), signOut: vi.fn(), refresh: vi.fn(), exchange: vi.fn(), reset: vi.fn(), tier: vi.fn(), enroll: vi.fn(), cookie: vi.fn(), grant: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'app.example.test' }), cookies: async () => ({ set: mocks.cookie, delete: mocks.cookie }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/auth', () => ({ parseJWT: (value: string) => JSON.parse(value) }))
vi.mock('@/lib/subscription', () => ({ getOrgTier: mocks.tier }))
vi.mock('@/lib/free-account', () => ({ canEnrollFree: mocks.enroll, finishFreeProvisioning: vi.fn(), getFreeGrant: mocks.grant }))
vi.mock('@/lib/sign-in-telemetry.server', () => ({ createSignInServerTimer: () => ({ log: vi.fn(), measure: async (_name: string, fn: () => unknown) => fn() }), persistSignInTraceCookie: vi.fn() }))

import { createOrganization, signIn, requestPasswordReset } from '@/app/(auth)/actions/auth'
import { GET as callback } from '@/app/auth/callback/route'

const founderEmail = 'founder@example.test'
const ownerEmail = 'owner@example.test'
const userId = '11111111-1111-4111-8111-111111111111'
function session(email = ownerEmail, role = 'owner') {
    return { access_token: JSON.stringify({ user_role: role, org_id: role === 'owner' ? 'organization-a' : null, onboarding_complete: true }), user: { id: userId, email, app_metadata: {} } }
}
beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('WEAVLY_FOUNDER_TEST_EMAIL', founderEmail)
    mocks.password.mockResolvedValue({ data: { session: session() }, error: null })
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.reset.mockResolvedValue({ error: null })
    mocks.exchange.mockResolvedValue({ data: { session: session() }, error: null })
    mocks.tier.mockResolvedValue('base')
    mocks.client.mockResolvedValue({ auth: { signInWithPassword: mocks.password, signOut: mocks.signOut, refreshSession: mocks.refresh, exchangeCodeForSession: mocks.exchange, resetPasswordForEmail: mocks.reset } })
})
afterEach(() => vi.unstubAllEnvs())

describe('founder identity has no customer login or signup', () => {
    it.each([founderEmail, ' FOUNDER@EXAMPLE.TEST '])('rejects reserved email %s before invoking Supabase password auth', async email => {
        expect(await signIn({ email, password: 'synthetic-only' })).toEqual({ error: FOUNDER_ONLY_LOGIN_MESSAGE })
        expect(mocks.client).not.toHaveBeenCalled()
        expect(mocks.password).not.toHaveBeenCalled()
        expect(mocks.admin).not.toHaveBeenCalled()
        expect(mocks.cookie).not.toHaveBeenCalled()
    })
    it.each(['free', 'lite', 'base'] as const)('cannot register the founder email for a %s workspace', async selectedPlan => {
        expect(await createOrganization({ ownerName: 'Synthetic Owner', email: ' FOUNDER@EXAMPLE.TEST ', password: 'SyntheticOnly1!', confirmPassword: 'SyntheticOnly1!', factoryName: 'Synthetic Factory', phone: '9876543210', selectedPlan, legalAcceptance: { accepted: true, ...SIGNUP_LEGAL_ACCEPTANCE } })).toEqual({ error: FOUNDER_ONLY_LOGIN_MESSAGE })
        expect(mocks.admin).not.toHaveBeenCalled()
        expect(mocks.enroll).not.toHaveBeenCalled()
        expect(mocks.client).not.toHaveBeenCalled()
    })
    it('denies an unexpected verified founder email returned after an otherwise ordinary login', async () => {
        mocks.password.mockResolvedValue({ data: { session: session(founderEmail) }, error: null })
        expect(await signIn({ email: ownerEmail, password: 'synthetic-only' })).toEqual({ error: FOUNDER_ONLY_LOGIN_MESSAGE })
        expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
        expect(mocks.tier).not.toHaveBeenCalled()
    })
    it('platform admin password success on normal login is rejected and its session is cleared', async () => {
        mocks.password.mockResolvedValue({ data: { session: session('platform@example.test', 'admin') }, error: null })
        expect(await signIn({ email: 'platform@example.test', password: 'synthetic-only' })).toEqual({ error: FOUNDER_ONLY_LOGIN_MESSAGE })
        expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
        expect(mocks.cookie).not.toHaveBeenCalled()
    })
    it('keeps normal owner password login and generic credential failures', async () => {
        expect(await signIn({ email: ownerEmail, password: 'synthetic-only' })).toEqual({ redirectTo: '/owner/estimator' })
        mocks.password.mockResolvedValue({ data: { session: null }, error: { message: 'provider detail' } })
        expect(await signIn({ email: ownerEmail, password: 'wrong' })).toEqual({ error: 'Incorrect email or password.' })
    })
    it('reads a Free signup\'s grant alongside its plan, and no grant for other owners', async () => {
        const grantRead = Promise.resolve({ subjectId: userId, state: 'active' })
        mocks.grant.mockReturnValue(grantRead)
        mocks.tier.mockResolvedValue('free')
        mocks.password.mockResolvedValue({ data: { session: { ...session(), user: { id: userId, email: ownerEmail, app_metadata: { free_signup: true } } } }, error: null })
        expect(await signIn({ email: ownerEmail, password: 'synthetic-only' })).toEqual({ redirectTo: '/free' })
        expect(mocks.grant).toHaveBeenCalledWith('organization-a')
        expect(mocks.tier).toHaveBeenCalledWith('organization-a', grantRead)

        vi.clearAllMocks()
        mocks.tier.mockResolvedValue('lite')
        mocks.password.mockResolvedValue({ data: { session: session() }, error: null })
        expect(await signIn({ email: ownerEmail, password: 'synthetic-only' })).toEqual({ redirectTo: '/owner/estimator' })
        expect(mocks.grant).not.toHaveBeenCalled()
        expect(mocks.tier).toHaveBeenCalledWith('organization-a', undefined)
    })
    it('permits password recovery without granting customer access', async () => {
        expect(await requestPasswordReset({ email: founderEmail })).toEqual({ success: true })
        expect(mocks.reset).toHaveBeenCalledWith(founderEmail, { redirectTo: expect.stringContaining('/auth/callback?next=/reset-password') })
    })
    it('email and platform role are denial signals, never founder privilege', () => {
        expect(founderOnlyIdentity(founderEmail, 'owner')).toBe(true)
        expect(founderOnlyIdentity(ownerEmail, 'admin')).toBe(true)
        expect(founderOnlyIdentity(ownerEmail, 'owner')).toBe(false)
    })
})

describe('founder callback remains outside customer workspaces', () => {
    it.each([founderEmail, 'platform@example.test'])('routes %s to founder authentication independently of a tenant next path', async email => {
        mocks.exchange.mockResolvedValue({ data: { session: session(email, email === founderEmail ? 'owner' : 'admin') }, error: null })
        const response = await callback(new Request('https://app.example.test/auth/callback?code=synthetic&next=/free'))
        expect(response.headers.get('location')).toBe('https://app.example.test/admin/login')
    })
    it('allows the founder recovery callback to reach password reset', async () => {
        mocks.exchange.mockResolvedValue({ data: { session: session(founderEmail, 'admin') }, error: null })
        expect((await callback(new Request('https://app.example.test/auth/callback?code=synthetic&next=/reset-password'))).headers.get('location')).toBe('https://app.example.test/reset-password')
    })
    it('keeps customer callback destinations and rejects external next URLs', async () => {
        expect((await callback(new Request('https://app.example.test/auth/callback?code=synthetic'))).headers.get('location')).toBe('https://app.example.test/owner/estimator')
        expect((await callback(new Request('https://app.example.test/auth/callback?code=synthetic&next=//attacker.test'))).headers.get('location')).toBe('https://app.example.test/forgot-password?error=invalid_link')
    })
})
