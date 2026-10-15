import { describe, expect, it } from 'vitest'
import { groupMachinesByWorker, orderWorkersByAssignment, workersHeldByOtherShift } from '../lib/machine-assignment-groups'
import { compareMachineLabels } from '../lib/base-machine-register'

const worker = (id: string) => ({ id })
const machine = (id: string) => ({ id })
const ids = (items: Array<{ id: string }>) => items.map((item) => item.id)

describe('groupMachinesByWorker', () => {
    it('puts machines assigned to the same worker next to each other, in the workers order', () => {
        // Machine list order interleaves the two workers: m1(Ramu) m2(Rami) m3(Ramu) m4(Rami).
        const result = groupMachinesByWorker(
            [worker('rami'), worker('ramu')],
            [machine('m1'), machine('m2'), machine('m3'), machine('m4')],
            new Map([['m1', 'ramu'], ['m2', 'rami'], ['m3', 'ramu'], ['m4', 'rami']]),
        )

        expect(result.rows.map((row) => row.worker.id)).toEqual(['rami', 'ramu'])
        expect(ids(result.rows[0].machines)).toEqual(['m2', 'm4'])
        expect(ids(result.rows[1].machines)).toEqual(['m1', 'm3'])
        expect(result.idleWorkers).toEqual([])
        expect(result.ungrouped).toEqual([])
    })

    it('keeps the original machine order inside each worker group', () => {
        const result = groupMachinesByWorker(
            [worker('a')],
            [machine('m3'), machine('m1'), machine('m2')],
            new Map([['m1', 'a'], ['m2', 'a'], ['m3', 'a']]),
        )

        expect(ids(result.rows[0].machines)).toEqual(['m3', 'm1', 'm2'])
    })

    it('rows only hold workers that have machines; the others are idle, each list keeping the workers order', () => {
        const result = groupMachinesByWorker(
            [worker('a'), worker('b'), worker('c'), worker('d')],
            [machine('m1'), machine('m2')],
            new Map([['m1', 'd'], ['m2', 'b']]),
        )

        expect(result.rows.map((row) => row.worker.id)).toEqual(['b', 'd'])
        expect(ids(result.idleWorkers)).toEqual(['a', 'c'])
    })

    it('leaves unassigned machines, and machines of workers not shown, in the ungrouped tail in original order', () => {
        const result = groupMachinesByWorker(
            [worker('a')],
            [machine('free1'), machine('m1'), machine('hidden'), machine('free2')],
            new Map([['m1', 'a'], ['hidden', 'worker-not-visible']]),
        )

        expect(ids(result.rows[0].machines)).toEqual(['m1'])
        expect(ids(result.ungrouped)).toEqual(['free1', 'hidden', 'free2'])
    })

    it('with no assignments every worker is idle and every machine ungrouped, in the original order', () => {
        const result = groupMachinesByWorker(
            [worker('a'), worker('b')],
            [machine('m2'), machine('m1')],
            new Map(),
        )

        expect(result.rows).toEqual([])
        expect(ids(result.idleWorkers)).toEqual(['a', 'b'])
        expect(ids(result.ungrouped)).toEqual(['m2', 'm1'])
    })

    it('places every worker and machine exactly once, and returns nothing extra for empty input', () => {
        const machines = [machine('m1'), machine('m2'), machine('m3')]
        const result = groupMachinesByWorker([worker('a'), worker('b'), worker('c')], machines, new Map([['m2', 'b'], ['m3', 'a']]))
        const placedMachines = [...result.rows.flatMap((row) => row.machines), ...result.ungrouped]
        const placedWorkers = [...result.rows.map((row) => row.worker), ...result.idleWorkers]
        expect(ids(placedMachines).sort()).toEqual(['m1', 'm2', 'm3'])
        expect(ids(placedWorkers).sort()).toEqual(['a', 'b', 'c'])

        expect(groupMachinesByWorker([], [], new Map())).toEqual({ rows: [], idleWorkers: [], ungrouped: [] })
    })

    it('board order: each worker group, then unassigned machines, both numbered 1..N then A-Z', () => {
        // Loader order is by name, so '10' sits before '2' and 'Spare' before '3'.
        const labelled = [
            { id: 'm10', machineLabel: '10' },
            { id: 'mSpare', machineLabel: 'Spare' },
            { id: 'm2', machineLabel: '2' },
            { id: 'm5', machineLabel: '5' },
            { id: 'mAlpha', machineLabel: 'Alpha' },
            { id: 'm1', machineLabel: '1' },
        ]
        const sorted = [...labelled].sort((a, b) => compareMachineLabels({ machineLabel: a.machineLabel, machineId: a.id }, { machineLabel: b.machineLabel, machineId: b.id }))
        const result = groupMachinesByWorker(
            [worker('ramu')],
            sorted,
            new Map([['m5', 'ramu'], ['m10', 'ramu']]),
        )

        expect(ids(result.rows[0].machines)).toEqual(['m5', 'm10'])
        expect(ids(result.ungrouped)).toEqual(['m1', 'm2', 'mAlpha', 'mSpare'])
    })
})

describe('orderWorkersByAssignment', () => {
    const at = (worker_id: string, created_at?: string) => ({ worker_id, created_at })

    it('puts assigned workers first, earliest assignment at the top, then the rest in the order given', () => {
        const result = orderWorkersByAssignment(
            [worker('anil'), worker('bhavin'), worker('chirag'), worker('dinesh')],
            [at('chirag', '2026-10-15T09:00:00Z'), at('bhavin', '2026-10-15T10:00:00Z')],
        )
        expect(ids(result)).toEqual(['chirag', 'bhavin', 'anil', 'dinesh'])
    })

    it('keeps a worker where their oldest assignment puts them when they get more machines', () => {
        const result = orderWorkersByAssignment(
            [worker('anil'), worker('bhavin')],
            [at('anil', '2026-10-15T09:00:00Z'), at('bhavin', '2026-10-15T09:30:00Z'), at('anil', '2026-10-15T11:00:00Z')],
        )
        expect(ids(result)).toEqual(['anil', 'bhavin'])
    })

    it('places a worker just assigned in the browser (no saved time) after saved ones', () => {
        const result = orderWorkersByAssignment(
            [worker('anil'), worker('bhavin'), worker('chirag')],
            [at('bhavin', '2026-10-15T09:00:00Z'), at('anil')],
        )
        expect(ids(result)).toEqual(['bhavin', 'anil', 'chirag'])
    })

    it('keeps the given order when nothing has a time', () => {
        const result = orderWorkersByAssignment([worker('anil'), worker('bhavin')], [at('bhavin'), at('anil')])
        expect(ids(result)).toEqual(['anil', 'bhavin'])
    })

    it('ignores assignments for workers that are not listed', () => {
        expect(ids(orderWorkersByAssignment([worker('anil')], [at('ghost', '2026-10-15T09:00:00Z')]))).toEqual(['anil'])
    })
})

describe('workersHeldByOtherShift', () => {
    it('holds workers placed on the other shift only', () => {
        const held = workersHeldByOtherShift([{ worker_id: 'both' }], [{ worker_id: 'both' }, { worker_id: 'day-only' }])
        expect([...held]).toEqual(['day-only'])
    })

    it('holds nobody when the other shift has no assignments', () => {
        expect(workersHeldByOtherShift([{ worker_id: 'a' }], []).size).toBe(0)
    })
})
