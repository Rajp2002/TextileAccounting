import { createClient } from '@/lib/supabase/server'
import { getSuratTodayString, getSuratYesterdayString, formatToSurat } from '@/lib/time'
import { parseJWT } from '@/lib/auth'
import { subDays, format, parseISO } from 'date-fns'

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

export type DashboardData = {
  yesterday: {
    total_meters: number
    piece_rate_wages: number
    fixed_payroll: number
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
    supabase.rpc('get_kpi_yesterday',             { p_org_id: org_id, p_date: yesterday }),
    supabase.rpc('get_kpi_today_live',            { p_org_id: org_id, p_date: today }),
    supabase.rpc('get_yield_alert',               { p_org_id: org_id }),
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

  const [kpiYesterday, kpiToday, yieldAlert, orders, workerBreakdown, machines, rawLogs] = results.map(r =>
    r.status === 'fulfilled' ? r.value.data : null
  )

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
    today:           kpiToday ? { ...(kpiToday as any), date: today } : null,
    yieldAlert:      yieldAlert as any,
    orders:          (orders as any) || null,
    workerBreakdown: (workerBreakdown as any) || null,
    machines:        (machines as any) || null,
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

  const [kpiToday, orders, workerBreakdown, machines] = results.map(r =>
    r.status === 'fulfilled' ? r.value.data : null
  )

  return {
    today:           kpiToday ? { ...(kpiToday as any), date: today } : null,
    orders:          (orders as any) || null,
    workerBreakdown: (workerBreakdown as any) || null,
    machines:        (machines as any) || null,
  }
}

export async function fetchHistoricalData(targetDate: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Unauthorized')

  const { org_id } = parseJWT(session.access_token)

  const results = await Promise.allSettled([
    supabase.rpc('get_kpi_yesterday',          { p_org_id: org_id, p_date: targetDate }),
    supabase.rpc('get_worker_breakdown_today', { p_org_id: org_id, p_date: targetDate }),
  ])

  const [kpi, workerBreakdown] = results.map(r =>
    r.status === 'fulfilled' ? r.value.data : null
  )

  return {
    yesterday: kpi,
    workerBreakdown: (workerBreakdown as any) || null,
  }
}

