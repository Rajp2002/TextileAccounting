import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

describe('MASTER-014 assignment concurrency boundary', () => {
    const migration = read('supabase/migrations/20260711134000_atomic_machine_assignment_context.sql')
    const invokerMigration = read('supabase/migrations/20260711180000_assignment_context_security_invoker.sql')
    const supervisorActions = read('app/(dashboard)/supervisor/actions.ts')
    const ownerActions = read('app/(dashboard)/owner/actions.ts')

    it('serializes and atomically writes the complete dated/standing context', () => {
        expect(migration).toContain('upsert_shift_assignment_context_v1')
        expect(migration).toMatch(/FROM public\.machines AS m[\s\S]*FOR UPDATE;/)
        expect(migration).toContain('ON CONFLICT (org_id, date, shift, machine_id)')
        expect(migration).toContain('ON CONFLICT (org_id, machine_id, shift)')
        expect(migration).toContain('SET current_order_id = p_order_id')
        expect(migration).toContain('PERFORM public.assert_org_not_locked(v_org_id)')
        expect(invokerMigration).toContain('SECURITY INVOKER')
        expect(invokerMigration).toContain('FROM PUBLIC, anon')
        expect(invokerMigration).toContain('TO authenticated, service_role')
    })

    it('rejects cross-tenant, inactive-worker, and closed-order context', () => {
        expect(migration).toContain('m.org_id = v_org_id')
        expect(migration).toContain('w.org_id = v_org_id')
        expect(migration).toContain('COALESCE(w.is_active, true)')
        expect(migration).toContain('o.org_id = v_org_id')
        expect(migration).toContain("o.status = 'active'")
    })

    it('routes supervisor writes through only the transactional RPC', () => {
        const start = supervisorActions.indexOf('export async function upsertShiftAssignment')
        const end = supervisorActions.indexOf('export async function copyPreviousShiftAction', start)
        const body = supervisorActions.slice(start, end)

        expect(body).toContain("supabase.rpc('upsert_shift_assignment_context_v1'")
        expect(body).not.toContain(".from('shift_assignments')")
        expect(body).not.toContain(".from('machine_assignments')")
        expect(body).not.toContain(".from('machines')")
    })

    it('does not trust stale owner isExisting state', () => {
        const start = ownerActions.indexOf('export async function updateMachineAssignment')
        const end = ownerActions.indexOf('export async function upsertMachineOperatorAssignment', start)
        const body = ownerActions.slice(start, end)

        expect(body).toContain(".upsert({")
        expect(body).toContain("onConflict: 'org_id,machine_id,shift'")
        expect(body).not.toContain('if (isExisting)')
        expect(body).not.toContain('.update({ worker_id: workerId })')
    })
})
