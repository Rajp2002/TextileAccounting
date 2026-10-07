import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }))

import { loadSupervisorNames } from '@/app/(dashboard)/owner/production/supervisor-names'

// The owner's daily-sheet history names the supervisor who saved a revision.
describe('owner sheet attribution', () => {
    it('maps supervisor ids to names through the owner function', async () => {
        rpc.mockResolvedValue({ data: [{ user_id: 'sup-1', full_name: 'Ramesh' }], error: null })
        expect(await loadSupervisorNames()).toEqual({ 'sup-1': 'Ramesh' })
        expect(rpc).toHaveBeenCalledWith('get_supervisor_display_names')
    })

    it('falls back to no names when the lookup fails', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'Base owner access is required' } })
        expect(await loadSupervisorNames()).toEqual({})
    })

    it('falls back to no names when the lookup throws, so the production page still loads', async () => {
        rpc.mockRejectedValue(new Error('network'))
        expect(await loadSupervisorNames()).toEqual({})
    })

    it('the production page passes the names to the sheet, which labels supervisor revisions', () => {
        expect(readFileSync('app/(dashboard)/owner/production/page.tsx', 'utf8')).toContain('supervisorNames')
        const sheet = readFileSync('app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx', 'utf8')
        expect(sheet).toContain("supervisorText(language, 'savedBy'")
        expect(sheet).toContain('initialData.supervisorNames')
    })
})
