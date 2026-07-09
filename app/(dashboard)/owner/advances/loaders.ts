import 'server-only'

import { isPerfLoggingEnabled } from '@/lib/perf'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
    buildPendingAdvanceOverview,
    buildWorkers,
    type FixedWorkerRow,
    type MeterWorkerRow,
    type OwnerAdvancesInitialData,
    type PendingAdvanceRow,
} from './read-model'

type QueryError = { message?: string } | null

async function traceAdvancesQuery<T>(label: string, operation: () => PromiseLike<T>): Promise<T> {
    if (!isPerfLoggingEnabled()) return operation()

    const startedAt = Date.now()
    try {
        const result = await Promise.resolve().then(operation)
        const state = result && typeof result === 'object' && 'error' in result && (result as { error?: unknown }).error
            ? 'error'
            : 'success'
        console.info(`[advances/query] label=${label} state=${state} duration_ms=${Date.now() - startedAt}`)
        return result
    } catch (error) {
        console.error(`[advances/query] label=${label} state=throw duration_ms=${Date.now() - startedAt}`, error)
        throw error
    }
}

function requireRows<T>(result: { data: T[] | null; error: QueryError }, label: string): T[] {
    if (result.error) throw new Error(`Failed to load ${label}: ${result.error.message ?? 'unknown database error'}`)
    return result.data ?? []
}

/**
 * Loads the primary advances screen as one server payload. Selected-worker
 * ledger and earnings lookups remain user-triggered in the client.
 */
export async function loadOwnerAdvancesInitialData(orgId: string): Promise<OwnerAdvancesInitialData> {
    const supabase = await createServerClient()
    const [meterWorkersResult, fixedWorkersResult, pendingAdvancesResult] = await Promise.all([
        traceAdvancesQuery('meter_workers', () => supabase
            .from('workers')
            .select('id, name, whatsapp_number')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('name')),
        traceAdvancesQuery('fixed_workers', () => supabase
            .from('fixed_workers')
            .select('id, name, role, monthly_salary, whatsapp_number')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('name')),
        traceAdvancesQuery('pending_advances', () => supabase
            .from('worker_advances')
            .select('id, amount, description, status, created_at, deducted_at, deducted_in_month, meter_worker_id, fixed_worker_id, workers(name), fixed_workers(name)')
            .eq('org_id', orgId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })),
    ])

    const meterWorkers = requireRows(meterWorkersResult, 'meter workers') as MeterWorkerRow[]
    const fixedWorkers = requireRows(fixedWorkersResult, 'fixed workers') as FixedWorkerRow[]
    const pendingAdvances = requireRows(pendingAdvancesResult, 'pending advances') as PendingAdvanceRow[]

    return {
        orgId,
        workers: buildWorkers(meterWorkers, fixedWorkers),
        pendingAdvances: buildPendingAdvanceOverview(pendingAdvances),
    }
}
