import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOwnerAnalyticsData, getAnalyticsPeriodBounds } from '../lib/owner-analytics'

describe('owner analytics', () => {
  it('builds equal current and comparison period bounds', () => {
    expect(getAnalyticsPeriodBounds('2026-07-21', 7)).toEqual({
      periodStart: '2026-07-15',
      periodEnd: '2026-07-21',
      comparisonStart: '2026-07-08',
      comparisonEnd: '2026-07-14',
    })
  })

  it('separates period performance from the current cash snapshot', () => {
    const data = buildOwnerAnalyticsData({
      anchorDate: '2026-07-21',
      period: 7,
      productionRows: [
        { date: '2026-07-10', meters: 100, worker_rate_snapshot: 2, machine_id: 'loom-1' },
        { date: '2026-07-15', meters: 150, worker_rate_snapshot: 2, machine_id: 'loom-1' },
        { date: '2026-07-16', meters: 50, worker_rate_snapshot: 3, machine_id: 'loom-2' },
      ],
      commercialRows: [
        { event_date: '2026-07-10', stage: 'realized', revenue_amount: 1000, gross_profit_amount: 100, quality_label: 'Old' },
        { event_date: '2026-07-16', stage: 'realized', revenue_amount: 2400, gross_profit_amount: 480, quality_label: 'Cotton 40' },
        { event_date: '2026-07-17', stage: 'expected', revenue_amount: 5000, gross_profit_amount: 1200, quality_label: 'Quote only' },
      ],
      receivableRows: [
        { party_name: 'Arihant Textiles', balance_amount: 700, due_date: '2026-07-20', payment_status: 'partial' },
        { party_name: 'Current Party', balance_amount: 300, due_date: '2026-07-25', payment_status: 'unpaid' },
        { party_name: 'Paid Party', balance_amount: 0, due_date: '2026-07-01', payment_status: 'paid' },
      ],
      machineRows: [
        { id: 'loom-1', name: 'Loom 1' },
        { id: 'loom-2', name: 'Loom 2' },
        { id: 'loom-3', name: 'Loom 3' },
      ],
      orderRows: [
        { id: 'order-1', party_name: 'Safe', quality_name: 'A', progress_pct: 60, pace_index: 1.1, days_remaining: 4 },
        { id: 'order-2', party_name: 'Watch', quality_name: 'B', progress_pct: 40, pace_index: 0.8, days_remaining: 3 },
        { id: 'order-3', party_name: 'Late', quality_name: 'C', progress_pct: 90, pace_index: 1.2, days_remaining: 0 },
      ],
    })

    expect(data.summary.meters).toBe(200)
    expect(data.summary.metersChangePct).toBe(100)
    expect(data.summary.floorWages).toBe(450)
    expect(data.summary.floorWagesPerMeter).toBe(2.25)
    expect(data.summary.realizedRevenue).toBe(2400)
    expect(data.summary.grossProfit).toBe(480)
    expect(data.summary.grossMarginPct).toBe(20)
    expect(data.summary.outstanding).toBe(1000)
    expect(data.summary.overdue).toBe(700)
    expect(data.producingLooms).toBe(2)
    expect(data.totalLooms).toBe(3)
    expect(data.loomPerformance[0]).toMatchObject({ name: 'Loom 1', meters: 150, sharePct: 75 })
    expect(data.qualityPerformance).toHaveLength(1)
    expect(data.orderHealth).toMatchObject({ onTrack: 1, atRisk: 1, critical: 1 })
    expect(data.orderHealth.attention.map((order) => order.id)).toEqual(['order-3', 'order-2'])
  })

  it('does not invent a percentage change when the prior period is empty', () => {
    const data = buildOwnerAnalyticsData({
      anchorDate: '2026-07-21',
      period: 7,
      productionRows: [{ date: '2026-07-21', meters: 25, worker_rate_snapshot: 1, machine_id: null }],
      commercialRows: [],
      receivableRows: [],
      machineRows: [],
      orderRows: [],
    })

    expect(data.summary.metersChangePct).toBeNull()
    expect(data.summary.revenueChangePct).toBeNull()
    expect(data.productionTrend).toHaveLength(7)
  })

  it('names the owner destination Analytics instead of Dashboard', () => {
    const navigation = readFileSync(join(process.cwd(), 'components/navigation/owner-sidebar.tsx'), 'utf8')
    const page = readFileSync(join(process.cwd(), 'app/(dashboard)/owner/analytics/page.tsx'), 'utf8')

    expect(navigation).toContain("if (item.name === 'Analytics') return 'Analytics'")
    expect(page).toContain("title: 'Analytics — Weavly'")
  })
})
