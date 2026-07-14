import 'server-only'

import { getPayrollCycleBounds, getPayrollMonthForDate } from '@/lib/payroll-cycle'
import { isPerfLoggingEnabled } from '@/lib/perf'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSuratTodayString } from '@/lib/time'
import {
    buildFixedWorkerPayroll,
    buildMeterWorkerPayroll,
    type AttendanceRow,
    type FixedWorkerDbRow,
    type MachineOperatorAssignmentRow,
    type MachineRow,
    type MeterWorkerDbRow,
    type OrderRow,
    type PayrollSettlementRow,
    type ProductionLogRow,
    type WorkerAdvanceRow,
} from './read-model'

const OPERATOR_PRODUCTION_LOG_SELECT = 'worker_id, meter_worker_id, fixed_worker_id, operator_assignment_id, operator_worker_type, operator_pay_mode_snapshot, operator_rate_snapshot, machine_id, meters, worker_rate_snapshot, order_id, date, shift'
const LEGACY_PRODUCTION_LOG_SELECT = 'worker_id, machine_id, meters, worker_rate_snapshot, order_id, date, shift'

type QueryError = { code?: string; message?: string } | null

async function tracePayrollQuery<T>(label: string, operation: () => PromiseLike<T>): Promise<T> {
    if (!isPerfLoggingEnabled()) return operation()

    const startedAt = Date.now()
    try {
        const result = await Promise.resolve().then(operation)
        const state = result && typeof result === 'object' && 'error' in result && (result as { error?: unknown }).error
            ? 'error'
            : 'success'
        console.info(`[payroll/query] label=${label} state=${state} duration_ms=${Date.now() - startedAt}`)
        return result
    } catch (error) {
        console.error(`[payroll/query] label=${label} state=throw duration_ms=${Date.now() - startedAt}`, error)
        throw error
    }
}

export type OwnerPayrollInitialData = {
    orgId: string
    factoryName: string
    cycleConfig: {
        cycle_start_day: number
        pay_date_day: number
        pay_reminder_days: number
    }
    selectedMonth: string
    meterWorkers: ReturnType<typeof buildMeterWorkerPayroll>
    fixedWorkers: ReturnType<typeof buildFixedWorkerPayroll>
    operatorSchemaWarning?: string
}

function isMissingOperatorSchemaError(error: QueryError) {
    if (!error) return false
    return error.code === 'PGRST204'
        || error.code === 'PGRST205'
        || /schema cache|could not find the (?:table|column)|column .* does not exist|relation .* does not exist/i.test(error.message ?? '')
}

function requireRows<T>(result: { data: T[] | null; error: QueryError }, label: string): T[] {
    if (result.error) throw new Error(`Failed to load ${label}: ${result.error.message ?? 'unknown database error'}`)
    return result.data ?? []
}

async function loadProductionLogs(
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    orgId: string,
    cycleStart: string,
    cycleEnd: string
) {
    const operatorResult = await tracePayrollQuery('production_logs.operator', () => supabase
        .from('production_logs')
        .select(OPERATOR_PRODUCTION_LOG_SELECT)
        .eq('org_id', orgId)
        .gt('meters', 0)
        .gte('date', cycleStart)
        .lte('date', cycleEnd))

    if (!operatorResult.error) {
        return {
            rows: (operatorResult.data ?? []) as ProductionLogRow[],
            usedLegacyOperatorSchema: false,
        }
    }

    if (!isMissingOperatorSchemaError(operatorResult.error)) {
        throw new Error(`Failed to load payroll production logs: ${operatorResult.error.message}`)
    }

    const legacyResult = await tracePayrollQuery('production_logs.legacy', () => supabase
        .from('production_logs')
        .select(LEGACY_PRODUCTION_LOG_SELECT)
        .eq('org_id', orgId)
        .gt('meters', 0)
        .gte('date', cycleStart)
        .lte('date', cycleEnd))

    if (legacyResult.error) {
        throw new Error(`Failed to load legacy payroll production logs: ${legacyResult.error.message}`)
    }

    return {
        rows: (legacyResult.data ?? []) as ProductionLogRow[],
        usedLegacyOperatorSchema: true,
    }
}

/**
 * Loads the first payroll screen from the server. The read model deliberately
 * shares cycle-wide logs, settlements, and advances across the meter and fixed
 * ledgers, eliminating the duplicated browser bootstrap queries.
 */
