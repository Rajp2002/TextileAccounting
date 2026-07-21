'use server'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSuratTodayString } from '@/lib/time'
import {
  buildOwnerAnalyticsData,
  getAnalyticsPeriodBounds,
  type AnalyticsCommercialRow,
  type AnalyticsMachineRow,
  type AnalyticsOrderRow,
  type AnalyticsPeriod,
  type AnalyticsProductionRow,
  type AnalyticsReceivableRow,
  type OwnerAnalyticsData,
} from '@/lib/owner-analytics'

const VALID_PERIODS = new Set<AnalyticsPeriod>([7, 30, 90])

function normalizePeriod(period: number): AnalyticsPeriod {
  return VALID_PERIODS.has(period as AnalyticsPeriod) ? period as AnalyticsPeriod : 30
}

function assertQuerySucceeded(label: string, error: { message?: string } | null) {
  if (error) throw new Error(`${label} failed: ${error.message ?? 'unknown query error'}`)
}

export async function getOwnerAnalytics(periodInput: number = 30): Promise<OwnerAnalyticsData> {
  const period = normalizePeriod(periodInput)
  const { profile } = await requireRole(['owner'])
  const supabase = await createClient()
  const anchorDate = getSuratTodayString()
  const bounds = getAnalyticsPeriodBounds(anchorDate, period)

  const [productionResult, commercialResult, receivablesResult, machinesResult, ordersResult] = await Promise.all([
    supabase
      .from('production_logs')
      .select('date, meters, worker_rate_snapshot, machine_id')
      .eq('org_id', profile.org_id)
      .gte('date', bounds.comparisonStart)
      .lte('date', bounds.periodEnd),
    supabase
      .from('commercial_profit_entries')
      .select('event_date, stage, revenue_amount, gross_profit_amount, quality_label')
      .eq('org_id', profile.org_id)
      .eq('stage', 'realized')
      .gte('event_date', bounds.comparisonStart)
      .lte('event_date', bounds.periodEnd),
    supabase
      .from('commercial_receivables')
      .select('party_name, balance_amount, due_date, payment_status')
      .eq('org_id', profile.org_id)
      .neq('payment_status', 'paid'),
    supabase
      .from('machines')
      .select('id, name')
      .eq('org_id', profile.org_id)
      .eq('status', 'active'),
    supabase.rpc('get_active_orders_with_pace', {
      p_org_id: profile.org_id,
      p_date: anchorDate,
    }),
  ])

  assertQuerySucceeded('Analytics production', productionResult.error)
  assertQuerySucceeded('Analytics commercials', commercialResult.error)
  assertQuerySucceeded('Analytics receivables', receivablesResult.error)
  assertQuerySucceeded('Analytics looms', machinesResult.error)
  assertQuerySucceeded('Analytics order health', ordersResult.error)

  return buildOwnerAnalyticsData({
    anchorDate,
    period,
    productionRows: (productionResult.data ?? []) as AnalyticsProductionRow[],
    commercialRows: (commercialResult.data ?? []) as AnalyticsCommercialRow[],
    receivableRows: (receivablesResult.data ?? []) as AnalyticsReceivableRow[],
    machineRows: (machinesResult.data ?? []) as AnalyticsMachineRow[],
    orderRows: (ordersResult.data ?? []) as AnalyticsOrderRow[],
  })
}
