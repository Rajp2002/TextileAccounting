'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getPayrollCycleBounds } from '@/lib/payroll-cycle'
import { normalizeProductionMode, type ProductionMode } from '@/lib/production-mode'
import { formatToSurat, getSuratTodayString } from '@/lib/time'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FactoryTodayData = {
    date: string
    productionMode: ProductionMode

    production: {
        hasLogsToday: boolean
        dayShiftLogged: boolean
        nightShiftLogged: boolean
        totalMetersToday: number
        totalLogsToday: number
        lastLogAt: string | null
    }

    machines: {
        totalActive: number
        assigned: number
        unassigned: number
        maintenance: number
        unassignedMachines: Array<{
            id: string
            name: string
            loomType: string | null
        }>
    }

    workAtRisk: {
        ordersBehindPace: Array<{
            id: string
            partyName: string
            qualityLabel: string | null
            targetMeters: number
            producedMeters: number
            remainingMeters: number
            deadline: string
            riskLevel: 'yellow' | 'red'
        }>
        inactiveMarketRuns: Array<{
            id: string
            label: string
            targetMeters: number
            producedMeters: number
            lastProductionDate: string | null
        }>
    }

    dispatch: {
        soldNotDispatched: Array<{
            saleId: string
            qualityLabel: string
            meters: number
            units: number
            saleValue: number
            saleDate: string
        }>
        pendingReceipts: Array<{
            dispatchId: string
            dispatchNumber: number
            partyName: string
            sentMeters: number
            sentDate: string
            trackingToken: string
            daysPending: number
        }>
        receiptDifferences: Array<{
            discrepancyId: string
            dispatchId: string
            dispatchNumber: number
            partyName: string
            sentMeters: number
            receivedMeters: number
            differenceMeters: number
            direction: 'short' | 'extra'
        }>
    }

    payroll: {
        currentCycleLabel: string
        unsettledWorkerCount: number
        grossWagesSoFar: number
        pendingAdvanceTotal: number
        upcomingSettlementDate: string | null
    }

    actionCounts: {
        critical: number
        warning: number
        info: number
    }

    activationChecklist?: {
        hasEstimate: boolean
        hasQuality: boolean
        hasOrder: boolean
        hasProductionLog: boolean
        hasStockEntry: boolean
        hasMarketRun: boolean
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
    const n = Number(v ?? 0)
    return Number.isFinite(n) ? n : 0
}

function daysBetween(a: string, b: string): number {
    const msPerDay = 1000 * 60 * 60 * 24
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay)
}

function getCurrentMonth(): string {
    return formatToSurat(new Date(), 'yyyy-MM')
}

function hasAnyCount(result: unknown): boolean {
    if (!result || typeof result !== 'object' || !('count' in result)) return false
    const count = (result as { count?: number | null }).count
    return typeof count === 'number' && count > 0
}

// ─── Main Aggregation ─────────────────────────────────────────────────────────