export async function loadOwnerPayrollInitialData(
    orgId: string,
    requestedMonth?: string | null
): Promise<OwnerPayrollInitialData> {
    const supabase = await createServerClient()
    const [configResult, organizationResult] = await Promise.all([
        tracePayrollQuery('payroll_config', () => supabase
            .from('payroll_configs')
            .select('cycle_start_day, pay_date_day, pay_reminder_days')
            .eq('org_id', orgId)
            .maybeSingle()),
        tracePayrollQuery('organization', () => supabase
            .from('organizations')
            .select('name')
            .eq('id', orgId)
            .maybeSingle()),
    ])

    if (configResult.error) {
        throw new Error(`Failed to load payroll configuration: ${configResult.error.message}`)
    }
    if (organizationResult.error) {
        throw new Error(`Failed to load payroll organization: ${organizationResult.error.message}`)
    }

    const cycleConfig = {
        cycle_start_day: configResult.data?.cycle_start_day ?? 1,
        pay_date_day: configResult.data?.pay_date_day ?? 10,
        pay_reminder_days: configResult.data?.pay_reminder_days ?? 3,
    }
    const selectedMonth = requestedMonth && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(requestedMonth)
        ? requestedMonth
        : getPayrollMonthForDate(getSuratTodayString(), cycleConfig.cycle_start_day)
    const { cycle_start: cycleStart, cycle_end: cycleEnd } = getPayrollCycleBounds(selectedMonth, cycleConfig.cycle_start_day)

    const [
        productionLogs,
        meterWorkersResult,
        fixedWorkersResult,
        machinesResult,
        settlementsResult,
        advancesResult,
        ordersResult,
        attendanceResult,
        assignmentsResult,
    ] = await Promise.all([
        loadProductionLogs(supabase, orgId, cycleStart, cycleEnd),
        tracePayrollQuery('meter_workers', () => supabase
            .from('workers')
            .select('id, name, whatsapp_number, is_active, pf_esi_enrolled, pf_esi_eligible')
            .eq('org_id', orgId)),
        tracePayrollQuery('fixed_workers', () => supabase
            .from('fixed_workers')
            .select('*')
            .eq('org_id', orgId)
            .order('role')
            .order('name')),
        tracePayrollQuery('machines', () => supabase
            .from('machines')
            .select('id, name')
            .eq('org_id', orgId)),
        tracePayrollQuery('payroll_settlements', () => supabase
            .from('payroll_settlements')
            .select('*')
            .eq('org_id', orgId)
            .in('worker_type', ['meter', 'fixed'])
            .eq('month', selectedMonth)),
        tracePayrollQuery('worker_advances', () => supabase
            .from('worker_advances')
            .select('meter_worker_id, fixed_worker_id, amount')
            .eq('org_id', orgId)
            .eq('status', 'pending')
            .is('writeoff_at', null)),
        tracePayrollQuery('orders', () => supabase
            .from('orders')
            .select('id, party_name, quality_label')
            .eq('org_id', orgId)
            .in('status', ['active', 'completed', 'cancelled'])),
        tracePayrollQuery('attendance', () => supabase
            .from('attendance')
            .select('fixed_worker_id, date, present')
            .eq('org_id', orgId)
            .gte('date', cycleStart)
            .lte('date', cycleEnd)
            .eq('present', true)),
        tracePayrollQuery('machine_operator_assignments', () => supabase
            .from('machine_operator_assignments')
            .select('id, worker_type, fixed_worker_id, pay_mode, rate, effective_from, effective_to')
            .eq('org_id', orgId)),
    ])

    if (assignmentsResult.error && !isMissingOperatorSchemaError(assignmentsResult.error)) {
        throw new Error(`Failed to load machine operator assignments: ${assignmentsResult.error.message}`)
    }

    const meterWorkers = requireRows(meterWorkersResult, 'meter workers') as MeterWorkerDbRow[]
    const fixedWorkers = requireRows(fixedWorkersResult, 'fixed workers') as FixedWorkerDbRow[]
    const machines = requireRows(machinesResult, 'machines') as MachineRow[]
    const settlements = requireRows(settlementsResult, 'payroll settlements') as PayrollSettlementRow[]
    const advances = requireRows(advancesResult, 'worker advances') as WorkerAdvanceRow[]
    const orders = requireRows(ordersResult, 'orders') as OrderRow[]
    const attendance = requireRows(attendanceResult, 'attendance') as AttendanceRow[]
    const assignments = assignmentsResult.error
        ? []
        : (assignmentsResult.data ?? []) as MachineOperatorAssignmentRow[]
    const usedLegacyOperatorSchema = productionLogs.usedLegacyOperatorSchema || Boolean(assignmentsResult.error)

    if (usedLegacyOperatorSchema) {
        console.warn('[owner/payroll] machine-operator payroll schema unavailable; rendering verified legacy payroll data only.')
    }

    return {
        orgId,
        factoryName: organizationResult.data?.name || 'Factory',
        cycleConfig,
        selectedMonth,
        meterWorkers: buildMeterWorkerPayroll({
            logs: productionLogs.rows,
            workers: meterWorkers,
            machines,
            settlements,
            advances,
            orders,
        }),
        fixedWorkers: buildFixedWorkerPayroll({
            workers: fixedWorkers,
            attendanceRows: attendance,
            settlements,
            advances,
            assignments,
            logs: productionLogs.rows,
            month: selectedMonth,
            cycleStartDay: cycleConfig.cycle_start_day,
        }),
        operatorSchemaWarning: usedLegacyOperatorSchema
            ? 'Loom-worker Hisaab fields are unavailable in this environment. Legacy payroll data is shown; do not settle Worker Hisaab until the payroll migration is applied.'
            : undefined,
    }
}
