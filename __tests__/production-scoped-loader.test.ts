import { beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateBaseWorkerPayables } from '@/lib/base-production-core'
import { buildBasePayrollHistory } from '@/lib/base-payroll-history'
import { DEFAULT_MONTHLY_CYCLE_RULE } from '@/lib/payroll-cycle-engine'

type Row = Record<string, unknown>
type Query = { table: string; columns?: string; count?: string; filters: Array<[string, unknown]>; orders: string[]; range?: [number, number] }
const fixture = vi.hoisted(() => ({
    rows: {} as Record<string, Row[]>, queries: [] as Query[], cap: 500,
    errorTable: '', rejectTable: '', truncateTable: '', orgId: 'tenant-one',
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => mockClient() }))
vi.mock('@/lib/auth', () => ({ requireRole: async () => ({ profile: { org_id: fixture.orgId }, user: { id: 'owner', user_metadata: {} } }) }))
vi.mock('@/lib/time', async importOriginal => ({ ...(await importOriginal<typeof import('../lib/time')>()), getSuratTodayString: () => '2026-10-02' }))
vi.mock('next/navigation', () => ({ redirect: (href: string) => { throw new Error(`Redirect: ${href}`) } }))
vi.mock('@/components/payroll/PayrollGuidedTour', () => ({ default: () => null }))
vi.mock('@/components/production/ProductionGuidedTour', () => ({ default: () => null }))
vi.mock('../app/(dashboard)/owner/production/BaseProductionClient', () => ({ default: () => null }))

import { loadBaseProductionInitialData, type BaseProductionInitialData, type BaseProductionLoadScope } from '../app/(dashboard)/owner/production/loaders'
import PayrollPage from '../app/(dashboard)/owner/payroll/page'
import ProductionPage from '../app/(dashboard)/owner/production/page'
import DailySheetPage from '../app/(dashboard)/owner/production/daily-sheet/page'

const productionOnly = ['estimator_quotes', 'base_production_jobs', 'base_production_machines', 'base_worker_machine_assignments', 'base_machine_job_contexts', 'base_production_batch_revisions']
const payrollOnly = ['base_worker_advances', 'base_worker_incentives', 'base_payroll_settlement_lines', 'base_payroll_periods']
const shared = ['organizations', 'base_payroll_cycle_configs', 'base_production_entries', 'base_production_workers', 'base_payroll_settlements', 'base_production_batches', 'base_daily_production_entries', 'base_daily_production_allocations']
const allTables = [...shared, ...productionOnly, ...payrollOnly]
const today = '2026-10-02'

function mockClient() {
    return { from(table: string) {
        const query: Query = { table, filters: [], orders: [] }
        fixture.queries.push(query)
        const result = (from = 0, to = Infinity) => {
            if (fixture.rejectTable === table) return Promise.reject(new Error('Connection interrupted'))
            const rows = (fixture.rows[table] ?? []).filter(row => query.filters.every(([key, value]) => row[key] === value))
            return Promise.resolve({
                data: fixture.truncateTable === table && from > 0 ? [] : rows.slice(from, Math.min(to + 1, from + fixture.cap)),
                error: fixture.errorTable === table ? { message: 'Unavailable' } : null,
                count: query.count === 'exact' ? rows.length : null,
            })
        }
        const chain = {
            select(columns: string, options?: { count?: string }) { query.columns = columns; query.count = options?.count; return chain },
            eq(key: string, value: unknown) { query.filters.push([key, value]); return chain },
            is(key: string, value: unknown) { query.filters.push([key, value]); return chain },
            order(key: string) { query.orders.push(key); return chain },
            range(from: number, to: number) { query.range = [from, to]; return result(from, to) },
            async maybeSingle() { const response = await result(); return { ...response, data: response.data[0] ?? null } },
        }
        return chain
    } }
}

