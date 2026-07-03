import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildFactoryTodaySetupChecklist,
  hasCompletedCostingEvidence,
  hasDayNightLoomAssignment,
  hasLinkedActiveProductionTarget,
  hasUsablePayrollConfig,
} from '../lib/factory-today-checklist'
import {
  aggregateDailyMeterTrend,
  getSevenDayTrendWindow,
} from '../lib/dashboard-trend'

const root = process.cwd()

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

describe('Batch 24C Factory Today setup and historical analytics state', () => {
  it('SETUP-011 recognizes completed costing from estimate, order, or market-run evidence', () => {
    expect(hasCompletedCostingEvidence({
      hasQuality: false,
      hasEstimate: true,
      hasOrder: false,
      hasMarketRun: false,
    })).toBe(true)
    expect(hasCompletedCostingEvidence({
      hasQuality: false,
      hasEstimate: false,
      hasOrder: true,
      hasMarketRun: false,
    })).toBe(true)
    expect(hasCompletedCostingEvidence({
      hasQuality: false,
      hasEstimate: false,
      hasOrder: false,
      hasMarketRun: true,
    })).toBe(true)
    expect(hasCompletedCostingEvidence({
      hasQuality: false,
      hasEstimate: false,
      hasOrder: false,
      hasMarketRun: false,
    })).toBe(false)
  })

  it('SETUP-011 uses real machine, assignment, worker, and payroll conditions', () => {
    expect(hasLinkedActiveProductionTarget([
      { id: 'loom-1', current_order_id: 'order-1', orders: { status: 'active' } },
    ])).toBe(true)
    expect(hasLinkedActiveProductionTarget([
      { id: 'loom-1', current_order_id: 'order-1', orders: { status: 'completed' } },
    ])).toBe(false)
    expect(hasLinkedActiveProductionTarget([
      { id: 'loom-1', current_order_id: null, orders: null },
    ])).toBe(false)

    expect(hasDayNightLoomAssignment([
      { machine_id: 'loom-1', shift: 'day', worker_id: 1 },
      { machine_id: 'loom-1', shift: 'night', worker_id: 2 },
    ])).toBe(true)
    expect(hasDayNightLoomAssignment([
      { machine_id: 'loom-1', shift: 'day', worker_id: 1 },
      { machine_id: 'loom-2', shift: 'night', worker_id: 2 },
    ])).toBe(false)
    expect(hasDayNightLoomAssignment([
      { machine_id: 'loom-1', shift: 'day', worker_id: 1 },
      { machine_id: 'loom-1', shift: 'night', worker_id: null },
    ])).toBe(false)

    expect(hasUsablePayrollConfig({ cycle_start_day: 1, pay_date_day: 10, pay_reminder_days: 5 })).toBe(true)
    expect(hasUsablePayrollConfig(null)).toBe(false)
    expect(hasUsablePayrollConfig({ cycle_start_day: 31, pay_date_day: 10, pay_reminder_days: 5 })).toBe(false)
    expect(hasUsablePayrollConfig({ cycle_start_day: 1, pay_date_day: 31, pay_reminder_days: 5 })).toBe(false)
    expect(hasUsablePayrollConfig({ cycle_start_day: 1, pay_date_day: 10, pay_reminder_days: 30 })).toBe(false)
  })

  it('SETUP-011 builds a complete setup checklist without relying on a qualities row alone', () => {
    const checklist = buildFactoryTodaySetupChecklist({
      onboardingComplete: false,
      productionMode: 'order_based',
      machines: [{ id: 'loom-1', current_order_id: 'order-1', orders: { status: 'active' } }],
      machineAssignments: [
        { machine_id: 'loom-1', shift: 'day', worker_id: 1 },
        { machine_id: 'loom-1', shift: 'night', worker_id: 2 },
      ],
      hasQuality: false,
      hasEstimate: true,
      hasOrder: true,
      hasMarketRun: false,
      hasMeterWorker: true,
      hasFixedWorker: false,
      hasSupervisor: true,
      payrollConfig: { cycle_start_day: 1, pay_date_day: 10, pay_reminder_days: 5 },
      hasPlan: true,
    })

    expect(checklist).toMatchObject({
      hasProductionMode: true,
      hasMachine: true,
      hasLoomAssignment: true,
      hasLoomTarget: true,
      hasQuality: true,
      hasMeterWorker: true,
      hasSupervisor: true,
      hasPayrollConfig: true,
      hasPlan: true,
    })
    expect(checklist.hasFixedWorker).toBe(false)
  })

  it('SETUP-011 keeps genuinely incomplete setup states incomplete', () => {
    const checklist = buildFactoryTodaySetupChecklist({
      onboardingComplete: false,
      productionMode: null,
      machines: [{ id: 'loom-1', current_order_id: 'order-1', orders: { status: 'cancelled' } }],
      machineAssignments: [{ machine_id: 'loom-1', shift: 'day', worker_id: 1 }],
      hasQuality: false,
      hasEstimate: false,
      hasOrder: false,
      hasMarketRun: false,
      hasMeterWorker: false,
      hasFixedWorker: false,
      hasSupervisor: false,
      payrollConfig: null,
      hasPlan: false,
    })

    expect(checklist.hasProductionMode).toBe(false)
    expect(checklist.hasLoomAssignment).toBe(false)
    expect(checklist.hasLoomTarget).toBe(false)
    expect(checklist.hasQuality).toBe(false)
    expect(checklist.hasMeterWorker).toBe(false)
    expect(checklist.hasPayrollConfig).toBe(false)
  })

  it('DASH-004 builds a seven-day trend ending on the selected historical date', () => {
    const dates = getSevenDayTrendWindow('2026-06-20')
    expect(dates).toHaveLength(7)
    expect(dates[6]).toBe('2026-06-20')

    const trend = aggregateDailyMeterTrend(dates, [
      { date: '2026-06-14', meters: 15 },
      { date: '2026-06-18', meters: '12.5' },
      { date: '2026-06-18', meters: 7.5 },
      { date: '2026-06-21', meters: 99 },
    ])

    expect(trend.find((point) => point.date === '2026-06-14')?.total_meters).toBe(15)
    expect(trend.find((point) => point.date === '2026-06-18')?.total_meters).toBe(20)
    expect(trend.find((point) => point.date === '2026-06-20')?.total_meters).toBe(0)
    expect(trend.some((point) => point.date === '2026-06-21')).toBe(false)
  })

  it('DASH-004 historical fetch clears current-only slices and current refresh restores live slices', () => {
    const dashboardActions = readProjectFile('app/(dashboard)/owner/actions/dashboard.ts')
    const dashboardClient = readProjectFile('app/(dashboard)/owner/analytics/_components/DashboardClient.tsx')

    expect(dashboardActions).toContain('getDailyMeterTrend(supabase, org_id, targetDate)')
    expect(dashboardActions).toContain('today: null')
    expect(dashboardActions).toContain('orders: null')
    expect(dashboardActions).toContain('machines: null')
    expect(dashboardActions).toContain('trend: trend || null')

    expect(dashboardActions).toContain('getDailyMeterTrend(supabase, org_id, today)')
    expect(dashboardClient).toContain('setData(history)')
    expect(dashboardClient).toContain('trend: liveData.trend')
    expect(dashboardClient).toContain('{isToday && (')
    expect(dashboardClient).toContain('<OrderHealthSummary orders={data.orders} />')
    expect(dashboardClient).toContain('<MachineUtilization machines={data.machines} />')
  })

  it('does not add migration/RPC/database package work for Batch 24C', () => {
    const migrationNames = readdirSync(join(root, 'supabase/migrations'))
    expect(migrationNames.some((name) => name.toLowerCase().includes('batch_24c'))).toBe(false)

    const packageLock = readProjectFile('package-lock.json')
    expect(packageLock).toContain('"name": "textile-saas"')
  })
})
