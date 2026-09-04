import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), updateUser: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { updateUser: mocks.updateUser } }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
import { dismissCostEstimateTutorial } from '../app/(dashboard)/owner/estimator/tutorial-actions'

beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireRole.mockResolvedValue({ user: { id: 'owner-a', user_metadata: { name: 'Owner' } } })
    mocks.updateUser.mockResolvedValue({ data: { user: { user_metadata: { cost_estimate_tutorial_dismissed: true } } }, error: null })
})

describe('account-level cost estimate tutorial preference', () => {
    it('updates only the current authenticated account preference and refreshes server-rendered state', async () => {
        expect(await dismissCostEstimateTutorial()).toEqual({ success: true })
        expect(mocks.requireRole).toHaveBeenCalledWith(['owner'])
        expect(mocks.updateUser).toHaveBeenCalledWith({ data: { cost_estimate_tutorial_dismissed: true } })
        expect(mocks.revalidatePath).toHaveBeenCalledWith('/owner/estimator')
    })

    it('recognises dismissal from another device without writing again', async () => {
        mocks.requireRole.mockResolvedValue({ user: { id: 'owner-a', user_metadata: { cost_estimate_tutorial_dismissed: true } } })
        expect(await dismissCostEstimateTutorial()).toEqual({ success: true })
        expect(mocks.updateUser).not.toHaveBeenCalled()
    })

    it('does not write for an unauthenticated or unauthorised caller', async () => {
        mocks.requireRole.mockRejectedValue(new Error('Access denied'))
        await expect(dismissCostEstimateTutorial()).rejects.toThrow('Access denied')
        expect(mocks.updateUser).not.toHaveBeenCalled()
    })

    it('reports failed and unconfirmed saves so the UI can retry', async () => {
        mocks.updateUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Offline' } })
        expect(await dismissCostEstimateTutorial()).toEqual({ success: false })
        mocks.updateUser.mockResolvedValueOnce({ data: { user: { user_metadata: {} } }, error: null })
        expect(await dismissCostEstimateTutorial()).toEqual({ success: false })
        expect(mocks.revalidatePath).not.toHaveBeenCalled()
    })
})
