import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('DASH-004 historical date boundary', () => {
  it('loads every historical surface from the selected date', () => {
    const actions = fs.readFileSync(path.join(root, 'app/(dashboard)/owner/actions/dashboard.ts'), 'utf8')

    expect(actions).toContain('getKpiForDate(supabase, org_id, targetDate)')
    expect(actions).toContain("get_worker_breakdown_today', { p_org_id: org_id, p_date: targetDate }")
    expect(actions).toContain('getDailyMeterTrend(supabase, org_id, targetDate)')
    expect(actions).toContain('today: null')
    expect(actions).toContain('orders: null')
    expect(actions).toContain('machines: null')
  })

  it('commits the rendered native date before requesting history', () => {
    const client = fs.readFileSync(path.join(root, 'app/(dashboard)/owner/analytics/_components/DashboardClient.tsx'), 'utf8')

    expect(client).toContain('data-testid="dashboard-date-picker"')
    expect(client).toContain("document.querySelector<HTMLInputElement>('[data-testid=\"dashboard-date-picker\"]')?.value")
    expect(client).toContain('void loadSelectedDate(renderedDate)')
    expect(client).toContain('View date')
    expect(client).toContain('<WorkerBreakdown entries={data.workerBreakdown} selectedDate={selectedDate} />')
    expect(client).toContain('<ProductionTrend data={data.trend} selectedDate={selectedDate} />')

    const workers = fs.readFileSync(path.join(root, 'app/(dashboard)/owner/analytics/_components/WorkerBreakdown.tsx'), 'utf8')
    expect(workers).toContain('Workers · ${formatDate(selectedDate!)}')
    expect(workers).toContain('No production logged on selected date')

    const trend = fs.readFileSync(path.join(root, 'app/(dashboard)/owner/analytics/_components/ProductionTrend.tsx'), 'utf8')
    expect(trend).toContain('getSevenDayTrendWindow(selectedDate)')
    expect(trend).toContain('through ${formatDateOnly(selectedDate!)}')
  })
})
