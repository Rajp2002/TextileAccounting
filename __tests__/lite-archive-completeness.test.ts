import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasOwnerArchiveAccess } from '@/lib/subscription-access'

// LT07 (LC48, LC49): the owner's JSON archive is complete above the server's
// row cap, includes retained Free costings, stays tenant-scoped, fails closed
// on any page error, and stays reachable after paid access ends.

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

const SERVER_ROW_CAP = 1000
const ORG = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const OWNER = '00000000-0000-4000-8000-0000000000aa'

const ctx = vi.hoisted(() => ({
    tables: {} as Record<string, Record<string, unknown>[]>,
    requests: [] as { table: string; filters: string[] }[],
    failTable: null as null | { table: string; onRequest: number },
    inserted: [] as { table: string; row: Record<string, unknown> }[],
    access: { effectiveTier: 'lite', freeAccount: false } as Record<string, unknown>,
}))

class FakeQuery implements PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }> {
    private filters: Filter[] = []
    private described: string[] = []
    private orders: { column: string; ascending: boolean }[] = []
    private max: number | null = null
    private offset: [number, number] | null = null
    constructor(private readonly table: string) {}
    select() { return this }
    eq(column: string, value: unknown) { this.described.push(`eq:${column}`); this.filters.push(row => row[column] === value); return this }
    gt(column: string, value: unknown) { this.filters.push(row => String(row[column]) > String(value)); return this }
    in(column: string, values: unknown[]) { this.described.push(`in:${column}`); this.filters.push(row => values.includes(row[column])); return this }
    or(expression: string) { this.described.push(`or:${expression}`); if (expression !== 'target_entity.neq.WEAVLY,grievance_type.neq.DATA_PRIVACY') throw new Error('Unexpected export filter'); this.filters.push(row => row.target_entity !== 'WEAVLY' || row.grievance_type !== 'DATA_PRIVACY'); return this }
    order(column: string, options: { ascending?: boolean } = {}) { this.orders.push({ column, ascending: options.ascending !== false }); return this }
    limit(count: number) { this.max = count; return this }
    range(from: number, to: number) { this.offset = [from, to]; return this }
    then<A = never, B = never>(resolve?: ((value: { data: Row[] | null; error: { message: string; code?: string } | null }) => A | PromiseLike<A>) | null, reject?: ((reason: unknown) => B | PromiseLike<B>) | null) {
        return Promise.resolve(this.run()).then(resolve, reject)
    }
    private run() {
        ctx.requests.push({ table: this.table, filters: this.described })
        const count = ctx.requests.filter(request => request.table === this.table).length
        if (ctx.failTable && ctx.failTable.table === this.table && ctx.failTable.onRequest === count) {
            return { data: null, error: { message: 'connection reset', code: '08006' } }
        }
        let rows = (ctx.tables[this.table] ?? []).filter(row => this.filters.every(filter => filter(row)))
        rows = [...rows].sort((a, b) => {
            for (const { column, ascending } of this.orders) {
                const order = String(a[column]).localeCompare(String(b[column]))
                if (order !== 0) return ascending ? order : -order
            }
            return 0
        })
        if (this.offset) rows = rows.slice(this.offset[0], this.offset[1] + 1)
        // PostgREST caps every response, whatever was requested.
        return { data: rows.slice(0, Math.min(this.max ?? Infinity, SERVER_ROW_CAP)), error: null }
    }
}

