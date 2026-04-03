'use server'

import { createClient } from '@/lib/supabase/server'
import { getSuratTodayString, getSuratYesterdayString } from '@/lib/time'
import { parseJWT } from '@/lib/auth'

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
  machines: Array<{ id: string, name: string }> | null
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Unauthorized')

  const { org_id } = parseJWT(session.access_token)
  const today     = getSuratTodayString()
  const yesterday = getSuratYesterdayString()

  const results = await Promise.allSettled([
    supabase.rpc('get_kpi_yesterday',             { p_org_id: org_id, p_date: yesterday }),
    supabase.rpc('get_kpi_today_live',            { p_org_id: org_id, p_date: today }),
    supabase.rpc('get_yield_alert',               { p_org_id: org_id }),
    supabase.rpc('get_active_orders_with_pace',   { p_org_id: org_id, p_date: today }),
    supabase.rpc('get_worker_breakdown_today',    { p_org_id: org_id, p_date: today }),
    supabase.from('machines').select('id, name').eq('org_id', org_id).eq('status', 'active'),
  ])

  const [kpiYesterday, kpiToday, yieldAlert, orders, workerBreakdown, machines] = results.map(r =>
    r.status === 'fulfilled' ? r.value.data : null
  )

  return {
    yesterday:       kpiYesterday,
    today:           kpiToday ? { ...(kpiToday as any), date: today } : null,
    yieldAlert:      yieldAlert as any,
    orders:          (orders as any) || null,
    workerBreakdown: (workerBreakdown as any) || null,
    machines:        (machines as any) || null,
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
    supabase.from('machines').select('id, name').eq('org_id', org_id).eq('status', 'active'),
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

export async function getQualities() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Unauthorized')

  const { org_id } = parseJWT(session.access_token)

  const { data, error } = await supabase
    .from('qualities')
    .select('id, name')
    .eq('org_id', org_id)
    .order('name')

  if (error) throw error
  return data
}

export async function createOrder(payload: {
  party_name: string
  quality_id: string
  total_target_meters: number
  deadline: string
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Unauthorized')

  const { org_id } = parseJWT(session.access_token)

  const { data, error } = await supabase
    .from('orders')
    .insert({
      ...payload,
      org_id,
      status: 'active',
      start_date: getSuratTodayString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}
