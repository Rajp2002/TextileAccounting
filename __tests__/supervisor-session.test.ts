import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ identity: vi.fn(), rpc: vi.fn(), createAdmin: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
vi.mock('@/lib/auth', () => ({ getVerifiedIdentity: mocks.identity }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdmin }))

import { getSupervisorSession, requireActiveSupervisor } from '@/lib/supervisor-session'

const supervisor = { user: { id: 'sup-1' }, profile: { role: 'supervisor', org_id: null, full_name: 'Ramesh' } }
const status = (overrides: Record<string, unknown> = {}) => ({
    data: { status: 'approved', org_id: 'org-1', factory_name: 'Shree Mills', plan_active: true, locked: false, today: '2026-10-07', ...overrides },
    error: null,
})

beforeEach(() => {
    mocks.identity.mockReset()
    mocks.rpc.mockReset()
    mocks.createAdmin.mockReset()
})

describe('supervisor session', () => {
    it('reads the supervisor status through the signed-in client, never the service role', async () => {
        mocks.identity.mockResolvedValue(supervisor)
        mocks.rpc.mockResolvedValue(status())
        expect(await getSupervisorSession()).toEqual({
            userId: 'sup-1', fullName: 'Ramesh', status: 'approved', orgId: 'org-1',
            factoryName: 'Shree Mills', planActive: true, locked: false, today: '2026-10-07',
        })
        expect(mocks.rpc).toHaveBeenCalledWith('get_supervisor_status')
        expect(mocks.createAdmin).not.toHaveBeenCalled()
    })

    it('is empty for owners and signed-out visitors', async () => {
        mocks.identity.mockResolvedValue({ user: { id: 'own-1' }, profile: { role: 'owner', org_id: 'org-1' } })
        expect(await getSupervisorSession()).toBeNull()
        mocks.identity.mockResolvedValue(null)
        expect(await getSupervisorSession()).toBeNull()
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('fails loudly when the status cannot be read', async () => {
        mocks.identity.mockResolvedValue(supervisor)
        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
        await expect(getSupervisorSession()).rejects.toThrow()
    })
})

describe('requireActiveSupervisor', () => {
    it('returns an approved supervisor of an active, unlocked factory', async () => {
        mocks.identity.mockResolvedValue(supervisor)
        mocks.rpc.mockResolvedValue(status())
        expect((await requireActiveSupervisor()).orgId).toBe('org-1')
    })

    it('sends everyone else away', async () => {
        mocks.identity.mockResolvedValue(null)
        await expect(requireActiveSupervisor()).rejects.toThrow('REDIRECT:/login')
        mocks.identity.mockResolvedValue(supervisor)
        for (const overrides of [{ status: 'pending' }, { plan_active: false }, { locked: true }, { status: 'none', org_id: null }]) {
            mocks.rpc.mockResolvedValue(status(overrides))
            await expect(requireActiveSupervisor()).rejects.toThrow('REDIRECT:/supervisor')
        }
    })
})
