import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    calculateFixedMachineOperatorGross,
    calculateMeterOperatorGross,
    getDefaultPayModeForMachineType,
    getOperatorWorkerTypeForPayMode,
    machineTypeRequiresOwnerConfiguredPayMode,
    normalizeMachineType,
    type OperatorAssignmentPayrollInput,
    type OperatorProductionLogInput,
} from '../lib/machine-operator-payroll'

const root = process.cwd()
const migration = readFileSync(
    join(root, 'supabase/migrations/20260709080948_machine_operator_payroll_v2.sql'),
    'utf8'
)

describe('machine operator payroll helpers', () => {
    it('normalizes machine types and chooses owner-overridable defaults', () => {
        expect(normalizeMachineType('Power Loom')).toBe('power_loom')
        expect(normalizeMachineType('powerloom')).toBe('power_loom')
        expect(normalizeMachineType('WaterJet')).toBe('water_jet')
        expect(normalizeMachineType('Jakards')).toBe('jacquard')
        expect(normalizeMachineType('air_jet')).toBe('other')

        expect(getDefaultPayModeForMachineType('jacquard')).toBe('per_meter')
        expect(getDefaultPayModeForMachineType('power_loom')).toBe('per_meter')
        expect(getDefaultPayModeForMachineType('rapier')).toBe('fixed_monthly')
        expect(getDefaultPayModeForMachineType('water_jet')).toBe('fixed_monthly')
        expect(machineTypeRequiresOwnerConfiguredPayMode('other')).toBe(true)
        expect(getOperatorWorkerTypeForPayMode('fixed_shift')).toBe('fixed_worker')
    })

    it('pays meter operators only from per-meter production snapshots', () => {
        const logs: OperatorProductionLogInput[] = [
            {
                meterWorkerId: 1,
                workerId: 1,
                productionDate: '2026-07-05',
                shift: 'day',
                meters: 1000,
                workerRateSnapshot: 2,
                operatorPayModeSnapshot: 'per_meter',
            },
            {
                meterWorkerId: 1,
                productionDate: '2026-07-06',
                shift: 'day',
                meters: 800,
                operatorRateSnapshot: 1.5,
                operatorPayModeSnapshot: 'per_meter',
            },
            {
                fixedWorkerId: 9,
                productionDate: '2026-07-06',
                shift: 'night',
                meters: 500,
                operatorRateSnapshot: 900,
                operatorPayModeSnapshot: 'fixed_shift',
            },
        ]

        expect(calculateMeterOperatorGross(logs, 1)).toBe(3200)
    })

    it('counts fixed-shift logs once per assignment/date/shift', () => {
        const logs: OperatorProductionLogInput[] = [100, 120, 80, 90].map((meters) => ({
            operatorAssignmentId: 'assignment-imran',
            operatorWorkerType: 'fixed_worker',
            fixedWorkerId: 7,
            productionDate: '2026-07-05',
            shift: 'day',
            meters,
            operatorRateSnapshot: 900,
            operatorPayModeSnapshot: 'fixed_shift',
        }))

        const result = calculateFixedMachineOperatorGross({
            fixedWorker: { id: 7, role: 'helper', monthlySalary: 0 },
            assignments: [],
            productionLogs: logs,
            attendance: [],
            cycleStart: '2026-07-01',
            cycleEnd: '2026-07-31',
        })

        expect(result.gross).toBe(900)
        expect(result.lines[0].quantityLabel).toBe('1 shift')
        expect(result.lines[0].productionMeters).toBe(390)
    })

    it('uses fixed monthly salary/rate and ignores production meters for gross pay', () => {
        const result = calculateFixedMachineOperatorGross({
            fixedWorker: { id: 8, role: 'helper', monthlySalary: 22000 },
            assignments: [{
                id: 'monthly-assignment',
                workerType: 'fixed_worker',
                workerId: 8,
                payMode: 'fixed_monthly',
                rate: 22000,
            }],
            productionLogs: [{
                operatorAssignmentId: 'monthly-assignment',
                operatorWorkerType: 'fixed_worker',
                fixedWorkerId: 8,
                productionDate: '2026-07-05',
                shift: 'day',
                meters: 5000,
                operatorRateSnapshot: 22000,
                operatorPayModeSnapshot: 'fixed_monthly',
            }],
            attendance: [],
            cycleStart: '2026-07-01',
            cycleEnd: '2026-07-31',
        })

        expect(result.gross).toBe(22000)
        expect(result.lines[0].productionMeters).toBeUndefined()
    })

    it('uses fixed-daily attendance first and production dates only as the MVP proxy', () => {
        const assignments: OperatorAssignmentPayrollInput[] = [{
            id: 'daily-assignment',
            workerType: 'fixed_worker',
            workerId: 9,
            payMode: 'fixed_daily',
            rate: 700,
        }]
        const logs: OperatorProductionLogInput[] = [
            {
                operatorAssignmentId: 'daily-assignment',
                operatorWorkerType: 'fixed_worker',
                fixedWorkerId: 9,
                productionDate: '2026-07-05',
                shift: 'day',
                meters: 50,
                operatorRateSnapshot: 700,
                operatorPayModeSnapshot: 'fixed_daily',
            },
            {
                operatorAssignmentId: 'daily-assignment',
                operatorWorkerType: 'fixed_worker',
                fixedWorkerId: 9,
                productionDate: '2026-07-06',
                shift: 'night',
                meters: 60,
                operatorRateSnapshot: 700,
                operatorPayModeSnapshot: 'fixed_daily',
            },
        ]

        const attendanceResult = calculateFixedMachineOperatorGross({
            fixedWorker: { id: 9, role: 'helper', monthlySalary: 21000 },
            assignments,
            productionLogs: logs,
            attendance: [
                { fixedWorkerId: 9, date: '2026-07-05', present: true },
                { fixedWorkerId: 9, date: '2026-07-06', present: true },
                { fixedWorkerId: 9, date: '2026-07-07', present: true },
            ],
            cycleStart: '2026-07-01',
            cycleEnd: '2026-07-31',
        })
        const proxyResult = calculateFixedMachineOperatorGross({
            fixedWorker: { id: 9, role: 'helper', monthlySalary: 21000 },
            assignments,
            productionLogs: logs,
            attendance: [],
            cycleStart: '2026-07-01',
            cycleEnd: '2026-07-31',
        })

        expect(attendanceResult.gross).toBe(2100)
        expect(attendanceResult.usedProductionDateProxy).toBe(false)
        expect(proxyResult.gross).toBe(1400)
        expect(proxyResult.usedProductionDateProxy).toBe(true)
    })
})

describe('machine operator payroll migration', () => {
    it('adds split-table-safe assignment constraints and production snapshots', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.machine_operator_assignments')
        expect(migration).toContain('worker_type TEXT NOT NULL CHECK')
        expect(migration).toContain('machine_operator_assignments_exactly_one_worker')
        expect(migration).toContain('machine_operator_assignments_pay_mode_matches_worker_type')
        expect(migration).toContain('operator_assignment_id UUID REFERENCES public.machine_operator_assignments')
        expect(migration).toContain('operator_pay_mode_snapshot')
        expect(migration).toContain('machine_type_snapshot')
    })

    it('recalculates settlement gross server-side and prevents fixed per-meter logs', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.calculate_operator_payroll_gross')
        expect(migration).toContain('server_calculated_gross')
        expect(migration).toContain('client_gross_ignored')
        expect(migration).toContain("Fixed machine operator logs cannot use per-meter pay mode.")
        expect(migration).toContain("pl.operator_pay_mode_snapshot = 'fixed_shift'")
        expect(migration).toContain('GROUP BY pl.operator_assignment_id, pl.date, pl.shift')
    })
})
