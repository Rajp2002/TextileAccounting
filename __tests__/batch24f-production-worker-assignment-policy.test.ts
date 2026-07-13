import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    buildFactoryTodaySetupChecklist,
} from '../lib/factory-today-checklist'
import {
    evaluateProductionWorkerAssignmentPolicy,
    hasAnyShiftLoomAssignment,
} from '../lib/production-worker-assignment-policy'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function sourceBlock(source: string, startNeedle: string, endNeedle: string) {
    const start = source.indexOf(startNeedle)
    expect(start).toBeGreaterThanOrEqual(0)
    const end = source.indexOf(endNeedle, start + startNeedle.length)
    expect(end).toBeGreaterThan(start)
    return source.slice(start, end)
}

describe('Batch 24F production worker assignment policy', () => {
    const supervisorActions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
    const ownerActions = readProjectFile('app/(dashboard)/owner/actions.ts')
    const machineManagement = readProjectFile('components/MachineManagement.tsx')
    const setupPanel = readProjectFile('components/factory-today/SetupPanel.tsx')
    const bulkLogProductionBody = sourceBlock(
        supervisorActions,
        'export async function bulkLogProduction',
        'export async function packProductionIntoBulkPackages'
    )
    const getShiftSetupDataBody = sourceBlock(
        supervisorActions,
        'export async function getShiftSetupData',
        'export async function upsertShiftAssignment'
    )

    it('PROD-002 allows day-shift production with only a day worker assigned', () => {
        expect(evaluateProductionWorkerAssignmentPolicy({
            machineName: 'Loom 1',
            machineStatus: 'active',
            currentOrderId: 'order-1',
            logOrderId: 'order-1',
            activeOrderStatus: 'active',
            shift: 'day',
            logWorkerId: 101,
            standingAssignments: { day: 101 },
        })).toEqual({ ok: true })

        expect(hasAnyShiftLoomAssignment([
            { machine_id: 'loom-1', shift: 'day', worker_id: 101 },
        ])).toBe(true)

        const checklist = buildFactoryTodaySetupChecklist({
            onboardingComplete: true,
            productionMode: 'order_based',
            machines: [{ id: 'loom-1', current_order_id: 'order-1', orders: { status: 'active' } }],
            machineAssignments: [{ machine_id: 'loom-1', shift: 'day', worker_id: 101 }],
            hasQuality: false,
            hasEstimate: true,
            hasOrder: true,
            hasMarketRun: false,
            hasMeterWorker: true,
            hasFixedWorker: false,
            hasSupervisor: true,
            payrollConfig: { cycle_start_day: 1, pay_date_day: 10, pay_reminder_days: 5 },
            hasPlan: true,
        })

        expect(checklist.hasLoomAssignment).toBe(true)
    })

    it('PROD-002 blocks night-shift production without a night worker and keeps the message actionable', () => {
        const result = evaluateProductionWorkerAssignmentPolicy({
            machineName: 'Loom 1',
            machineStatus: 'active',
            currentOrderId: 'order-1',
            logOrderId: 'order-1',
            activeOrderStatus: 'active',
            shift: 'night',
            logWorkerId: null,
            standingAssignments: { day: 101 },
        })

        expect(result).toMatchObject({ ok: false, code: 'SHIFT_WORKER_REQUIRED' })
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.message).toContain('needs a night worker assigned')
            expect(result.message).toContain('Day-shift production can still be logged')
            expect(result.message).toContain('assign a night worker before saving night production')
        }
    })

    it('PROD-002 lets the server selected-shift policy produce the missing-worker error', () => {
        expect(bulkLogProductionBody).toContain('const nonWorkerErrors = validation.errors.filter')
        expect(bulkLogProductionBody).toContain('error !== VALIDATION_MESSAGES.WORKER_REQUIRED')
        expect(bulkLogProductionBody).toContain('entry.meters > 0 && !entry.worker_id && nonWorkerErrors.length === 0')
        expect(bulkLogProductionBody).toContain('continue')
        expect(bulkLogProductionBody.indexOf('const nonWorkerErrors = validation.errors.filter')).toBeLessThan(
            bulkLogProductionBody.indexOf('evaluateProductionWorkerAssignmentPolicy')
        )
    })

    it('PROD-002 removes both-shift blockers from setup, activation, and selected-shift data loading', () => {
        expect(getShiftSetupDataBody).toContain('Boolean(machine.current_order_id && activeOrderIds.has(machine.current_order_id))')
        expect(getShiftSetupDataBody).toContain('worker_id: workerId,')
        expect(getShiftSetupDataBody).not.toContain('standingAssignments?.day &&')
        expect(getShiftSetupDataBody).not.toContain('standingAssignments?.night')

        expect(ownerActions).toContain('Assign at least one day or night worker before activating this loom.')
        expect(machineManagement).toContain('Assign at least one day or night worker before activating this loom.')
        expect(machineManagement).toContain('const hasAnyShiftAssignment = !!dayAssignment || !!nightAssignment')
        expect(setupPanel).toContain('Select at least one day or night worker on a loom before production.')
        expect(setupPanel).toContain('selected shift has an assigned worker')
    })

    it('PROD-004 rejects substitute-worker mismatch with an explicit owner-remapping message', () => {
        const result = evaluateProductionWorkerAssignmentPolicy({
            machineName: 'Loom 2',
            machineStatus: 'active',
            currentOrderId: 'order-2',
            logOrderId: 'order-2',
            activeOrderStatus: 'active',
            shift: 'day',
            logWorkerId: 202,
            standingAssignments: { day: 201, night: 203 },
        })

        expect(result).toMatchObject({ ok: false, code: 'SUBSTITUTE_REASSIGNMENT_REQUIRED' })
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.message).toContain('Reassign the day worker before logging a substitute')
            expect(result.message).toContain('production, payroll, and loom accountability')
        }
    })

    it('PROD-004 keeps production attributable only to the selected standing shift worker', () => {
        expect(bulkLogProductionBody).toContain('evaluateProductionWorkerAssignmentPolicy')
        expect(bulkLogProductionBody).toContain('return { error: policyResult.code, message: policyResult.message }')
        expect(bulkLogProductionBody).not.toContain('expectedShiftWorkerId !== log.worker_id')
        expect(bulkLogProductionBody).not.toContain('!standingAssignments?.day ||')
        expect(bulkLogProductionBody).not.toContain('!standingAssignments?.night ||')
        expect(supervisorActions).not.toContain('substitute_worker_id')
        expect(supervisorActions).not.toContain('actual_worker_id')
        expect(supervisorActions).not.toContain('assigned_worker_id')
    })

    it('MASTER-011 treats the persisted dated worker as the effective worker for that one shift', () => {
        expect(getShiftSetupDataBody).toContain('const datedWorkerId = existing?.worker_id')
        expect(getShiftSetupDataBody).toContain('const workerId = datedWorkerId ?? matchingOperatorAssignment?.worker_id')
        expect(getShiftSetupDataBody).toContain('const datedRate = existing?.rate_per_m == null ? null : Number(existing.rate_per_m)')
        expect(getShiftSetupDataBody).toContain('operator_rate: datedRate')
        expect(getShiftSetupDataBody).toContain('worker_id: operatorPayload.worker_id')

        expect(bulkLogProductionBody).toContain(".from('shift_assignments')")
        expect(bulkLogProductionBody).toContain(".eq('date', logDate)")
        expect(bulkLogProductionBody).toContain(".eq('shift', logShift)")
        expect(bulkLogProductionBody).toContain('current[logShift] = assignment.worker_id')
        expect(bulkLogProductionBody.indexOf('current[logShift] = assignment.worker_id')).toBeLessThan(
            bulkLogProductionBody.indexOf('evaluateProductionWorkerAssignmentPolicy')
        )
        expect(bulkLogProductionBody).toContain(".select('id, start_date')")
        expect(bulkLogProductionBody).toContain("(orders ?? []).map((o) => [o.id, o.start_date])")
        expect(bulkLogProductionBody).not.toContain("o.created_at.split('T')[0]")
    })

    it('does not add migration or RPC work for Batch 24F', () => {
        const migrationNames = readdirSync(join(root, 'supabase/migrations'))
        expect(migrationNames.some((name) => name.toLowerCase().includes('batch_24f'))).toBe(false)
        expect(supervisorActions).toContain("supabase.rpc('replace_shift_production_logs'")
        expect(supervisorActions).not.toContain('CREATE OR REPLACE FUNCTION')
    })
})
