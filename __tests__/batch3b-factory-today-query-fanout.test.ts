/**
 * Batch 3B — Factory Today first-render query fan-out
 *
 * Keep the operational dashboard payload on the initial server render and
 * defer only the setup/activation checklist. These source-level assertions
 * protect the split without coupling the test to Supabase implementation
 * details.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Batch 3B — Factory Today query fan-out', () => {
    const actions = read('app/(dashboard)/owner/today/actions.ts')
    const client = read('app/(dashboard)/owner/today/FactoryTodayClient.tsx')

    it('keeps the first-render dashboard payload at ten concurrent Supabase calls plus payroll-cycle wages', () => {
        expect(actions).toContain('const FIRST_RENDER_DASHBOARD_SUPABASE_CALLS = 10')
        expect(actions).toContain('loadFactoryTodayDashboardPayload')
        expect(actions).toContain('FIRST_RENDER_DASHBOARD_SUPABASE_CALLS')
        expect(actions).toContain('10-query first-render dashboard plus payroll cycle log query; setup checklist deferred')
    })

    it('loads the thirteen checklist queries through a separately authenticated deferred action', () => {
        expect(actions).toContain('const DEFERRED_CHECKLIST_SUPABASE_CALLS = 13')
        expect(actions).toContain('loadFactoryTodayChecklistPayload')
        expect(actions).toContain('DEFERRED_CHECKLIST_SUPABASE_CALLS')
        expect(actions).toContain('export async function getFactoryTodayChecklist')
        expect(actions).toContain("createPerfTimer('/owner/today/checklist')")
        expect(actions).toContain("requireRole(['owner'])")
    })

    it('keeps the action center visible while the checklist loads after hydration', () => {
        expect(client).toContain('getFactoryTodayChecklist(initialData.setupChecklistSeed)')
        expect(client).toContain('const showSetupPanel = !!setupChecklist')
        expect(client).toContain('checklistFailed')
        expect(client).toContain('checklistRequest.current ??= getFactoryTodayChecklist')
        expect(client).toContain('checklistRequest.current')
        expect(client).not.toContain('checklistRequestStarted.current')
        expect(client).not.toContain('if (isCurrent) setChecklistPayload')
    })

    it('logs every first-render query and exposes only development diagnostic timeouts', () => {
        expect(actions).toContain('const FACTORY_TODAY_DIAGNOSTIC_TIMEOUT_MS = 3_000')
        expect(actions).toContain('isPerfLoggingEnabled()')
        expect(actions).toContain("process.env.NODE_ENV !== 'development'")
        expect(actions).toContain('never_resolved=true')

        for (const label of [
            'production_recent',
            'machines',
            'active_order_progress',
            'active_market_runs',
            'sold_not_dispatched',
            'pending_receipts',
            'payroll_config',
            'pending_advances',
            'organization_settings',
            'commercial_receivables',
            'payroll_cycle_worker_logs',
        ]) {
            expect(actions).toContain(`traceFactoryTodayQuery('${label}'`)
        }
    })

    it('requests only columns that exist on production_logs', () => {
        expect(actions).toContain(".select('id, shift, meters, submitted_at, date, orders!production_logs_order_id_fkey(market_run_id)')")
        expect(actions).not.toContain(".select('id, shift, meters, created_at, date, market_run_id')")
        expect(actions).not.toContain(".select('id, shift, meters, created_at, date, orders!production_logs_order_id_fkey(market_run_id)')")
        expect(actions).toContain('recentProductionLogs.map((r) => r.orders?.[0]?.market_run_id)')
    })
})
