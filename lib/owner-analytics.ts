export type AnalyticsPeriod = 7 | 30 | 90

export type AnalyticsProductionRow = {
  date: string
  meters: number | string | null
  worker_rate_snapshot: number | string | null
  machine_id: string | null
}

export type AnalyticsCommercialRow = {
  event_date: string
  stage: string
  revenue_amount: number | string | null
  gross_profit_amount: number | string | null
  quality_label: string | null
}

export type AnalyticsReceivableRow = {
  party_name: string | null
  balance_amount: number | string | null
  due_date: string | null
  payment_status: string
}

export type AnalyticsMachineRow = {
  id: string
  name: string
}

export type AnalyticsOrderRow = {
  id: string
  party_name: string
  quality_name: string
  progress_pct: number | string | null
  pace_index: number | string | null
  days_remaining: number | string | null
}

export type OwnerAnalyticsData = {
  period: AnalyticsPeriod
  periodStart: string
  periodEnd: string
  comparisonStart: string
  summary: {
    meters: number
    metersChangePct: number | null
    floorWages: number
    floorWagesPerMeter: number | null
    realizedRevenue: number
    revenueChangePct: number | null
    grossProfit: number
    profitChangePct: number | null
    grossMarginPct: number | null
    outstanding: number
    overdue: number
  }
  productionTrend: Array<{ date: string; meters: number }>
  loomPerformance: Array<{ machineId: string; name: string; meters: number; sharePct: number }>
  qualityPerformance: Array<{
    quality: string
    revenue: number
    grossProfit: number
    marginPct: number | null
  }>
  receivableParties: Array<{ party: string; outstanding: number; overdue: number }>
  orderHealth: {
    onTrack: number
    atRisk: number
    critical: number
    attention: Array<{
      id: string
      party: string
      quality: string
      progressPct: number
      paceIndex: number
      daysRemaining: number
      severity: 'at-risk' | 'critical'
    }>
  }
  producingLooms: number
  totalLooms: number
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: string, amount: number) {
  const value = parseDate(date)
  value.setUTCDate(value.getUTCDate() + amount)
  return formatDate(value)
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function getAnalyticsPeriodBounds(anchorDate: string, period: AnalyticsPeriod) {
  const periodStart = addDays(anchorDate, -(period - 1))
  const comparisonEnd = addDays(periodStart, -1)
  const comparisonStart = addDays(comparisonEnd, -(period - 1))

  return { periodStart, periodEnd: anchorDate, comparisonStart, comparisonEnd }
}

function isWithin(date: string, start: string, end: string) {
  return date >= start && date <= end
}

function sumProduction(rows: AnalyticsProductionRow[]) {
  return rows.reduce(
    (totals, row) => {
      const meters = toNumber(row.meters)
      totals.meters += meters
      totals.floorWages += meters * toNumber(row.worker_rate_snapshot)
      return totals
    },
    { meters: 0, floorWages: 0 }
  )
}

function sumCommercial(rows: AnalyticsCommercialRow[]) {
  return rows.reduce(
    (totals, row) => {
      if (row.stage !== 'realized') return totals
      totals.revenue += toNumber(row.revenue_amount)
      totals.profit += toNumber(row.gross_profit_amount)
      return totals
    },
    { revenue: 0, profit: 0 }
  )
}

export function buildOwnerAnalyticsData(input: {
  anchorDate: string
  period: AnalyticsPeriod
  productionRows: AnalyticsProductionRow[]
  commercialRows: AnalyticsCommercialRow[]
  receivableRows: AnalyticsReceivableRow[]
  machineRows: AnalyticsMachineRow[]
  orderRows: AnalyticsOrderRow[]
}): OwnerAnalyticsData {
  const bounds = getAnalyticsPeriodBounds(input.anchorDate, input.period)
  const currentProductionRows = input.productionRows.filter((row) =>
    isWithin(row.date, bounds.periodStart, bounds.periodEnd)
  )
  const previousProductionRows = input.productionRows.filter((row) =>
    isWithin(row.date, bounds.comparisonStart, bounds.comparisonEnd)
  )
  const currentCommercialRows = input.commercialRows.filter((row) =>
    isWithin(row.event_date, bounds.periodStart, bounds.periodEnd)
  )
  const previousCommercialRows = input.commercialRows.filter((row) =>
    isWithin(row.event_date, bounds.comparisonStart, bounds.comparisonEnd)
  )

  const currentProduction = sumProduction(currentProductionRows)
  const previousProduction = sumProduction(previousProductionRows)
  const currentCommercial = sumCommercial(currentCommercialRows)
  const previousCommercial = sumCommercial(previousCommercialRows)

  const trendByDate = new Map<string, number>()
  for (let offset = 0; offset < input.period; offset += 1) {
    trendByDate.set(addDays(bounds.periodStart, offset), 0)
  }
  for (const row of currentProductionRows) {
    trendByDate.set(row.date, (trendByDate.get(row.date) ?? 0) + toNumber(row.meters))
  }

  const machineNames = new Map(input.machineRows.map((machine) => [machine.id, machine.name]))
  const loomMeters = new Map<string, number>()
  for (const row of currentProductionRows) {
    if (!row.machine_id) continue
    loomMeters.set(row.machine_id, (loomMeters.get(row.machine_id) ?? 0) + toNumber(row.meters))
  }
  const loomPerformance = [...loomMeters.entries()]
    .map(([machineId, meters]) => ({
      machineId,
      name: machineNames.get(machineId) ?? 'Unknown loom',
      meters,
      sharePct: currentProduction.meters > 0 ? (meters / currentProduction.meters) * 100 : 0,
    }))
    .sort((a, b) => b.meters - a.meters)

  const qualityTotals = new Map<string, { revenue: number; grossProfit: number }>()
  for (const row of currentCommercialRows) {
    if (row.stage !== 'realized') continue
    const quality = row.quality_label?.trim() || 'Unlabelled quality'
    const totals = qualityTotals.get(quality) ?? { revenue: 0, grossProfit: 0 }
    totals.revenue += toNumber(row.revenue_amount)
    totals.grossProfit += toNumber(row.gross_profit_amount)
    qualityTotals.set(quality, totals)
  }
  const qualityPerformance = [...qualityTotals.entries()]
    .map(([quality, totals]) => ({
      quality,
      ...totals,
      marginPct: totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const partyTotals = new Map<string, { outstanding: number; overdue: number }>()
  let outstanding = 0
  let overdue = 0
  for (const row of input.receivableRows) {
    if (row.payment_status === 'paid') continue
    const balance = toNumber(row.balance_amount)
    const isOverdue = Boolean(row.due_date && row.due_date < input.anchorDate)
    const party = row.party_name?.trim() || 'Unnamed party'
    const totals = partyTotals.get(party) ?? { outstanding: 0, overdue: 0 }
    outstanding += balance
    totals.outstanding += balance
    if (isOverdue) {
      overdue += balance
      totals.overdue += balance
    }
    partyTotals.set(party, totals)
  }
  const receivableParties = [...partyTotals.entries()]
    .map(([party, totals]) => ({ party, ...totals }))
    .sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding)

  const orderHealth: OwnerAnalyticsData['orderHealth'] = {
    onTrack: 0,
    atRisk: 0,
    critical: 0,
    attention: [],
  }
  for (const row of input.orderRows) {
    const paceIndex = toNumber(row.pace_index)
    const daysRemaining = toNumber(row.days_remaining)
    const progressPct = toNumber(row.progress_pct)
    const severity = daysRemaining <= 0 || (paceIndex > 0 && paceIndex < 0.7)
      ? 'critical'
      : paceIndex > 0 && paceIndex < 0.9
        ? 'at-risk'
        : null

    if (!severity) {
      orderHealth.onTrack += 1
      continue
    }

    orderHealth[severity === 'critical' ? 'critical' : 'atRisk'] += 1
    orderHealth.attention.push({
      id: row.id,
      party: row.party_name,
      quality: row.quality_name,
      progressPct,
      paceIndex,
      daysRemaining,
      severity,
    })
  }
  orderHealth.attention.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
    return a.paceIndex - b.paceIndex
  })

  return {
    period: input.period,
    periodStart: bounds.periodStart,
    periodEnd: bounds.periodEnd,
    comparisonStart: bounds.comparisonStart,
    summary: {
      meters: currentProduction.meters,
      metersChangePct: pctChange(currentProduction.meters, previousProduction.meters),
      floorWages: currentProduction.floorWages,
      floorWagesPerMeter: currentProduction.meters > 0
        ? currentProduction.floorWages / currentProduction.meters
        : null,
      realizedRevenue: currentCommercial.revenue,
      revenueChangePct: pctChange(currentCommercial.revenue, previousCommercial.revenue),
      grossProfit: currentCommercial.profit,
      profitChangePct: pctChange(currentCommercial.profit, previousCommercial.profit),
      grossMarginPct: currentCommercial.revenue > 0
        ? (currentCommercial.profit / currentCommercial.revenue) * 100
        : null,
      outstanding,
      overdue,
    },
    productionTrend: [...trendByDate.entries()].map(([date, meters]) => ({ date, meters })),
    loomPerformance,
    qualityPerformance,
    receivableParties,
    orderHealth,
    producingLooms: loomMeters.size,
    totalLooms: input.machineRows.length,
  }
}
