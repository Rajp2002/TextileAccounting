import 'server-only'

import type { ProductionTargetOption } from '@/app/(dashboard)/owner/actions'
import type { MachineManagementInitialData } from '@/components/MachineManagement'
import { getMarketRunDisplayStatus } from '@/lib/market-runs'
import { createClient as createServerClient } from '@/lib/supabase/server'

type MachineOperatorAssignmentRow = {
    id: string
    machine_id: string
    worker_type: 'meter_worker' | 'fixed_worker'
    meter_worker_id: number | null
    fixed_worker_id: number | null
    shift: string
    pay_mode: 'per_meter' | 'fixed_monthly' | 'fixed_daily' | 'fixed_shift'
    rate: number | string | null
    machine_type: string | null
}

type LegacyMachineAssignmentRow = {
    machine_id: string
    worker_id: number
    shift: string
}

type ActiveOrderTargetRow = {
    id: string
    party_name: string | null
    quality_label: string | null
    total_target_meters: number | string | null
    deadline: string | null
    status: string | null
    created_at: string | null
    worker_rate_per_m: number | string | null
    market_run_id: string | null
}

type MarketRunTargetRow = {
    market_run_id: string
    fabric_label: string | null
    quality_label: string | null
    target_meters: number | string | null
    worker_rate_per_m: number | string | null
    status: string | null
    order_id: string | null
    order_status: string | null
    total_meters_produced: number | string | null
    meters_in_godown: number | string | null
    total_meters_sold: number | string | null
    created_at: string | null
}

