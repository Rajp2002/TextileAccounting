import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

type Row = Record<string, unknown>
type Query = { table: string; columns?: string; count?: string; filters: Array<[string, unknown]>; orders: Array<[string, unknown]>; range?: [number, number] }
const fixture = vi.hoisted(() => ({
    tier: 'base', orgId: 'tenant-one', userId: 'owner-one', today: '2026-10-02', roleDenied: false,
    rows: {} as Record<string, Row[]>, queries: [] as Query[], events: [] as string[],
    errorTable: '', cap: 500, truncateAfterFirst: '',
    query: new URLSearchParams(), title: vi.fn(), metadata: { assignments: 'completed' },
    client: vi.fn(), role: vi.fn(), plan: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({ requireRole: fixture.role }))
vi.mock('@/lib/subscription', () => ({ getCachedOrgPlanAccess: fixture.plan }))
vi.mock('@/lib/supabase/server', () => ({ createClient: fixture.client }))
vi.mock('@/lib/time', async importOriginal => ({ ...(await importOriginal<typeof import('../lib/time')>()), getSuratTodayString: () => fixture.today }))
vi.mock('next/navigation', () => ({ useSearchParams: () => fixture.query }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ tx: (value: string) => `Localized: ${value}` }) }))
vi.mock('@/hooks/use-localized-page-title', () => ({ useLocalizedPageTitle: fixture.title }))
vi.mock('@/components/tours/TourSampleBanner', () => ({ TourSampleBanner: () => null }))
vi.mock('../app/(dashboard)/owner/production/BaseAssignmentWorkspace', () => ({ default: () => null }))

import { loadBaseAssignmentsInitialData } from '../app/(dashboard)/owner/assignments/loaders'
import { loadBaseProductionInitialData } from '../app/(dashboard)/owner/production/loaders'
import BaseAssignmentsClient from '../app/(dashboard)/owner/assignments/BaseAssignmentsClient'
import AssignmentsPage from '../app/(dashboard)/owner/assignments/page'

const tables = ['base_production_workers', 'base_production_machines', 'base_production_jobs', 'base_worker_machine_assignments', 'base_machine_job_contexts']
const workerId = '11111111-1111-4111-8111-111111111111'
const machineId = '22222222-2222-4222-8222-222222222222'

function client() {
    return {
        from(table: string) {
            const query: Query = { table, filters: [], orders: [] }
            fixture.queries.push(query)
            const chain = {
                select(columns: string, options?: { count?: string }) { query.columns = columns; query.count = options?.count; return chain },
                eq(column: string, value: unknown) { query.filters.push([column, value]); return chain },
                is(column: string, value: unknown) { query.filters.push([column, value]); return chain },
                order(column: string, options?: unknown) { query.orders.push([column, options]); return chain },
                range(from: number, to: number) {
                    query.range = [from, to]
                    const rows = fixture.rows[table] ?? []
                    return Promise.resolve({
                        data: fixture.truncateAfterFirst === table && from > 0 ? [] : rows.slice(from, Math.min(to + 1, from + fixture.cap)),
                        error: fixture.errorTable === table ? { message: 'private database detail' } : null,
                        count: query.count === 'exact' ? rows.length : null,
                    })
                },
                maybeSingle() { return Promise.resolve({ data: table === 'organizations' ? { name: 'Fixture factory' } : null, error: null }) },
            }
            return chain
        },
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    fixture.tier = 'base'
    fixture.orgId = 'tenant-one'
    fixture.userId = 'owner-one'
    fixture.roleDenied = false
    fixture.errorTable = ''
    fixture.cap = 500
    fixture.truncateAfterFirst = ''
    fixture.queries = []
    fixture.events = []
    fixture.query = new URLSearchParams()
    fixture.rows = {
        base_production_workers: [{ id: workerId, name: 'Asha', rate_per_meter: '1.25', pay_type: 'fixed_monthly', monthly_salary: '12000', salary_history: [], operator_eligible: true, operator_effective_from: '2026-01-01', shift_availability: 'both', is_active: true, updated_at: '2026-10-01' }],
        base_production_machines: [{ id: machineId, name: 'Loom 1', machine_type: 'rapier', custom_label: null, is_active: true }],
        base_production_jobs: [{ id: 'job-1', costing_id: 'costing-1', costing_group_id: null, costing_version: '2', quality_label: 'Grey', target_meters: '1200', start_date: '2026-09-01', due_date: null, customer_reference: '', notes: null, status: 'planned', worker_rate_per_meter: '2.5', planned_cost_per_meter: '25.5', planned_price_per_meter: '30', created_at: '2026-09-01T00:00:00.000Z' }],
        base_worker_machine_assignments: [{ id: 'assignment-1', worker_id: workerId, machine_id: machineId, shift: 'night', active: true, effective_from: '2026-09-01', effective_to: null }],
        base_machine_job_contexts: [{ id: 'context-1', machine_id: machineId, job_id: 'job-1', active: true, effective_from: '2026-09-01', effective_to: null }],
    }
    fixture.role.mockImplementation(async (roles: string[]) => {
        fixture.events.push('role')
        expect(roles).toEqual(['owner'])
        if (fixture.roleDenied) throw new Error('Not authorized')
        return { profile: { org_id: fixture.orgId }, user: { id: fixture.userId, user_metadata: { tour_preferences: fixture.metadata } } }
    })
    fixture.plan.mockImplementation(async (orgId: string) => {
        fixture.events.push('plan')
        expect(orgId).toBe(fixture.orgId)
        return { effectiveTier: fixture.tier }
    })
    fixture.client.mockImplementation(async () => { fixture.events.push('client'); return client() })
})

