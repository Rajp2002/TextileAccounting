import { describe, expect, it } from 'vitest'
import {
    blockedSupervisorRows,
    buildSupervisorSavePayload,
    buildSupervisorSheet,
    contextKey,
    parseSupervisorSheet,
    summarizeSupervisorSheet,
} from '@/lib/supervisor-daily-sheet'

const ids = {
    org: '00000000-0000-4000-8000-000000000001',
    w1: '00000000-0000-4000-8000-0000000000a1', w2: '00000000-0000-4000-8000-0000000000a2', w3: '00000000-0000-4000-8000-0000000000a3',
    m1: '00000000-0000-4000-8000-0000000000b1', m2: '00000000-0000-4000-8000-0000000000b2', m3: '00000000-0000-4000-8000-0000000000b3',
    j1: '00000000-0000-4000-8000-0000000000c1', j2: '00000000-0000-4000-8000-0000000000c2',
    a1: '00000000-0000-4000-8000-0000000000d1', a2: '00000000-0000-4000-8000-0000000000d2',
    e1: '00000000-0000-4000-8000-0000000000e1', batch: '00000000-0000-4000-8000-0000000000f1',
    request: '00000000-0000-4000-8000-0000000000f2',
}
const worker = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
    id, name, is_active: true, shift_availability: 'both', pay_type: 'piece_rate', operator_eligible: null,
    operator_effective_from: null, start_date: null, end_date: null, paid: false, ...overrides,
})

function raw(overrides: Record<string, unknown> = {}) {
    return {
        org_id: ids.org, factory_name: 'Shree Mills', today: '2026-10-07', min_date: '2026-10-06', batch: null,
        workers: [worker(ids.w1, 'Asha'), worker(ids.w2, 'Bhavin'), worker(ids.w3, 'Chirag', { shift_availability: 'night' })],
        machines: [
            { id: ids.m1, label: 'Loom 1', machine_type: 'power_loom', is_active: true },
            { id: ids.m2, label: 'Loom 2', machine_type: 'power_loom', is_active: true },
            { id: ids.m3, label: 'Loom 10', machine_type: 'power_loom', is_active: true },
        ],
        assignments: [{ id: ids.a1, worker_id: ids.w1, machine_id: ids.m1 }, { id: ids.a2, worker_id: ids.w2, machine_id: ids.m2 }],
        machine_jobs: [{ machine_id: ids.m1, job_id: ids.j1, job_label: 'Cotton' }, { machine_id: ids.m2, job_id: ids.j2, job_label: 'Rayon' }],
        entries: [], allocations: [], revisions: [],
        ...overrides,
    }
}

describe('parseSupervisorSheet', () => {
    it('reads the database payload', () => {
        const data = parseSupervisorSheet(raw())
        expect(data.factoryName).toBe('Shree Mills')
        expect(data.machines.map(machine => machine.label)).toEqual(['Loom 1', 'Loom 2', 'Loom 10'])
    })

    it('rejects a payload it does not understand', () => {
        expect(() => parseSupervisorSheet({ workers: 'nope' })).toThrow()
    })
})

