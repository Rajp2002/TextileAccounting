import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ identity: vi.fn(), revoked: vi.fn(), claims: vi.fn(), user: vi.fn(), rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({ getVerifiedIdentity: mocks.identity }))
vi.mock('@/lib/rate-limit', () => ({ isUserRevoked: mocks.revoked }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims, getUser: mocks.user } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-pathname':'/admin/factories' }) }))

import {
    adminRecordAudit, establishFounderSession, FOUNDER_CAPABILITIES, founderConsoleEnabled,
    requireFounder, requireFounderCandidate, requireFounderPage, revokeFounderSession,
    touchFounderSession, validateFounderClaims, requireLegacyFounder,
} from '@/lib/admin/founder'
import { AdminError, adminErrorResponse } from '@/lib/admin/errors'
import { getGrievances } from '@/lib/actions/compliance'

const userId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const claims = () => ({ sub: userId, session_id: sessionId, iss: 'https://qa-project.supabase.co/auth/v1',
    role: 'authenticated', aud: 'authenticated', aal: 'aal2', exp: Math.floor(Date.now()/1000)+300, iat: Math.floor(Date.now()/1000) })
const identity = (role = 'admin', org_id: string | null = null) => ({ user: { id: userId, email: 'founder@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z' }, profile: { role, org_id } })

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('WEAVLY_ADMIN_ENABLED', 'true')
    vi.stubEnv('WEAVLY_ADMIN_PRODUCTION_APPROVED', '')
    vi.stubEnv('WEAVLY_ADMIN_LEGACY_READS_ENABLED', '')
    vi.stubEnv('WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED', '')
    vi.stubEnv('WEAVLY_ADMIN_LEGACY_REFERENCE_ACTIONS_ENABLED', '')
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('WEAVLY_FOUNDER_TEST_EMAIL', 'founder@example.invalid')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://qa-project.supabase.co')
    mocks.identity.mockResolvedValue(identity())
    mocks.revoked.mockResolvedValue(false)
    mocks.claims.mockResolvedValue({ data: { claims: claims() }, error: null })
    mocks.user.mockResolvedValue({ data: { user: { id: userId } }, error: null })
    mocks.rpc.mockResolvedValue({ data: { allowed: true }, error: null })
})