describe('authorized, focused assignment loading', () => {
    it('reads exactly the five operational datasets after role and entitlement checks', async () => {
        const data = await loadBaseAssignmentsInitialData()
        expect(fixture.events).toEqual(['role', 'plan', 'client'])
        expect(fixture.queries.map(query => query.table)).toEqual(tables)
        for (const query of fixture.queries) {
            expect(query.filters).toEqual([['org_id', 'tenant-one']])
            expect(query.orders.at(-1)).toEqual(['id', undefined])
            expect(query.range).toEqual([0, 499])
        }
        expect(data?.initialData).toMatchObject({ orgId: 'tenant-one', actorId: 'owner-one', today: fixture.today })
        expect(data?.tourMetadata).toEqual({ tour_preferences: fixture.metadata })
        expect(Object.keys(data!.initialData).sort()).toEqual(['actorId', 'assignments', 'jobs', 'machineJobContexts', 'machines', 'orgId', 'today', 'workers'])
    })

    it.each(['none', 'free', 'lite'])('denies %s before constructing a database client', async tier => {
        fixture.tier = tier
        expect(await loadBaseAssignmentsInitialData()).toBeNull()
        expect(fixture.events).toEqual(['role', 'plan'])
        expect(fixture.client).not.toHaveBeenCalled()
        expect(fixture.queries).toEqual([])
    })

    it('does not query plan or business data after authorization fails', async () => {
        fixture.roleDenied = true
        await expect(loadBaseAssignmentsInitialData()).rejects.toThrow('Not authorized')
        expect(fixture.plan).not.toHaveBeenCalled()
        expect(fixture.client).not.toHaveBeenCalled()
    })

    it('resolves tenant scope on every call', async () => {
        await loadBaseAssignmentsInitialData()
        fixture.orgId = 'tenant-two'
        fixture.userId = 'owner-two'
        const data = await loadBaseAssignmentsInitialData()
        expect(data?.initialData).toMatchObject({ orgId: 'tenant-two', actorId: 'owner-two' })
        expect(fixture.queries.slice(5).every(query => query.filters[0][1] === 'tenant-two')).toBe(true)
    })

    it.each(tables)('fails visibly when %s cannot load', async table => {
        fixture.errorTable = table
        await expect(loadBaseAssignmentsInitialData()).rejects.toThrow('Unable to load assignments. Please retry.')
    })

    it('retains complete history despite a server row cap below the requested page size', async () => {
        fixture.cap = 2
        for (const table of tables) {
            const base = fixture.rows[table][0]
            fixture.rows[table] = Array.from({ length: 7 }, (_, index) => ({ ...base, id: `${table}-${index}`, active: index % 2 === 0, is_active: index % 2 === 0, effective_from: index < 3 ? '2025-01-01' : '2027-01-01', effective_to: index < 3 ? '2025-12-31' : null }))
        }
        const data = (await loadBaseAssignmentsInitialData())!.initialData
        for (const key of ['workers', 'machines', 'jobs', 'assignments', 'machineJobContexts'] as const) expect(data[key]).toHaveLength(7)
        expect(data.assignments[0].effective_to).toBe('2025-12-31')
        expect(data.assignments[5]).toMatchObject({ active: false, effective_from: '2027-01-01' })
        for (const table of tables) {
            const pages = fixture.queries.filter(query => query.table === table)
            expect(pages.map(query => query.range)).toEqual([[0, 499], [2, 501], [4, 503], [6, 505]])
            expect(pages.map(query => query.count)).toEqual(['exact', undefined, undefined, undefined])
            expect(pages.every(query => query.orders.at(-1)?.[0] === 'id')).toBe(true)
        }
    })

    it('does not return a partial workspace when counted history disappears during loading', async () => {
        fixture.cap = 1
        fixture.rows.base_worker_machine_assignments.push({ ...fixture.rows.base_worker_machine_assignments[0], id: 'assignment-2' })
        fixture.truncateAfterFirst = 'base_worker_machine_assignments'
        await expect(loadBaseAssignmentsInitialData()).rejects.toThrow('Unable to load assignments. Please retry.')
    })

    it('matches full-loader query scopes, selected fields, ordering, and normalization for all five datasets', async () => {
        fixture.rows.base_production_jobs.push({ id: 'fallback-job', costing_id: 'costing-2', start_date: 'invalid', status: 'invalid', costing_version: 0 })
        fixture.rows.base_worker_machine_assignments.push({ id: 'historic-assignment', worker_id: workerId, machine_id: machineId, shift: 'invalid', active: false, effective_from: 'invalid', effective_to: '2025-12-31' })
        fixture.rows.base_machine_job_contexts.push({ id: 'historic-context', machine_id: machineId, job_id: 'fallback-job', active: false, effective_from: 'invalid', effective_to: '' })
        const lean = (await loadBaseAssignmentsInitialData(fixture.today))!.initialData
        const leanQueries = [...fixture.queries]
        fixture.queries = []
        const full = await loadBaseProductionInitialData(fixture.orgId, fixture.today)
        for (const key of ['workers', 'machines', 'jobs', 'assignments', 'machineJobContexts'] as const) expect(lean[key]).toEqual(full[key])
        for (const query of leanQueries) expect(query).toEqual(fixture.queries.find(fullQuery => fullQuery.table === query.table))
    })

    it('keeps assignment eligibility equal when full production history promotes a planned job to active', async () => {
        fixture.rows.base_production_entries = [{ id: 'entry-1', worker_id: workerId, job_id: 'job-1', production_date: fixture.today, meters: '5', worker_rate_snapshot: '2.5' }]
        const lean = (await loadBaseAssignmentsInitialData())!.initialData
        const full = await loadBaseProductionInitialData(fixture.orgId, fixture.today)
        expect(lean.jobs[0].status).toBe('planned')
        expect(full.jobs[0].status).toBe('active')
        const eligibleIds = (jobs: typeof lean.jobs) => jobs.filter(job => job.status === 'planned' || job.status === 'active').map(job => job.id)
        expect(eligibleIds(lean.jobs)).toEqual(eligibleIds(full.jobs))
    })
})