function numericValue(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function isMissingRelationError(error: { message?: string; code?: string } | null) {
    if (!error) return false
    return error.code === 'PGRST205'
        || /Could not find the table|schema cache|relation .* does not exist/i.test(error.message ?? '')
}

function buildProductionTargets(
    orders: ActiveOrderTargetRow[],
    runs: MarketRunTargetRow[]
): ProductionTargetOption[] {
    const runTargets: ProductionTargetOption[] = runs
        .filter((run) => {
            const displayStatus = getMarketRunDisplayStatus({
                storedStatus: run.status ?? 'production',
                producedQuantity: numericValue(run.total_meters_produced),
                availableQuantity: numericValue(run.meters_in_godown),
                soldQuantity: numericValue(run.total_meters_sold),
            })
            return displayStatus === 'production'
        })
        .map((run) => {
            const fabricLabel = String(run.fabric_label || run.quality_label || 'Market Run')
            const qualityLabel = run.quality_label ? String(run.quality_label) : fabricLabel
            const targetMeters = numericValue(run.target_meters)

            return {
                source_type: 'market_run',
                source_id: String(run.market_run_id),
                order_id: run.order_id ? String(run.order_id) : null,
                market_run_id: String(run.market_run_id),
                label: qualityLabel,
                detail_label: `Market Run · ${fabricLabel} · ${targetMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`,
                quality_label: qualityLabel,
                target_meters: targetMeters,
                worker_rate_per_m: run.worker_rate_per_m == null ? null : numericValue(run.worker_rate_per_m),
                deadline: null,
                created_at: run.created_at ? String(run.created_at) : null,
                status: String(run.status ?? 'production'),
            }
        })

    const orderTargets: ProductionTargetOption[] = orders
        .filter((order) => !order.market_run_id)
        .map((order) => {
            const qualityLabel = order.quality_label ? String(order.quality_label) : String(order.party_name || 'Party Order')
            const partyLabel = String(order.party_name || 'Party Order')
            const targetMeters = numericValue(order.total_target_meters)

            return {
                source_type: 'order',
                source_id: String(order.id),
                order_id: String(order.id),
                market_run_id: null,
                label: qualityLabel,
                detail_label: `Party Order · ${partyLabel} · ${targetMeters.toLocaleString('en-IN', { maximumFractionDigits: 0 })}m`,
                quality_label: qualityLabel,
                target_meters: targetMeters,
                worker_rate_per_m: order.worker_rate_per_m == null ? null : numericValue(order.worker_rate_per_m),
                deadline: order.deadline ? String(order.deadline) : null,
                created_at: order.created_at ? String(order.created_at) : null,
                status: String(order.status ?? 'active'),
            }
        })

    return [...runTargets, ...orderTargets]
}

function buildAssignments(
    operatorRows: MachineOperatorAssignmentRow[],
    legacyRows: LegacyMachineAssignmentRow[]
): MachineManagementInitialData['assignments'] {
    const operatorAssignments = operatorRows.map((assignment) => ({
        machine_id: assignment.machine_id,
        shift: assignment.shift as 'day' | 'night',
        worker_id: assignment.worker_type === 'meter_worker' ? assignment.meter_worker_id : null,
        operator_assignment_id: assignment.id,
        operator_worker_type: assignment.worker_type,
        meter_worker_id: assignment.meter_worker_id,
        fixed_worker_id: assignment.fixed_worker_id,
        pay_mode: assignment.pay_mode,
        rate: Number(assignment.rate ?? 0),
        machine_type: assignment.machine_type,
    }))
    const operatorKeys = new Set(operatorAssignments.map((assignment) => `${assignment.machine_id}:${assignment.shift}`))
    const legacyAssignments = legacyRows
        .filter((assignment) => !operatorKeys.has(`${assignment.machine_id}:${assignment.shift}`))
        .map((assignment) => ({
            machine_id: assignment.machine_id,
            worker_id: assignment.worker_id,
            shift: assignment.shift as 'day' | 'night',
            operator_assignment_id: null,
            operator_worker_type: 'meter_worker' as const,
            meter_worker_id: assignment.worker_id,
            fixed_worker_id: null,
            pay_mode: 'per_meter' as const,
            rate: null,
            machine_type: null,
        }))

    return [...operatorAssignments, ...legacyAssignments]
}

export async function loadOwnerMachinesInitialData(orgId: string): Promise<MachineManagementInitialData> {
    const supabase = await createServerClient()

    const [
        machinesRes,
        workersRes,
        fixedWorkersRes,
        ordersRes,
        runsRes,
        operatorAssignmentsRes,
        legacyAssignmentsRes,
    ] = await Promise.all([
        supabase
            .from('machines')
            .select('*, orders(worker_rate_per_m, quality_label, party_name, status, market_run_id)')
            .eq('org_id', orgId)
            .order('name'),
        supabase
            .from('workers')
            .select('id, name, is_active')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('fixed_workers')
            .select('id, name, role, monthly_salary, is_active')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('orders')
            .select('id, party_name, quality_label, total_target_meters, deadline, status, created_at, worker_rate_per_m, market_run_id')
            .eq('org_id', orgId)
            .eq('status', 'active')
            .order('deadline', { ascending: true }),
        supabase
            .from('market_run_summary')
            .select('market_run_id, fabric_label, quality_label, target_meters, worker_rate_per_m, status, order_id, order_status, total_meters_produced, meters_in_godown, total_meters_sold, created_at')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false }),
        supabase
            .from('machine_operator_assignments')
            .select('id, machine_id, worker_type, meter_worker_id, fixed_worker_id, shift, pay_mode, rate, machine_type')
            .eq('org_id', orgId)
            .eq('active', true)
            .is('effective_to', null),
        supabase
            .from('machine_assignments')
            .select('machine_id, worker_id, shift')
            .eq('org_id', orgId),
    ])

    if (machinesRes.error) throw new Error(`Failed to load machines: ${machinesRes.error.message}`)
    if (workersRes.error) throw new Error(`Failed to load meter workers: ${workersRes.error.message}`)
    if (fixedWorkersRes.error) throw new Error(`Failed to load fixed workers: ${fixedWorkersRes.error.message}`)
    if (ordersRes.error) throw new Error(`Failed to load active orders: ${ordersRes.error.message}`)
    if (runsRes.error) throw new Error(`Failed to load market runs: ${runsRes.error.message}`)
    if (operatorAssignmentsRes.error && !isMissingRelationError(operatorAssignmentsRes.error)) {
        throw new Error(`Failed to load operator assignments: ${operatorAssignmentsRes.error.message}`)
    }
    if (legacyAssignmentsRes.error) throw new Error(`Failed to load legacy assignments: ${legacyAssignmentsRes.error.message}`)

    if (operatorAssignmentsRes.error && isMissingRelationError(operatorAssignmentsRes.error)) {
        console.warn('[owner/machines] machine_operator_assignments unavailable; falling back to legacy assignments only.')
    }

    return {
        machines: machinesRes.data ?? [],
        workers: workersRes.data ?? [],
        fixedWorkers: fixedWorkersRes.data ?? [],
        productionTargets: buildProductionTargets(
            (ordersRes.data ?? []) as ActiveOrderTargetRow[],
            (runsRes.data ?? []) as MarketRunTargetRow[]
        ),
        assignments: buildAssignments(
            (operatorAssignmentsRes.error ? [] : operatorAssignmentsRes.data ?? []) as MachineOperatorAssignmentRow[],
            (legacyAssignmentsRes.data ?? []) as LegacyMachineAssignmentRow[]
        ),
    }
}