describe('AD01 founder identity and session boundary', () => {
    it.each([
        { email: 'peer@example.invalid' }, { email: 'founder+alias@example.invalid' },
        { email: undefined }, { email_confirmed_at: undefined },
    ])('denies wrong or unverified email before grant/session reads %j', async patch => {
        mocks.identity.mockResolvedValue({ ...identity(), user: { ...identity().user, ...patch } })
        await expect(requireFounderCandidate()).rejects.toMatchObject({ code: 'FORBIDDEN' })
        expect(mocks.rpc.mock.calls.some(([name]) => name === 'admin_founder_session')).toBe(false)
    })
    it('normalizes casing but still requires the UUID grant', async () => {
        mocks.identity.mockResolvedValue({ ...identity(), user: { ...identity().user, email: 'FOUNDER@example.invalid' } })
        await requireFounderCandidate()
        mocks.rpc.mockResolvedValue({ data: { allowed: false, code: 'FORBIDDEN' }, error: null })
        await expect(requireFounderCandidate()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
    it('fails closed before loading data when disabled or production approval is absent', async () => {
        vi.stubEnv('WEAVLY_ADMIN_ENABLED', '')
        await expect(requireFounder()).rejects.toMatchObject({ code: 'ADMIN_DISABLED', status: 503 })
        expect(mocks.identity).not.toHaveBeenCalled()
        vi.stubEnv('WEAVLY_ADMIN_ENABLED', 'true')
        vi.stubEnv('NODE_ENV', 'production')
        expect(founderConsoleEnabled()).toBe(false)
        await expect(requireFounder()).rejects.toMatchObject({ code: 'ADMIN_DISABLED' })
        vi.stubEnv('WEAVLY_ADMIN_PRODUCTION_APPROVED', 'true')
        expect(founderConsoleEnabled()).toBe(true)
    })

    it('accepts an organization-less founder only with the verified grant/session', async () => {
        const principal = await requireFounder()
        expect(principal).toEqual({ userId, sessionId, capabilities: FOUNDER_CAPABILITIES })
        expect(mocks.rpc).toHaveBeenCalledWith('admin_founder_session', { p_user_id: userId, p_session_id: sessionId, p_operation: 'check' })
    })

    it.each(['owner', 'supervisor', 'worker'])('denies %s before any privileged database call', async role => {
        mocks.identity.mockResolvedValue(identity(role, 'org-a'))
        await expect(requireFounder()).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })
        expect(mocks.rpc.mock.calls.some(([name]) => name === 'admin_founder_session')).toBe(false)
    })

    it('denies anonymous, revoked and generic admin identities', async () => {
        mocks.identity.mockResolvedValue(null)
        mocks.user.mockResolvedValue({ data: { user: null }, error: null })
        await expect(requireFounder()).rejects.toMatchObject({ status: 401 })
        mocks.identity.mockResolvedValue(identity())
        mocks.user.mockResolvedValue({ data: { user: { id: userId } }, error: null })
        mocks.revoked.mockResolvedValue(true)
        await expect(requireFounder()).rejects.toMatchObject({ status: 401 })
        mocks.revoked.mockResolvedValue(false)
        mocks.rpc.mockResolvedValue({ data: { allowed: false, code: 'FORBIDDEN' }, error: null })
        await expect(requireFounder()).rejects.toMatchObject({ status: 403 })
    })

    it('allows only the MFA candidate shell at AAL1', async () => {
        mocks.claims.mockResolvedValue({ data: { claims: { ...claims(), aal: 'aal1' } }, error: null })
        expect(await requireFounderCandidate()).toEqual({ userId, sessionId, aal: 'aal1' })
        mocks.rpc.mockClear()
        await expect(requireFounder()).rejects.toMatchObject({ code: 'MFA_REQUIRED' })
        await expect(establishFounderSession()).rejects.toMatchObject({ code: 'MFA_REQUIRED' })
        expect(mocks.rpc.mock.calls.some(([name]) => name === 'admin_founder_session')).toBe(false)
        await expect(requireFounderPage()).rejects.toThrow('REDIRECT:/admin/verify?returnTo=%2Fadmin%2Ffactories')
    })

    it('freshly verifies claims after MFA in the same server action', async () => {
        mocks.claims.mockResolvedValueOnce({ data: { claims: { ...claims(), aal: 'aal1' } }, error: null })
        await requireFounderCandidate()
        await establishFounderSession()
        expect(mocks.claims).toHaveBeenCalledTimes(2)
        expect(mocks.rpc).toHaveBeenLastCalledWith('admin_founder_session', expect.objectContaining({ p_operation: 'establish' }))
    })

    it.each([
        { iss: 'https://wrong-project.supabase.co/auth/v1' }, { sub: 'someone-else' }, { session_id: 'malformed' },
        { aal: 'aal3' }, { aud: 'service_role' }, { role: 'service_role' }, { exp: 1 }, { iat: 99999999999 },
    ])('denies wrong-project or malformed verified claims %j', patch => {
        expect(() => validateFounderClaims({ ...claims(), ...patch }, userId, 'https://qa-project.supabase.co')).toThrow(AdminError)
    })

    it('never maps cryptographic verification failure to a valid session', async () => {
        mocks.claims.mockResolvedValue({ data: null, error: new Error('malformed token') })
        await expect(requireFounder()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('checks grant/session on every call and rejects replay after revocation', async () => {
        await requireFounder()
        mocks.rpc.mockResolvedValue({ data: { allowed: false, code: 'SESSION_EXPIRED' }, error: null })
        await expect(requireFounder()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
        expect(mocks.rpc.mock.calls.filter(([name]) => name === 'admin_founder_session')).toHaveLength(2)
        expect(mocks.rpc).toHaveBeenLastCalledWith('admin_record_denial',expect.objectContaining({ p_reason_code: 'SESSION_EXPIRED' }))
    })

    it('reads never touch idle time; explicit interactive touch first checks expiry', async () => {
        await requireFounder()
        await requireFounder()
        expect(mocks.rpc.mock.calls.every(([,args]) => args.p_operation === 'check')).toBe(true)
        await touchFounderSession()
        expect(mocks.rpc).toHaveBeenLastCalledWith('admin_founder_session', expect.objectContaining({ p_operation: 'touch' }))
        mocks.rpc.mockClear()
        mocks.rpc.mockResolvedValue({ data: { allowed: false, code: 'SESSION_EXPIRED' }, error: null })
        await expect(touchFounderSession()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
        expect(mocks.rpc.mock.calls.filter(([name]) => name === 'admin_founder_session')).toHaveLength(1)
    })

    it('revoke works with the console disabled and does not require a still-enabled grant', async () => {
        vi.stubEnv('WEAVLY_ADMIN_ENABLED', '')
        mocks.rpc.mockResolvedValue({data:{allowed:true,revoked:true},error:null})
        expect(await revokeFounderSession()).toBe('revoked')
        expect(mocks.rpc).toHaveBeenCalledWith('admin_founder_session', expect.objectContaining({ p_operation: 'revoke' }))
    })

    it('revoke cannot silently succeed when fresh Auth verification or claims fail',async()=>{
        mocks.user.mockResolvedValue({data:{user:null},error:new Error('Auth unavailable')})
        await expect(revokeFounderSession()).rejects.toMatchObject({code:'SIGNOUT_UNAVAILABLE'})
        mocks.user.mockResolvedValue({data:{user:{id:userId}},error:null})
        mocks.claims.mockResolvedValue({data:null,error:new Error('Claims unavailable')})
        await expect(revokeFounderSession()).rejects.toMatchObject({code:'SIGNOUT_UNAVAILABLE'})
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('revoke works despite an unavailable profile and distinguishes no matching platform session',async()=>{
        mocks.identity.mockResolvedValue(null)
        mocks.rpc.mockResolvedValue({data:{allowed:true,revoked:true},error:null})
        expect(await revokeFounderSession()).toBe('revoked')
        expect(mocks.identity).not.toHaveBeenCalled()
        mocks.rpc.mockResolvedValue({data:{allowed:true,revoked:false},error:null})
        expect(await revokeFounderSession()).toBe('not_applicable')
    })

    it('fails closed if access auditing fails and sanitizes unknown database errors', async () => {
        const principal = await requireFounder()
        mocks.rpc.mockResolvedValue({ error: new Error('sensitive backend details') })
        await expect(adminRecordAudit(principal, 'factory.read', 'factory', 'org-a')).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' })
        const response = adminErrorResponse(new Error('sensitive backend details'))
        expect(response.status).toBe(503)
        expect(await response.text()).not.toContain('sensitive backend details')
        expect(response.headers.get('cache-control')).toContain('no-store')
    })

    it('direct legacy read actions cannot bypass their disabled page gate', async () => {
        await expect(getGrievances()).rejects.toMatchObject({ code: 'LEGACY_READ_DISABLED', status: 403 })
        expect(mocks.rpc).toHaveBeenLastCalledWith('admin_record_audit', expect.objectContaining({
            p_action: 'legacy.getGrievances', p_outcome: 'denied', p_reason_code: 'legacy_reads_disabled',
        }))
    })

    it('the legacy write flag cannot enable reads; each capability needs its own gate', async () => {
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED', 'true')
        await expect(requireLegacyFounder('getGrievances', 'read')).rejects.toMatchObject({ code: 'LEGACY_READ_DISABLED' })
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_READS_ENABLED', 'true')
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED', '')
        await expect(requireLegacyFounder('getGrievances', 'read')).rejects.toMatchObject({ code: 'LEGACY_READ_DISABLED' })
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_REFERENCE_ACTIONS_ENABLED', 'true')
        expect((await requireLegacyFounder('getGrievances', 'read')).user.id).toBe(userId)
        expect(mocks.rpc).toHaveBeenLastCalledWith('admin_record_audit', expect.objectContaining({ p_action: 'legacy.authorize.getGrievances' }))
        await expect(requireLegacyFounder('lockdownTenant', 'write')).rejects.toMatchObject({ code: 'LEGACY_OPERATION_DISABLED' })
        expect(mocks.rpc).toHaveBeenLastCalledWith('admin_record_audit', expect.objectContaining({ p_outcome:'denied', p_reason_code:'legacy_operations_disabled' }))
    })
})
