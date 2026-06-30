'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'
import { getPayrollCycleDetails, getPayrollCycleStatus, getPayrollMonthForDate, getPreviousPayrollMonth } from '@/lib/payroll-cycle'
import { normalizeProductionMode, hasExplicitProductionMode, type ProductionMode } from '@/lib/production-mode'
import { formatToSurat, getSuratTodayString } from '@/lib/time'
import { formatDateOnly } from '@/lib/format'
import { calculatePieceRateGrossWages } from '@/lib/payroll-read-models'

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
            daysPending: number
        }>
    }

    commercial: {
        blockingIssues: Array<{
            id: string
            partyName: string
            qualityLabel: string
            balanceAmount: number
            dueDate: string | null
            reason: 'due_or_overdue' | 'payment_mismatch'
        }>
        dueOrOverdueCount: number
        paymentMismatchCount: number
        totalDueOrOverdue: number
    }

    payroll: {
        currentCycleMonth: string
        currentCycleLabel: string
        payDate: string
        payWindowStatus: 'not_started' | 'in_progress' | 'scheduled' | 'approaching' | 'due_today' | 'overdue'
        isPayWindowOpen: boolean
        daysUntilPayDate: number
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
        hasDispatch: boolean
        hasCommercial: boolean
    }

    setupChecklist: {
        hasProductionMode: boolean
        hasMachine: boolean
        hasLoomAssignment: boolean
        hasLoomTarget: boolean
        hasQuality: boolean
        hasMeterWorker: boolean
        hasFixedWorker: boolean
        hasSupervisor: boolean
        hasPayrollConfig: boolean
        hasPlan: boolean
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
        payrollConfigRes,
        advancesRes,
        hasEstimateRes,
        hasQualityRes,
        hasOrderRes,
        hasProductionRes,
        hasStockRes,
        hasMarketRunRes,
        orgSettingsRes,
        hasFixedWorkerRes,
        hasSupervisorRes,
        subscriptionRes,
        hasMeterWorkerRes,
        machineAssignmentsRes,
        hasDispatchRes,
        hasCommercialRes,
        commercialReceivablesRes,
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
            .select('order_id, party_name, quality_label, total_target_meters, total_meters_produced, deadline, status')
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
            .select('id, taka_sold, meters_sold, pending_dispatch_meters, revenue_amount, sale_date, fabric_stock_lots!inner(quality_label)')
            .eq('org_id', orgId)
            .gt('pending_dispatch_meters', 0)
            .order('sale_date', { ascending: false })
            .limit(20),

        // 7. In-transit dispatches and unresolved receipt differences
        supabase
            .from('dispatches')
            .select('id, dispatch_number, qty_meters_sent, dispatched_at, party_name, receipt_status, orders(party_name)')
            .eq('org_id', orgId)
            .or('status.eq.in_transit,receipt_status.eq.difference_reported')
            .order('dispatched_at', { ascending: true })
            .limit(15),

        // 9. Payroll config
        supabase
            .from('payroll_configs')
            .select('cycle_start_day, pay_date_day, pay_reminder_days')
            .eq('org_id', orgId)
            .maybeSingle(),

        // 10. Pending advances total
        supabase
            .from('worker_advances')
            .select('amount')
            .eq('org_id', orgId)
            .eq('status', 'pending')
            .is('writeoff_at', null),

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
            .select('production_mode, onboarding_complete')
            .eq('id', orgId)
            .maybeSingle(),

        // 17. Setup Checklist: Has Fixed Worker
        (async () => {
            try {
                const { count } = await supabase.from('fixed_workers').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        // 18. Setup Checklist: Has Supervisor
        (async () => {
            try {
                const admin = createAdminClient()
                const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('role', 'supervisor').limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        // 19. Setup Checklist: Has Plan (subscription)
        supabase.from('org_subscriptions')
            .select('status, plan_tier, current_end')
            .eq('org_id', orgId)
            .in('status', ['active', 'authenticated'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

        // 20. Setup Checklist: Has Meter Worker
        (async () => {
            try {
                const { count } = await supabase.from('workers').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        (async () => {
            try {
                const { data } = await supabase
                    .from('machine_assignments')
                    .select('machine_id, shift')
                    .eq('org_id', orgId)
                    .in('shift', ['day', 'night'])
                return { data: data ?? [] }
            } catch {
                return { data: [] }
            }
        })(),

        (async () => {
            try {
                const { count } = await supabase.from('dispatches').select('id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        (async () => {
            try {
                const { count } = await supabase.from('commercial_profit_entries').select('source_id', { count: 'exact', head: true }).eq('org_id', orgId).limit(1)
                return { count }
            } catch {
                return { count: 0 }
            }
        })(),

        (async () => {
            try {
                const { data } = await supabase
                    .from('commercial_receivables')
                    .select('id, party_name, quality_label, total_amount, received_amount, balance_amount, payment_status, due_date')
                    .eq('org_id', orgId)
                    .order('due_date', { ascending: true })
                    .limit(500)
                return { data: data ?? [] }
            } catch {
                return { data: [] }
            }
        })(),
    ])

    const hasEstimate = hasAnyCount(hasEstimateRes)
    const hasQuality = hasAnyCount(hasQualityRes)
    const hasOrder = hasAnyCount(hasOrderRes)
    const hasProductionLog = hasAnyCount(hasProductionRes)
    const hasStockEntry = hasAnyCount(hasStockRes)
    const hasMarketRun = hasAnyCount(hasMarketRunRes)
    const hasFixedWorker = hasAnyCount(hasFixedWorkerRes)
    const hasSupervisor = hasAnyCount(hasSupervisorRes)
    const hasMeterWorker = hasAnyCount(hasMeterWorkerRes)
    const hasDispatch = hasAnyCount(hasDispatchRes)
    const hasCommercial = hasAnyCount(hasCommercialRes)
    const productionMode = normalizeProductionMode(orgSettingsRes.data?.production_mode)

    // Setup checklist: production mode check mirrors onboarding logic
    const setupHasProductionMode = orgSettingsRes.data?.onboarding_complete === true
        ? true
        : hasExplicitProductionMode(orgSettingsRes.data?.production_mode)
    const setupHasMachine = (machinesRes.data ?? []).length > 0
    const setupHasLoomTarget = (machinesRes.data ?? []).some((machine) => !!machine.current_order_id)
    const assignmentsByMachine = new Map<string, Set<string>>()
    for (const assignment of machineAssignmentsRes.data ?? []) {
        const machineId = String((assignment as Record<string, unknown>).machine_id ?? '')
        const shift = String((assignment as Record<string, unknown>).shift ?? '')
        if (!machineId) continue
        const shifts = assignmentsByMachine.get(machineId) ?? new Set<string>()
        shifts.add(shift)
        assignmentsByMachine.set(machineId, shifts)
    }
    const setupHasLoomAssignment = Array.from(assignmentsByMachine.values())
        .some((shifts) => shifts.has('day') && shifts.has('night'))
    const setupHasPayrollConfig = !!payrollConfigRes.data

    // Check subscription validity
    let setupHasPlan = false
    if (subscriptionRes.data) {
        const sub = subscriptionRes.data
        if (sub.current_end) {
            setupHasPlan = new Date(sub.current_end).getTime() > Date.now()
        } else {
            setupHasPlan = true
        }
    }

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
            const producedMeters = toNum(order.total_meters_produced)
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
            meters: toNum(raw.pending_dispatch_meters),
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
            daysPending: daysBetween(sentDate, today),
        }
    })

    const dispatch: FactoryTodayData['dispatch'] = { soldNotDispatched, pendingReceipts }

    // ── 5. Commercials ─────────────────────────────────────────────────────────
    const commercialBlockingIssues = (commercialReceivablesRes.data ?? []).flatMap((raw) => {
        const rec = raw as Record<string, unknown>
        const totalAmount = toNum(rec.total_amount)
        const receivedAmount = toNum(rec.received_amount)
        const balanceAmount = toNum(rec.balance_amount)
        const paymentStatus = String(rec.payment_status || '')
        const dueDate = rec.due_date ? String(rec.due_date) : null
        const isDueOrOverdue = balanceAmount > 0.01 && Boolean(dueDate) && String(dueDate) <= today
        const isPaymentMismatch =
            receivedAmount > totalAmount + 0.01 ||
            (paymentStatus === 'paid' && balanceAmount > 0.01) ||
            (paymentStatus !== 'paid' && balanceAmount <= 0.01 && totalAmount > 0)

        if (!isDueOrOverdue && !isPaymentMismatch) return []

        return [{
            id: String(rec.id),
            partyName: String(rec.party_name || 'Unknown Party'),
            qualityLabel: String(rec.quality_label || 'Commercial receivable'),
            balanceAmount,
            dueDate,
            reason: isPaymentMismatch ? 'payment_mismatch' as const : 'due_or_overdue' as const,
        }]
    })

    const commercial: FactoryTodayData['commercial'] = {
        blockingIssues: commercialBlockingIssues.slice(0, 10),
        dueOrOverdueCount: commercialBlockingIssues.filter((issue) => issue.reason === 'due_or_overdue').length,
        paymentMismatchCount: commercialBlockingIssues.filter((issue) => issue.reason === 'payment_mismatch').length,
        totalDueOrOverdue: commercialBlockingIssues
            .filter((issue) => issue.reason === 'due_or_overdue')
            .reduce((sum, issue) => sum + issue.balanceAmount, 0),
    }

    // ── 6. Payroll ─────────────────────────────────────────────────────────────
    const cycleStartDay = payrollConfigRes.data?.cycle_start_day ?? 1
    const payDateDay = payrollConfigRes.data?.pay_date_day ?? 10
    const payReminderDays = payrollConfigRes.data?.pay_reminder_days ?? 3
    const currentPayrollMonth = getPayrollMonthForDate(today, cycleStartDay)
    const payrollCycleMonth = getPreviousPayrollMonth(currentPayrollMonth)
    const bounds = getPayrollCycleDetails(payrollCycleMonth, cycleStartDay, payDateDay)
    const payrollStatus = getPayrollCycleStatus(payrollCycleMonth, cycleStartDay, payDateDay, today, payReminderDays)

    const pendingAdvanceTotal = (advancesRes.data ?? []).reduce(
        (s, a) => s + toNum((a as Record<string, unknown>).amount),
        0
    )

    const payrollWorkerLogsRes = await supabase
        .from('production_logs')
        .select('worker_id, meters, worker_rate_snapshot')
        .eq('org_id', orgId)
        .gte('date', bounds.cycle_start)
        .lte('date', bounds.cycle_end)
        .not('worker_id', 'is', null)

    // Unique workers with logs this cycle = rough unsettled count
    const uniqueWorkerIds = new Set(
        (payrollWorkerLogsRes.data ?? [])
            .map((r) => (r as Record<string, unknown>).worker_id)
            .filter(Boolean)
    )

    const cycleLabel = `${formatDateOnly(bounds.cycle_start)} – ${formatDateOnly(bounds.cycle_end)}`

    const payroll: FactoryTodayData['payroll'] = {
        currentCycleMonth: payrollCycleMonth,
        currentCycleLabel: cycleLabel,
        payDate: bounds.pay_date,
        payWindowStatus: payrollStatus.status,
        isPayWindowOpen: payrollStatus.is_payroll_window_open,
        daysUntilPayDate: payrollStatus.days_until_pay_date,
        unsettledWorkerCount: uniqueWorkerIds.size,
        grossWagesSoFar: calculatePieceRateGrossWages(payrollWorkerLogsRes.data ?? []),
        pendingAdvanceTotal,
        upcomingSettlementDate: null,
    }

    // ── 7. Action Counts ───────────────────────────────────────────────────────
    const critical = [
        !production.hasLogsToday ? 1 : 0,
        ordersBehindPace.filter((o) => o.riskLevel === 'red').length,
        soldNotDispatched.length > 0 ? 1 : 0,
        pendingReceipts.filter((r) => r.daysPending > 5).length,
        commercial.blockingIssues.length > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0)

    const warning = [
        machinesData.unassigned > 0 ? 1 : 0,
        inactiveMarketRuns.length > 0 ? 1 : 0,
        ordersBehindPace.filter((o) => o.riskLevel === 'yellow').length,
        payroll.isPayWindowOpen && payroll.unsettledWorkerCount > 0 ? 1 : 0,
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
        commercial,
        payroll,
        actionCounts: { critical, warning, info },
        activationChecklist: {
            hasEstimate,
            hasQuality,
            hasOrder,
            hasProductionLog,
            hasStockEntry,
            hasMarketRun,
            hasDispatch,
            hasCommercial,
        },
        setupChecklist: {
            hasProductionMode: setupHasProductionMode,
            hasMachine: setupHasMachine,
            hasLoomAssignment: setupHasLoomAssignment,
            hasLoomTarget: setupHasLoomTarget,
            hasQuality,
            hasMeterWorker,
            hasFixedWorker,
            hasSupervisor,
            hasPayrollConfig: setupHasPayrollConfig,
            hasPlan: setupHasPlan,
        },
    }
}