describe('buildSupervisorSheet', () => {
    it('orders machines naturally and shows today’s Setup', () => {
        const sheet = buildSupervisorSheet(parseSupervisorSheet(raw()), '2026-10-07', 'day')
        expect(sheet.rows.map(row => [row.machineLabel, row.workerName, row.jobLabel])).toEqual([
            ['Loom 1', 'Asha', 'Cotton'], ['Loom 2', 'Bhavin', 'Rayon'], ['Loom 10', null, null],
        ])
    })

    it('lists machines with a worker first, then the unassigned ones, each in natural order', () => {
        const sheet = buildSupervisorSheet(parseSupervisorSheet(raw({
            assignments: [{ id: ids.a1, worker_id: ids.w1, machine_id: ids.m1 }, { id: ids.a2, worker_id: ids.w2, machine_id: ids.m3 }],
        })), '2026-10-07', 'day')
        expect(sheet.rows.map(row => row.machineLabel)).toEqual(['Loom 1', 'Loom 10', 'Loom 2'])
    })

    it('a machine with no assignment has no worker', () => {
        const sheet = buildSupervisorSheet(parseSupervisorSheet(raw()), '2026-10-07', 'day')
        expect(sheet.rows.find(row => row.machineId === ids.m3)).toMatchObject({ workerId: null, jobId: null })
    })

    it('a saved allocation keeps its worker and quality after Setup changes', () => {
        const data = parseSupervisorSheet(raw({
            batch: { id: ids.batch, status: 'saved', updated_at: '2026-10-07T06:00:00.123456+00:00', client_request_id: ids.request, machine_records: [] },
            entries: [{ id: ids.e1, worker_id: ids.w2, entry_status: 'entered', meters: 55.5, notes: null, machine_id: null, job_id: null }],
            allocations: [{ entry_id: ids.e1, worker_id: ids.w2, assignment_id: null, machine_id: ids.m1, job_id: ids.j2, machine_label: 'Loom 1 (old)', job_label: 'Rayon', meters: 55.5 }],
        }))
        const sheet = buildSupervisorSheet(data, '2026-10-07', 'day')
        expect(sheet.rows.find(row => row.machineId === ids.m1)).toMatchObject({ workerId: ids.w2, workerName: 'Bhavin', jobId: ids.j2, machineLabel: 'Loom 1 (old)' })
        expect(sheet.baseline[ids.w2].machineMeters[contextKey({ machineId: ids.m1, jobId: ids.j2 })]).toBe('55.5')
        expect(sheet.baseline[ids.w2].status).toBe('entered')
    })

    it('leaves out a worker who is unavailable on this shift and has nothing saved', () => {
        const sheet = buildSupervisorSheet(parseSupervisorSheet(raw()), '2026-10-07', 'day')
        expect(sheet.workers.map(item => item.name)).toEqual(['Asha', 'Bhavin'])
    })

    it('marks paid workers', () => {
        const data = parseSupervisorSheet(raw({ workers: [worker(ids.w1, 'Asha', { paid: true }), worker(ids.w2, 'Bhavin')] }))
        const sheet = buildSupervisorSheet(data, '2026-10-07', 'day')
        expect(sheet.rows.find(row => row.machineId === ids.m1)?.paid).toBe(true)
        expect(sheet.rows.find(row => row.machineId === ids.m2)?.paid).toBe(false)
    })
})

describe('buildSupervisorSavePayload', () => {
    const sheet = buildSupervisorSheet(parseSupervisorSheet(raw({
        assignments: [{ id: ids.a1, worker_id: ids.w1, machine_id: ids.m1 }, { id: ids.a2, worker_id: ids.w1, machine_id: ids.m2 }],
    })), '2026-10-07', 'day')

    it('sums a worker’s machines to two decimals and allocates each produced machine', () => {
        const rows = { ...sheet.baseline, [ids.w1]: { ...sheet.baseline[ids.w1], status: 'entered' as const, machineMeters: {
            [contextKey({ machineId: ids.m1, jobId: ids.j1 })]: '10.555',
            [contextKey({ machineId: ids.m2, jobId: ids.j2 })]: '20.1',
        } } }
        const [first] = buildSupervisorSavePayload(sheet, rows)
        expect(first).toMatchObject({
            worker_id: ids.w1, entry_status: 'entered', meters: 30.66,
            machine_records: [{ machine_id: ids.m1, state: 'invalid' }, { machine_id: ids.m2, state: 'entered' }],
        })
    })

    it('records a valid split exactly', () => {
        const rows = { ...sheet.baseline, [ids.w1]: { ...sheet.baseline[ids.w1], status: 'entered' as const, machineMeters: {
            [contextKey({ machineId: ids.m1, jobId: ids.j1 })]: '10.25',
            [contextKey({ machineId: ids.m2, jobId: ids.j2 })]: '0',
        } } }
        const [first] = buildSupervisorSavePayload(sheet, rows)
        expect(first).toEqual({
            worker_id: ids.w1, entry_status: 'entered', meters: 10.25, notes: null,
            machine_records: [{ machine_id: ids.m1, state: 'entered' }, { machine_id: ids.m2, state: 'not_running' }],
            allocations: [{ machine_id: ids.m1, job_id: ids.j1, meters: 10.25 }],
        })
    })

    it('an absent worker has every machine absent and no metres', () => {
        const rows = { ...sheet.baseline, [ids.w1]: { ...sheet.baseline[ids.w1], status: 'absent' as const, machineMeters: {} } }
        const [first] = buildSupervisorSavePayload(sheet, rows)
        expect(first).toMatchObject({ entry_status: 'absent', meters: 0, allocations: [] })
        expect(first.machine_records.map(record => record.state)).toEqual(['absent', 'absent'])
    })

    it('a worker left blank stays pending', () => {
        const [first] = buildSupervisorSavePayload(sheet, sheet.baseline)
        expect(first).toMatchObject({ entry_status: 'blank', meters: null })
        expect(first.machine_records.map(record => record.state)).toEqual(['pending', 'pending'])
    })
})

