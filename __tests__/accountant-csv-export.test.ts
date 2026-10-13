import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState } from '@/lib/estimator'
import {
    buildChallanPaymentsCsv,
    buildChallansCsv,
    buildCostingsCsv,
    buildDailyProductionCsv,
    buildQualitiesCsv,
    buildRateBookCsv,
    CHALLANS_CSV_HEADERS,
    COSTINGS_CSV_HEADERS,
    DAILY_PRODUCTION_CSV_HEADERS,
    toCsv,
} from '@/lib/accountant-csv'
import { ACCOUNTANT_CSV_AREAS } from '@/lib/accountant-csv-areas'

// Accountant CSV downloads on /owner/data-export: flat tables a munim can
// open in Excel, read completely and tenant-scoped like the JSON archive,
// audited, and failing closed.

type Row = Record<string, unknown>

/** Minimal RFC 4180 reader for the files under test. */
function parseCsv(csv: string) {
    expect(csv.startsWith('﻿')).toBe(true)
    const rows: string[][] = []
    let row: string[] = []
    let cell = ''
    let quoted = false
    const body = csv.slice(1)
    for (let index = 0; index < body.length; index += 1) {
        const char = body[index]
        if (quoted) {
            if (char === '"' && body[index + 1] === '"') { cell += '"'; index += 1 }
            else if (char === '"') quoted = false
            else cell += char
        } else if (char === '"') quoted = true
        else if (char === ',') { row.push(cell); cell = '' }
        else if (char === '\r' && body[index + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; index += 1 }
        else cell += char
    }
    row.push(cell)
    rows.push(row)
    const [headers, ...records] = rows
    return records.map(record => Object.fromEntries(headers.map((header, index) => [header, record[index]])))
}

describe('CSV format', () => {
    it('writes a BOM, CRLF lines, quoted cells and no live formulas', () => {
        const csv = toCsv(['Name', 'Amount'], [['=HYPERLINK("x")', 12.5], ['Shah, "Surat"\nGodown', null], ['-5 kg', -5]])
        expect(csv.startsWith('﻿Name,Amount\r\n')).toBe(true)
        expect(parseCsv(csv)).toEqual([
            { Name: '\'=HYPERLINK("x")', Amount: '12.5' },
            { Name: 'Shah, "Surat"\nGodown', Amount: '' },
            { Name: '\'-5 kg', Amount: '-5' },
        ])
    })
})

describe('saved costings CSV', () => {
    const state = makeDefaultEstimateState()
    state.orderQuantityM = 1000
    state.isConfigured = true
    const snapshot = buildCostingResult(state, calcFullTotals(state))

    it('reads each costing from its saved snapshot, keeps older costings as saved, and adds retained Free costings', () => {
        const csv = buildCostingsCsv({
            quotes: [
                { id: 'q2', created_at: '2026-09-02T20:00:00Z', quality_label: '60 GSM Poly', party_name: 'Shah Textiles', record_kind: 'quotation', status: 'sent', version_number: 2, costing_result_snapshot: snapshot, quotation_reference: 'Q-17', quotation_valid_until: '2026-09-30', is_archived: false, reconciliation_status: 'verified' },
                { id: 'q1', created_at: '2026-08-01T06:00:00Z', quality_label: 'Old rayon', party_name: null, record_kind: 'costing', status: 'draft', version_number: 1, costing_result_snapshot: null, landed_cost_per_meter: 21.5, quote_price_per_meter: 25, production_cost_per_meter: 20, meters: 500, intended_margin_percent: 12, is_archived: true, reconciliation_status: 'legacy' },
            ],
            freeCostings: [{ id: 'f1', created_at: '2026-07-15T06:00:00Z', label: 'Free try', result: snapshot, revision: 1 }],
        })
        const rows = parseCsv(csv)
        expect(Object.keys(rows[0])).toEqual([...COSTINGS_CSV_HEADERS])
        expect(rows.map(row => row.Quality)).toEqual(['Free try', 'Old rayon', '60 GSM Poly'])
        const [free, legacy, current] = rows
        expect(free['Record type']).toBe('Free costing')
        expect(Number(free['Production cost / m'])).toBe(snapshot.productionCostPerM)
        expect(legacy).toMatchObject({ 'Record type': 'Costing', Status: 'Draft', 'Landed cost / m': '21.5', 'Selling price / m': '25', 'Order metres': '500', 'Warp yarn / m': '', Archived: 'Yes', 'Numbers check': 'Older costing' })
        // 20:00 UTC on 2 September is 3 September in Surat.
        expect(current).toMatchObject({ 'Saved on': '2026-09-03', Party: 'Shah Textiles', 'Record type': 'Quotation', Version: '2', Status: 'Sent', 'Quotation reference': 'Q-17', 'Numbers check': 'Checked' })
        expect(Number(current['Warp yarn / m'])).toBe(snapshot.breakdown.warpCostPerM)
        expect(Number(current['Selling price / m'])).toBe(snapshot.suggestedSellingPricePerM)
        expect(Number(current['Expected profit total'])).toBe(snapshot.expectedProfitTotal)
    })
})

describe('qualities CSV', () => {
    it('writes one row per yarn layer and keeps qualities saved before layers', () => {
        const rows = parseCsv(buildQualitiesCsv([
            { name: 'Zari border', is_active: false, warp_rows: [{ label: 'Body', calcDenier: 75, beamEnds: 3200, yarnRate: 140, gstPct: 5, shortagePct: null }], weft_rows: [{ calcDenier: 0, linearDensityUnit: 'cotton_count_ne', cottonCountNe: 40, picks: 64, effectiveCostingWidthCm: 112, yarnRate: 210, gstPct: 5, shortagePct: 3 }], yarn_shortage_pct: 2, created_at: '2026-01-01T06:00:00Z' },
            { name: 'Basic poly', is_active: true, yarn_denier: 75, ppi: 60, beam_ends: 3000, reed_space: 110, default_yarn_rate: 140 },
        ]))
        expect(rows).toHaveLength(3)
        expect(rows[0]).toMatchObject({ Quality: 'Basic poly', Status: 'Active', Layer: '', Denier: '75', 'Picks per inch': '60', 'Width (cm)': '110' })
        expect(rows[1]).toMatchObject({ Quality: 'Zari border', Status: 'Archived', Layer: 'Warp', Yarn: 'Body', Denier: '75', Ends: '3200', 'Yarn rate / kg': '140', 'Waste %': '2' })
        expect(rows[2]).toMatchObject({ Layer: 'Weft', Yarn: 'Weft 1', Denier: '', 'Cotton count (Ne)': '40', 'Picks per inch': '64', 'Width (cm)': '112', 'Waste %': '3' })
    })
})

describe('Rate Book CSV', () => {
    it('lists every rate with its history oldest first, and a rate without history once', () => {
        const rows = parseCsv(buildRateBookCsv({
            rates: [
                { id: 'r1', name: '75D Poly', category: 'yarn_warp', unit: 'per_kg', current_value: 150, is_active: true },
                { id: 'r2', name: 'Sizing', category: 'sizing', unit: 'per_kg', current_value: 12, previous_value: null, effective_date: '2026-05-01', is_active: false, updated_at: '2026-05-01T06:00:00Z' },
            ],
            history: [
                { id: 'h2', rate_id: 'r1', event_type: 'changed', value: 150, previous_value: 140, effective_date: '2026-09-01', source: 'Market', created_at: '2026-09-01T06:00:00Z' },
                { id: 'h1', rate_id: 'r1', event_type: 'recorded', value: 140, effective_date: '2026-06-01', created_at: '2026-06-01T06:00:00Z' },
            ],
        }))
        expect(rows.map(row => [row.Rate, row.Event, row['Rate on this date']])).toEqual([
            ['Sizing', 'Current', '12'],
            ['75D Poly', 'Recorded', '140'],
            ['75D Poly', 'Changed', '150'],
        ])
        expect(rows[0]).toMatchObject({ Category: 'Sizing', Status: 'Archived', Unit: 'Rs per kg' })
        expect(rows[2]).toMatchObject({ Category: 'Warp yarn', 'Current rate': '150', 'Previous rate': '140', Source: 'Market', 'Recorded at': '2026-09-01 11:30' })
    })
})

const challans: Row[] = [
    {
        id: 'c2', number: 'DC000000000002', quality_label: '60 GSM Poly', delivery_status: 'received', difference_status: 'accepted',
        sent_meters: 1000, acknowledged_meters: 990, chargeable_meters: 990, selling_rate: 42.35, adjustment_amount: -100, paid_amount: 20000, balance: 21826.5,
        lines: [{ lot: 'L-1', meters: 600 }, { lot: 'L-2', meters: 400 }], payment_due_date: '2026-10-15', payment_terms: '30 days',
        document: { date: '2026-09-10', customer_name: 'Shah Textiles', customer_gstin: '24ABCDE1234F1Z5', customer_phone: '9876543210', hsn: '5407', eway_bill_reference: 'EWB1' },
        issued_at: '2026-09-10T05:00:00Z', archived_at: null,
    },
    {
        id: 'c1', number: 'DC000000000001', quality_label: 'Rayon', delivery_status: 'draft', difference_status: 'none',
        sent_meters: 100, chargeable_meters: 100, selling_rate: 30, adjustment_amount: 0, paid_amount: 0, balance: 3000,
        lines: [{ lot: 'A', meters: 100 }], document: { date: '2026-09-01', customer_name: 'Mehta' },
    },
]

describe('delivery challans CSV', () => {
    it('writes one row per challan with its value, money position and no phone number', () => {
        const csv = buildChallansCsv(challans)
        expect(csv).not.toContain('9876543210')
        const rows = parseCsv(csv)
        expect(Object.keys(rows[0])).toEqual([...CHALLANS_CSV_HEADERS])
        expect(rows.map(row => row['Challan number'])).toEqual(['DC000000000001', 'DC000000000002'])
        expect(rows[0]).toMatchObject({ 'Payment status': 'Draft', 'Delivery status': 'Draft', Difference: '' })
        expect(rows[1]).toMatchObject({
            Party: 'Shah Textiles', 'Party GSTIN': '24ABCDE1234F1Z5', HSN: '5407', Lots: 'L-1 (600 m); L-2 (400 m)',
            'Metres received': '990', 'Fabric value': '41926.5', Adjustment: '-100', Paid: '20000', Balance: '21826.5',
            'Payment status': 'Part paid', 'Delivery status': 'Received', Difference: 'Accepted', 'Payment due date': '2026-10-15',
            'Payment terms': '30 days', 'E-way bill': 'EWB1', 'Issued at': '2026-09-10 10:30', Archived: 'No',
        })
    })

    it('lists payments, refunds, adjustments and reversals with their signs', () => {
        const rows = parseCsv(buildChallanPaymentsCsv({
            challans,
            events: [
                { id: 'e1', challan_id: 'c2', action: 'confirm', amount: null, payload: { data: {} }, created_at: '2026-09-10T05:00:00Z' },
                { id: 'e2', challan_id: 'c2', action: 'payment', amount: 25000, payload: { data: { date: '2026-09-20', method: 'NEFT', reason: 'UTR 123' } }, created_at: '2026-09-21T05:00:00Z' },
                { id: 'e3', challan_id: 'c2', action: 'reverse_entry', amount: -25000, reverses_id: 'e2', payload: { data: { reason: 'Bounced' } }, created_at: '2026-09-22T05:00:00Z' },
                { id: 'e4', challan_id: 'c2', action: 'payment', amount: 20000, payload: { data: { date: '2026-09-25', method: 'UPI', reason: 'Ref 9' } }, created_at: '2026-09-25T05:00:00Z' },
                { id: 'e5', challan_id: 'c2', action: 'adjustment', amount: -100, payload: { data: { reason: 'Rate difference' } }, created_at: '2026-09-26T05:00:00Z' },
            ],
        }))
        expect(rows.map(row => [row['Entry date'], row.Entry, row.Amount, row['Reversed later']])).toEqual([
            ['2026-09-20', 'Payment received', '25000', 'Yes'],
            ['2026-09-22', 'Reversal of payment received', '-25000', ''],
            ['2026-09-25', 'Payment received', '20000', ''],
            ['2026-09-26', 'Adjustment', '-100', ''],
        ])
        expect(rows[0]).toMatchObject({ 'Challan number': 'DC000000000002', Party: 'Shah Textiles', Method: 'NEFT', 'Reference or reason': 'UTR 123' })
    })
})

describe('daily production CSV', () => {
    it('writes machine rows, worker totals, absences and earlier entries, skipping blank rows', () => {
        const rows = parseCsv(buildDailyProductionCsv({
            batches: [
                { id: 'b1', production_date: '2026-10-01', shift: 'night', status: 'saved' },
                { id: 'b2', production_date: '2026-10-01', shift: 'day', status: 'finalized' },
            ],
            entries: [
                { id: 'e1', batch_id: 'b1', worker_id: 'w1', entry_status: 'entered', allocation_mode: 'machine_breakdown', meters: 180, worker_rate_snapshot: 2.5 },
                { id: 'e2', batch_id: 'b2', worker_id: 'w2', entry_status: 'entered', allocation_mode: 'worker_total', meters: 95.5, worker_rate_snapshot: 2, machine_label: 'L-3', job_label: 'Rayon', notes: 'Beam change' },
                { id: 'e3', batch_id: 'b2', worker_id: 'w1', entry_status: 'absent', allocation_mode: 'worker_total', meters: 0, worker_rate_snapshot: 2.5 },
                { id: 'e4', batch_id: 'b2', worker_id: 'w3', entry_status: 'blank', allocation_mode: 'worker_total', meters: null, worker_rate_snapshot: 0 },
                { id: 'e5', batch_id: 'b2', worker_id: 'w3', entry_status: 'entered', allocation_mode: 'worker_total', meters: 50, worker_rate_snapshot: 0, pay_basis_snapshot: 'fixed_monthly', piece_earning_state: 'inapplicable', machine_label: 'L-4', job_label: 'Poly' },
            ],
            allocations: [
                { entry_id: 'e1', machine_label: 'L-2', job_label: 'Poly', meters: 80, worker_rate_snapshot: 2.5 },
                { entry_id: 'e1', machine_label: 'L-1', job_label: 'Poly', meters: 100, worker_rate_snapshot: 2.5 },
            ],
            workers: [{ id: 'w1', name: 'Ramesh' }, { id: 'w2', name: 'Anil' }, { id: 'w3', name: 'Suresh' }],
            legacyEntries: [{ id: 'l1', worker_id: 'w2', job_id: 'j1', production_date: '2026-09-01', meters: 40, worker_rate_snapshot: 2 }],
            jobs: [{ id: 'j1', quality_label: 'Old job' }],
        }))
        expect(Object.keys(rows[0])).toEqual([...DAILY_PRODUCTION_CSV_HEADERS])
        expect(rows.map(row => [row.Date, row.Shift, row.Worker, row.Machine, row.Metres, row.Entry, row['Piece earning']])).toEqual([
            ['2026-09-01', '', 'Anil', '', '40', 'Produced', '80'],
            ['2026-10-01', 'Day', 'Anil', 'L-3', '95.5', 'Produced', '191'],
            ['2026-10-01', 'Day', 'Ramesh', '', '0', 'Absent', ''],
            ['2026-10-01', 'Day', 'Suresh', 'L-4', '50', 'Produced', ''],
            ['2026-10-01', 'Night', 'Ramesh', 'L-1', '100', 'Produced', '250'],
            ['2026-10-01', 'Night', 'Ramesh', 'L-2', '80', 'Produced', '200'],
        ])
        expect(rows[0]).toMatchObject({ Quality: 'Old job', 'Sheet status': 'Earlier entry form' })
        expect(rows[1]).toMatchObject({ Quality: 'Rayon', 'Sheet status': 'Final', Notes: 'Beam change', 'Pay basis': 'Piece rate' })
        expect(rows[3]).toMatchObject({ 'Pay basis': 'Monthly salary' })
    })
})

// ─── The server action ──────────────────────────────────────────────────────

const SERVER_ROW_CAP = 1000
const ORG = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const OWNER = '00000000-0000-4000-8000-0000000000aa'

const ctx = vi.hoisted(() => ({
    tables: {} as Record<string, Record<string, unknown>[]>,
    requests: [] as { table: string; filters: string[] }[],
    failTable: null as null | string,
    rpc: [] as { name: string; args: Record<string, unknown> }[],
    rpcError: null as null | { message: string },
    access: { effectiveTier: 'none', freeAccount: false } as Record<string, unknown>,
}))

class FakeQuery implements PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }> {
    private filters: ((row: Row) => boolean)[] = []
    private described: string[] = []
    private orders: string[] = []
    private max = Infinity
    constructor(private readonly table: string) {}
    select() { return this }
    eq(column: string, value: unknown) { this.described.push(`eq:${column}`); this.filters.push(row => row[column] === value); return this }
    gt(column: string, value: unknown) { this.filters.push(row => String(row[column]) > String(value)); return this }
    order(column: string) { this.orders.push(column); return this }
    limit(count: number) { this.max = count; return this }
    then<A = never, B = never>(resolve?: ((value: { data: Row[] | null; error: { message: string; code?: string } | null }) => A | PromiseLike<A>) | null, reject?: ((reason: unknown) => B | PromiseLike<B>) | null) {
        ctx.requests.push({ table: this.table, filters: this.described })
        if (ctx.failTable === this.table) return Promise.resolve({ data: null, error: { message: 'connection reset', code: '08006' } }).then(resolve, reject)
        const rows = (ctx.tables[this.table] ?? [])
            .filter(row => this.filters.every(filter => filter(row)))
            .sort((a, b) => this.orders.reduce((order, column) => order || String(a[column]).localeCompare(String(b[column])), 0))
        return Promise.resolve({ data: rows.slice(0, Math.min(this.max, SERVER_ROW_CAP)), error: null }).then(resolve, reject)
    }
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth', () => ({
    requireRole: async () => ({ user: { id: OWNER }, profile: { org_id: ORG, role: 'owner', full_name: 'Owner' } }),
}))
vi.mock('@/lib/subscription', () => ({ getCachedOrgPlanAccess: async () => ctx.access }))
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => ({
        from: (table: string) => new FakeQuery(table),
        rpc: async (name: string, args: Record<string, unknown>) => { ctx.rpc.push({ name, args }); return { data: null, error: ctx.rpcError } },
    }),
}))

