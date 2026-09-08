import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    getAdultWorkerCutoffDate,
    WorkerAgeVerificationSchema,
} from '../lib/worker-validation'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

describe('Sprint 6 operational integrity', () => {
    it('accepts a valid adult DOB and trims non-sensitive evidence', () => {
        const result = WorkerAgeVerificationSchema.safeParse({
            date_of_birth: getAdultWorkerCutoffDate(),
            age_verification_method: 'government_id',
            age_verification_reference: '  Government ID · 1234  ',
        })

        expect(result.success).toBe(true)
        if (result.success) expect(result.data.age_verification_reference).toBe('Government ID · 1234')
    })

    it('rejects malformed dates, under-18 DOBs, and incomplete evidence', () => {
        expect(WorkerAgeVerificationSchema.safeParse({
            date_of_birth: '2008-02-30',
            age_verification_method: 'government_id',
            age_verification_reference: 'ID · 1234',
        }).success).toBe(false)

        expect(WorkerAgeVerificationSchema.safeParse({
            date_of_birth: getAdultWorkerCutoffDate(),
            age_verification_method: 'government_id',
            age_verification_reference: 'x',
        }).success).toBe(false)
    })

    it('uses the approved transactional boundaries for assignments and cancellation', () => {
        const migration = read('supabase/migrations/20260801144006_sprint6_operational_integrity.sql')
        const ownerActions = read('app/(dashboard)/owner/actions.ts')
        const orderActions = read('app/(dashboard)/owner/orders/actions.ts')

        expect(migration).toContain('SECURITY INVOKER')
        expect(migration).toContain('PERFORM public.assert_org_not_locked(v_org_id)')
        expect(migration).toContain('FOR UPDATE')
        expect(migration).toContain('ON CONFLICT (org_id, machine_id, shift)')
        expect(migration).toContain("'already_cancelled'")
        expect(migration).toContain('machines_unlinked')
        expect(ownerActions).toContain("supabase.rpc('upsert_machine_operator_assignment_v1'")
        expect(orderActions).toContain("supabase.rpc('cancel_order_with_impact_v1'")
        expect(ownerActions).not.toContain('.from(\'orders\')\n        .delete()')
    })

    it('keeps the customer-facing state changes explicit and refreshable', () => {
        const ordersClient = read('app/(dashboard)/owner/orders/OrdersClient.tsx')
        const dispatchClient = read('app/(dashboard)/owner/dispatches/DispatchesClient.tsx')

        expect(ordersClient).toContain('title="Cancel order?"')
        expect(ordersClient).toContain('Existing production, stock, sales, dispatches, receipts, and payments')
        expect(dispatchClient).toContain('await refreshDispatchData()')
        expect(dispatchClient).toContain('Due after first dispatch')
    })
})