describe('thin assignment route and client parity', () => {
    it('passes the focused data and tour metadata through the page', async () => {
        const page = await AssignmentsPage()
        expect(page?.type).toBe(BaseAssignmentsClient)
        expect(page?.props.initialData.actorId).toBe('owner-one')
        expect(page?.props.tourMetadata).toEqual({ tour_preferences: fixture.metadata })
    })

    it('returns no workspace when the plan does not allow assignments', async () => {
        fixture.tier = 'lite'
        expect(await AssignmentsPage()).toBeNull()
        expect(fixture.queries).toEqual([])
    })

    it('preserves focus IDs, shift, remount key, tour metadata, return link, and localized title', async () => {
        const data = (await loadBaseAssignmentsInitialData())!
        fixture.query = new URLSearchParams({ worker: workerId, machine: machineId, shift: 'night', returnTo: '/owner/production/daily-sheet?date=2026-10-01&shift=night' })
        const html = renderToStaticMarkup(createElement(function ClientPropsProbe() {
            const tree = BaseAssignmentsClient(data)
            const workspace = tree.props.children.at(-1)
            expect(workspace.key).toBe(`tenant-one:${workerId}:${machineId}:night`)
            expect(workspace.props).toMatchObject({ initialData: data.initialData, focusWorkerId: workerId, focusMachineId: machineId, initialShift: 'night', tourMetadata: data.tourMetadata })
            return tree
        }))
        expect(html).toContain('href="/owner/production/daily-sheet?date=2026-10-01&amp;shift=night"')
        expect(html).toContain('Localized: Worker–Machine Assignments')
        expect(fixture.title).toHaveBeenCalledWith('Localized: Worker–Machine Assignments | Weavly')
    })

    it('retains default day key and rejects an unsafe return URL', async () => {
        const data = (await loadBaseAssignmentsInitialData())!
        fixture.query = new URLSearchParams({ returnTo: 'https://other.test', shift: 'invalid' })
        const html = renderToStaticMarkup(createElement(function ClientKeyProbe() {
            const tree = BaseAssignmentsClient(data)
            expect(tree.props.children.at(-1).key).toBe('tenant-one:all:all:day')
            return tree
        }))
        expect(html).not.toContain('https://other.test')
    })
})