function fakeClient() {
    return {
        from(table: string) {
            const query = new FakeQuery(table)
            return Object.assign(query, {
                insert(row: Record<string, unknown>) {
                    ctx.inserted.push({ table, row })
                    const stored = { id: `run-${ctx.inserted.length}`, ...row }
                    return { select: () => ({ single: async () => ({ data: stored, error: null }) }) }
                },
                delete() { return { eq: () => ({ eq: async () => ({ error: null }) }) } },
            })
        },
        rpc: async () => ({ data: null, error: null }),
    }
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({
    requireRole: async () => ({ user: { id: OWNER }, profile: { org_id: ORG, role: 'owner', full_name: 'Owner' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeClient() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeClient() }))
vi.mock('@/lib/subscription', () => ({ getCachedOrgPlanAccess: async () => ctx.access }))
vi.mock('@/lib/support/data-rights', () => ({ readOwnSupportExport: async () => ({ scope: 'requester_public_support', asOf: '2026-10-04T00:00:00Z', datasets: { support_tickets: [], support_messages: [], support_ticket_events: [] } }) }))

const { exportOrganizationData } = await import('@/app/(dashboard)/owner/settings/data-export')

const uuid = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`

beforeEach(() => {
    ctx.requests = []
    ctx.inserted = []
    ctx.failTable = null
    ctx.access = { effectiveTier: 'lite', freeAccount: false }
    ctx.tables = {
        organizations: [{ id: ORG, name: 'Lite Weaver' }, { id: OTHER, name: 'Other' }],
        grievances: [{ id: uuid(90000), org_id: ORG, target_entity: 'WEAVLY', grievance_type: 'DATA_PRIVACY', description: 'PRIVATE OPERATOR CASE' }, { id: uuid(90001), org_id: ORG, target_entity: 'WEAVLY', grievance_type: 'UNLOCK_REQUEST', description: 'Owner unlock intake' }],
        // Above the server cap, with long runs of equal timestamps.
        audit_log: [
            ...Array.from({ length: 2345 }, (_, index) => ({ id: uuid(index), org_id: ORG, changed_at: `2026-09-${String(1 + Math.floor(index / 700)).padStart(2, '0')}` })),
            { id: uuid(9999), org_id: OTHER, changed_at: '2026-09-01' },
        ],
        machines: Array.from({ length: 450 }, (_, index) => ({ id: `m-${String(index).padStart(4, '0')}`, org_id: ORG })),
        machine_assignments: Array.from({ length: 1200 }, (_, index) => ({ id: `a-${String(index).padStart(5, '0')}`, machine_id: `m-${String(index % 450).padStart(4, '0')}` })),
        free_saved_costings: [
            { id: uuid(20001), org_id: ORG, subject_id: OWNER, label: 'Free costing A' },
            { id: uuid(20002), org_id: OTHER, subject_id: 'someone', label: 'Not ours' },
        ],
        payroll_configs: [{ org_id: ORG, cycle: 'weekly' }, { org_id: OTHER, cycle: 'monthly' }],
        whatsapp_cooldowns: [
            { org_id: ORG, alert_type: 'a', ref_id: '1' }, { org_id: ORG, alert_type: 'a', ref_id: '2' }, { org_id: ORG, alert_type: 'b', ref_id: '1' },
        ],
        base_daily_production_entries: [
            ...Array.from({ length: 1200 }, (_, index) => ({ id: uuid(30000 + index), org_id: ORG, entry_status: 'entered' })),
            { id: uuid(39999), org_id: OTHER, entry_status: 'entered' },
        ],
        base_payroll_advance_recoveries: Array.from({ length: 1100 }, (_, index) => ({ org_id: ORG, settlement_id: `s-${String(index % 7).padStart(2, '0')}`, advance_id: `a-${String(index).padStart(5, '0')}` })),
        base_payroll_reversals: [{ org_id: ORG, settlement_id: 's-01', reason: 'Paid twice' }, { org_id: OTHER, settlement_id: 's-99', reason: 'Not ours' }],
        factory_supervisors: [{ org_id: ORG, user_id: 'u-1', status: 'approved' }, { org_id: OTHER, user_id: 'u-2', status: 'approved' }],
        document_branding_settings: [{ org_id: ORG, business_address: 'Sachin GIDC', phone: '9876543210' }],
        delivery_challans: [{ id: uuid(40001), org_id: ORG, number: 'DC1', document: { customer_name: 'Shah', customer_phone: '9876500000' } }],
    }
})

type ExportPayload = Awaited<ReturnType<typeof exportOrganizationData>> & {
    datasets: Record<string, Row[]>
    dataset_counts: Record<string, number>
    dataset_catalog: string[]
    completeness: { status: string; page_size: number; consistency: string }
}

describe('owner archive completeness', () => {
    it('keeps operator privacy cases out of the organization download while retaining owner operational intake', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.datasets.grievances.map(row => row.description)).toEqual(['Owner unlock intake'])
        expect(JSON.stringify(payload)).not.toContain('PRIVATE OPERATOR CASE')
        expect(ctx.requests.find(request => request.table === 'grievances')?.filters).toContain('or:target_entity.neq.WEAVLY,grievance_type.neq.DATA_PRIVACY')
    })
    it('exports every row of a dataset larger than the server row cap, once', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        const ids = payload.datasets.audit_log.map(row => row.id)
        expect(ids).toHaveLength(2345)
        expect(new Set(ids).size).toBe(2345)
        expect(payload.dataset_counts.audit_log).toBe(2345)
    })

    it('exports assignments for every machine, beyond the cap and across lookup batches', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.datasets.machine_assignments).toHaveLength(1200)
    })

    it('includes retained Free costings for this organization only', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.dataset_catalog).toContain('free_saved_costings')
        expect(payload.datasets.free_saved_costings.map(row => row.label)).toEqual(['Free costing A'])
    })

    it('keeps one-row and composite-key datasets', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.datasets.payroll_configs).toEqual([{ org_id: ORG, cycle: 'weekly' }])
        expect(payload.datasets.base_payroll_reversals.map(row => row.settlement_id)).toEqual(['s-01'])
        expect(payload.datasets.whatsapp_cooldowns).toHaveLength(3)
    })

    it('scopes every read to this organization', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.datasets.audit_log.every(row => row.org_id === ORG)).toBe(true)
        for (const request of ctx.requests) {
            expect(request.filters.some(filter => filter.startsWith('eq:') || filter === 'in:machine_id' || filter === 'in:referral_code_id'), request.table).toBe(true)
        }
    })

    it('states what complete means', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.completeness).toMatchObject({ status: 'complete', page_size: 1000 })
        expect(payload.completeness.consistency).toMatch(/not a point-in-time backup/)
    })

    it('fails the whole export, and records the failure, when any page fails', async () => {
        ctx.failTable = { table: 'audit_log', onRequest: 2 }
        await expect(exportOrganizationData()).rejects.toThrow('The organization export is incomplete. No export was generated; please try again.')
        expect(ctx.inserted.map(entry => entry.row.status)).toEqual(['failed'])
    })
})

describe('current Base, dispatch and settings records', () => {
    const added = [
        'base_production_machines', 'base_worker_machine_assignments', 'base_machine_job_contexts', 'base_production_batches',
        'base_production_batch_revisions', 'base_daily_production_entries', 'base_daily_production_allocations', 'factory_supervisors',
        'base_payroll_settlement_lines', 'base_payroll_reversals', 'base_payroll_advance_recoveries', 'base_payroll_periods',
        'base_payroll_cycle_configs', 'base_worker_incentives', 'base_staff_days_off', 'document_branding_settings', 'document_branding_logo_assets',
        'delivery_challans', 'delivery_challan_events', 'free_account_grants', 'plan_usage_events', 'web_vital_samples',
    ]

    it('exports every table the current Base, challan and branding screens write', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        for (const key of added) {
            expect(payload.dataset_catalog, key).toContain(key)
            expect(payload.datasets[key], key).toBeDefined()
            expect(ctx.requests.find(request => request.table === key)?.filters, key).toContain('eq:org_id')
        }
    })

    it('reads daily production beyond the row cap for this organization only', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.datasets.base_daily_production_entries).toHaveLength(1200)
        expect(payload.datasets.base_daily_production_entries.every(row => row.org_id === ORG)).toBe(true)
    })

    it('pages tables keyed by something other than id', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.datasets.base_payroll_advance_recoveries).toHaveLength(1100)
        expect(new Set(payload.datasets.base_payroll_advance_recoveries.map(row => row.advance_id)).size).toBe(1100)
        expect(payload.datasets.base_payroll_reversals.map(row => row.reason)).toEqual(['Paid twice'])
        expect(payload.datasets.factory_supervisors.map(row => row.user_id)).toEqual(['u-1'])
        expect(payload.datasets.document_branding_settings.map(row => row.business_address)).toEqual(['Sachin GIDC'])
    })

    it('redacts phone numbers in the new records, including inside challan documents', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(JSON.stringify(payload)).not.toContain('9876543210')
        expect(JSON.stringify(payload)).not.toContain('9876500000')
        expect(payload.datasets.delivery_challans[0].document).toMatchObject({ customer_name: 'Shah', customer_phone: '[REDACTED]' })
    })

    it('names what it leaves out, and never reads it', async () => {
        const payload = await exportOrganizationData() as ExportPayload & { excluded_sources: { tables: string[]; reason: string }[] }
        const excluded = payload.excluded_sources.flatMap(source => source.tables)
        for (const table of ['supervisor_join_codes', 'estimator_costing_attestations', 'base_production_save_receipts', 'base_payroll_payment_requests']) {
            expect(excluded).toContain(table)
            expect(ctx.requests.some(request => request.table === table), table).toBe(false)
        }
        for (const source of payload.excluded_sources) expect(source.reason.length).toBeGreaterThan(20)
    })
})

describe('retained owner access to the archive', () => {
    it('allows every cohort that ever had paid access, but not a pure Free account', () => {
        expect(hasOwnerArchiveAccess({ effectiveTier: 'free', freeAccount: true })).toBe(false)
        expect(hasOwnerArchiveAccess({ effectiveTier: 'none', freeAccount: true })).toBe(true) // former Free, paid Lite expired
        expect(hasOwnerArchiveAccess({ effectiveTier: 'none' })).toBe(true) // never Free, paid Lite expired
        expect(hasOwnerArchiveAccess({ effectiveTier: 'lite' })).toBe(true)
        expect(hasOwnerArchiveAccess({ effectiveTier: 'base' })).toBe(true)
    })

    it('lets a former-Free owner whose paid plan ended export, and keeps a pure Free owner out', async () => {
        ctx.access = { effectiveTier: 'none', freeAccount: true }
        await expect(exportOrganizationData()).resolves.toBeTruthy()
        ctx.access = { effectiveTier: 'free', freeAccount: true }
        await expect(exportOrganizationData()).rejects.toThrow('NEXT_REDIRECT')
    })

    it('opens the export route and its history for retained owners at every guard', () => {
        const layout = readFileSync('app/(dashboard)/owner/layout.tsx', 'utf8')
        const page = readFileSync('app/(dashboard)/owner/data-export/page.tsx', 'utf8')
        const action = readFileSync('app/(dashboard)/owner/settings/data-export.ts', 'utf8')
        const proxy = readFileSync('proxy.ts', 'utf8')
        expect(layout).toContain("const retainedArchive = pathname.startsWith('/owner/data-export') && hasOwnerArchiveAccess(access)")
        expect(layout.match(/requireRole\(\['owner'\], \{ allowFreeAccount: true \}\)/g)?.length).toBe(3)
        expect(page).toContain("requireRole(['owner'], { allowFreeAccount: true })")
        // One guard for every archive action, JSON and CSV.
        const guard = readFileSync('lib/retained-archive-owner.ts', 'utf8')
        const csvActions = readFileSync('app/(dashboard)/owner/data-export/csv-actions.ts', 'utf8')
        expect(guard).toContain("requireRole(['owner'], { allowFreeAccount: true })")
        expect(guard).toContain("if (!hasOwnerArchiveAccess(await getCachedOrgPlanAccess(session.profile.org_id))) redirect('/free')")
        expect(action.match(/await requireRetainedArchiveOwner\(\)/g)?.length).toBe(2)
        expect(action.match(/^export async function/gm)?.length).toBe(2)
        expect(csvActions.match(/await requireRetainedArchiveOwner\(\)/g)?.length).toBe(1)
        expect(csvActions.match(/^export async function/gm)?.length).toBe(1)
        expect(proxy).toContain("!pathname.startsWith('/owner/data-export')")
    })
})

describe('archive consistency note', () => {
    it('describes concurrent dataset reads accurately', async () => {
        const payload = await exportOrganizationData() as ExportPayload
        expect(payload.completeness.consistency).toContain('Datasets are read separately')
        expect(payload.completeness.consistency).not.toContain('one after another')
    })
})
