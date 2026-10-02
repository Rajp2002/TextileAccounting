import { describe, expect, it } from 'vitest'
import type { BaseWorkerMachineAssignment } from '../lib/base-production-core'
import {
    applyPendingAssignmentChanges,
    isAssignmentChangeReflected,
    isPendingAssignmentId,
    type PendingAssignmentChange,
} from '../lib/machine-assignment-optimistic'

const today = '2026-10-02'

function assignment(id: string, workerId: string, machineId: string, overrides: Partial<BaseWorkerMachineAssignment> = {}): BaseWorkerMachineAssignment {
    return { id, worker_id: workerId, machine_id: machineId, shift: 'day', active: true, effective_from: '2026-09-01', effective_to: null, ...overrides }
}

const pairs = (rows: readonly BaseWorkerMachineAssignment[]) => rows.map((row) => `${row.worker_id}:${row.machine_id}:${row.shift}`)

describe('applyPendingAssignmentChanges', () => {
    it('shows a dropped worker on a free machine straight away with a placeholder row', () => {
        const server = [assignment('a1', 'ramu', 'm1')]
        const changes: PendingAssignmentChange[] = [{ id: '1', kind: 'assign', workerId: 'ramu', machineId: 'm2', shift: 'day' }]

        const result = applyPendingAssignmentChanges(server, changes, today)

        expect(pairs(result)).toEqual(['ramu:m1:day', 'ramu:m2:day'])
        const placeholder = result.find((row) => row.machine_id === 'm2')!
        expect(isPendingAssignmentId(placeholder.id)).toBe(true)
        expect(placeholder).toMatchObject({ active: true, effective_from: today, effective_to: null })
    })

    it('replaces the machine’s current worker for that shift only', () => {
        const server = [assignment('a1', 'ramu', 'm1'), assignment('a2', 'rami', 'm1', { shift: 'night' })]
        const changes: PendingAssignmentChange[] = [{ id: '1', kind: 'assign', workerId: 'deep', machineId: 'm1', shift: 'day' }]

        expect(pairs(applyPendingAssignmentChanges(server, changes, today))).toEqual(['rami:m1:night', 'deep:m1:day'])
    })

    it('ignores ended assignments when replacing', () => {
        const ended = assignment('old', 'ramu', 'm1', { effective_to: '2026-09-30' })
        const changes: PendingAssignmentChange[] = [{ id: '1', kind: 'assign', workerId: 'deep', machineId: 'm1', shift: 'day' }]

        expect(pairs(applyPendingAssignmentChanges([ended], changes, today))).toEqual(['ramu:m1:day', 'deep:m1:day'])
    })

    it('hides a removed assignment', () => {
        const server = [assignment('a1', 'ramu', 'm1'), assignment('a2', 'ramu', 'm2')]
        const changes: PendingAssignmentChange[] = [{ id: '1', kind: 'remove', assignmentId: 'a1', machineId: 'm1', shift: 'day' }]

        expect(pairs(applyPendingAssignmentChanges(server, changes, today))).toEqual(['ramu:m2:day'])
    })

    it('applies changes in order, so a later change on the same machine wins', () => {
        const changes: PendingAssignmentChange[] = [
            { id: '1', kind: 'assign', workerId: 'ramu', machineId: 'm1', shift: 'day' },
            { id: '2', kind: 'assign', workerId: 'deep', machineId: 'm1', shift: 'day' },
        ]

        expect(pairs(applyPendingAssignmentChanges([], changes, today))).toEqual(['deep:m1:day'])
    })

    it('returns the server rows untouched once they already show every change', () => {
        const server = [assignment('a1', 'ramu', 'm1')]
        const changes: PendingAssignmentChange[] = [
            { id: '1', kind: 'assign', workerId: 'ramu', machineId: 'm1', shift: 'day' },
            { id: '2', kind: 'remove', assignmentId: 'gone', machineId: 'm9', shift: 'day' },
        ]

        expect(applyPendingAssignmentChanges(server, changes, today)).toBe(server)
    })
})

describe('isAssignmentChangeReflected', () => {
    it('treats an assign as reflected only when that worker holds the machine for that shift today', () => {
        const change: PendingAssignmentChange = { id: '1', kind: 'assign', workerId: 'ramu', machineId: 'm1', shift: 'day' }

        expect(isAssignmentChangeReflected([assignment('a1', 'ramu', 'm1')], change, today)).toBe(true)
        expect(isAssignmentChangeReflected([assignment('a1', 'deep', 'm1')], change, today)).toBe(false)
        expect(isAssignmentChangeReflected([assignment('a1', 'ramu', 'm1', { shift: 'night' })], change, today)).toBe(false)
        expect(isAssignmentChangeReflected([assignment('a1', 'ramu', 'm1', { active: false })], change, today)).toBe(false)
    })

    it('treats a remove as reflected once the assignment is no longer active', () => {
        const change: PendingAssignmentChange = { id: '1', kind: 'remove', assignmentId: 'a1', machineId: 'm1', shift: 'day' }

        expect(isAssignmentChangeReflected([assignment('a1', 'ramu', 'm1')], change, today)).toBe(false)
        expect(isAssignmentChangeReflected([assignment('a1', 'ramu', 'm1', { effective_to: '2026-10-01' })], change, today)).toBe(true)
        expect(isAssignmentChangeReflected([], change, today)).toBe(true)
    })
})
