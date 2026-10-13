import { describe, expect, it } from 'vitest'
import { buildMachineCollectionSheet, compareMachineLabels, compareMachineSheetOrder, isSavedMachineReadingProtected, machineReadingState, machineWorkerStatus, readMachineRecords, summarizeMachineRegister } from '../lib/base-machine-register'
import { parseBaseProductionDraft } from '../lib/base-production-draft'
import { baseProductionAuditChanges } from '../lib/base-production-audit'

describe('saved shift reading protection', () => {
    it('protects only the readings a saved shift recorded as entered, stopped or absent', () => {
        expect(isSavedMachineReadingProtected('entered', true)).toBe(true)
        expect(isSavedMachineReadingProtected('not_running', true)).toBe(true)
        expect(isSavedMachineReadingProtected('absent', true)).toBe(true)
    })
    it('keeps a pending or unrecorded reading open to complete the shift', () => {
        expect(isSavedMachineReadingProtected('pending', true)).toBe(false)
        expect(isSavedMachineReadingProtected(undefined, true)).toBe(false)
    })
    it('protects every reading in a shift saved before the register existed', () => {
        expect(isSavedMachineReadingProtected(undefined, false)).toBe(true)
        expect(isSavedMachineReadingProtected('pending', false)).toBe(true)
    })
})

describe('machine register entry semantics', () => {
    it('never converts missing readings to stopped machines', () => {
        expect(machineReadingState('', 'zero')).toBe('pending')
        expect(machineReadingState(undefined, 'entered')).toBe('pending')
        expect(machineReadingState('0', 'entered')).toBe('not_running')
        expect(machineReadingState('0.00', 'zero')).toBe('not_running')
        expect(machineReadingState('120.25', 'entered')).toBe('entered')
        expect(machineReadingState('', 'absent')).toBe('absent')
    })
    it.each(['-1', 'NaN', 'Infinity', '1e3', '0x20', '12,5', '100000.01', '1.001', '12.'])('rejects an invalid reading instead of silently dropping it: %s', value => {
        expect(machineReadingState(value, 'entered')).toBe('invalid')
    })
    it('supports stopped and running machines for the same worker', () => {
        expect(machineWorkerStatus(['0', '125.50', ''])).toBe('entered')
        expect(machineWorkerStatus(['0', ''])).toBe('zero')
        expect(machineWorkerStatus(['', ''])).toBe('blank')
        expect(machineWorkerStatus(['0', '-5'])).toBe('entered')
        expect(summarizeMachineRegister(['not_running', 'entered', 'pending', 'invalid', 'absent'])).toEqual({ total: 5, accounted: 3, pending: 1, invalid: 1, stopped: 1 })
    })
    it('preserves an explicit stop beside a pending reading in local drafts', () => {
        const draft = { version: 1, revision: null, requestId: '11111111-1111-4111-8111-111111111111', reason: '', rows: { worker: { meters: '', status: 'zero', machineMeters: { 'm1:j1': '0', 'm2:j1': '' }, savedUnallocatedMeters: null } } }
        expect(parseBaseProductionDraft(JSON.stringify(draft))).toEqual(draft)
    })
    it('sorts machines naturally and deterministically', () => {
        const machines = ['Loom 10', 'Loom 2', 'Loom 1'].map(machineLabel => ({ machineLabel, machineId: machineLabel }))
        expect(machines.sort(compareMachineLabels).map(machine => machine.machineLabel)).toEqual(['Loom 1', 'Loom 2', 'Loom 10'])
    })
    it('lists machines with a worker for the shift first, then numbered labels before A-Z', () => {
        const machines = [
            { machineLabel: 'test', machineId: 'm-test', workerId: null },
            { machineLabel: 'ZZ Loom 42', machineId: 'm-42', workerId: null },
            { machineLabel: 'ZZ Loom 41', machineId: 'm-41', workerId: 'w-ramesh' },
            { machineLabel: '05', machineId: 'm-05', workerId: 'w-demo' },
            { machineLabel: '10', machineId: 'm-10', workerId: 'w-ramu' },
            { machineLabel: '01', machineId: 'm-01', workerId: 'w-demo' },
            { machineLabel: '02', machineId: 'm-02', workerId: 'w-ramu' },
        ]
        expect(machines.sort(compareMachineSheetOrder).map(machine => machine.machineLabel)).toEqual(['01', '02', '05', '10', 'ZZ Loom 41', 'test', 'ZZ Loom 42'])
    })
    it('prints the supplied full order with blank readings and escaped factory data', () => {
        const html = buildMachineCollectionSheet({ factory: '<script>bad()</script>', date: '3 Sep 2026', shift: 'Day', machines: [{ machineLabel: 'Loom 2', workerName: 'Ramesh', jobLabel: 'Cotton' }, { machineLabel: 'Loom 10', workerName: null, jobLabel: null }] })
        expect(html).not.toContain('<script>')
        expect(html).toContain('&lt;script&gt;')
        expect(html.indexOf('Loom 2')).toBeLessThan(html.indexOf('Loom 10'))
        expect(html).toContain('<td></td><td></td>')
        expect(html).toContain('not the cumulative counter')
        expect(html).not.toContain('₹')
    })
    it('reads durable machine states and includes status-only changes in the audit', () => {
        const record = { machine_id: '11111111-1111-4111-8111-111111111111', worker_id: '22222222-2222-4222-8222-222222222222', machine_label: 'Loom 1', job_id: null, job_label: null, state: 'pending' as const }
        expect(readMachineRecords([record])).toEqual([record])
        expect(readMachineRecords([{ ...record, state: 'made-up' }])).toEqual([])
        const before = { total_meters: 0, entered_count: 0, zero_count: 1, absent_count: 0, worker_count: 1, machine_records: [record] }
        const changes = baseProductionAuditChanges(before, { ...before, machine_records: [{ ...record, state: 'not_running' }] })
        expect(changes).toHaveLength(1)
        expect(changes[0].before?.status).toBe('pending')
        expect(changes[0].after?.status).toBe('not_running')
        expect(changes[0].after?.pay).toBe(0)
    })
})
