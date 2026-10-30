import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ requireFounder: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: mocks.requireFounder }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))

import { setFactoryCohort } from '@/lib/admin/cohort'

const orgId = '00000000-0000-4000-8000-000000000051'
const principal = { userId: '00000000-0000-4000-8000-000000000052', sessionId: '00000000-0000-4000-8000-000000000053', capabilities: [] }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireFounder.mockResolvedValue(principal)
    mocks.rpc.mockResolvedValue({ data: { orgId, cohort: 'test' }, error: null })
})

describe('setFactoryCohort', () => {
    it('defaults the reason and passes the founder session', async () => {
        expect(await setFactoryCohort(orgId, { cohort: 'test' })).toEqual({ orgId, cohort: 'test' })
        expect(mocks.rpc).toHaveBeenCalledWith('admin_set_org_cohort', expect.objectContaining({
            p_actor_id: principal.userId, p_session_id: principal.sessionId, p_org_id: orgId, p_cohort: 'test', p_reason: 'Marked by founder',
        }))
    })

    it('rejects extra keys, unknown cohorts and bad org ids before the database', async () => {
        await expect(setFactoryCohort(orgId, { cohort: 'test', orgId: 'x' })).rejects.toMatchObject({ status: 400 })
        await expect(setFactoryCohort(orgId, { cohort: 'unclassified' })).rejects.toMatchObject({ status: 400 })
        await expect(setFactoryCohort('not-a-uuid', { cohort: 'test' })).rejects.toMatchObject({ status: 400 })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('maps a missing factory to 404 and other failures to 503', async () => {
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'ORG_NOT_FOUND' } })
        await expect(setFactoryCohort(orgId, { cohort: 'demo' })).rejects.toMatchObject({ status: 404 })
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } })
        await expect(setFactoryCohort(orgId, { cohort: 'demo' })).rejects.toMatchObject({ status: 503 })
    })
})

describe('factory page', () => {
    it('shows the cohort control and tappable owner contact', () => {
        const src = readFileSync('app/(admin-console)/admin/factories/[orgId]/page.tsx', 'utf8')
        expect(src).toContain('<CohortControl')
        expect(src).toContain('<PhoneLinks phone={factory.contact.ownerPhone}')
    })
    it('the cohort route delegates to setFactoryCohort', () => {
        const src = readFileSync('app/api/admin/factories/[orgId]/cohort/route.ts', 'utf8')
        expect(src).toContain('setFactoryCohort')
        expect(src).toContain('reportResponse')
    })
})
