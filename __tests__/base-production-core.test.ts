import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
    calculateBaseJobSummary,
    calculateBaseWorkerPayables,
    getBasePayrollPeriod,
    type BaseProductionEntry,
    type BaseProductionWorker,
} from '../lib/base-production-core'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

const worker: BaseProductionWorker = {
    id: 'worker-1',
    name: 'Ramesh',
    rate_per_meter: 10,
    is_active: true,
}

function entry(overrides: Partial<BaseProductionEntry> = {}): BaseProductionEntry {
    return {
        id: 'entry-1',
        job_id: 'job-1',
        worker_id: 'worker-1',
        production_date: '2026-08-20',
        meters: 100,
        worker_rate_snapshot: 8,
        notes: null,
        created_at: '2026-08-20T10:00:00.000Z',
        ...overrides,
    }
}

describe('Base Production Core calculations', () => {
    it('keeps job progress bounded and never returns negative remaining metres', () => {
        const summary = calculateBaseJobSummary(
            {
                id: 'job-1',
                target_meters: 100,
                planned_cost_per_meter: 20,
                planned_price_per_meter: 30,
            },
            [entry({ meters: 65 }), entry({ id: 'entry-2', meters: 50 })],
        )

        expect(summary.produced_meters).toBe(115)
        expect(summary.remaining_meters).toBe(0)
        expect(summary.progress_percent).toBe(100)
        expect(summary.planned_cost_total).toBe(2000)
        expect(summary.planned_value_total).toBe(3000)
    })

    it('uses the recorded rate snapshot and caps advance recovery at 50%', () => {
        const result = calculateBaseWorkerPayables({
            workers: [worker],
            entries: [entry()],
            advances: [{
                id: 'advance-1',
                worker_id: 'worker-1',
                amount: 600,
                recovered_amount: 0,
                description: null,
                status: 'pending',
                created_at: '2026-08-01T10:00:00.000Z',
            }],
            settlements: [],
            periodEnd: '2026-08-31',
        })[0]

        expect(result.gross_pay).toBe(800)
        expect(result.max_advance_recovery).toBe(400)
        expect(result.advance_recovery).toBe(400)
        expect(result.net_payout).toBe(400)
        expect(result.remaining_debt).toBe(200)
    })

    it('starts a new payable period after a prior settlement', () => {
        const result = calculateBaseWorkerPayables({
            workers: [worker],
            entries: [
                entry({ id: 'old', production_date: '2026-08-10', meters: 100 }),
                entry({ id: 'new', production_date: '2026-08-20', meters: 25 }),
            ],
            advances: [],
            settlements: [{
                id: 'settlement-1',
                worker_id: 'worker-1',
                period_start: '2026-08-01',
                period_end: '2026-08-15',
                gross_pay: 800,
                advance_deducted: 0,
                net_payout: 800,
                payment_mode: 'cash',
                paid_at: '2026-08-15T18:00:00.000Z',
            }],
            periodEnd: '2026-08-31',
        })[0]

        expect(result.period_start).toBe('2026-08-16')
        expect(result.meters).toBe(25)
        expect(result.gross_pay).toBe(200)
        expect(result.status).toBe('unsettled')
    })

    it('returns a calendar-month start for the first Base pay period', () => {
        expect(getBasePayrollPeriod('2026-08-29')).toEqual({ start: '2026-08-01', end: '2026-08-29' })
    })
})

describe('Base Production Core boundary contracts', () => {
    it('keeps Base production tables and settlement access separate from Full Suite records', () => {
        const migration = read('supabase/migrations/20260829090000_base_production_core.sql')
        const actions = read('app/(dashboard)/owner/production/actions.ts')
        const client = read('app/(dashboard)/owner/production/BaseProductionClient.tsx')
        const sidebar = read('components/navigation/owner-sidebar.tsx')

        expect(migration).toContain('base_production_core_access')
        expect(migration).toContain('base_production_jobs')
        expect(migration).toContain('base_production_entries')
        expect(migration).toContain('settle_base_worker_payroll')
        expect(migration).toContain('public.estimator_quotes(org_id, id)')
        expect(migration).not.toContain('require_premium_tenant_mutation')
        expect(actions).toContain('worker_rate_snapshot: worker.rate_per_meter')
        expect(actions).toContain("supabase.rpc('settle_base_worker_payroll'")
        expect(migration).toContain('NEW.worker_rate_snapshot := v_worker_rate')
        expect(migration).not.toContain('machine_label')
        expect(migration).not.toContain('shift text')
        expect(migration).not.toContain('auth.role()')
        expect(client).toContain('Fixed salary, statutory deductions, payslips, and WhatsApp remain Full Suite features.')
        expect(sidebar).toContain("href: \"/owner/production\"")
    })
})
