import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

describe('B14 realtime dashboard recovery and state boundaries', () => {
  const client = read('app/(dashboard)/owner/analytics/_components/DashboardClient.tsx')
  const actions = read('app/(dashboard)/owner/actions/dashboard.ts')
  const orderHealth = read('app/(dashboard)/owner/analytics/_components/OrderHealthSummary.tsx')
  const errorBoundary = read('app/(dashboard)/owner/analytics/error.tsx')
  const workerBreakdownMigration = read('supabase/migrations/20260714053000_b14_repair_worker_breakdown_timestamp.sql')

  it('replaces authoritative slices after a debounced event instead of incrementing client totals', () => {
    expect(client).toContain('const liveData = await refreshLiveDashboard()')
    expect(client).toContain('today:           liveData.today')
    expect(client).toContain('orders:          liveData.orders')
    expect(client).not.toMatch(/total_meters\s*:\s*prev[^\n]*\+/)
  })

  it('re-subscribes and refetches after reconnect while exposing offline and failure truth', () => {
    expect(client).toContain('setSubscriptionEpoch((value) => value + 1)')
    expect(client).toContain('production-logs-${subscriptionEpoch}`')
    expect(client).toContain('void supabase.removeChannel(channel)')
    expect(client).toContain("setConnectionStatus('reconnecting')")
    expect(client).toContain('void refreshDashboard()')
    expect(client).toContain('Offline — showing last synced data. Reconnect to refresh.')
    expect(client).toContain('Live dashboard sync failed. The last confirmed totals remain visible.')
    expect(client).toContain('Retry live sync')
  })

  it('does not silently collapse rejected dashboard queries into empty states', () => {
    expect(actions).toContain('function unwrapDashboardResult')
    expect(actions).toContain("'error' in value && value.error")
    expect(actions).toContain("unwrapDashboardResult(result, ['today KPI', 'order pace'")
    expect(errorBoundary).toContain('Dashboard could not load')
    expect(errorBoundary).toContain('Retry dashboard')
  })

  it('repairs worker breakdown ordering against the canonical production timestamp', () => {
    expect(workerBreakdownMigration).toContain("'logged_at', pl.submitted_at")
    expect(workerBreakdownMigration).toContain('order by pl.submitted_at, pl.id')
    expect(workerBreakdownMigration).not.toContain('pl.created_at')
  })

  it('does not count a waiting-for-production order as on-track', () => {
    expect(orderHealth).toContain("if (order.meters_produced === 0) return 'no-data'")
    expect(orderHealth).toContain("const key = s === 'no-data' ? 'at-risk' : s")
    expect(orderHealth).not.toContain("const key = s === 'no-data' ? 'on-track' : s")
    expect(orderHealth).toContain("label: t('analytics.orders.card.critical')")
  })
})
