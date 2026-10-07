import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ requireActive: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('next/navigation', () => ({
    redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) },
    useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/lib/supervisor-session', () => ({ requireActiveSupervisor: mocks.requireActive }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: mocks.rpc }) }))

import { saveSupervisorDailySheet } from '@/app/supervisor/daily-sheet/actions'
import { SupervisorStatusView } from '@/components/supervisor/supervisor-status-view'
import { SupervisorDailySheet } from '@/components/supervisor/SupervisorDailySheet'
import { parseSupervisorSheet } from '@/lib/supervisor-daily-sheet'

const ids = {
    org: '00000000-0000-4000-8000-000000000001', worker: '00000000-0000-4000-8000-0000000000a1',
    machine: '00000000-0000-4000-8000-0000000000b1', job: '00000000-0000-4000-8000-0000000000c1',
    request: '00000000-0000-4000-8000-0000000000f2',
}
const input = {
    productionDate: '2026-10-07', shift: 'day' as const, clientRequestId: ids.request, expectedUpdatedAt: null,
    entries: [{
        worker_id: ids.worker, entry_status: 'entered' as const, meters: 40, notes: null,
        machine_records: [{ machine_id: ids.machine, state: 'entered' as const }],
        allocations: [{ machine_id: ids.machine, job_id: ids.job, meters: 40 }],
    }],
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireActive.mockResolvedValue({ userId: 'sup-1', orgId: ids.org, today: '2026-10-07', status: 'approved', planActive: true, locked: false })
    mocks.rpc.mockResolvedValue({ data: { batch_id: 'b-1', total_meters: 40 }, error: null })
})

describe('saveSupervisorDailySheet', () => {
    it('saves through the supervisor function', async () => {
        expect(await saveSupervisorDailySheet(input)).toEqual({ success: true, totalMeters: 40, idempotent: false })
        expect(mocks.rpc).toHaveBeenCalledWith('save_supervisor_daily_sheet', expect.objectContaining({
            p_production_date: '2026-10-07', p_shift: 'day', p_client_request_id: ids.request, p_correction_reason: null, p_expected_updated_at: null,
            p_entries: input.entries,
        }))
    })

    it('checks the supervisor before anything else', async () => {
        mocks.requireActive.mockRejectedValue(new Error('REDIRECT:/supervisor'))
        await expect(saveSupervisorDailySheet(input)).rejects.toThrow('REDIRECT:/supervisor')
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('refuses a date outside today and yesterday without calling the database', async () => {
        expect(await saveSupervisorDailySheet({ ...input, productionDate: '2026-10-05' })).toEqual({ error: 'errorGeneric' })
        expect(mocks.rpc).not.toHaveBeenCalled()
    })

    it('refuses malformed entries', async () => {
        expect(await saveSupervisorDailySheet({ ...input, entries: [] })).toEqual({ error: 'enterSomething' })
    })

    it.each([
        ['40001', 'errorConflict'], ['23503', 'errorSetup'], ['42501', 'errorAccess'],
    ])('maps database error %s to %s', async (code, key) => {
        mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'detail' } })
        expect(await saveSupervisorDailySheet(input)).toEqual({ error: key })
    })

    it('passes a validation message through', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Paid worker machine records are protected.' } })
        expect(await saveSupervisorDailySheet(input)).toEqual({ error: 'errorGeneric', message: 'Paid worker machine records are protected.' })
    })
})

describe('supervisor status view', () => {
    it('tells a pending supervisor who they are waiting for', () => {
        const html = renderToStaticMarkup(<SupervisorStatusView state="pending" factoryName="Shree Mills" />)
        expect(html).toContain('Waiting for approval')
        expect(html).toContain('Shree Mills')
    })

    it('explains an unavailable sheet', () => {
        expect(renderToStaticMarkup(<SupervisorStatusView state="unavailable" factoryName="Shree Mills" />)).toContain('Daily sheet unavailable')
        expect(renderToStaticMarkup(<SupervisorStatusView state="none" factoryName={null} />)).toContain('No factory linked')
    })
})

describe('supervisor daily sheet', () => {
    const data = parseSupervisorSheet({
        org_id: ids.org, factory_name: 'Shree Mills', today: '2026-10-07', min_date: '2026-10-06', batch: null,
        workers: [{ id: ids.worker, name: 'Asha', is_active: true, shift_availability: 'both', pay_type: 'piece_rate', operator_eligible: null, operator_effective_from: null, start_date: null, end_date: null, paid: false }],
        machines: [{ id: ids.machine, label: 'Loom 1', machine_type: 'power_loom', is_active: true }],
        assignments: [{ id: '00000000-0000-4000-8000-0000000000d1', worker_id: ids.worker, machine_id: ids.machine }],
        machine_jobs: [{ machine_id: ids.machine, job_id: ids.job, job_label: 'Cotton' }],
        entries: [], allocations: [], revisions: [],
    })

    it('renders machines, workers and qualities, and no money', () => {
        const html = renderToStaticMarkup(<SupervisorDailySheet data={data} date="2026-10-07" shift="day" actorId="sup-1" />)
        for (const text of ['Daily sheet', 'Loom 1', 'Asha', 'Cotton', 'Save shift', 'Today', 'Yesterday']) expect(html).toContain(text)
        expect(html).not.toMatch(/₹|Rate|Earnings|Pay/)
    })

    it.each([
        'components/supervisor/SupervisorDailySheet.tsx',
        'components/supervisor/supervisor-status-view.tsx',
        'components/supervisor/supervisor-shell.tsx',
        'app/supervisor/layout.tsx',
        'app/supervisor/page.tsx',
        'app/supervisor/daily-sheet/page.tsx',
        'app/supervisor/daily-sheet/actions.ts',
    ])('%s never touches money', (file) => {
        expect(readFileSync(file, 'utf8')).not.toMatch(/formatINR|₹|\brate|salary|price|earning|createAdminClient/i)
    })

    it('the page loads through the supervisor read function inside the date window', () => {
        const source = readFileSync('app/supervisor/daily-sheet/page.tsx', 'utf8')
        expect(source).toContain("rpc('get_supervisor_daily_sheet'")
        expect(source).toContain('supervisorDateWindow')
        expect(source).toContain('requireActiveSupervisor')
    })
})
