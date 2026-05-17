'use server'

import { createClient } from '@/lib/supabase/server'
import { getSuratTodayString, getSuratYesterdayString, formatToSurat } from '@/lib/time'
import { parseJWT } from '@/lib/auth'
import { getDaysInMonth, subDays, parseISO } from 'date-fns'

export type WorkerBreakdownEntry = {
  worker_id: string
  worker_name: string
  total_meters: number
  total_wages: number
  entries: Array<{
    machine_name: string
    meters: number
    rate: number
    wages: number
    shift: 'day' | 'night'
    logged_at: string
  }>
}

export type Order = {
  id: string
  party_name: string
  quality_name: string
  total_target_meters: number
  deadline: string
  days_remaining: number
  meters_produced: number
  meters_remaining: number
  progress_pct: number
  pace_index: number
  projected_finish_date: string | null
  assigned_machines: Array<{ id: string, name: string }>
}

export type DailyMeterPoint = {
  date: string
  total_meters: number
}

type KpiSnapshot = {
  total_meters: number | null
  piece_rate_wages: number | null
  fixed_payroll: number | null
  efficiency_pct: number | null
}

type TodayKpiSnapshot = {
  total_meters: number
  piece_rate_wages: number
  active_machines: number
}

type ProductionLogKpiRow = {
  meters: number | string | null
  worker_rate_snapshot: number | string | null
  yarn_batch_id: string | null
}

type FixedWorkerSalaryRow = {
  monthly_salary: number | string | null
}

type YarnBatchKpiRow = {
  id: string
  total_weight_kg: number | string | null
  leftover_weight_kg: number | string | null
  qualities: { target_yield: number | string | null } | Array<{ target_yield: number | string | null }> | null
}

export type DashboardData = {
  yesterday: {
    total_meters: number | null
    piece_rate_wages: number | null
    fixed_payroll: number | null
    efficiency_pct: number | null
  } | null
  today: {
    total_meters: number
    piece_rate_wages: number
    active_machines: number
    date: string
  } | null
  yieldAlert: {
    efficiency_pct: number
    loss_rupees: number
    batch_count: number
    expected_meters: number
    actual_meters: number
  } | null
  orders: Order[] | null
  workerBreakdown: WorkerBreakdownEntry[] | null
  machines: Array<{ id: string, name: string, current_order_id: string | null }> | null
  trend: DailyMeterPoint[] | null
}

function getResponseData<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object' || !('data' in value)) return null
  return (value as { data: T | null }).data ?? null
}

function normalizeKpiSnapshot(data: unknown): KpiSnapshot | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>

  return {
    total_meters: row.total_meters === null || row.total_meters === undefined ? null : Number(row.total_meters),
    piece_rate_wages: row.piece_rate_wages === null || row.piece_rate_wages === undefined ? null : Number(row.piece_rate_wages),
    fixed_payroll: row.fixed_payroll === null || row.fixed_payroll === undefined ? null : Number(row.fixed_payroll),
    efficiency_pct: row.efficiency_pct === null || row.efficiency_pct === undefined ? null : Number(row.efficiency_pct),
  }
}

