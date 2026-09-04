import 'server-only'

import { readCompleteBaseRows } from '@/lib/base-complete-query'
import { readBaseRevisionEntries } from '@/lib/base-production-audit'
import { readMachineRecords } from '@/lib/base-machine-register'

import { createClient as createServerClient } from '@/lib/supabase/server'
import {
    calculateBaseWorkerPayables,
    reconcileBaseProductionJobStatuses,
    toBaseNumber,
    type BaseDailyProductionStatus,
    type BasePayrollSettlement,
    type BasePayrollSettlementLine,
    type BaseProductionCosting,
    type BaseProductionAllocation,
    type BaseProductionEntry,
    type BaseProductionJob,
    type BaseProductionMachine,
    type BaseProductionBatch,
    type BaseProductionBatchRevision,
    type BaseProductionRevisionSnapshot,
    type BaseProductionWorker,
    type BaseMachineJobContext,
    type BaseWorkerMachineAssignment,
    type BaseWorkerAdvance,
    type BaseWorkerPayable,
    getBasePayrollPeriod,
} from '@/lib/base-production-core'

export type BaseProductionInitialData = {
    orgId: string
    actorId?: string
    factoryName?: string
    today: string
    payrollPeriod: { start: string; end: string }
    costings: BaseProductionCosting[]
    jobs: BaseProductionJob[]
    entries: BaseProductionEntry[]
    workers: BaseProductionWorker[]
    machines: BaseProductionMachine[]
    assignments: BaseWorkerMachineAssignment[]
    machineJobContexts: BaseMachineJobContext[]
    dailyBatches: BaseProductionBatch[]
    batchRevisions: BaseProductionBatchRevision[]
    advances: BaseWorkerAdvance[]
    settlements: BasePayrollSettlement[]
    settlementLines: BasePayrollSettlementLine[]
    payables: BaseWorkerPayable[]
    allocations: BaseProductionAllocation[]
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

function toShift(value: unknown): 'day' | 'night' {
    return value === 'night' ? 'night' : 'day'
}

function toDailyStatus(value: unknown): BaseDailyProductionStatus {
    return value === 'entered' || value === 'zero' || value === 'absent' ? value : 'blank'
}

function toRevisionSnapshot(value: unknown): BaseProductionRevisionSnapshot {
    const snapshot = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return {
        machine_records: readMachineRecords(snapshot.machine_records),
        total_meters: toBaseNumber(typeof snapshot.total_meters === 'string' || typeof snapshot.total_meters === 'number' ? snapshot.total_meters : 0),
        entered_count: Math.max(0, Number(snapshot.entered_count) || 0),
        zero_count: Math.max(0, Number(snapshot.zero_count) || 0),
        absent_count: Math.max(0, Number(snapshot.absent_count) || 0),
        worker_count: Math.max(0, Number(snapshot.worker_count) || 0),
        entries: readBaseRevisionEntries(snapshot.entries),
    }
}

export async function loadBaseProductionInitialData(orgId: string, today: string): Promise<BaseProductionInitialData> {
    const supabase = await createServerClient()
    const payrollPeriod = getBasePayrollPeriod(today)

    const [
        organizationResult,
        costingsResult,
        jobsResult,
        entriesResult,
        workersResult,
        advancesResult,
        settlementsResult,
        settlementLinesResult,
        machinesResult,
        assignmentsResult,
        contextsResult,
        batchesResult,
        batchRevisionsResult,
        dailyEntriesResult,
        dailyAllocationsResult,
    ] = await Promise.all([
        supabase
            .from('organizations')
            .select('name')
            .eq('id', orgId)
            .maybeSingle(),
        readCompleteBaseRows((from, to) => supabase
            .from('estimator_quotes')
            .select('id, quality_label, costing_group_id, version_number, order_quantity_m, production_cost_per_meter, landed_cost_per_meter, quote_price_per_meter, worker_rate_per_m', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .eq('record_kind', 'costing')
            .eq('is_archived', false)
            .order('updated_at', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_jobs')
            .select('id, costing_id, costing_group_id, costing_version, quality_label, target_meters, start_date, due_date, customer_reference, notes, status, worker_rate_per_meter, planned_cost_per_meter, planned_price_per_meter, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('updated_at', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_entries')
            .select('id, job_id, worker_id, production_date, meters, worker_rate_snapshot, notes, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('production_date', { ascending: false })
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_workers')
            .select('id, name, rate_per_meter, shift_availability, is_active', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('is_active', { ascending: false })
            .order('name')
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_worker_advances')
            .select('id, worker_id, amount, recovered_amount, description, status, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_payroll_settlements')
            .select('id, worker_id, period_start, period_end, gross_pay, advance_deducted, net_payout, payment_mode, paid_at, worker_name_snapshot, advance_balance_before, remaining_advance_balance, status, recovery_receipt_complete, reversal:base_payroll_reversals(reason, created_at)', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('period_end', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_payroll_settlement_lines')
            .select('id, settlement_id, worker_id, production_date, shift, machine_id, machine_label, job_id, costing_label, meters, worker_rate_snapshot, gross_pay, source_kind', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('production_date')
            .order('machine_label')
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_machines')
            .select('id, name, machine_type, custom_label, is_active', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('is_active', { ascending: false })
            .order('name')
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_worker_machine_assignments')
            .select('id, worker_id, machine_id, shift, active, effective_from, effective_to', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('active', { ascending: false })
            .order('effective_from', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_machine_job_contexts')
            .select('id, machine_id, job_id, active, effective_from, effective_to', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('active', { ascending: false })
            .order('effective_from', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_batches')
            .select('id, production_date, shift, status, client_request_id, created_at, updated_at, machine_records', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('production_date', { ascending: false })
            .order('shift')
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_batch_revisions')
            .select('id, batch_id, revision_number, change_kind, correction_reason, before_snapshot, after_snapshot, changed_at, changed_by', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('changed_at', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_daily_production_entries')
            .select('id, batch_id, worker_id, entry_status, meters, worker_rate_snapshot, machine_id, job_id, machine_label, job_label, assignment_snapshot, allocation_mode, notes, updated_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('updated_at', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_daily_production_allocations')
            .select('id, entry_id, worker_id, assignment_id, machine_id, job_id, meters, worker_rate_snapshot, machine_label, job_label, assignment_snapshot, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, to)),
    ])

    if (organizationResult.error) {
        throw new Error(`Failed to load Base production organization: ${organizationResult.error.message ?? 'unknown database error'}`)
    }
    const rawCostings = requireRows(costingsResult, 'costings')
    const rawJobs = requireRows(jobsResult, 'jobs')
    const rawEntries = requireRows(entriesResult, 'entries')
    const rawWorkers = requireRows(workersResult, 'workers')
    const rawAdvances = requireRows(advancesResult, 'advances')
    const rawSettlements = requireRows(settlementsResult, 'settlements')
    const rawSettlementLines = requireRows(settlementLinesResult, 'settlement history lines')
    const rawMachines = requireRows(machinesResult, 'machines')
    const rawAssignments = requireRows(assignmentsResult, 'assignments')
    const rawContexts = requireRows(contextsResult, 'machine job contexts')
    const rawBatches = requireRows(batchesResult, 'daily batches')
    const rawBatchRevisions = requireRows(batchRevisionsResult, 'daily batch correction history')
    const rawDailyEntries = requireRows(dailyEntriesResult, 'daily entries')
    const rawDailyAllocations = requireRows(dailyAllocationsResult, 'daily production allocations')

    const costings: BaseProductionCosting[] = rawCostings.map((row) => ({
        id: String(row.id),
        quality_label: String(row.quality_label || 'Unnamed costing'),
        costing_group_id: toStringOrNull(row.costing_group_id),
        version_number: Math.max(1, Number(row.version_number) || 1),
        order_quantity_m: row.order_quantity_m === null || row.order_quantity_m === undefined ? null : toBaseNumber(row.order_quantity_m),
        production_cost_per_meter: toBaseNumber(row.production_cost_per_meter),
        landed_cost_per_meter: toBaseNumber(row.landed_cost_per_meter),
        quote_price_per_meter: toBaseNumber(row.quote_price_per_meter),
        worker_rate_per_meter: toBaseNumber(row.worker_rate_per_m),
    }))

    const storedJobs: BaseProductionJob[] = rawJobs.map((row) => ({
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
        worker_rate_per_meter: toBaseNumber(row.worker_rate_per_meter),
        planned_cost_per_meter: toBaseNumber(row.planned_cost_per_meter),
        planned_price_per_meter: toBaseNumber(row.planned_price_per_meter),
        created_at: String(row.created_at || new Date(0).toISOString()),
    }))

    const legacyEntries: BaseProductionEntry[] = rawEntries.map((row) => ({
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
        shift_availability: row.shift_availability === 'day' || row.shift_availability === 'night'
            ? row.shift_availability
            : 'both',
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

    const settlements: BasePayrollSettlement[] = rawSettlements.map((row) => {
        const reversal = Array.isArray(row.reversal) ? row.reversal[0] : row.reversal
        return {
            id: String(row.id),
            worker_id: String(row.worker_id),
            period_start: toDate(row.period_start, payrollPeriod.start),
            period_end: toDate(row.period_end, today),
            gross_pay: toBaseNumber(row.gross_pay),
            advance_deducted: toBaseNumber(row.advance_deducted),
            net_payout: toBaseNumber(row.net_payout),
            payment_mode: toPaymentMode(row.payment_mode),
            status: row.status === 'reversed' ? 'reversed' : 'paid',
            recovery_receipt_complete: row.recovery_receipt_complete === true,
            reversal_reason: toStringOrNull(reversal?.reason),
            reversed_at: toStringOrNull(reversal?.created_at),
            paid_at: String(row.paid_at || new Date(0).toISOString()),
            worker_name_snapshot: String(row.worker_name_snapshot || 'Worker'),
            advance_balance_before: toBaseNumber(row.advance_balance_before),
            remaining_advance_balance: toBaseNumber(row.remaining_advance_balance),
        }
    })

    const settlementLines: BasePayrollSettlementLine[] = rawSettlementLines.map((row) => ({
        id: String(row.id),
        settlement_id: String(row.settlement_id),
        worker_id: String(row.worker_id),
        production_date: toDate(row.production_date, today),
        shift: row.shift === 'day' || row.shift === 'night' ? row.shift : null,
        machine_id: row.machine_id ? String(row.machine_id) : null,
        machine_label: String(row.machine_label || 'Unassigned machine'),
        job_id: row.job_id ? String(row.job_id) : null,
        costing_label: String(row.costing_label || 'Production job'),
        meters: toBaseNumber(row.meters),
        worker_rate_snapshot: toBaseNumber(row.worker_rate_snapshot),
        gross_pay: toBaseNumber(row.gross_pay),
        source_kind: row.source_kind === 'machine_allocation' || row.source_kind === 'worker_total'
            ? row.source_kind
            : 'legacy_entry',
    }))

    const machines: BaseProductionMachine[] = rawMachines.map((row) => ({
        id: String(row.id),
        name: String(row.name || 'Unnamed machine'),
        machine_type: String(row.machine_type || 'other'),
        custom_label: toStringOrNull(row.custom_label),
        is_active: row.is_active !== false,
    }))

    const assignments: BaseWorkerMachineAssignment[] = rawAssignments.map((row) => ({
        id: String(row.id),
        worker_id: String(row.worker_id),
        machine_id: String(row.machine_id),
        shift: toShift(row.shift),
        active: row.active !== false,
        effective_from: toDate(row.effective_from, today),
        effective_to: toStringOrNull(row.effective_to),
    }))

    const machineJobContexts: BaseMachineJobContext[] = rawContexts.map((row) => ({
        id: String(row.id),
        machine_id: String(row.machine_id),
        job_id: String(row.job_id),
        active: row.active !== false,
        effective_from: toDate(row.effective_from, today),
        effective_to: toStringOrNull(row.effective_to),
    }))

    const dailyBatches: BaseProductionBatch[] = rawBatches.map((row) => ({
        machine_records: readMachineRecords(row.machine_records),
        id: String(row.id),
        production_date: toDate(row.production_date, today),
        shift: toShift(row.shift),
        status: row.status === 'finalized' ? 'finalized' : row.status === 'draft' ? 'draft' : 'saved',
        client_request_id: String(row.client_request_id),
        created_at: String(row.created_at || new Date(0).toISOString()),
        updated_at: String(row.updated_at || row.created_at || new Date(0).toISOString()),
    }))

    const batchRevisions: BaseProductionBatchRevision[] = rawBatchRevisions.map((row) => ({
        id: String(row.id),
        batch_id: String(row.batch_id),
        revision_number: Math.max(1, Number(row.revision_number) || 1),
        change_kind: row.change_kind === 'corrected' ? 'corrected' : 'created',
        correction_reason: toStringOrNull(row.correction_reason),
        before_snapshot: row.before_snapshot ? toRevisionSnapshot(row.before_snapshot) : null,
        after_snapshot: toRevisionSnapshot(row.after_snapshot),
        changed_at: String(row.changed_at || new Date(0).toISOString()),
        changed_by: toStringOrNull(row.changed_by),
    }))

    const batchById = new Map(dailyBatches.map((batch) => [batch.id, batch]))
    const dailyEntries: BaseProductionEntry[] = rawDailyEntries.map((row) => {
        const batch = batchById.get(String(row.batch_id))
        if (!batch) throw new Error('Production history is incomplete. Reload before continuing.')
        const entryStatus = toDailyStatus(row.entry_status)

        return {
            id: String(row.id),
            job_id: row.job_id ? String(row.job_id) : '',
            worker_id: String(row.worker_id),
            production_date: batch?.production_date ?? today,
            meters: toBaseNumber(row.meters),
            worker_rate_snapshot: toBaseNumber(row.worker_rate_snapshot),
            notes: toStringOrNull(row.notes),
            created_at: String(row.updated_at || batch?.updated_at || new Date(0).toISOString()),
            batch_id: String(row.batch_id),
            shift: batch?.shift ?? 'day',
            entry_status: entryStatus,
            allocation_mode: row.allocation_mode === 'machine_breakdown' ? 'machine_breakdown' : 'worker_total',
            machine_id: row.machine_id ? String(row.machine_id) : null,
            machine_label: toStringOrNull(row.machine_label),
            job_label: toStringOrNull(row.job_label),
            assignment_snapshot: row.assignment_snapshot ?? [],
        }
    })

    const allocations: BaseProductionAllocation[] = rawDailyAllocations.map((row) => ({
        id: String(row.id),
        entry_id: String(row.entry_id),
        worker_id: String(row.worker_id),
        assignment_id: row.assignment_id ? String(row.assignment_id) : null,
        machine_id: String(row.machine_id),
        job_id: String(row.job_id),
        meters: toBaseNumber(row.meters),
        worker_rate_snapshot: toBaseNumber(row.worker_rate_snapshot),
        machine_label: String(row.machine_label || 'Machine'),
        job_label: String(row.job_label || 'Production job'),
        assignment_snapshot: row.assignment_snapshot ?? {},
        created_at: String(row.created_at || new Date(0).toISOString()),
    }))

    const entries = [...legacyEntries, ...dailyEntries].sort((a, b) => {
        const dateOrder = b.production_date.localeCompare(a.production_date)
        if (dateOrder !== 0) return dateOrder
        return b.created_at.localeCompare(a.created_at)
    })

    // Recorded output is the authoritative signal that a job has started. Keep
    // legacy rows coherent while the write path repairs the stored status.
    const jobs = reconcileBaseProductionJobStatuses(storedJobs, entries, allocations)

    return {
        orgId,
        factoryName: String(organizationResult.data?.name || 'Weavly'),
        today,
        payrollPeriod,
        costings,
        jobs,
        entries,
        workers,
        machines,
        assignments,
        machineJobContexts,
        dailyBatches,
        batchRevisions,
        advances,
        settlements,
        settlementLines,
        payables: calculateBaseWorkerPayables({ workers, entries, allocations, advances, settlements, periodEnd: today }),
        allocations,
    }
}