const { exportAccountantCsv } = await import('@/app/(dashboard)/owner/data-export/csv-actions')

const uuid = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`

beforeEach(() => {
    ctx.requests = []
    ctx.rpc = []
    ctx.failTable = null
    ctx.rpcError = null
    ctx.access = { effectiveTier: 'none', freeAccount: false }
    ctx.tables = {
        delivery_challans: [
            ...Array.from({ length: 1500 }, (_, index) => ({
                id: uuid(index), org_id: ORG, number: `DC${String(index).padStart(12, '0')}`, quality_label: 'Poly', delivery_status: 'sent',
                difference_status: 'none', sent_meters: 10, chargeable_meters: 10, selling_rate: 40, adjustment_amount: 0, paid_amount: 0, balance: 400,
                lines: [], document: { date: '2026-09-01', customer_name: 'Shah' },
            })),
            { id: uuid(99999), org_id: OTHER, number: 'DC-OTHER', document: { date: '2026-09-01', customer_name: 'Not ours' }, lines: [] },
        ],
        cost_rate_book: [{ id: uuid(1), org_id: ORG, name: 'Poly', category: 'yarn_warp', unit: 'per_kg', current_value: 150 }],
        cost_rate_history: [{ id: uuid(2), org_id: ORG, rate_id: uuid(1), event_type: 'recorded', value: 150, created_at: '2026-09-01T00:00:00Z' }],
    }
})

describe('accountant CSV action', () => {
    it('reads every row of a large area for this organization only, and names the file by area', async () => {
        const { filename, csv } = await exportAccountantCsv('challans')
        expect(filename).toMatch(/^weavly-challans-\d{8}-\d{4}\.csv$/)
        const rows = parseCsv(csv)
        expect(rows).toHaveLength(1500)
        expect(new Set(rows.map(row => row['Challan number'])).size).toBe(1500)
        expect(csv).not.toContain('Not ours')
        for (const request of ctx.requests) expect(request.filters, request.table).toContain('eq:org_id')
    })

    it('reads each area from its own tables', async () => {
        await exportAccountantCsv('rate_book')
        expect([...new Set(ctx.requests.map(request => request.table))].sort()).toEqual(['cost_rate_book', 'cost_rate_history'])
    })

    it('records an EXPORT audit entry for each download', async () => {
        const { filename } = await exportAccountantCsv('rate_book')
        expect(ctx.rpc).toEqual([{ name: 'log_export_event', args: expect.objectContaining({ p_org_id: ORG, p_actor_id: OWNER, p_table_name: 'owner_csv_export', p_record_id: 'rate_book' }) }])
        expect(String(ctx.rpc[0].args.p_description)).toContain(filename)
    })

    it('fails closed, without an audit entry, when any read fails', async () => {
        ctx.failTable = 'cost_rate_history'
        await expect(exportAccountantCsv('rate_book')).rejects.toThrow('Nothing was downloaded')
        expect(ctx.rpc).toEqual([])
    })

    it('returns no file when the audit entry cannot be written', async () => {
        ctx.rpcError = { message: 'audit unavailable' }
        await expect(exportAccountantCsv('rate_book')).rejects.toThrow('Nothing was downloaded')
    })

    it('refuses an unknown area before reading anything', async () => {
        await expect(exportAccountantCsv('profiles' as never)).rejects.toThrow('Nothing was downloaded')
        expect(ctx.requests).toEqual([])
    })

    it('uses the archive access rule: retained owners yes, a pure Free account no', async () => {
        ctx.access = { effectiveTier: 'none', freeAccount: true }
        await expect(exportAccountantCsv('rate_book')).resolves.toBeTruthy()
        ctx.access = { effectiveTier: 'free', freeAccount: true }
        await expect(exportAccountantCsv('rate_book')).rejects.toThrow('NEXT_REDIRECT')
    })

    it('offers every area on the data export page', () => {
        const page = readFileSync('app/(dashboard)/owner/data-export/page.tsx', 'utf8')
        const section = readFileSync('app/(dashboard)/owner/data-export/AccountantCsvExports.tsx', 'utf8')
        expect(page).toContain('<AccountantCsvExports />')
        for (const area of ACCOUNTANT_CSV_AREAS) expect(section).toContain(`area: '${area}'`)
    })
})
