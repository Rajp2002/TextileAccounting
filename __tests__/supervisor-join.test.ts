import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIGNUP_LEGAL_ACCEPTANCE } from '@/lib/legal-documents'

const mocks = vi.hoisted(() => ({
    limit: vi.fn(), rpc: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(),
    insert: vi.fn(), deleteEq: vi.fn(), signIn: vi.fn(), tables: [] as string[],
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Test Browser' }) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/lib/rate-limit', () => ({ checkSupervisorJoinRateLimit: mocks.limit, getClientIpFromHeaders: () => '203.0.113.9' }))
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => ({
        rpc: mocks.rpc,
        auth: { admin: { createUser: mocks.createUser, deleteUser: mocks.deleteUser } },
        from: (table: string) => {
            mocks.tables.push(table)
            return { insert: mocks.insert, delete: () => ({ eq: mocks.deleteEq }) }
        },
    }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signInWithPassword: mocks.signIn } }) }))

import { checkSupervisorJoinCode, joinFactoryAsSupervisor } from '@/app/(auth)/actions/supervisor-join'
import { SupervisorJoinSchema } from '@/lib/schemas'

const input = {
    code: 'abcd-2345', fullName: 'Ramesh Patel', email: 'ramesh@example.test', phone: '98765 43210',
    password: 'Weave@2026', confirmPassword: 'Weave@2026',
    legalAcceptance: { accepted: true, ...SIGNUP_LEGAL_ACCEPTANCE },
}
const factory = { org_id: 'org-1', factory_name: 'Shree Mills' }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.tables.length = 0
    mocks.limit.mockResolvedValue(null)
    mocks.rpc.mockImplementation(async (name: string) => ({ data: factory, error: null, name }))
    mocks.createUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.deleteUser.mockResolvedValue({ error: null })
    mocks.insert.mockResolvedValue({ error: null })
    mocks.deleteEq.mockResolvedValue({ error: null })
    mocks.signIn.mockResolvedValue({ error: null })
})

describe('SupervisorJoinSchema', () => {
    const parse = (overrides: Record<string, unknown>) => SupervisorJoinSchema.safeParse({ ...input, phone: '9876543210', ...overrides })

    it('normalizes the code and accepts a complete request', () => {
        const result = parse({})
        expect(result.success && result.data.code).toBe('ABCD2345')
    })

    it.each([
        [{ confirmPassword: 'Weave@2027' }, 'confirmPassword'],
        [{ legalAcceptance: { accepted: false, ...SIGNUP_LEGAL_ACCEPTANCE } }, 'legalAcceptance'],
        [{ fullName: 'R' }, 'fullName'],
        [{ code: 'ABCD2O45' }, 'code'],
        [{ email: 'not-an-email' }, 'email'],
    ])('rejects %o at %s', (overrides, field) => {
        const result = parse(overrides)
        expect(result.success).toBe(false)
        expect(!result.success && result.error.issues[0].path[0]).toBe(field)
    })
})

describe('checkSupervisorJoinCode', () => {
    it('is throttled per IP before any lookup', async () => {
        mocks.limit.mockResolvedValue(Date.now() + 60_000)
        expect(await checkSupervisorJoinCode('ABCD2345')).toEqual({ valid: false, error: 'tooManyAttempts' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('rejects a malformed code without a lookup', async () => {
        expect(await checkSupervisorJoinCode('ABC')).toEqual({ valid: false, error: 'codeInvalid' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('looks up the normalized code and names the factory', async () => {
        expect(await checkSupervisorJoinCode(' abcd-2345 ')).toEqual({ valid: true, factoryName: 'Shree Mills' })
        expect(mocks.rpc).toHaveBeenCalledWith('lookup_supervisor_join_code', { p_code: 'ABCD2345' })
    })

    it('gives the same answer for an unknown, disabled or inactive code', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: null })
        expect(await checkSupervisorJoinCode('ABCD2345')).toEqual({ valid: false, error: 'codeInvalid' })
    })
})

describe('joinFactoryAsSupervisor', () => {
    it('creates the account, registers the request, records legal acceptance against the factory and goes home', async () => {
        await expect(joinFactoryAsSupervisor(input)).rejects.toThrow('REDIRECT:/supervisor')
        expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'ramesh@example.test', password: 'Weave@2026', email_confirm: true }))
        expect(mocks.rpc).toHaveBeenCalledWith('register_supervisor_join_request', {
            p_user_id: 'user-1', p_code: 'ABCD2345', p_full_name: 'Ramesh Patel', p_email: 'ramesh@example.test', p_phone: '9876543210',
        })
        expect(mocks.tables).toContain('legal_document_acceptances')
        const rows = mocks.insert.mock.calls[0][0] as Array<Record<string, unknown>>
        expect(rows.map(row => [row.org_id, row.actor_user_id, row.document_type])).toEqual([['org-1', 'user-1', 'terms'], ['org-1', 'user-1', 'privacy']])
        expect(mocks.signIn).toHaveBeenCalledWith({ email: 'ramesh@example.test', password: 'Weave@2026' })
    })

    it('is throttled per IP', async () => {
        mocks.limit.mockResolvedValue(Date.now() + 60_000)
        expect(await joinFactoryAsSupervisor(input)).toEqual({ error: 'tooManyAttempts' })
        expect(mocks.createUser).not.toHaveBeenCalled()
    })

    it('rejects an invalid mobile number before creating anything', async () => {
        expect(await joinFactoryAsSupervisor({ ...input, phone: '12345' })).toEqual({ error: 'phoneInvalid' })
        expect(mocks.createUser).not.toHaveBeenCalled()
    })

    it('stops on a code that no longer works', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: null })
        expect(await joinFactoryAsSupervisor(input)).toEqual({ error: 'codeInvalid' })
        expect(mocks.createUser).not.toHaveBeenCalled()
    })

    it('reports an email that already has an account', async () => {
        mocks.createUser.mockResolvedValue({ data: { user: null }, error: { status: 422, message: 'A user with this email address has already been registered' } })
        expect(await joinFactoryAsSupervisor(input)).toEqual({ error: 'emailTaken' })
    })

    it('deletes the new account when registration fails', async () => {
        mocks.rpc.mockImplementation(async (name: string) => name === 'register_supervisor_join_request'
            ? { data: null, error: { code: '22023', message: 'Check the code with your factory owner.' } }
            : { data: factory, error: null })
        expect(await joinFactoryAsSupervisor(input)).toEqual({ error: 'codeInvalid' })
        expect(mocks.deleteUser).toHaveBeenCalledWith('user-1')
    })

    it('removes the profile and account when legal acceptance cannot be recorded', async () => {
        mocks.insert.mockResolvedValue({ error: { message: 'insert failed' } })
        expect(await joinFactoryAsSupervisor(input)).toEqual({ error: 'joinFailed' })
        expect(mocks.tables).toContain('profiles')
        expect(mocks.deleteEq).toHaveBeenCalledWith('id', 'user-1')
        expect(mocks.deleteUser).toHaveBeenCalledWith('user-1')
    })

    it('keeps the request when only the sign-in fails', async () => {
        mocks.signIn.mockResolvedValue({ error: { message: 'temporarily unavailable' } })
        expect(await joinFactoryAsSupervisor(input)).toEqual({ error: 'joinedSignInFailed' })
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })
})
