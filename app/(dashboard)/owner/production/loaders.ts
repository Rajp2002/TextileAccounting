import { normalizeWorker, normalizeMachine } from './registers/normalize'
import 'server-only'
import { effectiveDateFor, goLiveOptions, goLivePhase, type BaseGoLivePhase } from '@/lib/base-go-live'

import { readCompleteBaseRows } from '@/lib/base-complete-query'
import { readBaseRevisionEntries } from '@/lib/base-production-audit'
import { readMachineRecords } from '@/lib/base-machine-register'
import type { BaseStaffDayOff } from '@/lib/base-salary'

import { createClient as createServerClient } from '@/lib/supabase/server'
import {
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
    type BaseWorkerIncentive,
    type BasePayrollPeriod,
} from '@/lib/base-production-core'
import {
    type PayrollCycleConfig,
    type PayrollCycleType,
    DEFAULT_MONTHLY_CYCLE_RULE,
    getPeriodContaining,
    validateCycleRule,
} from '@/lib/payroll-cycle-engine'

export type BaseProductionInitialData = {
    orgId: string
    actorId?: string
    factoryName?: string
    today: string
    /** First day recorded in Weavly (organizations.base_go_live_date); null while not scheduled. */
    goLiveDate?: string | null
    goLivePhase?: BaseGoLivePhase
    /** Cycle starts the owner may move go-live to; empty once live. */
    goLiveOptions?: string[]
    /** The later of today and go-live: the date setup changes take effect from. */
    effectiveDate?: string
    /** Legacy stock count dates for the setup readiness list; loaded only while not live. */
    legacyCounts?: { basis: 'unknown' | 'estimated' | 'counted'; basis_at: string | null }[]
    payrollPeriod: { start: string; end: string }
    payrollCycleConfig?: PayrollCycleConfig
    costings: BaseProductionCosting[]
    jobs: BaseProductionJob[]
    entries: BaseProductionEntry[]
    workers: BaseProductionWorker[]
    machines: BaseProductionMachine[]
    assignments: BaseWorkerMachineAssignment[]
    machineJobContexts: BaseMachineJobContext[]
    dailyBatches: BaseProductionBatch[]
    batchRevisions: BaseProductionBatchRevision[]
    incentives?: BaseWorkerIncentive[]
    /** Fixed-salary days marked off; payroll merges them into workers with withStaffDaysOff. */
    staffDaysOff?: BaseStaffDayOff[]
    advances: BaseWorkerAdvance[]
    settlements: BasePayrollSettlement[]
    settlementLines: BasePayrollSettlementLine[]
    payrollPeriods: BasePayrollPeriod[]
    allocations: BaseProductionAllocation[]
    /** Supervisor id → name for "saved by" on revisions; loaded by the page (supervisor-names.ts). */
    supervisorNames?: Record<string, string>
}

type QueryError = { message?: string } | null

// Columns selected from base_payroll_periods and base_payroll_cycle_configs.
type PayrollPeriodRow = {
    id: string
    period_start: string | null
    period_end: string | null
    status: string | null
    total_gross: number | string | null
    total_recovery: number | string | null
    total_net: number | string | null
    total_workers: number | null
    paid_workers: number | null
    settled_at: string | null
    settled_by: string | null
    calculation_snapshot: unknown
    resolved_worker_ids: unknown
    notes: string | null
    created_at: string | null
    updated_at: string | null
}

type PayrollCycleConfigRow = {
    id: string
    org_id: string
    cycle_type: string
    rule: unknown
    effective_from: string
    effective_until: string | null
}

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

export type BaseProductionLoadScope = 'complete' | 'production' | 'payroll'

