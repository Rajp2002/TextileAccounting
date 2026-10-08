import { describe, expect, it } from 'vitest'
import {
  listRotatableWorkers,
  planShiftRotation,
  type RotationAssignment,
  type RotationWorker,
} from '../lib/base-shift-rotation'

function worker(id: string, shift: RotationWorker['shift_availability'], overrides: Partial<RotationWorker> = {}): RotationWorker {
  return { id, name: `Worker ${id}`, pay_type: 'piece_rate', shift_availability: shift, is_active: true, ...overrides }
}

function loom(workerId: string, machineId: string, shift: 'day' | 'night'): RotationAssignment {
  return { worker_id: workerId, machine_id: machineId, shift }
}

const machineNames = new Map([['m1', 'Loom 1'], ['m2', 'Loom 2'], ['m3', 'Loom 3']])

describe('listRotatableWorkers', () => {
  it('keeps only active piece-rate workers fixed to one shift', () => {
    const rotatable = listRotatableWorkers([
      worker('a', 'day'),
      worker('b', 'night'),
      worker('c', 'both'),
      worker('d', 'day', { pay_type: 'fixed_monthly' }),
      worker('e', 'night', { is_active: false }),
    ])
    expect(rotatable.map(w => w.id)).toEqual(['a', 'b'])
  })
})

describe('planShiftRotation', () => {
  it('moves a day worker to night with every loom they run', () => {
    const plan = planShiftRotation({
      workers: [worker('a', 'day')],
      assignments: [loom('a', 'm1', 'day'), loom('a', 'm2', 'day')],
      machineNames,
      selectedIds: ['a'],
    })
    expect(plan.moves).toEqual([{ workerId: 'a', workerName: 'Worker a', from: 'day', to: 'night', loomCount: 2 }])
    expect(plan.clashes).toEqual([])
  })

  it('lets the day and night workers of one loom swap places', () => {
    const plan = planShiftRotation({
      workers: [worker('a', 'day'), worker('b', 'night')],
      assignments: [loom('a', 'm1', 'day'), loom('b', 'm1', 'night')],
      machineNames,
      selectedIds: ['a', 'b'],
    })
    expect(plan.moves.map(m => [m.workerId, m.from, m.to])).toEqual([['a', 'day', 'night'], ['b', 'night', 'day']])
    expect(plan.clashes).toEqual([])
  })

  it('flags a clash when only one worker of a swapping pair is selected', () => {
    const plan = planShiftRotation({
      workers: [worker('a', 'day'), worker('b', 'night')],
      assignments: [loom('a', 'm1', 'day'), loom('b', 'm1', 'night')],
      machineNames,
      selectedIds: ['a'],
    })
    expect(plan.clashes).toEqual([{
      workerId: 'a',
      workerName: 'Worker a',
      machineId: 'm1',
      machineName: 'Loom 1',
      shift: 'night',
      heldByWorkerId: 'b',
      heldByWorkerName: 'Worker b',
    }])
  })

  it('flags the same clash from the night worker side', () => {
    const plan = planShiftRotation({
      workers: [worker('a', 'day'), worker('b', 'night')],
      assignments: [loom('a', 'm1', 'day'), loom('b', 'm1', 'night')],
      machineNames,
      selectedIds: ['b'],
    })
    expect(plan.clashes.map(c => [c.workerId, c.machineId, c.shift, c.heldByWorkerId])).toEqual([['b', 'm1', 'day', 'a']])
  })

  it('treats a worker who works both shifts as a blocker because they never move', () => {
    const plan = planShiftRotation({
      workers: [worker('a', 'day'), worker('c', 'both')],
      assignments: [loom('a', 'm1', 'day'), loom('c', 'm1', 'night')],
      machineNames,
      selectedIds: ['a'],
    })
    expect(plan.clashes.map(c => c.heldByWorkerId)).toEqual(['c'])
  })

  it('moves a worker with no looms without any clash', () => {
    const plan = planShiftRotation({
      workers: [worker('a', 'night')],
      assignments: [],
      machineNames,
      selectedIds: ['a'],
    })
    expect(plan.moves).toEqual([{ workerId: 'a', workerName: 'Worker a', from: 'night', to: 'day', loomCount: 0 }])
    expect(plan.clashes).toEqual([])
  })

  it('ignores selected ids that cannot be rotated', () => {
    const plan = planShiftRotation({
      workers: [worker('c', 'both'), worker('d', 'day', { pay_type: 'fixed_monthly' })],
      assignments: [loom('c', 'm1', 'day')],
      machineNames,
      selectedIds: ['c', 'd', 'missing'],
    })
    expect(plan.moves).toEqual([])
    expect(plan.clashes).toEqual([])
  })

  it('does not count looms of unselected workers as moving', () => {
    const plan = planShiftRotation({
      workers: [worker('a', 'day'), worker('b', 'night')],
      assignments: [loom('a', 'm1', 'day'), loom('b', 'm2', 'night')],
      machineNames,
      selectedIds: ['b'],
    })
    expect(plan.moves.map(m => [m.workerId, m.loomCount])).toEqual([['b', 1]])
    expect(plan.clashes).toEqual([])
  })
})