beforeEach(() => {
    fixture.queries = []
    fixture.cap = 500
    fixture.errorTable = fixture.rejectTable = fixture.truncateTable = ''
    fixture.orgId = 'tenant-one'
    fixture.rows = {
        organizations: [{ id: 'tenant-one', name: 'Test factory' }],
        base_payroll_cycle_configs: [{ id: 'cycle', cycle_type: 'monthly', rule: DEFAULT_MONTHLY_CYCLE_RULE, effective_from: '2020-01-01', effective_until: null }],
        estimator_quotes: [{ id: 'costing', quality_label: 'Grey cloth', record_kind: 'costing', is_archived: false, worker_rate_per_m: 2 }],
        base_production_jobs: [{ id: 'job', costing_id: 'costing', quality_label: 'Grey cloth', status: 'planned', start_date: '2025-01-01' }],
        base_production_workers: [
            { id: 'piece', name: 'Piece worker', rate_per_meter: 99, pay_type: 'piece_rate', is_active: true, shift_availability: 'both' },
            { id: 'salary', name: 'Salary worker', pay_type: 'fixed_monthly', is_active: true, monthly_salary: 33000, start_date: '2026-08-15', salary_history: [{ effective_from: '2026-08-01', monthly_salary: 30000 }, { effective_from: '2026-09-16', monthly_salary: 33000 }] },
        ],
        base_production_entries: [
            { id: 'old-unpaid', worker_id: 'piece', job_id: 'job', production_date: '2025-08-10', meters: 100, worker_rate_snapshot: 2 },
            { id: 'future', worker_id: 'piece', job_id: 'job', production_date: '2026-10-10', meters: 500, worker_rate_snapshot: 3 },
        ],
        base_worker_advances: [{ id: 'advance', worker_id: 'piece', amount: 100, recovered_amount: 20, status: 'pending' }],
        base_worker_incentives: [{ id: 'incentive', worker_id: 'piece', service_start: '2026-09-01', service_end: '2026-09-02', amount: 25, evidence_reference: 'Approved task', status: 'approved', approved_by: 'owner', approved_at: '2026-09-03T00:00:00Z' }],
        base_payroll_settlements: [
            { id: 'reversed', worker_id: 'piece', period_start: '2025-08-01', period_end: '2025-08-31', gross_pay: 200, net_payout: 200, status: 'reversed', worker_name_snapshot: 'Piece worker', reversal: { reason: 'Payment not made', created_at: '2025-09-01T00:00:00Z' } },
            { id: 'paid-salary', worker_id: 'salary', period_start: '2026-08-15', period_end: '2026-08-31', gross_pay: 16451.61, net_payout: 16451.61, status: 'paid', worker_name_snapshot: 'Salary worker' },
        ],
        base_payroll_settlement_lines: [{ id: 'frozen-line', settlement_id: 'reversed', worker_id: 'piece', production_date: '2025-08-10', machine_label: 'Historic loom', costing_label: 'Historic costing', meters: 100, worker_rate_snapshot: 2, gross_pay: 200, source_kind: 'legacy_entry', source_id: 'old-unpaid' }],
        base_payroll_periods: [{ id: 'period', period_start: '2025-08-01', period_end: '2025-08-31', status: 'open', total_gross: 200, resolved_worker_ids: ['zero-worker'] }],
        base_production_machines: [{ id: 'machine', name: 'Loom', machine_type: 'rapier', is_active: true }],
        base_worker_machine_assignments: [{ id: 'assignment', worker_id: 'piece', machine_id: 'machine', shift: 'day', active: true, effective_from: '2025-01-01' }],
        base_machine_job_contexts: [{ id: 'context', machine_id: 'machine', job_id: 'job', active: true, effective_from: '2025-01-01' }],
        base_production_batches: [{ id: 'batch', production_date: '2026-09-30', shift: 'day', status: 'saved', machine_records: [] }],
        base_production_batch_revisions: [{ id: 'revision', batch_id: 'batch', revision_number: 2, change_kind: 'corrected', correction_reason: 'Meter correction', after_snapshot: { total_meters: 20 } }],
        base_daily_production_entries: [{ id: 'daily-entry', batch_id: 'batch', worker_id: 'piece', job_id: 'job', entry_status: 'entered', meters: 20, worker_rate_snapshot: 99, allocation_mode: 'machine_breakdown' }],
        base_daily_production_allocations: [{ id: 'allocation', entry_id: 'daily-entry', worker_id: 'piece', machine_id: 'machine', job_id: 'job', meters: 20, worker_rate_snapshot: 3, machine_label: 'Loom', job_label: 'Grey cloth' }],
    }
    for (const rows of Object.values(fixture.rows)) for (const row of rows) row.org_id = 'tenant-one'
})

const load = (scope?: BaseProductionLoadScope) => loadBaseProductionInitialData(fixture.orgId, today, scope)
const queriedTables = () => [...new Set(fixture.queries.map(query => query.table))].sort()
const payables = (data: BaseProductionInitialData) => calculateBaseWorkerPayables({ ...data, periodEnd: today })

