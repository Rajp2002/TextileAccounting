import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    buildProtectedLoomActionError,
    findDuplicateLoomName,
    findDuplicateLoomNameInBatch,
    getLoomLifecycleProtectionReasons,
    isDuplicateLoomNameDbError,
    normalizeLoomName,
} from '../lib/master-data-loom-guardrails'

const root = process.cwd()
const migrationPath = 'supabase/migrations/20260704120000_batch_24e_master_data_loom_guardrails.sql'

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('Batch 24E master data loom guardrails', () => {
    const ownerActions = readProjectFile('app/(dashboard)/owner/actions.ts')
    const supervisorActions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
    const machineManagement = readProjectFile('components/MachineManagement.tsx')
    const migration = readProjectFile(migrationPath)

    it('MASTER-002 blocks duplicate loom create/update using trimmed case-folded names', () => {
        expect(normalizeLoomName('  Rapier 1  ')).toBe('rapier 1')

        const existing = [
            { id: 'loom-1', name: 'Rapier 1' },
            { id: 'loom-2', name: 'Waterjet 2' },
        ]

        expect(findDuplicateLoomName('rapier 1', existing)?.id).toBe('loom-1')
        expect(findDuplicateLoomName('  RAPIER 1  ', existing)?.id).toBe('loom-1')
        expect(findDuplicateLoomName('Rapier 1', existing, 'loom-1')).toBeNull()
        expect(findDuplicateLoomName('Rapier 3', existing)).toBeNull()

        expect(ownerActions).toContain('findDuplicateLoomName(trimmedName, existingMachines ?? [])')
        expect(ownerActions).toContain('findDuplicateLoomName(trimmedName, existingMachines ?? [], parsed.data)')
        expect(ownerActions).toContain('buildDuplicateLoomNameError(trimmedName)')
    })

    it('MASTER-002 blocks duplicate bulk-add entries before insert', () => {
        const duplicate = findDuplicateLoomNameInBatch([
            { name: 'Jacquard A' },
            { name: '  jacquard a  ' },
        ])

        expect(duplicate?.normalizedName).toBe('jacquard a')
        expect(findDuplicateLoomNameInBatch([
            { name: 'Jacquard A' },
            { name: 'Jacquard B' },
        ])).toBeNull()

        expect(ownerActions).toContain('findDuplicateLoomNameInBatch')
        expect(ownerActions).toContain('Failed to validate loom names. Please try again.')
    })

    it('MASTER-002 keeps same-type different-name looms and different orgs valid', () => {
        const orgScopedExisting = [{ id: 'loom-1', name: 'Rapier 1' }]

        expect(findDuplicateLoomName('Rapier 2', orgScopedExisting)).toBeNull()
        expect(ownerActions).toContain(".eq('org_id', profile.org_id)")
        expect(migration).toContain('ON public.machines (org_id, lower(btrim(name)))')
    })

    it('MASTER-002 includes a database uniqueness boundary for race safety without applying it', () => {
        expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS machines_org_normalized_name_unique')
        expect(migration).toContain('lower(btrim(name))')
        expect(migration).toContain('Do not apply without QA review')
        expect(isDuplicateLoomNameDbError({
            code: '23505',
            message: 'duplicate key value violates unique constraint "machines_org_normalized_name_unique"',
        })).toBe(true)
    })

    it('MASTER-005 blocks deactivate/delete for active targets, assignments, and history', () => {
        const reasons = getLoomLifecycleProtectionReasons({
            currentOrderId: 'order-1',
            currentOrderStatus: 'active',
            standingAssignmentCount: 1,
            shiftAssignmentCount: 1,
            productionLogCount: 1,
        })

        expect(reasons).toContain('an active production target')
        expect(reasons).toContain('active worker assignments')
        expect(reasons).toContain('dated shift assignment history')
        expect(reasons).toContain('production history')
        expect(buildProtectedLoomActionError('delete', reasons)).toContain('Cannot delete this loom')
        expect(buildProtectedLoomActionError('deactivate', reasons)).toContain('Cannot deactivate this loom')
        expect(buildProtectedLoomActionError('unlink', reasons)).toContain('Cannot unlink this loom')
    })

    it('MASTER-005 preserves unused loom deactivate/delete paths', () => {
        expect(getLoomLifecycleProtectionReasons({
            currentOrderId: null,
            standingAssignmentCount: 0,
            shiftAssignmentCount: 0,
            productionLogCount: 0,
        })).toEqual([])
    })

    it('MASTER-005 routes owner and supervisor delete through protected server actions', () => {
        expect(ownerActions).toContain('export async function deleteMachine(machineId: string)')
        expect(ownerActions).toContain("buildProtectedLoomActionError('delete', reasons)")
        expect(ownerActions).toContain("buildProtectedLoomActionError('deactivate', reasons)")
        expect(ownerActions).toContain(".from('machine_assignments')")
        expect(ownerActions).toContain(".from('shift_assignments')")
        expect(ownerActions).toContain(".from('production_logs')")

        const supervisorDeleteBody = supervisorActions.slice(
            supervisorActions.indexOf('export async function deleteMachineWithCode')
        )
        expect(supervisorDeleteBody).toContain("buildProtectedLoomActionError('delete', reasons)")
        expect(supervisorDeleteBody.indexOf('getMachineLifecycleProtectionInput')).toBeLessThan(
            supervisorDeleteBody.indexOf('validateAndConsumeAccessCode')
        )

        expect(machineManagement).toContain('deleteMachine(id)')
        expect(machineManagement).not.toContain("supabase.from('machines').delete()")
    })

    it('MASTER-005 blocks the null-target unlink path before it can silently deactivate a protected loom', () => {
        const assignTargetBody = ownerActions.slice(
            ownerActions.indexOf('export async function assignMachineProductionTarget'),
            ownerActions.indexOf('export async function assignMachineOrder')
        )

        expect(assignTargetBody).toContain('if (parsedOrderId === null)')
        expect(assignTargetBody).toContain('getMachineLifecycleProtectionInput(supabase, profile.org_id, machineParsed.data)')
        expect(assignTargetBody).toContain("buildProtectedLoomActionError('unlink', reasons)")
        expect(assignTargetBody.indexOf('getMachineLifecycleProtectionInput')).toBeLessThan(
            assignTargetBody.indexOf(".from('machines')")
        )
        expect(assignTargetBody).toContain('current_order_id: parsedOrderId')
        expect(assignTargetBody).not.toContain("parsedOrderId === null ? { status: 'inactive' }")
        expect(assignTargetBody).not.toContain("status: 'inactive'")

        const activeAssignmentReasons = getLoomLifecycleProtectionReasons({
            standingAssignmentCount: 1,
        })
        expect(activeAssignmentReasons).toContain('active worker assignments')
        expect(buildProtectedLoomActionError('unlink', activeAssignmentReasons)).toContain('active worker assignments')

        const historyReasons = getLoomLifecycleProtectionReasons({
            shiftAssignmentCount: 1,
            productionLogCount: 1,
        })
        expect(historyReasons).toContain('dated shift assignment history')
        expect(historyReasons).toContain('production history')
        expect(buildProtectedLoomActionError('unlink', historyReasons)).toContain('production history')
    })

    it('MASTER-014 remains excluded because no partial assignment atomicity claim is added', () => {
        const migrationNames = readdirSync(join(root, 'supabase/migrations'))
            .filter((name) => name.toLowerCase().includes('batch_24e'))

        expect(migrationNames).toEqual(['20260704120000_batch_24e_master_data_loom_guardrails.sql'])
        expect(migration).not.toMatch(/shift_assignments|machine_assignments|advisory lock|transaction/i)
        expect(supervisorActions).toContain("supabase.rpc('replace_shift_production_logs'")
    })
})