export async function getFactoryToday(): Promise<FactoryTodayData> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const orgId = profile.org_id
    const today = getSuratTodayString()
    const currentMonthStart = `${today.slice(0, 7)}-01`
    const twoDaysAgo = formatToSurat(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

    // ── All queries run concurrently ──────────────────────────────────────────
    const [
        productionRes,
        machinesRes,
        ordersRes,
        marketRunsRes,
        recentProdForRunsRes,
        salesRes,
        dispatchesRes,
        receiptDifferencesRes,
        payrollConfigRes,
        advancesRes,
        settlementsRes,
        hasEstimateRes,
        hasQualityRes,
        hasOrderRes,
        hasProductionRes,
        hasStockRes,
        hasMarketRunRes,
        orgSettingsRes,
    ] = await Promise.all([
        // 1. Production logs today
        supabase
            .from('production_logs')
            .select('id, shift, meters, created_at, date')
            .eq('org_id', orgId)
            .eq('date', today),

        // 2. Active machines with latest assignment info
        supabase
            .from('machines')
            .select('id, name, status, current_order_id, loom_type')
            .eq('org_id', orgId),

        // 3. Active orders with progress summary for pace calculation
        supabase
            .from('order_progress_summary')
            .select('order_id, party_name, quality_label, total_target_meters, produced_meters, deadline, status')
            .eq('org_id', orgId)
            .eq('status', 'active')
            .not('deadline', 'is', null),

        // 4. Active market runs (production or in_godown status)
        supabase
            .from('market_run_summary')
            .select('market_run_id, fabric_label, quality_label, target_meters, meters_produced, status')
            .eq('org_id', orgId)
            .in('status', ['production', 'in_godown']),

        // 5. Most recent production for each market run (to detect inactive runs)
        supabase
            .from('production_logs')
            .select('market_run_id, date')
            .eq('org_id', orgId)
            .gte('date', twoDaysAgo)
            .not('market_run_id', 'is', null),

        // 6. Sold stock not yet dispatched
        supabase
            .from('fabric_stock_sales')
            .select('id, taka_sold, meters_sold, revenue_amount, sale_date, fabric_stock_lots!inner(quality_label)')
            .eq('org_id', orgId)
            .is('dispatch_id', null)
            .order('sale_date', { ascending: false })
            .limit(20),

        // 7. In-transit dispatches (pending receipt)
        supabase
            .from('dispatches')
            .select('id, dispatch_number, qty_meters_sent, dispatched_at, party_name, orders(party_name, tracking_token)')
            .eq('org_id', orgId)
            .eq('status', 'in_transit')
            .order('dispatched_at', { ascending: true })
            .limit(15),

        // 8. Unresolved dispatch receipt differences
        supabase
            .from('stock_discrepancies')
            .select(`
                id,
                dispatch_id,
                expected_meters,
                actual_received_meters,
                actual_dispatched_meters,
                difference_meters,
                discrepancy_type,
                dispatches (
                    dispatch_number,
                    qty_meters_sent,
                    received_meters,
                    qty_meters_received,
                    party_name,
                    orders (
                        party_name
                    )
                )
            `)
            .eq('org_id', orgId)
            .eq('status', 'needs_review')
            .eq('source_reference', 'dispatch_receipt')
            .order('discrepancy_date', { ascending: false })
            .limit(10),

        // 9. Payroll config
        supabase
            .from('payroll_configs')
            .select('cycle_start_day')
            .eq('org_id', orgId)
            .maybeSingle(),

        // 10. Pending advances total
        supabase
            .from('worker_advances')
            .select('amount')
            .eq('org_id', orgId)
            .eq('status', 'pending')
            .is('writeoff_at', null),

        // 11. Unsettled worker count for current cycle
        supabase
            .from('production_logs')
            .select('worker_id')
            .eq('org_id', orgId)
            .gte('date', currentMonthStart)
            .not('worker_id', 'is', null),

        // 12. Activation Checklist: Has Estimate
        (async () => {
            try {
                const { count } = await supabase.from('estimator_quotes').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),
        
        // 13. Activation Checklist: Has Quality
        (async () => {
            try {
                const { count } = await supabase.from('qualities').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        // 14. Activation Checklist: Has Order
        (async () => {
            try {
                const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        // 15. Activation Checklist: Has Production Log
        (async () => {
            try {
                const { count } = await supabase.from('production_logs').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        // 16. Activation Checklist: Has Stock Entry
        (async () => {
            try {
                const { count } = await supabase.from('fabric_stock_lots').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        (async () => {
            try {
                const { count } = await supabase.from('market_runs').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        supabase
            .from('organizations')
            .select('production_mode')
            .eq('id', orgId)
            .maybeSingle(),
    ])

    const hasEstimate = hasAnyCount(hasEstimateRes)
    const hasQuality = hasAnyCount(hasQualityRes)
    const hasOrder = hasAnyCount(hasOrderRes)
    const hasProductionLog = hasAnyCount(hasProductionRes)
    const hasStockEntry = hasAnyCount(hasStockRes)
    const hasMarketRun = hasAnyCount(hasMarketRunRes)
    const productionMode = normalizeProductionMode(orgSettingsRes.data?.production_mode)

    // ── 1. Production ──────────────────────────────────────────────────────────
    const logs = productionRes.data ?? []
    const dayShiftLogged = logs.some((l) => l.shift === 'day')
    const nightShiftLogged = logs.some((l) => l.shift === 'night')
    const totalMetersToday = logs.reduce((s, l) => s + toNum(l.meters), 0)
    const lastLog = logs.length > 0
        ? logs.reduce((latest, l) => (l.created_at > latest.created_at ? l : latest), logs[0])
        : null

    const production: FactoryTodayData['production'] = {
        hasLogsToday: logs.length > 0,
        dayShiftLogged,
        nightShiftLogged,
        totalMetersToday,
        totalLogsToday: logs.length,
        lastLogAt: lastLog?.created_at ?? null,
    }

    // ── 2. Machines ────────────────────────────────────────────────────────────
    const machines = machinesRes.data ?? []
    // "assigned" = active machine with a linked order in current_order_id
    // "unassigned" = active machine with no current_order_id
    // "maintenance" = machine.status === 'maintenance'
    const assigned = machines.filter((m) => m.status === 'active' && m.current_order_id).length
    const maintenance = machines.filter((m) => m.status === 'maintenance').length
    const unassignedMachines = machines
        .filter((m) => m.status === 'active' && !m.current_order_id)
        .map((m) => ({ id: m.id, name: m.name, loomType: m.loom_type ?? null }))

    const machinesData: FactoryTodayData['machines'] = {
        totalActive: machines.filter((m) => m.status === 'active').length,
        assigned,
        unassigned: unassignedMachines.length,
        maintenance,
        unassignedMachines,
    }

    // ── 3. Work at Risk ────────────────────────────────────────────────────────
    const ordersBehindPace = (ordersRes.data ?? [])
        .map((order) => {
            const targetMeters = toNum(order.total_target_meters)
            const producedMeters = toNum(order.produced_meters)
            const remainingMeters = Math.max(0, targetMeters - producedMeters)
            const deadline = order.deadline as string
            const daysUntilDeadline = daysBetween(today, deadline)

            // Already completed
            if (remainingMeters === 0) return null

            // Overdue and not completed — always red
            if (daysUntilDeadline < 0) {
                return {
                    id: order.order_id,
                    partyName: order.party_name,
                    qualityLabel: order.quality_label,
                    targetMeters,
                    producedMeters,
                    remainingMeters,
                    deadline,
                    riskLevel: 'red' as const,
                }
            }

            // Deadline is far out — not yet actionable
            if (daysUntilDeadline > 14) return null

            // Grace period: order has < 3 days of existence (just started) — never penalise new orders
            // We detect this by checking if produced + expected pace ≈ 0
            // Specifically: if producedMeters is 0 and deadline is > 5 days away, give neutral treatment
            if (producedMeters === 0 && daysUntilDeadline > 5) return null

            // Required daily pace to finish on time
            const requiredPace = daysUntilDeadline > 0 ? remainingMeters / daysUntilDeadline : remainingMeters

            // Estimate current pace based on total produced vs total days in the order window
            // We approximate the order window as (target / requiredPace) total days
            // If an order was just created (producedMeters ~ 0), we rely on the grace period above
            const estimatedOrderDays = Math.max(1, daysUntilDeadline + Math.round(producedMeters / Math.max(1, requiredPace)))
            const currentPace = producedMeters / estimatedOrderDays

            if (currentPace < requiredPace * 0.7) {
                return {
                    id: order.order_id,
                    partyName: order.party_name,
                    qualityLabel: order.quality_label,
                    targetMeters,
                    producedMeters,
                    remainingMeters,
                    deadline,
                    riskLevel: 'red' as const,
                }
            } else if (currentPace < requiredPace * 0.9) {
                return {
                    id: order.order_id,
                    partyName: order.party_name,
                    qualityLabel: order.quality_label,
                    targetMeters,
                    producedMeters,
                    remainingMeters,
                    deadline,
                    riskLevel: 'yellow' as const,
                }
            }

            return null
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

    // Inactive market runs — active runs with no production in last 2 days
    const recentRunIds = new Set(
        (recentProdForRunsRes.data ?? []).map((r) => r.market_run_id).filter(Boolean)
    )
    const inactiveMarketRuns = (marketRunsRes.data ?? [])
        .filter((run) => !recentRunIds.has(run.market_run_id))
        .map((run) => ({
            id: run.market_run_id,
            label: (run.fabric_label || run.quality_label) as string,
            targetMeters: toNum(run.target_meters),
            producedMeters: toNum(run.meters_produced),
            lastProductionDate: null,
        }))

    const workAtRisk: FactoryTodayData['workAtRisk'] = {
        ordersBehindPace,
        inactiveMarketRuns,
    }

    // ── 4. Dispatch ────────────────────────────────────────────────────────────
    const soldNotDispatched = (salesRes.data ?? [])
        .filter((s) => {
            // Only include sales with actual meters > 0 (guard against reversed/zero-value entries)
            const raw = s as Record<string, unknown>
            return toNum(raw.meters_sold) > 0 && toNum(raw.taka_sold) > 0
        })
        .map((s) => {
        const raw = s as Record<string, unknown>
        const lot = Array.isArray(raw.fabric_stock_lots) ? raw.fabric_stock_lots[0] : raw.fabric_stock_lots
        const lotTyped = lot as Record<string, unknown> | null
        return {
            saleId: String(raw.id),
            qualityLabel: String(lotTyped?.quality_label || 'Stock'),
            meters: toNum(raw.meters_sold),
            units: toNum(raw.taka_sold),
            saleValue: toNum(raw.revenue_amount),
            saleDate: String(raw.sale_date || today),
        }
    })

    const pendingReceipts = (dispatchesRes.data ?? []).map((d) => {
        const raw = d as Record<string, unknown>
        const order = Array.isArray(raw.orders) ? raw.orders[0] : raw.orders
        const orderTyped = order as Record<string, unknown> | null
        const sentDate = String(raw.dispatched_at || today).split('T')[0]
        return {
            dispatchId: String(raw.id),
            dispatchNumber: toNum(raw.dispatch_number),
            partyName: String(raw.party_name || orderTyped?.party_name || 'Party'),
            sentMeters: toNum(raw.qty_meters_sent),
            sentDate,
            trackingToken: String(orderTyped?.tracking_token || ''),
            daysPending: daysBetween(sentDate, today),
        }
    })

    const receiptDifferences = (receiptDifferencesRes.data ?? []).map((row) => {
        const raw = row as Record<string, unknown>
        const dispatchRow = Array.isArray(raw.dispatches) ? raw.dispatches[0] : raw.dispatches
        const dispatchTyped = dispatchRow as Record<string, unknown> | null
        const orderRow = Array.isArray(dispatchTyped?.orders) ? dispatchTyped?.orders[0] : dispatchTyped?.orders
        const orderTyped = orderRow as Record<string, unknown> | null
        const differenceMeters = toNum(raw.difference_meters)
        const sentMeters = toNum(dispatchTyped?.qty_meters_sent ?? raw.expected_meters)
        const receivedMeters = toNum(dispatchTyped?.received_meters ?? dispatchTyped?.qty_meters_received ?? raw.actual_received_meters ?? raw.actual_dispatched_meters)
        return {
            discrepancyId: String(raw.id),
            dispatchId: String(raw.dispatch_id),
            dispatchNumber: toNum(dispatchTyped?.dispatch_number),
            partyName: String(dispatchTyped?.party_name || orderTyped?.party_name || 'Party'),
            sentMeters,
            receivedMeters,
            differenceMeters,
            direction: differenceMeters < 0 ? 'short' as const : 'extra' as const,
        }
    })

    const dispatch: FactoryTodayData['dispatch'] = { soldNotDispatched, pendingReceipts, receiptDifferences }

    // ── 5. Payroll ─────────────────────────────────────────────────────────────
    const cycleStartDay = payrollConfigRes.data?.cycle_start_day ?? 1
    const currentMonth = getCurrentMonth()
    const bounds = getPayrollCycleBounds(currentMonth, cycleStartDay)

    const pendingAdvanceTotal = (advancesRes.data ?? []).reduce(
        (s, a) => s + toNum((a as Record<string, unknown>).amount),
        0
    )

    // Unique workers with logs this cycle = rough unsettled count
    const uniqueWorkerIds = new Set(
        (settlementsRes.data ?? [])
            .map((r) => (r as Record<string, unknown>).worker_id)
            .filter(Boolean)
    )

    const cycleLabel = `${new Date(bounds.cycle_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(bounds.cycle_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`

    const payroll: FactoryTodayData['payroll'] = {
        currentCycleLabel: cycleLabel,
        unsettledWorkerCount: uniqueWorkerIds.size,
        grossWagesSoFar: 0, // summary-only; full calc lives in payroll page
        pendingAdvanceTotal,
        upcomingSettlementDate: bounds.next_cycle_start,
    }

    // ── 7. Action Counts ───────────────────────────────────────────────────────
    const critical = [
        !production.hasLogsToday ? 1 : 0,
        ordersBehindPace.filter((o) => o.riskLevel === 'red').length,
        soldNotDispatched.length > 0 ? 1 : 0,
        pendingReceipts.filter((r) => r.daysPending > 5).length,
        receiptDifferences.length,
    ].reduce((a, b) => a + b, 0)

    const warning = [
        machinesData.unassigned > 0 ? 1 : 0,
        inactiveMarketRuns.length > 0 ? 1 : 0,
        ordersBehindPace.filter((o) => o.riskLevel === 'yellow').length,
        pendingAdvanceTotal > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0)

    const info = [
        production.hasLogsToday ? 1 : 0,
        machinesData.assigned > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0)

    return {
        date: today,
        productionMode,
        production,
        machines: machinesData,
        workAtRisk,
        dispatch,
        payroll,
        actionCounts: { critical, warning, info },
        activationChecklist: {
            hasEstimate,
            hasQuality,
            hasOrder,
            hasProductionLog,
            hasStockEntry,
            hasMarketRun,
        },
    }
}