describe('task-scoped production and payroll loading', () => {
    it.each([
        ['complete', allTables],
        ['production', [...shared, ...productionOnly]],
        ['payroll', [...shared, ...payrollOnly]],
    ] as const)('queries only the %s task datasets with tenant scope on every page', async (scope, expected) => {
        await load(scope)
        expect(queriedTables()).toEqual([...expected].sort())
        for (const query of fixture.queries) {
            expect(query.filters).toContainEqual([query.table === 'organizations' ? 'id' : 'org_id', 'tenant-one'])
            if (query.range) {
                expect(query.orders.at(-1)).toBe('id')
                expect(query.range).toEqual([0, 499])
            }
        }
    })

    it('retains the complete loader as the default for existing callers', async () => {
        const implicit = await load()
        expect(queriedTables()).toEqual([...allTables].sort())
        expect(implicit).toEqual(await load('complete'))
    })

    it('preserves all payroll evidence, older unpaid work, reversals, salary changes and saved rates', async () => {
        const complete = await load('complete')
        const payroll = await load('payroll')
        for (const key of ['orgId', 'factoryName', 'today', 'payrollPeriod', 'payrollCycleConfig', 'workers', 'entries', 'allocations', 'advances', 'incentives', 'settlements', 'settlementLines', 'payrollPeriods', 'dailyBatches'] as const) {
            expect(payroll[key]).toEqual(complete[key])
        }
        expect(payables(payroll)).toEqual(payables(complete))
        expect(payables(payroll).find(worker => worker.worker_id === 'piece')).toMatchObject({ period_start: '2025-08-10', meters: 120, base_pay: 260, gross_pay: 285, advance_recovery: 80, net_payout: 205, status: 'unsettled' })
        expect(payables(payroll).find(worker => worker.worker_id === 'salary')).toMatchObject({ period_start: '2026-09-01', gross_pay: 33629.03 })
        expect(buildBasePayrollHistory(payroll.settlements, payroll.settlementLines, payroll.payrollPeriods)).toEqual(buildBasePayrollHistory(complete.settlements, complete.settlementLines, complete.payrollPeriods))
        expect(payroll.settlements.find(row => row.id === 'reversed')).toMatchObject({ status: 'reversed', reversal_reason: 'Payment not made' })
        for (const key of ['costings', 'jobs', 'machines', 'assignments', 'machineJobContexts', 'batchRevisions'] as const) expect(payroll[key]).toEqual([])
    })

    it('preserves production records, corrections, locks and historical job reconciliation', async () => {
        const complete = await load('complete')
        const production = await load('production')
        for (const key of ['orgId', 'factoryName', 'today', 'payrollPeriod', 'payrollCycleConfig', 'workers', 'entries', 'allocations', 'settlements', 'dailyBatches', 'costings', 'jobs', 'machines', 'assignments', 'machineJobContexts', 'batchRevisions'] as const) expect(production[key]).toEqual(complete[key])
        expect(production.jobs[0].status).toBe('active')
        expect(production.batchRevisions[0]).toMatchObject({ change_kind: 'corrected', correction_reason: 'Meter correction', revision_number: 2 })
        for (const key of ['advances', 'incentives', 'settlementLines', 'payrollPeriods'] as const) expect(production[key]).toEqual([])
    })

    it.each(['production', 'payroll'] as const)('continues short server pages without date truncation for %s', async scope => {
        fixture.cap = 2
        fixture.rows.base_production_entries = Array.from({ length: 7 }, (_, i) => ({ ...fixture.rows.base_production_entries[0], id: `old-${i}`, production_date: `2024-01-0${i + 1}` }))
        const data = await load(scope)
        expect(data.entries).toHaveLength(8)
        expect(data.entries.some(entry => entry.production_date === '2024-01-01')).toBe(true)
        const pages = fixture.queries.filter(query => query.table === 'base_production_entries')
        expect(pages.map(query => query.range)).toEqual([[0, 499], [2, 501], [4, 503], [6, 505]])
        expect(pages.map(query => query.count)).toEqual(['exact', undefined, undefined, undefined])
        expect(pages.every(query => query.filters.length === 1 && query.filters[0][0] === 'org_id')).toBe(true)
    })

    it('fails instead of returning partial payroll when counted history disappears', async () => {
        fixture.cap = 1
        fixture.truncateTable = 'base_production_entries'
        await expect(load('payroll')).rejects.toThrow('Production history changed while loading')
    })

    it.each([...shared, ...payrollOnly])('surfaces payroll query failures in %s', async table => {
        fixture.errorTable = table
        await expect(load('payroll')).rejects.toThrow('Unavailable')
    })

    it('does not silently treat a rejected payroll-period read as an empty period history', async () => {
        fixture.rejectTable = 'base_payroll_periods'
        await expect(load('payroll')).rejects.toThrow('Connection interrupted')
    })

    it('surfaces a rejected cycle read without returning fallback financial periods', async () => {
        fixture.rejectTable = 'base_payroll_cycle_configs'
        await expect(load('payroll')).rejects.toThrow('Connection interrupted')
    })

    it('does not mix another organization into scoped financial evidence', async () => {
        fixture.rows.base_production_entries.push({ ...fixture.rows.base_production_entries[0], id: 'foreign', org_id: 'tenant-two', meters: 99999 })
        const data = await load('payroll')
        expect(data.entries.some(entry => entry.id === 'foreign')).toBe(false)
        expect(payables(data).find(worker => worker.worker_id === 'piece')?.gross_pay).toBe(285)
        fixture.orgId = 'tenant-two'
        fixture.queries = []
        await load('payroll')
        expect(fixture.queries.every(query => query.filters[0][1] === 'tenant-two')).toBe(true)
    })

    it('uses explicit payroll scope from the payroll route', async () => {
        await PayrollPage()
        expect(queriedTables()).toEqual([...shared, ...payrollOnly].sort())
    })

    it('uses production scope from overview and the delegated daily-sheet route', async () => {
        await ProductionPage({})
        expect(queriedTables()).toEqual([...shared, ...productionOnly].sort())
        fixture.queries = []
        const page = DailySheetPage()
        expect(page.type).toBe(ProductionPage)
        await ProductionPage(page.props)
        expect(queriedTables()).toEqual([...shared, ...productionOnly].sort())
    })
})
