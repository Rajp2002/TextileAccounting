import 'server-only'

import { createClient as createServerClient } from '@/lib/supabase/server'
import {
    calculateBaseWorkerPayables,
    toBaseNumber,
    type BasePayrollSettlement,
    type BaseProductionCosting,
    type BaseProductionEntry,
    type BaseProductionJob,
    type BaseProductionWorker,
    type BaseWorkerAdvance,
    type BaseWorkerPayable,
    getBasePayrollPeriod,
} from '@/lib/base-production-core'

export type BaseProductionInitialData = {
    orgId: string
    today: string
    payrollPeriod: { start: string; end: string }
    costings: BaseProductionCosting[]
    jobs: BaseProductionJob[]
    entries: BaseProductionEntry[]
    workers: BaseProductionWorker[]
    advances: BaseWorkerAdvance[]
    settlements: BasePayrollSettlement[]
    payables: BaseWorkerPayable[]
}

type QueryError = { message?: string } | null

function requireRows<T>(result: { data: T[] | null; error: QueryError }, label: string): T[] {
    if (result.error) throw new Error(`Failed to load Base production ${label}: ${result.error.message ?? 'unknown database error'}`)
    return result.data ?? []
}

function toDate(value: unknown, fallback: string) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

function toStringOrNull(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null
}

function toStatus(value: unknown): BaseProductionJob['status'] {
    return value === 'active' || value === 'completed' || value === 'cancelled' ? value : 'planned'
}

function toPaymentMode(value: unknown): BasePayrollSettlement['payment_mode'] {
    return value === 'bank_transfer' || value === 'upi' || value === 'cheque' ? value : 'cash'
}

export async function loadBaseProductionInitialData(orgId: string, today: string): Promise<BaseProductionInitialData> {
    const supabase = await createServerClient()
    const payrollPeriod = getBasePayrollPeriod(today)

    const [costingsResult, jobsResult, entriesResult, workersResult, advancesResult, settlementsResult] = await Promise.all([
        supabase
            .from('estimator_quotes')
            .select('id, quality_label, costing_group_id, version_number, production_cost_per_meter, landed_cost_per_meter, quote_price_per_meter')
            .eq('org_id', orgId)
            .eq('record_kind', 'costing')
            .eq('is_archived', false)
            .order('updated_at', { ascending: false }),
        supabase
            .from('base_production_jobs')
            .select('id, costing_id, costing_group_id, costing_version, quality_label, target_meters, start_date, due_date, customer_reference, notes, status, planned_cost_per_meter, planned_price_per_meter, created_at')
            .eq('org_id', orgId)
            .order('updated_at', { ascending: false }),
        supabase
            .from('base_production_entries')
            .select('id, job_id, worker_id, production_date, meters, worker_rate_snapshot, notes, created_at')
            .eq('org_id', orgId)
            .order('production_date', { ascending: false })
            .order('created_at', { ascending: false }),
        supabase
            .from('base_production_workers')
            .select('id, name, rate_per_meter, is_active')
            .eq('org_id', orgId)
            .order('is_active', { ascending: false })
            .order('name'),
        supabase
            .from('base_worker_advances')
            .select('id, worker_id, amount, recovered_amount, description, status, created_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false }),
        supabase
            .from('base_payroll_settlements')
            .select('id, worker_id, period_start, period_end, gross_pay, advance_deducted, net_payout, payment_mode, paid_at')
            .eq('org_id', orgId)
            .order('period_end', { ascending: false }),
    ])

    const rawCostings = requireRows(costingsResult, 'costings')
    const rawJobs = requireRows(jobsResult, 'jobs')
    const rawEntries = requireRows(entriesResult, 'entries')
    const rawWorkers = requireRows(workersResult, 'workers')
    const rawAdvances = requireRows(advancesResult, 'advances')
    const rawSettlements = requireRows(settlementsResult, 'settlements')

    const costings: BaseProductionCosting[] = rawCostings.map((row) => ({
        id: String(row.id),
        quality_label: String(row.quality_label || 'Unnamed costing'),
        costing_group_id: toStringOrNull(row.costing_group_id),
        version_number: Math.max(1, Number(row.version_number) || 1),
        production_cost_per_meter: toBaseNumber(row.production_cost_per_meter),
        landed_cost_per_meter: toBaseNumber(row.landed_cost_per_meter),
        quote_price_per_meter: toBaseNumber(row.quote_price_per_meter),
    }))

    const jobs: BaseProductionJob[] = rawJobs.map((row) => ({
        id: String(row.id),
        costing_id: String(row.costing_id),
        costing_group_id: toStringOrNull(row.costing_group_id),
        costing_version: row.costing_version === null || row.costing_version === undefined
            ? null
            : Math.max(1, Number(row.costing_version) || 1),
        quality_label: String(row.quality_label || 'Unnamed costing'),
        target_meters: toBaseNumber(row.target_meters),
        start_date: toDate(row.start_date, today),
        due_date: toStringOrNull(row.due_date),
        customer_reference: toStringOrNull(row.customer_reference),
        notes: toStringOrNull(row.notes),
        status: toStatus(row.status),
        planned_cost_per_meter: toBaseNumber(row.planned_cost_per_meter),
        planned_price_per_meter: toBaseNumber(row.planned_price_per_meter),
        created_at: String(row.created_at || new Date(0).toISOString()),
    }))

    const entries: BaseProductionEntry[] = rawEntries.map((row) => ({
        id: String(row.id),
        job_id: String(row.job_id),
        worker_id: String(row.worker_id),
        production_date: toDate(row.production_date, today),
        meters: toBaseNumber(row.meters),
        worker_rate_snapshot: toBaseNumber(row.worker_rate_snapshot),
        notes: toStringOrNull(row.notes),
        created_at: String(row.created_at || new Date(0).toISOString()),
    }))

    const workers: BaseProductionWorker[] = rawWorkers.map((row) => ({
        id: String(row.id),
        name: String(row.name || 'Unnamed worker'),
        rate_per_meter: toBaseNumber(row.rate_per_meter),
        is_active: row.is_active !== false,
    }))

    const advances: BaseWorkerAdvance[] = rawAdvances.map((row) => ({
        id: String(row.id),
        worker_id: String(row.worker_id),
        amount: toBaseNumber(row.amount),
        recovered_amount: toBaseNumber(row.recovered_amount),
        description: toStringOrNull(row.description),
        status: row.status === 'deducted' ? 'deducted' : 'pending',
        created_at: String(row.created_at || new Date(0).toISOString()),
    }))

    const settlements: BasePayrollSettlement[] = rawSettlements.map((row) => ({
        id: String(row.id),
        worker_id: String(row.worker_id),
        period_start: toDate(row.period_start, payrollPeriod.start),
        period_end: toDate(row.period_end, today),
        gross_pay: toBaseNumber(row.gross_pay),
        advance_deducted: toBaseNumber(row.advance_deducted),
        net_payout: toBaseNumber(row.net_payout),
        payment_mode: toPaymentMode(row.payment_mode),
        paid_at: String(row.paid_at || new Date(0).toISOString()),
    }))

    return {
        orgId,
        today,
        payrollPeriod,
        costings,
        jobs,
        entries,
        workers,
        advances,
        settlements,
        payables: calculateBaseWorkerPayables({ workers, entries, advances, settlements, periodEnd: today }),
    }
}