describe('a loom still assigned to someone who has left', () => {
    // Bhavin's last working day has passed, but Loom 2 is still assigned to him.
    const sheet = buildSupervisorSheet(parseSupervisorSheet(raw({
        workers: [worker(ids.w1, 'Asha'), worker(ids.w2, 'Bhavin', { end_date: '2026-10-05' })],
    })), '2026-10-07', 'day')
    const asha = { ...sheet.baseline[ids.w1], status: 'entered' as const, machineMeters: { [contextKey({ machineId: ids.m1, jobId: ids.j1 })]: '40' } }

    it('still shows the loom with his name, so the supervisor sees why it is open', () => {
        expect(sheet.rows.find(row => row.machineId === ids.m2)).toMatchObject({ workerName: 'Bhavin', unavailable: true })
        expect(sheet.rows.find(row => row.machineId === ids.m1)?.unavailable).toBe(false)
    })

    it('leaves his blank row out of the save, so the rest of the shift saves', () => {
        const payload = buildSupervisorSavePayload(sheet, { ...sheet.baseline, [ids.w1]: asha })
        expect(payload.map(entry => entry.worker_id)).toEqual([ids.w1])
        expect(blockedSupervisorRows(sheet, { ...sheet.baseline, [ids.w1]: asha })).toEqual([])
    })

    it('names his loom when it has a reading, instead of sending it', () => {
        const rows = { ...sheet.baseline, [ids.w1]: asha, [ids.w2]: { ...sheet.baseline[ids.w2], status: 'entered' as const, machineMeters: { [contextKey({ machineId: ids.m2, jobId: ids.j2 })]: '12' } } }
        expect(blockedSupervisorRows(sheet, rows)).toEqual([{ workerName: 'Bhavin', machineLabels: ['Loom 2'] }])
    })
})

describe('summarizeSupervisorSheet', () => {
    it('counts accounted machines, metres and readings to fix', () => {
        const sheet = buildSupervisorSheet(parseSupervisorSheet(raw()), '2026-10-07', 'day')
        const rows = {
            ...sheet.baseline,
            [ids.w1]: { ...sheet.baseline[ids.w1], status: 'entered' as const, machineMeters: { [contextKey({ machineId: ids.m1, jobId: ids.j1 })]: '40' } },
            [ids.w2]: { ...sheet.baseline[ids.w2], status: 'entered' as const, machineMeters: { [contextKey({ machineId: ids.m2, jobId: ids.j2 })]: '4x' } },
        }
        expect(summarizeSupervisorSheet(sheet, rows)).toMatchObject({
            register: { total: 3, accounted: 1, pending: 1, invalid: 1 },
            totalMeters: 40,
            invalidCount: 1,
            recordedCount: 2,
        })
    })
})
