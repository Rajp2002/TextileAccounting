import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    requireRole: vi.fn(), requireWritableOrg: vi.fn(), tier: vi.fn(), rpc: vi.fn(),
    deleteUser: vi.fn(), revoke: vi.fn(), revalidate: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('@/lib/auth', () => ({ requireRole: mocks.requireRole, requireWritableOrg: mocks.requireWritableOrg }))
vi.mock('@/lib/subscription', () => ({ getOrgTier: mocks.tier }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { deleteUser: mocks.deleteUser } } }) }))
vi.mock('@/lib/rate-limit', () => ({ revokeUserSession: mocks.revoke }))

import {
    approveSupervisorAction,
    declineSupervisorAction,
    getSupervisorAccessAction,
    regenerateSupervisorCodeAction,
    removeSupervisorAction,
    setSupervisorJoiningAction,
} from '@/app/(dashboard)/owner/settings/supervisor-actions'
import { SupervisorAccessCard } from '@/components/settings/supervisors/SupervisorAccessCard'

const supervisorId = '00000000-0000-4000-8000-0000000000a1'
const rawState = {
    joining_enabled: true, code: 'ABCD2345',
    pending: [{ user_id: supervisorId, full_name: 'Ramesh', email: 'r@example.test', phone: '9876543210', requested_at: '2026-10-07T05:00:00+00:00' }],
    approved: [],
}
const state = {
    joiningEnabled: true, code: 'ABCD2345',
    pending: [{ userId: supervisorId, fullName: 'Ramesh', email: 'r@example.test', phone: '9876543210', requestedAt: '2026-10-07T05:00:00+00:00', decidedAt: null }],
    approved: [],
}

beforeEach(() => {
    vi.clearAllMocks()
    const owner = { user: { id: 'own-1' }, profile: { role: 'owner', org_id: 'org-1' } }
    mocks.requireRole.mockResolvedValue(owner)
    mocks.requireWritableOrg.mockResolvedValue(owner)
    mocks.tier.mockResolvedValue('base')
    mocks.rpc.mockImplementation(async (name: string) => name === 'regenerate_supervisor_join_code'
        ? { data: 'WXYZ6789', error: null }
        : { data: name === 'get_supervisor_access' || name === 'set_supervisor_joining' ? rawState : null, error: null })
    mocks.deleteUser.mockResolvedValue({ error: null })
    mocks.revoke.mockResolvedValue(undefined)
})

describe('owner supervisor actions', () => {
    it('reads the access state for a Base owner', async () => {
        expect(await getSupervisorAccessAction()).toEqual({ data: state })
        expect(mocks.requireRole).toHaveBeenCalledWith(['owner'])
    })

    it('refuses an owner without Base production', async () => {
        mocks.tier.mockResolvedValue('lite')
        expect(await getSupervisorAccessAction()).toEqual({ error: 'actionFailed' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('writes only for a writable organization', async () => {
        mocks.requireWritableOrg.mockRejectedValue(new Error('Organization is locked.'))
        expect(await setSupervisorJoiningAction(true)).toEqual({ error: 'actionFailed' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('turns joining on and regenerates the code', async () => {
        expect(await setSupervisorJoiningAction(true)).toEqual({ data: state })
        expect(mocks.rpc).toHaveBeenCalledWith('set_supervisor_joining', { p_enabled: true })
        await regenerateSupervisorCodeAction()
        expect(mocks.rpc).toHaveBeenCalledWith('regenerate_supervisor_join_code')
    })

    it('rejects an invalid person id', async () => {
        expect(await approveSupervisorAction('not-a-uuid')).toEqual({ error: 'actionFailed' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('approves a request', async () => {
        await approveSupervisorAction(supervisorId)
        expect(mocks.rpc).toHaveBeenCalledWith('approve_supervisor', { p_user_id: supervisorId })
    })

    it('declining also deletes the account and ends its session', async () => {
        await declineSupervisorAction(supervisorId)
        expect(mocks.rpc).toHaveBeenCalledWith('decline_supervisor', { p_user_id: supervisorId })
        expect(mocks.deleteUser).toHaveBeenCalledWith(supervisorId)
        expect(mocks.revoke).toHaveBeenCalledWith(supervisorId)
    })

    it('a refused decline deletes nothing', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'no longer waiting' } })
        expect(await declineSupervisorAction(supervisorId)).toEqual({ error: 'actionFailed' })
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })

    it('removing ends the supervisor’s session', async () => {
        await removeSupervisorAction(supervisorId)
        expect(mocks.rpc).toHaveBeenCalledWith('remove_supervisor', { p_user_id: supervisorId })
        expect(mocks.revoke).toHaveBeenCalledWith(supervisorId)
        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })
})

describe('Supervisors card', () => {
    it('renders the code and the waiting request from initial data', () => {
        const client = new QueryClient()
        client.setQueryData(['supervisor_access', 'org-1'], state)
        const html = renderToStaticMarkup(<QueryClientProvider client={client}><SupervisorAccessCard orgId="org-1" factoryName="Shree Mills" /></QueryClientProvider>)
        for (const text of ['Supervisors', 'ABCD-2345', 'Ramesh', 'Approve', 'Decline', 'Share on WhatsApp']) expect(html).toContain(text)
    })

    it('appears in Settings only on Base', () => {
        const view = readFileSync('components/settings/plan-aware/plan-aware-settings-view.tsx', 'utf8')
        expect(view).toMatch(/tier === 'base' && <SupervisorAccessCard/)
    })
})