export async function loadBaseProductionInitialData(
    orgId: string,
    today: string,
    scope: BaseProductionLoadScope = 'complete',
): Promise<BaseProductionInitialData> {
    const supabase = await createServerClient()
    const includeProduction = scope !== 'payroll'
    const includePayroll = scope !== 'production'
    const skippedRows = { data: [] as never[], error: null }

    // Keep the cycle in every scope: period defaults also normalize legacy
    // settlement records used by production's saved-sheet protections.
    const cycleConfigPromise = supabase
        .from('base_payroll_cycle_configs')
        .select('id, org_id, cycle_type, rule, effective_from, effective_until, created_at, updated_at')
        .eq('org_id', orgId)
        .is('effective_until', null)
        .order('created_at', { ascending: false })
        .maybeSingle()

    const [
        organizationResult,
        costingsResult,
        jobsResult,
        entriesResult,
        workersResult,
        advancesResult,
        settlementsResult,
        settlementLinesResult,
        incentivesResult,
        staffDaysOffResult,
        machinesResult,
        assignmentsResult,
        contextsResult,
        batchesResult,
        batchRevisionsResult,
        dailyEntriesResult,
        dailyAllocationsResult,
        payrollPeriodsResult,
        payrollCycleConfigResult,
    ] = await Promise.all([
        supabase
            .from('organizations')
            .select('name, base_go_live_date')
            .eq('id', orgId)
            .maybeSingle(),
        includeProduction ? readCompleteBaseRows((from, to) => supabase
            .from('estimator_quotes')
            .select('id, quality_label, costing_group_id, version_number, order_quantity_m, production_cost_per_meter, landed_cost_per_meter, quote_price_per_meter, worker_rate_per_m', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .eq('record_kind', 'costing')
            .eq('is_archived', false)
            .order('updated_at', { ascending: false })
            .order('id')
            .range(from, to)) : skippedRows,
        includeProduction ? readCompleteBaseRows((from, to) => supabase
            .from('base_production_jobs')
            .select('id, costing_id, costing_group_id, costing_version, quality_label, target_meters, start_date, due_date, customer_reference, notes, status, worker_rate_per_meter, planned_cost_per_meter, planned_price_per_meter, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('updated_at', { ascending: false })
            .order('id')
            .range(from, to)) : skippedRows,
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_entries')
            .select('id, job_id, worker_id, production_date, meters, worker_rate_snapshot, pay_basis_snapshot, piece_earning_state, notes, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('production_date', { ascending: false })
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_workers')
            .select('id, name, rate_per_meter, shift_availability, is_active, pay_type, role, operator_eligible, operator_effective_from, operator_approved_by, operator_approved_at, monthly_salary, salary_effective_from, salary_history, start_date, end_date, updated_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('is_active', { ascending: false })
            .order('name')
            .order('id')
            .range(from, to)),
        includePayroll ? readCompleteBaseRows((from, to) => supabase
            .from('base_worker_advances')
            .select('id, worker_id, amount, recovered_amount, description, status, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, to)) : skippedRows,
        readCompleteBaseRows((from, to) => supabase
            .from('base_payroll_settlements')
            .select('id, worker_id, period_start, period_end, gross_pay, incentive_pay, advance_deducted, net_payout, payment_mode, paid_at, worker_name_snapshot, advance_balance_before, remaining_advance_balance, status, recovery_receipt_complete, reversal:base_payroll_reversals(reason, created_at)', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('period_end', { ascending: false })
            .order('id')
            .range(from, to)),
        includePayroll ? readCompleteBaseRows((from, to) => supabase
            .from('base_payroll_settlement_lines')
            .select('id, settlement_id, worker_id, production_date, shift, machine_id, machine_label, job_id, costing_label, meters, worker_rate_snapshot, gross_pay, source_kind, source_id, earning_snapshot', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('production_date')
            .order('machine_label')
            .order('id')
            .range(from, to)) : skippedRows,
        includePayroll ? readCompleteBaseRows((from, to) => supabase
            .from('base_worker_incentives')
            .select('id, worker_id, service_start, service_end, amount, evidence_reference, status, updated_at, approved_by, approved_at, void_reason', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('created_at', { ascending: false }).order('id').range(from, to)) : skippedRows,
        includePayroll ? readCompleteBaseRows((from, to) => supabase
            .from('base_staff_days_off')
            .select('id, worker_id, off_date', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId).order('off_date').order('id').range(from, to)) : skippedRows,
        includeProduction ? readCompleteBaseRows((from, to) => supabase
            .from('base_production_machines')
            .select('id, name, machine_type, custom_label, is_active', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('is_active', { ascending: false })
            .order('name')
            .order('id')
            .range(from, to)) : skippedRows,
        includeProduction ? readCompleteBaseRows((from, to) => supabase
            .from('base_worker_machine_assignments')
            .select('id, worker_id, machine_id, shift, active, effective_from, effective_to, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('active', { ascending: false })
            .order('effective_from', { ascending: false })
            .order('id')
            .range(from, to)) : skippedRows,
        includeProduction ? readCompleteBaseRows((from, to) => supabase
            .from('base_machine_job_contexts')
            .select('id, machine_id, job_id, active, effective_from, effective_to', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('active', { ascending: false })
            .order('effective_from', { ascending: false })
            .order('id')
            .range(from, to)) : skippedRows,
        readCompleteBaseRows((from, to) => supabase
            .from('base_production_batches')
            .select('id, production_date, shift, status, client_request_id, created_at, updated_at, machine_records', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('production_date', { ascending: false })
            .order('shift')
            .order('id')
            .range(from, to)),
        includeProduction ? readCompleteBaseRows((from, to) => supabase
            .from('base_production_batch_revisions')
            .select('id, batch_id, revision_number, change_kind, correction_reason, before_snapshot, after_snapshot, changed_at, changed_by', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('changed_at', { ascending: false })
            .order('id')
            .range(from, to)) : skippedRows,
        readCompleteBaseRows((from, to) => supabase
            .from('base_daily_production_entries')
            .select('id, batch_id, worker_id, entry_status, meters, worker_rate_snapshot, pay_basis_snapshot, piece_earning_state, machine_id, job_id, machine_label, job_label, assignment_snapshot, allocation_mode, notes, updated_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('updated_at', { ascending: false })
            .order('id')
            .range(from, to)),
        readCompleteBaseRows((from, to) => supabase
            .from('base_daily_production_allocations')
            .select('id, entry_id, worker_id, assignment_id, machine_id, job_id, meters, worker_rate_snapshot, pay_basis_snapshot, piece_earning_state, machine_label, job_label, assignment_snapshot, created_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, to)),
        includePayroll ? readCompleteBaseRows((from, to) => supabase
            .from('base_payroll_periods')
            .select('id, period_start, period_end, status, total_gross, total_recovery, total_net, total_workers, paid_workers, settled_at, settled_by, calculation_snapshot, resolved_worker_ids, notes, created_at, updated_at', from === 0 ? { count: 'exact' } : {})
            .eq('org_id', orgId)
            .order('period_end', { ascending: false })
            .order('id')
            .range(from, to)
        ) : skippedRows,
        cycleConfigPromise,
    ])

    if (organizationResult.error) {
        throw new Error(`Failed to load Base production organization: ${organizationResult.error.message ?? 'unknown database error'}`)
    }
    if (payrollCycleConfigResult.error) {
        throw new Error(`Failed to load Base production payroll cycle: ${payrollCycleConfigResult.error.message ?? 'unknown database error'}`)
    }
    const rawCostings = requireRows(costingsResult, 'costings')
    const rawJobs = requireRows(jobsResult, 'jobs')
    const rawEntries = requireRows(entriesResult, 'entries')
    const rawWorkers = requireRows(workersResult, 'workers')
    const rawAdvances = requireRows(advancesResult, 'advances')
    const rawSettlements = requireRows(settlementsResult, 'settlements')
    const rawSettlementLines = requireRows(settlementLinesResult, 'settlement history lines')
    const rawIncentives = requireRows(incentivesResult, 'incentives')
    // Deploying before 20261014160000 is applied must not take payroll down; there are no days off yet.
    const staffDaysOffErr = staffDaysOffResult.error as { code?: string; message?: string } | null
    const rawStaffDaysOff = (staffDaysOffErr && (staffDaysOffErr.code === 'PGRST205' || staffDaysOffErr.code === '42P01' || staffDaysOffErr.message?.includes('does not exist')))
        ? []
        : requireRows(staffDaysOffResult, 'fixed-salary days off')
    const rawMachines = requireRows(machinesResult, 'machines')
    const rawAssignments = requireRows(assignmentsResult, 'assignments')
    const rawContexts = requireRows(contextsResult, 'machine job contexts')
    const rawBatches = requireRows(batchesResult, 'daily batches')
    const rawBatchRevisions = requireRows(batchRevisionsResult, 'daily batch correction history')
    const rawDailyEntries = requireRows(dailyEntriesResult, 'daily entries')
    const rawDailyAllocations = requireRows(dailyAllocationsResult, 'daily production allocations')
    const payrollPeriodsErr = payrollPeriodsResult.error as { code?: string; message?: string } | null
    const rawPayrollPeriods: PayrollPeriodRow[] = (payrollPeriodsErr && (payrollPeriodsErr.code === 'PGRST205' || payrollPeriodsErr.code === '42P01' || payrollPeriodsErr.message?.includes('does not exist')))
        ? []
        : requireRows(payrollPeriodsResult as { data: PayrollPeriodRow[] | null; error: QueryError }, 'payroll periods')

    const rawCycleConfig = payrollCycleConfigResult?.data as PayrollCycleConfigRow | null
    const payrollCycleConfig: PayrollCycleConfig = rawCycleConfig ? {
        id: String(rawCycleConfig.id),
        orgId: String(rawCycleConfig.org_id),
        cycleType: rawCycleConfig.cycle_type as PayrollCycleType,
        rule: (validateCycleRule(rawCycleConfig.rule).normalizedRule ?? DEFAULT_MONTHLY_CYCLE_RULE),
        effectiveFrom: String(rawCycleConfig.effective_from),
        effectiveUntil: rawCycleConfig.effective_until ? String(rawCycleConfig.effective_until) : null,
    } : {
        cycleType: 'monthly',
        rule: DEFAULT_MONTHLY_CYCLE_RULE,
        effectiveFrom: '2020-01-01',
        effectiveUntil: null,
    }

    const activeCycleRule = payrollCycleConfig.rule
    const activePeriodBounds = getPeriodContaining(today, activeCycleRule)
    const payrollPeriod = { start: activePeriodBounds.start, end: activePeriodBounds.end }

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
        pay_basis_snapshot: row.pay_basis_snapshot === 'fixed_monthly' ? 'fixed_monthly' : 'piece_rate',
        piece_earning_state: row.piece_earning_state === 'inapplicable' ? 'inapplicable' : 'applicable',
        notes: toStringOrNull(row.notes),
        created_at: String(row.created_at || new Date(0).toISOString()),
    }))

    const workers = rawWorkers.map(normalizeWorker)

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
            incentive_pay: toBaseNumber(row.incentive_pay),
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
        source_id: String(row.source_id),
        earning_snapshot: row.earning_snapshot?.calculation_version === 'manual-incentive-v1' ? row.earning_snapshot : null,
        source_kind: row.source_kind === 'machine_allocation' || row.source_kind === 'worker_total' || row.source_kind === 'fixed_salary' || row.source_kind === 'manual_incentive'
            ? row.source_kind
            : 'legacy_entry',
    }))

    const paidIds = new Set(settlements.filter(item => item.status !== 'reversed').map(item => item.id))
    const paidIncentives = new Map(settlementLines.filter(line => line.source_kind === 'manual_incentive' && paidIds.has(line.settlement_id)).map(line => [line.source_id, line.settlement_id]))
    const incentives: BaseWorkerIncentive[] = rawIncentives.map(row => ({
        id: String(row.id), worker_id: String(row.worker_id), service_start: toDate(row.service_start, today),
        service_end: toDate(row.service_end, today), amount: toBaseNumber(row.amount), evidence_reference: String(row.evidence_reference),
        status: row.status === 'approved' || row.status === 'voided' ? row.status : 'draft',
        updated_at: String(row.updated_at), approved_by: toStringOrNull(row.approved_by), approved_at: toStringOrNull(row.approved_at),
        void_reason: toStringOrNull(row.void_reason), settlement_id: paidIncentives.get(String(row.id)) ?? null,
    }))
    const staffDaysOff: BaseStaffDayOff[] = rawStaffDaysOff.map(row => ({ worker_id: String(row.worker_id), off_date: toDate(row.off_date, today) }))
    const machines = rawMachines.map(normalizeMachine)

    const assignments: BaseWorkerMachineAssignment[] = rawAssignments.map((row) => ({
        id: String(row.id),
        worker_id: String(row.worker_id),
        machine_id: String(row.machine_id),
        shift: toShift(row.shift),
        active: row.active !== false,
        effective_from: toDate(row.effective_from, today),
        effective_to: toStringOrNull(row.effective_to),
        ...(row.created_at ? { created_at: String(row.created_at) } : {}),
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
            pay_basis_snapshot: row.pay_basis_snapshot === 'fixed_monthly' ? 'fixed_monthly' : 'piece_rate',
            piece_earning_state: row.piece_earning_state === 'inapplicable' ? 'inapplicable' : 'applicable',
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
        pay_basis_snapshot: row.pay_basis_snapshot === 'fixed_monthly' ? 'fixed_monthly' : 'piece_rate',
        piece_earning_state: row.piece_earning_state === 'inapplicable' ? 'inapplicable' : 'applicable',
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

    const payrollPeriods: BasePayrollPeriod[] = rawPayrollPeriods.map((row) => ({
        id: String(row.id),
        org_id: orgId,
        period_start: toDate(row.period_start, payrollPeriod.start),
        period_end: toDate(row.period_end, payrollPeriod.end),
        status: (row.status === 'settled' || row.status === 'in_progress' || row.status === 'ready_to_complete') ? row.status : 'open',
        total_gross: toBaseNumber(row.total_gross),
        total_recovery: toBaseNumber(row.total_recovery),
        total_net: toBaseNumber(row.total_net),
        total_workers: Math.max(0, Number(row.total_workers) || 0),
        paid_workers: Math.max(0, Number(row.paid_workers) || 0),
        settled_at: row.settled_at ? String(row.settled_at) : null,
        settled_by: row.settled_by ? String(row.settled_by) : null,
        calculation_snapshot: row.calculation_snapshot ?? null,
        resolved_worker_ids: Array.isArray(row.resolved_worker_ids) ? row.resolved_worker_ids.map(String) : [],
        notes: toStringOrNull(row.notes),
        created_at: String(row.created_at || new Date(0).toISOString()),
        updated_at: String(row.updated_at || new Date(0).toISOString()),
    }))

    const goLiveDate = (organizationResult.data?.base_go_live_date as string | null | undefined) ?? null
    // Setup readiness asks for a legacy count near go-live. A failed read only hides that line.
    const legacyCounts = includeProduction && goLivePhase(today, goLiveDate) !== 'live'
        ? ((await supabase.from('legacy_stock').select('basis, basis_at').eq('org_id', orgId)).data ?? []) as BaseProductionInitialData['legacyCounts']
        : undefined
    return {
        orgId,
        factoryName: String(organizationResult.data?.name || 'Weavly'),
        goLiveDate,
        goLivePhase: goLivePhase(today, goLiveDate),
        goLiveOptions: goLivePhase(today, goLiveDate) === 'live' ? [] : goLiveOptions(today, payrollCycleConfig.rule),
        effectiveDate: effectiveDateFor(today, goLiveDate),
        ...(legacyCounts ? { legacyCounts } : {}),
        today,
        payrollPeriod,
        payrollCycleConfig,
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
        incentives,
        staffDaysOff,
        payrollPeriods,
        allocations,
    }
}
