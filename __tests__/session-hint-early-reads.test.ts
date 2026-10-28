import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const VERIFIED = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const ORG = 'aaaaaaaa-1111-4111-8111-111111111111'
const OTHER_ORG = 'bbbbbbbb-2222-4222-8222-222222222222'

const mocks = vi.hoisted(() => ({
    headers: new Headers(),
    getUser: vi.fn(),
    revoked: vi.fn(),
    plan: vi.fn(),
    profileReads: [] as string[],
    rows: {} as Record<string, unknown>,
}))
vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T>(fn: T) => fn }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('next/headers', () => ({ headers: async () => mocks.headers }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/rate-limit', () => ({ isUserRevoked: mocks.revoked }))
vi.mock('@/lib/subscription', () => ({ getCachedOrgPlanAccess: mocks.plan }))
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => ({
        from: () => ({
            select: () => ({
                eq: (_column: string, userId: string) => ({
                    maybeSingle: async () => {
                        mocks.profileReads.push(userId)
                        return { data: mocks.rows[userId] ?? null, error: null }
                    },
                }),
            }),
        }),
    }),
}))
import { getVerifiedIdentity, requireRole } from '@/lib/auth'
import { formatSessionHintHeader, parseSessionHintHeader, SESSION_HINT_HEADER } from '@/lib/session-hint'

const profile = (org_id: string, role = 'owner') => ({ role, org_id, full_name: 'Synthetic', phone: null, whatsapp_number: null, whatsapp_opted_in: false, access_revoked_at: null })

beforeEach(() => {
    vi.clearAllMocks()
    mocks.profileReads.length = 0
    mocks.headers = new Headers({ 'x-weavly-revocation-checked': '1' })
    mocks.rows = { [VERIFIED]: profile(ORG), [OTHER]: profile(OTHER_ORG, 'admin') }
    mocks.getUser.mockResolvedValue({ data: { user: { id: VERIFIED, app_metadata: {}, user_metadata: {} } } })
    mocks.revoked.mockResolvedValue(false)
    mocks.plan.mockImplementation(async (orgId: string) => ({ effectiveTier: orgId === ORG ? 'lite' : 'free', freeAccount: null }))
})

describe('session hint header', () => {
    it('round-trips user and org ids and rejects anything else', () => {
        expect(parseSessionHintHeader(formatSessionHintHeader(VERIFIED, ORG))).toEqual({ userId: VERIFIED, orgId: ORG })
        expect(parseSessionHintHeader(formatSessionHintHeader(VERIFIED, undefined))).toEqual({ userId: VERIFIED, orgId: null })
        expect(formatSessionHintHeader('not-a-uuid', ORG)).toBeNull()
        for (const value of [null, '', 'x', `${VERIFIED}:x`, `${VERIFIED}:${ORG}:${ORG}`, `${VERIFIED} `]) {
            expect(parseSessionHintHeader(value)).toBeNull()
        }
    })

    it('is written only by Proxy, after the revocation check, and browser values are stripped', () => {
        const proxy = readFileSync('proxy.ts', 'utf8')
        expect(proxy).toContain('forwardedHeaders.delete(SESSION_HINT_HEADER)')
        expect(proxy.indexOf('forwardedHeaders.delete(SESSION_HINT_HEADER)')).toBeLessThan(proxy.indexOf('await supabase.auth.getClaims()'))
        expect(proxy.indexOf('forwardedHeaders.set(SESSION_HINT_HEADER, sessionHint)')).toBeGreaterThan(proxy.indexOf('await isUserRevoked(userId)'))
    })
})

describe('reads started from the session hint', () => {
    it('reads the profile alongside Auth when the hint names the verified user', async () => {
        mocks.headers.set(SESSION_HINT_HEADER, `${VERIFIED}:${ORG}`)
        let readBeforeAuthAnswered = false
        mocks.getUser.mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 5))
            readBeforeAuthAnswered = mocks.profileReads.includes(VERIFIED)
            return { data: { user: { id: VERIFIED, app_metadata: {}, user_metadata: {} } } }
        })
        const identity = await getVerifiedIdentity()
        expect(readBeforeAuthAnswered).toBe(true)
        expect(mocks.profileReads).toEqual([VERIFIED])
        expect(identity?.profile.org_id).toBe(ORG)
    })

    it('never uses a row read for a hinted user Auth did not verify', async () => {
        mocks.headers.set(SESSION_HINT_HEADER, `${OTHER}:${OTHER_ORG}`)
        const identity = await getVerifiedIdentity()
        expect(mocks.profileReads).toEqual([OTHER, VERIFIED])
        expect(identity?.profile).toMatchObject({ role: 'owner', org_id: ORG })
    })

    it('still refuses a revoked session even though the profile read started early', async () => {
        mocks.headers = new Headers({ [SESSION_HINT_HEADER]: `${VERIFIED}:${ORG}` })
        mocks.revoked.mockResolvedValue(true)
        expect(await getVerifiedIdentity()).toBeNull()
    })

    it('reads in order without a hint, as before', async () => {
        await getVerifiedIdentity()
        expect(mocks.profileReads).toEqual([VERIFIED])
    })

    it('uses the early plan read only for the verified org', async () => {
        mocks.headers.set(SESSION_HINT_HEADER, `${VERIFIED}:${ORG}`)
        await requireRole(['owner'])
        expect(mocks.plan.mock.calls).toEqual([[ORG]])

        mocks.plan.mockClear()
        // A stale org claim: its (paid) plan must not decide the verified org's access.
        mocks.headers.set(SESSION_HINT_HEADER, `${VERIFIED}:${OTHER_ORG}`)
        mocks.plan.mockImplementation(async (orgId: string) => ({ effectiveTier: orgId === OTHER_ORG ? 'base' : 'free', freeAccount: null }))
        await expect(requireRole(['owner'])).rejects.toThrow('REDIRECT:/free')
        expect(mocks.plan.mock.calls).toEqual([[OTHER_ORG], [ORG]])
    })

    it('starts no plan read for Free-allowed or non-owner checks', async () => {
        mocks.headers.set(SESSION_HINT_HEADER, `${VERIFIED}:${ORG}`)
        await requireRole(['owner'], { allowFreeAccount: true })
        // Platform admins are never tenant sessions (redirected), and must not trigger a plan read either.
        mocks.rows[VERIFIED] = profile(ORG, 'admin')
        await requireRole(['admin']).catch(() => {})
        expect(mocks.plan).not.toHaveBeenCalled()
    })
})