async function getKpiForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  date: string
): Promise<KpiSnapshot | null> {
  const rpcResult = await supabase.rpc('get_kpi_yesterday', { p_org_id: orgId, p_date: date })

  if (!rpcResult.error && rpcResult.data && rpcResult.data.total_meters !== null) {
    return normalizeKpiSnapshot(rpcResult.data)
  }

  if (rpcResult.error) {
    console.error('[dashboard] get_kpi_yesterday failed; falling back to table aggregation:', rpcResult.error)
  }

  const [logsRes, fixedWorkersRes] = await Promise.all([
    supabase
      .from('production_logs')
      .select('meters, worker_rate_snapshot, yarn_batch_id')
      .eq('org_id', orgId)
      .eq('date', date)
      .gt('meters', 0),
    supabase
      .from('fixed_workers')
      .select('monthly_salary')
      .eq('org_id', orgId)
      .eq('is_active', true),
  ])

  if (logsRes.error) {
    console.error('[dashboard] production log KPI fallback failed:', logsRes.error)
    return normalizeKpiSnapshot(rpcResult.data)
  }
  if (fixedWorkersRes.error) {
    console.error('[dashboard] fixed payroll KPI fallback failed:', fixedWorkersRes.error)
  }

  const logs = (logsRes.data ?? []) as ProductionLogKpiRow[]
  const totalMeters = logs.length === 0
    ? null
    : logs.reduce((sum, log) => sum + Number(log.meters ?? 0), 0)
  const pieceRateWages = logs.length === 0
    ? null
    : logs.reduce((sum, log) => sum + Number(log.meters ?? 0) * Number(log.worker_rate_snapshot ?? 0), 0)

  const fixedSalaryTotal = ((fixedWorkersRes.data ?? []) as FixedWorkerSalaryRow[])
    .reduce((sum, worker) => sum + Number(worker.monthly_salary ?? 0), 0)
  const fixedPayroll = fixedSalaryTotal / getDaysInMonth(parseISO(date))

  let efficiencyPct: number | null = null
  const yarnBatchIds = [...new Set(logs.map((log) => log.yarn_batch_id).filter(Boolean))] as string[]

  if (yarnBatchIds.length > 0) {
    const { data: batches, error: batchesError } = await supabase
      .from('yarn_batches')
      .select('id, total_weight_kg, leftover_weight_kg, qualities(target_yield)')
      .in('id', yarnBatchIds)
      .eq('org_id', orgId)

    if (batchesError) {
      console.error('[dashboard] KPI efficiency fallback failed:', batchesError)
    } else {
      const expectedMeters = ((batches ?? []) as YarnBatchKpiRow[]).reduce((sum, batch) => {
        const quality = Array.isArray(batch.qualities) ? batch.qualities[0] : batch.qualities
        const netWeight = Number(batch.total_weight_kg ?? 0) - Number(batch.leftover_weight_kg ?? 0)
        return sum + Math.max(netWeight, 0) * Number(quality?.target_yield ?? 0)
      }, 0)

      const batchMeters = logs
        .filter((log) => log.yarn_batch_id && yarnBatchIds.includes(log.yarn_batch_id))
        .reduce((sum, log) => sum + Number(log.meters ?? 0), 0)

      if (expectedMeters > 0) {
        efficiencyPct = Math.round((batchMeters / expectedMeters) * 1000) / 10
      }
    }
  }

  return {
    total_meters: totalMeters,
    piece_rate_wages: pieceRateWages,
    fixed_payroll: fixedPayroll,
    efficiency_pct: efficiencyPct,
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Unauthorized')

  const { org_id } = parseJWT(session.access_token)
  const today     = getSuratTodayString()
  const yesterday = getSuratYesterdayString()

  const todayDate = parseISO(today)
  const last7Days = Array.from({ length: 7 }, (_, i) =>
    formatToSurat(subDays(todayDate, 6 - i), 'yyyy-MM-dd')
  )

  const results = await Promise.allSettled([
    getKpiForDate(supabase, org_id, yesterday),
    supabase.rpc('get_kpi_today_live',            { p_org_id: org_id, p_date: today }),
    supabase.rpc('get_active_orders_with_pace',   { p_org_id: org_id, p_date: today }),
    supabase.rpc('get_worker_breakdown_today',    { p_org_id: org_id, p_date: today }),
    supabase.from('machines').select('id, name, current_order_id').eq('org_id', org_id).eq('status', 'active'),
    // 7-day trend: sum meters per day from production_logs
    supabase
      .from('production_logs')
      .select('date, meters')
      .eq('org_id', org_id)
      .gte('date', last7Days[0])
      .lte('date', today)
      .order('date', { ascending: true }),
  ])

  const [kpiYesterdayResult, kpiTodayResult, ordersResult, workerBreakdownResult, machinesResult, rawLogsResult] = results.map(r =>
    r.status === 'fulfilled' ? r.value : null
  )
  const kpiYesterday = kpiYesterdayResult as KpiSnapshot | null
  const kpiToday = getResponseData<TodayKpiSnapshot>(kpiTodayResult)
  const orders = getResponseData<Order[]>(ordersResult)
  const workerBreakdown = getResponseData<WorkerBreakdownEntry[]>(workerBreakdownResult)
  const machines = getResponseData<Array<{ id: string, name: string, current_order_id: string | null }>>(machinesResult)
  const rawLogs = getResponseData<Array<{ date: string; meters: number }>>(rawLogsResult)

  // Aggregate production_logs rows into a daily DailyMeterPoint array
  const trendMap = new Map<string, number>()
  last7Days.forEach(d => trendMap.set(d, 0)) // seed all 7 days with 0
  if (rawLogs) {
    for (const row of rawLogs as Array<{ date: string; meters: number }>) {
      trendMap.set(row.date, (trendMap.get(row.date) ?? 0) + row.meters)
    }
  }
  const trend = last7Days.map(d => ({ date: d, total_meters: trendMap.get(d) ?? 0 }))

  return {
    yesterday:       kpiYesterday,
    today:           kpiToday ? { ...kpiToday, date: today } : null,
    // Yield alerts are intentionally disabled for Phase 1.
    // The lean production scope no longer includes yarn yield alerts, and the legacy RPC is not wired into the dashboard.
    yieldAlert:      null,
    orders:          orders || null,
    workerBreakdown: workerBreakdown || null,
    machines:        machines || null,
    trend,
  }
}

export async function refreshLiveDashboard() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Unauthorized')

  const { org_id } = parseJWT(session.access_token)
  const today = getSuratTodayString()

  const results = await Promise.allSettled([
    supabase.rpc('get_kpi_today_live',            { p_org_id: org_id, p_date: today }),
    supabase.rpc('get_active_orders_with_pace',   { p_org_id: org_id, p_date: today }),
    supabase.rpc('get_worker_breakdown_today',    { p_org_id: org_id, p_date: today }),
    supabase.from('machines').select('id, name, current_order_id').eq('org_id', org_id).eq('status', 'active'),
  ])

  const [kpiTodayResult, ordersResult, workerBreakdownResult, machinesResult] = results.map(r =>
    r.status === 'fulfilled' ? r.value : null
  )
  const kpiToday = getResponseData<TodayKpiSnapshot>(kpiTodayResult)
  const orders = getResponseData<Order[]>(ordersResult)
  const workerBreakdown = getResponseData<WorkerBreakdownEntry[]>(workerBreakdownResult)
  const machines = getResponseData<Array<{ id: string, name: string, current_order_id: string | null }>>(machinesResult)

  return {
    today:           kpiToday ? { ...kpiToday, date: today } : null,
    orders:          orders || null,
    workerBreakdown: workerBreakdown || null,
    machines:        machines || null,
  }
}

export async function fetchHistoricalData(targetDate: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Unauthorized')

  const { org_id } = parseJWT(session.access_token)

  const results = await Promise.allSettled([
    getKpiForDate(supabase, org_id, targetDate),
    supabase.rpc('get_worker_breakdown_today', { p_org_id: org_id, p_date: targetDate }),
  ])

  const [kpiResult, workerBreakdownResult] = results.map(r =>
    r.status === 'fulfilled' ? r.value : null
  )
  const kpi = kpiResult as KpiSnapshot | null
  const workerBreakdown = getResponseData<WorkerBreakdownEntry[]>(workerBreakdownResult)

  return {
    yesterday: kpi,
    workerBreakdown: workerBreakdown || null,
  }
}
