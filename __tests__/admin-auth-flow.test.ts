import { beforeEach, describe, expect, it, vi } from 'vitest'
import { founderMutationOriginAllowed } from '@/lib/admin/auth-input'
import { isDedicatedSupportRoute, isFounderAuthRoute, isFounderLoginRoute, isFounderRoute, safeFounderReturnPath } from '@/lib/admin/routes'

const mocks = vi.hoisted(() => ({
    headers: vi.fn(), enabled: vi.fn(), candidate: vi.fn(), establish: vi.fn(), rate: vi.fn(),
    password: vi.fn(), signOut: vi.fn(), factors: vi.fn(), verify: vi.fn(), createClient: vi.fn(),
    enrollmentEnabled: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(), setup: vi.fn(),
}))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT ${path}`) } }))
vi.mock('@/lib/admin/founder', () => ({ founderConsoleEnabled: mocks.enabled, founderMfaEnrollmentEnabled: mocks.enrollmentEnabled, requireFounderCandidate: mocks.candidate, establishFounderSession: mocks.establish }))
vi.mock('@/lib/admin/founder-mfa', () => ({ founderMfaSetup: mocks.setup, FOUNDER_FACTOR_NAME: 'Weavly founder authenticator' }))
vi.mock('@/lib/rate-limit', () => ({ checkAuthRateLimit: mocks.rate, getClientIpFromHeaders: () => '192.0.2.10' }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { founderSignIn } from '@/app/(admin-auth)/admin/login/actions'
import { founderBeginEnrollment, founderVerify } from '@/app/(admin-auth)/admin/verify/actions'

const factorId = 'e73ba91a-2d52-4e93-8a39-bdb902757fe2'
const intentId = '71db586c-ae1e-4bba-9d16-1eae02d829ce'
const verificationId = '9a4f1129-e57f-4b4a-9d99-7b93d3c5cb10'
const pendingFactor = { id: factorId, status: 'unverified', factor_type: 'totp', friendly_name: 'Weavly founder authenticator' }
function passwordForm() {
    const form = new FormData()
    form.set('email', 'founder@example.invalid')
    form.set('password', 'synthetic-password-only')
    form.set('returnTo', '/admin/payments')
    return form
}
function challengeForm() {
    const form = new FormData()
    form.set('factorId', factorId)
    form.set('code', '123456')
    form.set('returnTo', '/admin/factories')
    return form
}
beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('WEAVLY_FOUNDER_TEST_EMAIL', 'founder@example.invalid')
    mocks.headers.mockResolvedValue(new Headers({ origin: 'https://weavly.example', host: 'weavly.example' }))
    mocks.enabled.mockReturnValue(true)
    mocks.enrollmentEnabled.mockReturnValue(true)
    mocks.rate.mockResolvedValue(null)
    mocks.candidate.mockResolvedValue({ userId: 'founder', sessionId: 'live-session', aal: 'aal1' })
    mocks.establish.mockResolvedValue({ userId: 'founder', sessionId: 'live-session' })
    mocks.password.mockResolvedValue({ error: null })
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.factors.mockResolvedValue({ data: { all: [{ id: factorId, status: 'verified' }], totp: [{ id: factorId, status: 'verified' }] }, error: null })
    mocks.verify.mockResolvedValue({ error: null })
    mocks.setup.mockResolvedValue({ allowed: true, intentId, verificationId })
    mocks.unenroll.mockResolvedValue({ error: null })
    mocks.enroll.mockResolvedValue({ data: { id: factorId, totp: { uri: 'otpauth://totp/Weavly:Synthetic?secret=JBSWY3DPEHPK3PXP&issuer=Weavly', secret: 'JBSWY3DPEHPK3PXP' } }, error: null })
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword: mocks.password, signOut: mocks.signOut, mfa: { listFactors: mocks.factors, challengeAndVerify: mocks.verify, enroll: mocks.enroll, unenroll: mocks.unenroll } } })
})

describe('first authenticator connection', () => {
    beforeEach(() => { mocks.factors.mockResolvedValue({ data: { all: [], totp: [] }, error: null }) })
    it('returns only a PNG and bound intent after verified candidate and serialized setup', async () => {
        const result = await founderBeginEnrollment()
        expect(result.setup).toMatchObject({ factorId, intentId, qrCode: expect.stringMatching(/^data:image\/png;base64,/) })
        expect(JSON.stringify(result)).not.toContain('JBSWY3DPEHPK3PXP')
        expect(JSON.stringify(result)).not.toContain('otpauth:')
        expect(mocks.setup).toHaveBeenCalledWith(expect.anything(), 'begin')
        expect(mocks.setup).toHaveBeenCalledWith(expect.anything(), 'bind', intentId, factorId)
        expect(mocks.establish).not.toHaveBeenCalled()
    })
    it('cannot enroll before identity, same-origin or setup approval', async () => {
        mocks.enrollmentEnabled.mockReturnValueOnce(false)
        expect((await founderBeginEnrollment()).code).toBe('UNAVAILABLE')
        mocks.candidate.mockRejectedValueOnce(new Error('private candidate data'))
        expect((await founderBeginEnrollment()).code).toBe('SETUP_FAILED')
        mocks.headers.mockResolvedValueOnce(new Headers({ origin: 'https://attacker.example', host: 'weavly.example' }))
        expect((await founderBeginEnrollment()).code).toBe('FORBIDDEN')
        expect(mocks.enroll).not.toHaveBeenCalled()
    })
    it('never replaces a verified factor, including a phone factor', async () => {
        mocks.factors.mockResolvedValue({ data: { all: [{ ...pendingFactor, factor_type: 'phone', status: 'verified' }], totp: [] }, error: null })
        expect((await founderBeginEnrollment(true)).code).toBe('EXISTING_FACTOR')
        expect(mocks.setup).not.toHaveBeenCalled()
        expect(mocks.unenroll).not.toHaveBeenCalled()
        expect(mocks.enroll).not.toHaveBeenCalled()
    })
    it('retains interrupted factors on restart and never calls unenroll', async () => {
        mocks.factors.mockResolvedValue({ data: { all: [pendingFactor, { ...pendingFactor, id: 'unrelated', friendly_name: 'Other app' }], totp: [] }, error: null })
        await founderBeginEnrollment(true)
        expect(mocks.setup).toHaveBeenCalledWith(expect.anything(), 'status')
        expect(mocks.setup).toHaveBeenCalledWith(expect.anything(), 'restart', intentId)
        expect(mocks.unenroll).not.toHaveBeenCalled()
        expect(mocks.enroll).toHaveBeenCalledOnce()
    })
    it('detects verification racing setup and abandons metadata without deleting the verified factor', async () => {
        mocks.factors.mockResolvedValueOnce({ data: { all: [], totp: [] }, error: null })
            .mockResolvedValueOnce({ data: { all: [{ ...pendingFactor, status: 'verified' }], totp: [] }, error: null })
        const result = await founderBeginEnrollment()
        expect(result.setup).toBeUndefined()
        expect(mocks.unenroll).not.toHaveBeenCalled()
        expect(mocks.setup).toHaveBeenLastCalledWith(expect.anything(), 'abandon', intentId)
    })
    it('a delayed old enrollment cannot remove a factor created by a restarted intent', async () => {
        mocks.factors.mockResolvedValueOnce({ data: { all: [], totp: [] }, error: null })
            .mockResolvedValueOnce({ data: { all: [pendingFactor], totp: [] }, error: null })
        mocks.setup.mockResolvedValueOnce({ allowed: true, intentId })
            .mockResolvedValueOnce({ allowed: true, intentId: verificationId })
        expect((await founderBeginEnrollment()).setup).toBeUndefined()
        expect(mocks.unenroll).not.toHaveBeenCalled()
        expect(mocks.enroll).not.toHaveBeenCalled()
    })
    it('cannot expose a QR when binding fails and sanitizes provider errors', async () => {
        mocks.setup.mockResolvedValueOnce({ allowed: true, intentId }).mockRejectedValueOnce(new Error('private DB error'))
        expect((await founderBeginEnrollment()).setup).toBeUndefined()
        mocks.enroll.mockResolvedValueOnce({ data: null, error: { message: 'provider secret material' } })
        expect(JSON.stringify(await founderBeginEnrollment())).not.toContain('secret material')
    })
    it('pending verification requires the same intent and establishes access only after provider completion', async () => {
        mocks.factors.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null })
        const form = challengeForm(); form.set('enrollmentIntentId', intentId)
        await expect(founderVerify({}, form)).rejects.toThrow('REDIRECT /admin/factories')
        expect(mocks.setup).toHaveBeenCalledWith(expect.anything(), 'verify', intentId, factorId)
        expect(mocks.setup).toHaveBeenCalledWith(expect.anything(), 'complete', intentId, factorId)
        expect(mocks.establish.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.setup.mock.invocationCallOrder[1])
    })
    it('a mismatched intent never reaches provider verification', async () => {
        mocks.factors.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null })
        mocks.setup.mockRejectedValueOnce(new Error('wrong intent'))
        const form = challengeForm(); form.set('enrollmentIntentId', intentId)
        expect((await founderVerify({}, form)).code).toBe('VERIFICATION_FAILED')
        expect(mocks.verify).not.toHaveBeenCalled()
    })
    it('rejected first code releases only the verification lease, retaining setup', async () => {
        mocks.factors.mockResolvedValue({ data: { all: [pendingFactor], totp: [] }, error: null })
        mocks.verify.mockResolvedValueOnce({ error: { code: 'mfa_verification_failed' } })
        const form = challengeForm(); form.set('enrollmentIntentId', intentId)
        expect((await founderVerify({}, form)).code).toBe('VERIFICATION_FAILED')
        expect(mocks.setup).toHaveBeenLastCalledWith(expect.anything(), 'verify_failed', intentId, factorId, verificationId)
        expect(mocks.establish).not.toHaveBeenCalled()
    })
})

describe('founder authentication boundary', () => {
    it('wrong email fails before the password is sent to Auth', async () => {
        const form = passwordForm(); form.set('email', 'other@example.invalid')
        expect((await founderSignIn({}, form)).code).toBe('WRONG_EMAIL')
        expect(mocks.password).not.toHaveBeenCalled()
        expect(mocks.candidate).not.toHaveBeenCalled()
    })
    it('password success checks current founder identity and redirects only to challenge', async () => {
        await expect(founderSignIn({}, passwordForm())).rejects.toThrow('REDIRECT /admin/verify?returnTo=%2Fadmin%2Fpayments')
        expect(mocks.candidate).toHaveBeenCalledOnce()
        expect(mocks.establish).not.toHaveBeenCalled()
    })
    it('provider failures and wrong-founder failures are generic and omit credentials', async () => {
        mocks.password.mockResolvedValueOnce({ error: { message: 'Raw password or customer details' } })
        const provider = await founderSignIn({}, passwordForm())
        mocks.candidate.mockRejectedValueOnce(new Error('private founder grant diagnostics'))
        const wrongFounder = await founderSignIn({}, passwordForm())
        expect(provider.message).toBe(wrongFounder.message)
        expect(JSON.stringify(wrongFounder)).not.toContain('diagnostics')
        expect(JSON.stringify(provider)).not.toContain('password or customer')
        expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    })
    it('disabled release does not send a password to Auth', async () => {
        mocks.enabled.mockReturnValue(false)
        expect((await founderSignIn({}, passwordForm())).code).toBe('UNAVAILABLE')
        expect(mocks.createClient).not.toHaveBeenCalled()
    })
    it('cross-origin and missing-origin requests never reach Auth', async () => {
        for (const headers of [new Headers({ origin: 'https://attacker.example', host: 'weavly.example' }), new Headers({ host: 'weavly.example' })]) {
            mocks.headers.mockResolvedValueOnce(headers)
            expect((await founderSignIn({}, passwordForm())).code).toBe('FORBIDDEN')
        }
        expect(mocks.createClient).not.toHaveBeenCalled()
    })
    it('action-specific throttling applies before Auth regardless of route invocation', async () => {
        mocks.rate.mockResolvedValue(Date.now() + 60_000)
        expect((await founderSignIn({}, passwordForm())).code).toBe('THROTTLED')
        expect((await founderVerify({}, challengeForm())).code).toBe('THROTTLED')
        expect(mocks.password).not.toHaveBeenCalled()
        expect(mocks.verify).not.toHaveBeenCalled()
    })
    it('only a current founder candidate can enumerate factors or verify', async () => {
        mocks.candidate.mockRejectedValueOnce(new Error('denied'))
        expect((await founderVerify({}, challengeForm())).code).toBe('VERIFICATION_FAILED')
        expect(mocks.factors).not.toHaveBeenCalled()
        expect(mocks.verify).not.toHaveBeenCalled()
    })
    it.each(['unverified', 'missing'])('rejects a %s factor without challenge or session creation', async (status) => {
        mocks.factors.mockResolvedValueOnce({ data: { totp: status === 'missing' ? [] : [{ id: factorId, status }] }, error: null })
        expect((await founderVerify({}, challengeForm())).code).toBe('VERIFICATION_FAILED')
        expect(mocks.verify).not.toHaveBeenCalled()
        expect(mocks.establish).not.toHaveBeenCalled()
    })
    it('successful challenge establishes the authoritative session afterwards', async () => {
        await expect(founderVerify({}, challengeForm())).rejects.toThrow('REDIRECT /admin/factories')
        expect(mocks.verify).toHaveBeenCalledWith({ factorId, code: '123456' })
        expect(mocks.establish.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.verify.mock.invocationCallOrder[0])
    })
    it('failed provider verification never creates an admin session', async () => {
        mocks.verify.mockResolvedValueOnce({ error: { message: 'Private provider failure' } })
        const result = await founderVerify({}, challengeForm())
        expect(result.message).not.toContain('Private provider')
        expect(mocks.establish).not.toHaveBeenCalled()
    })
    it('provider success with unavailable/expired server session never redirects to data', async () => {
        mocks.establish.mockRejectedValueOnce(new Error('expired server row'))
        expect((await founderVerify({}, challengeForm())).code).toBe('VERIFICATION_FAILED')
    })
    it('keeps external return targets away from sign-in/challenge redirects', async () => {
        const form = challengeForm()
        form.set('returnTo', '//attacker.example')
        await expect(founderVerify({}, form)).rejects.toThrow('REDIRECT /admin')
    })
})

describe('admin routing and redirect allowlist', () => {
    it('makes only exact founder login public and challenge authenticated', () => {
        expect(isFounderLoginRoute('/admin/login')).toBe(true)
        expect(isFounderLoginRoute('/admin/verify')).toBe(false)
        expect(isFounderLoginRoute('/admin/login/extra')).toBe(false)
        expect(isFounderAuthRoute('/admin/verify')).toBe(true)
        expect(isFounderRoute('/administrator')).toBe(false)
        expect(isDedicatedSupportRoute('/supportive')).toBe(false)
    })
    it.each(['https://attacker.example/admin', '//attacker.example', '/admin/../login', '/admin\\evil', '/admin%2ffactories', '/admin/login', '/admin?returnTo=evil', '/admin/support/not-a-uuid'])('rejects unsafe return target %s', (path) => {
        expect(safeFounderReturnPath(path)).toBe('/admin')
    })
    it('permits fixed destinations and valid factory/ticket IDs', () => {
        expect(safeFounderReturnPath('/admin/support')).toBe('/admin/support')
        expect(safeFounderReturnPath(`/admin/factories/${factorId}`)).toBe(`/admin/factories/${factorId}`)
    })
    it('validates Origin host and rejects credentials, values and malformed Origin', () => {
        expect(founderMutationOriginAllowed(new Headers({ origin: 'https://weavly.example', host: 'weavly.example' }))).toBe(true)
        for (const origin of ['https://user:pass@weavly.example', 'https://weavly.example?x=1', 'null', 'https://weavly.example.evil']) {
            expect(founderMutationOriginAllowed(new Headers({ origin, host: 'weavly.example' }))).toBe(false)
        }
    })
})
