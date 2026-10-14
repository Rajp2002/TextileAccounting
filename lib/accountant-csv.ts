import Decimal from 'decimal.js'
import { paymentStatus } from './delivery-challans'
import { parseCostingResultSnapshot } from './estimator'
import { getSavedCostingMetrics, type SavedCostingListItem } from './saved-costings'
import { formatToSurat } from './time'

// Spreadsheet downloads for the owner's munim or accountant: one flat table
// per file, English headers like the payroll CSVs, a
// UTF-8 byte-order mark so Excel reads Gujarati and Hindi names, money and
// metres as plain numbers, and dates in Surat time.

type Row = Record<string, unknown>
type CsvValue = string | number | null | undefined

function csvCell(value: CsvValue) {
    if (value == null) return ''
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
    // Owner-entered names, references and notes never run as formulas.
    const text = /^[\s]*[=+@\-]/.test(value) ? `'${value}` : value
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(headers: readonly string[], rows: readonly CsvValue[][]) {
    return '﻿' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const num = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}
const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const suratDate = (value: unknown) => typeof value === 'string' && value ? formatToSurat(value, 'yyyy-MM-dd') : ''
const suratDateTime = (value: unknown) => typeof value === 'string' && value ? formatToSurat(value, 'yyyy-MM-dd HH:mm') : ''
const label = (labels: Record<string, string>, value: unknown) => labels[text(value)] ?? text(value)
const byText = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })

// ─── Costings ────────────────────────────────────────────────────────────────

export const COSTINGS_CSV_HEADERS = [
    'Saved on', 'Quality', 'Party', 'Record type', 'Version', 'Status', 'Order metres',
    'Warp yarn / m', 'Weft yarn / m', 'Weaving / m', 'Warping and sizing / m', 'Winding / m',
    'Processing / m', 'Finishing / m', 'Overhead / m', 'Production cost / m', 'Transport / m',
    'Commission / m', 'Landed cost / m', 'Break-even price / m', 'Selling price / m',
    'Target margin %', 'Actual margin %', 'Profit / m', 'Expected profit total',
    'Quotation reference', 'Valid until', 'Archived', 'Numbers check',
] as const

const RECORD_KIND_LABELS: Record<string, string> = { costing: 'Costing', quotation: 'Quotation', market_run: 'Market run' }
const QUOTE_STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', rejected: 'Rejected' }
const NUMBERS_CHECK_LABELS: Record<string, string> = {
    verified: 'Checked',
    needs_review: 'Needs review',
    legacy: 'Older costing',
    unreconstructable: 'Older costing, assumptions incomplete',
}

function costingRow(input: {
    savedOn: unknown
    quality: unknown
    party: unknown
    recordType: string
    version: number | null
    status: string
    snapshot: unknown
    listItem: SavedCostingListItem | null
    quotationReference?: unknown
    validUntil?: unknown
    archived: boolean
    numbersCheck: string
}): CsvValue[] {
    const snapshot = parseCostingResultSnapshot(input.snapshot)
    const metrics = input.listItem ? getSavedCostingMetrics(input.listItem) : null
    const breakdown = snapshot?.breakdown
    const legacy = input.listItem
    return [
        suratDate(input.savedOn), text(input.quality), text(input.party), input.recordType, input.version,
        input.status, snapshot?.quantityM ?? num(legacy?.meters),
        breakdown?.warpCostPerM, breakdown?.weftCostPerM, breakdown?.weaveCostPerM,
        breakdown?.warpingAndSizingPerM, breakdown?.windingPerM, breakdown?.processingPerM,
        breakdown?.finishingPerM,
        snapshot?.overheadPerM ?? num(legacy?.overhead_per_meter),
        snapshot?.productionCostPerM ?? metrics?.productionCostPerM,
        snapshot?.transportPerM,
        snapshot?.commissionPerM ?? num(legacy?.commission_cost_per_meter),
        snapshot?.landedCostPerM ?? metrics?.landedCostPerM,
        snapshot?.breakEvenPricePerM ?? metrics?.breakEvenPricePerM,
        snapshot?.suggestedSellingPricePerM ?? metrics?.suggestedSellingPricePerM,
        snapshot?.targetMarginPct ?? metrics?.targetMarginPct,
        snapshot?.actualMarginPct ?? metrics?.actualMarginPct,
        snapshot?.profitPerM ?? metrics?.expectedProfitPerM,
        snapshot?.expectedProfitTotal ?? metrics?.expectedProfitTotal,
        text(input.quotationReference), text(input.validUntil), input.archived ? 'Yes' : 'No', input.numbersCheck,
    ]
}

/** One row per saved costing version, plus Free costings kept after an upgrade. */
export function buildCostingsCsv({ quotes, freeCostings }: { quotes: Row[]; freeCostings: Row[] }) {
    const rows = [
        ...quotes.map(quote => ({
            sortKey: text(quote.created_at),
            cells: costingRow({
                savedOn: quote.created_at,
                quality: quote.quality_label,
                party: quote.party_name,
                recordType: label(RECORD_KIND_LABELS, quote.record_kind || 'costing'),
                version: num(quote.version_number) ?? 1,
                status: label(QUOTE_STATUS_LABELS, quote.status),
                snapshot: quote.costing_result_snapshot,
                listItem: quote as unknown as SavedCostingListItem,
                quotationReference: quote.quotation_reference,
                validUntil: quote.quotation_valid_until,
                archived: quote.is_archived === true,
                numbersCheck: label(NUMBERS_CHECK_LABELS, quote.reconciliation_status),
            }),
        })),
        ...freeCostings.map(costing => ({
            sortKey: text(costing.created_at),
            cells: costingRow({
                savedOn: costing.created_at,
                quality: costing.label,
                party: '',
                recordType: 'Free costing',
                version: num(costing.revision),
                status: '',
                snapshot: costing.result,
                listItem: null,
                archived: false,
                numbersCheck: '',
            }),
        })),
    ].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return toCsv(COSTINGS_CSV_HEADERS, rows.map(row => row.cells))
}

// ─── Qualities ───────────────────────────────────────────────────────────────

export const QUALITIES_CSV_HEADERS = [
    'Quality', 'Status', 'Layer', 'Yarn', 'Denier', 'Cotton count (Ne)', 'Ends', 'Picks per inch',
    'Width (cm)', 'Yarn rate / kg', 'GST %', 'Waste %', 'Crimp %', 'Pick rate (paise)', 'Loom type',
    'Created on', 'Updated on',
] as const

/** One row per yarn layer of each saved quality. */
export function buildQualitiesCsv(templates: Row[]) {
    const rows: CsvValue[][] = []
    const sorted = [...templates].sort((a, b) => byText(text(a.name), text(b.name)))
    for (const quality of sorted) {
        const shared = (cells: CsvValue[]) => [
            text(quality.name), quality.is_active === false ? 'Archived' : 'Active', ...cells,
            num(quality.per_pick_cost_paise), text(quality.loom_type), suratDate(quality.created_at), suratDate(quality.updated_at),
        ]
        const yarn = (row: Row, fallback: string) => {
            const isCount = row.linearDensityUnit === 'cotton_count_ne'
            return [text(row.label) || fallback, isCount ? null : num(row.calcDenier), isCount ? num(row.cottonCountNe) : null]
        }
        const warp = list(quality.warp_rows).map(record)
        const weft = list(quality.weft_rows).map(record)
        warp.forEach((row, index) => rows.push(shared([
            'Warp', ...yarn(row, `Warp ${index + 1}`), num(row.beamEnds), null, null,
            num(row.yarnRate), num(row.gstPct), num(row.shortagePct) ?? num(quality.yarn_shortage_pct), num(row.crimpPct) ?? num(quality.warp_crimp_pct),
        ])))
        weft.forEach((row, index) => rows.push(shared([
            'Weft', ...yarn(row, `Weft ${index + 1}`), null, num(row.picks), num(row.effectiveCostingWidthCm) ?? num(row.reedSpace),
            num(row.yarnRate), num(row.gstPct), num(row.shortagePct) ?? num(quality.yarn_shortage_pct), num(row.crimpPct),
        ])))
        // Qualities saved before yarn layers existed keep their single recipe.
        if (warp.length === 0 && weft.length === 0) rows.push(shared([
            '', '', num(quality.calculated_yarn_denier) ?? num(quality.yarn_denier), null, num(quality.beam_ends), num(quality.ppi),
            num(quality.reed_space), num(quality.default_yarn_rate), null, num(quality.yarn_shortage_pct), num(quality.warp_crimp_pct),
        ]))
    }
    return toCsv(QUALITIES_CSV_HEADERS, rows)
}

// ─── Rate Book ───────────────────────────────────────────────────────────────

export const RATE_BOOK_CSV_HEADERS = [
    'Rate', 'Category', 'Unit', 'Status', 'Current rate', 'Event', 'Rate on this date', 'Previous rate',
    'Effective date', 'Source', 'Notes', 'Recorded at',
] as const

const RATE_CATEGORY_LABELS: Record<string, string> = {
    yarn_warp: 'Warp yarn', yarn_weft: 'Weft yarn', warping: 'Warping', sizing: 'Sizing', winding: 'Winding',
    processing: 'Processing', finishing: 'Finishing', transport: 'Transport', commission: 'Commission', overhead: 'Overhead',
}
const RATE_UNIT_LABELS: Record<string, string> = { per_kg: 'Rs per kg', per_m: 'Rs per metre', percent: 'Percent' }
const RATE_EVENT_LABELS: Record<string, string> = {
    recorded: 'Recorded', reviewed: 'Reviewed', changed: 'Changed', archived: 'Archived', restored: 'Restored',
}

/** Every Rate Book rate with its full history, oldest event first. */
export function buildRateBookCsv({ rates, history }: { rates: Row[]; history: Row[] }) {
    const historyByRate = new Map<string, Row[]>()
    for (const event of history) {
        const events = historyByRate.get(text(event.rate_id)) ?? []
        events.push(event)
        historyByRate.set(text(event.rate_id), events)
    }
    const rows: CsvValue[][] = []
    const sorted = [...rates].sort((a, b) => (
        byText(label(RATE_CATEGORY_LABELS, a.category), label(RATE_CATEGORY_LABELS, b.category)) || byText(text(a.name), text(b.name))
    ))
    for (const rate of sorted) {
        const shared = [
            text(rate.name), label(RATE_CATEGORY_LABELS, rate.category), label(RATE_UNIT_LABELS, rate.unit),
            rate.is_active === false ? 'Archived' : 'Active', num(rate.current_value),
        ]
        const events = (historyByRate.get(text(rate.id)) ?? [])
            .sort((a, b) => text(a.created_at).localeCompare(text(b.created_at)) || text(a.id).localeCompare(text(b.id)))
        if (events.length === 0) {
            rows.push([...shared, 'Current', num(rate.current_value), num(rate.previous_value), text(rate.effective_date), text(rate.source), text(rate.notes), suratDateTime(rate.updated_at)])
            continue
        }
        for (const event of events) rows.push([
            ...shared, label(RATE_EVENT_LABELS, event.event_type), num(event.value), num(event.previous_value),
            text(event.effective_date), text(event.source), text(event.notes), suratDateTime(event.created_at),
        ])
    }
    return toCsv(RATE_BOOK_CSV_HEADERS, rows)
}

// ─── Delivery challans ───────────────────────────────────────────────────────

export const CHALLANS_CSV_HEADERS = [
    'Challan number', 'Challan date', 'Party', 'Party GSTIN', 'Place of supply', 'Delivery address', 'Quality',
    'HSN', 'Lots', 'Metres sent', 'Metres received', 'Chargeable metres', 'Rate / m', 'Fabric value',
    'Adjustment', 'Paid', 'Balance', 'Payment status', 'Delivery status', 'Difference', 'Payment due date',
    'Payment terms', 'Invoice reference', 'E-way bill', 'LR reference', 'Transport', 'Vehicle', 'Issued at', 'Archived',
] as const

const DELIVERY_STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', received: 'Received', reversed: 'Reversed' }
const DIFFERENCE_LABELS: Record<string, string> = { none: '', review: 'Needs review', accepted: 'Accepted', disputed: 'Disputed' }
const PAYMENT_STATUS_LABELS: Record<string, string> = { draft: 'Draft', credit: 'Credit', settled: 'Settled', partial: 'Part paid', unpaid: 'Unpaid' }

const challanDate = (challan: Row) => text(record(challan.document).date)
const sortChallans = (challans: Row[]) => [...challans].sort((a, b) => (
    challanDate(a).localeCompare(challanDate(b)) || byText(text(a.number), text(b.number))
))

/** One row per delivery challan, with its money position. */
export function buildChallansCsv(challans: Row[]) {
    const rows = sortChallans(challans).map((challan): CsvValue[] => {
        const doc = record(challan.document)
        const lots = list(challan.lines).map(record)
            .map(line => `${text(line.lot)} (${num(line.meters) ?? 0} m)`)
            .join('; ')
        const chargeable = num(challan.chargeable_meters) ?? 0
        const rate = num(challan.selling_rate) ?? 0
        const status = paymentStatus({
            balance: num(challan.balance) ?? 0,
            paid_amount: num(challan.paid_amount) ?? 0,
            delivery_status: text(challan.delivery_status) as 'draft' | 'sent' | 'received' | 'reversed',
        })
        return [
            text(challan.number), challanDate(challan), text(doc.customer_name), text(doc.customer_gstin),
            text(doc.place_of_supply), text(doc.delivery_address), text(challan.quality_label), text(doc.hsn), lots,
            num(challan.sent_meters), num(challan.acknowledged_meters), chargeable, rate, money(new Decimal(chargeable).times(rate)),
            num(challan.adjustment_amount), num(challan.paid_amount), num(challan.balance),
            label(PAYMENT_STATUS_LABELS, status), label(DELIVERY_STATUS_LABELS, challan.delivery_status),
            label(DIFFERENCE_LABELS, challan.difference_status),
            text(challan.payment_due_date) || text(doc.payment_due_date), text(challan.payment_terms) || text(doc.payment_terms),
            text(doc.invoice_reference), text(doc.eway_bill_reference), text(doc.lr_reference), text(doc.transport),
            text(doc.vehicle), suratDateTime(challan.issued_at), challan.archived_at ? 'Yes' : 'No',
        ]
    })
    return toCsv(CHALLANS_CSV_HEADERS, rows)
}

export const CHALLAN_PAYMENTS_CSV_HEADERS = [
    'Entry date', 'Challan number', 'Party', 'Entry', 'Amount', 'Method', 'Reference or reason', 'Reversed later', 'Recorded at',
] as const

const MONEY_EVENT_LABELS: Record<string, string> = {
    payment: 'Payment received', refund: 'Refund paid', adjustment: 'Adjustment',
}

/**
 * One row per payment, refund, adjustment and reversal on a challan. Amount
 * is signed as it moves the challan balance: payments are positive, refunds
 * negative, and a reversal carries the opposite of the entry it reverses.
 */
export function buildChallanPaymentsCsv({ challans, events }: { challans: Row[]; events: Row[] }) {
    const challanById = new Map(challans.map(challan => [text(challan.id), challan]))
    const eventById = new Map(events.map(event => [text(event.id), event]))
    const reversedIds = new Set(events.map(event => text(event.reverses_id)).filter(Boolean))
    const rows = events
        .filter(event => ['payment', 'refund', 'adjustment', 'reverse_entry'].includes(text(event.action)))
        .map(event => {
            const data = record(record(event.payload).data)
            const challan = challanById.get(text(event.challan_id)) ?? {}
            const original = eventById.get(text(event.reverses_id))
            const entry = event.action === 'reverse_entry'
                ? `Reversal of ${(label(MONEY_EVENT_LABELS, original?.action) || 'entry').toLowerCase()}`
                : label(MONEY_EVENT_LABELS, event.action)
            const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(text(data.date)) ? text(data.date) : suratDate(event.created_at)
            return {
                sortKey: `${entryDate} ${text(event.created_at)}`,
                cells: [
                    entryDate, text(challan.number), text(record(challan.document).customer_name), entry, num(event.amount),
                    text(data.method), text(data.reason), reversedIds.has(text(event.id)) ? 'Yes' : '', suratDateTime(event.created_at),
                ] satisfies CsvValue[],
            }
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return toCsv(CHALLAN_PAYMENTS_CSV_HEADERS, rows.map(row => row.cells))
}

// ─── Daily production ────────────────────────────────────────────────────────

export const DAILY_PRODUCTION_CSV_HEADERS = [
    'Date', 'Shift', 'Worker', 'Machine', 'Quality', 'Metres', 'Entry', 'Pay basis', 'Rate / m',
    'Piece earning', 'Sheet status', 'Notes',
] as const

const SHIFT_LABELS: Record<string, string> = { day: 'Day', night: 'Night' }
const ENTRY_STATUS_LABELS: Record<string, string> = { entered: 'Produced', zero: 'Zero metres', absent: 'Absent' }
const SHEET_STATUS_LABELS: Record<string, string> = { draft: 'Draft', saved: 'Saved', finalized: 'Final' }
const SHIFT_ORDER: Record<string, number> = { day: 0, night: 1 }

// As the production loader reads it: anything but a monthly salary is piece rate.
const payBasis = (source: Row) => source.pay_basis_snapshot === 'fixed_monthly' ? 'Monthly salary' : 'Piece rate'

function pieceEarning(source: Row, meters: number | null) {
    if (source.piece_earning_state === 'inapplicable' || source.pay_basis_snapshot === 'fixed_monthly') return null
    const rate = num(source.worker_rate_snapshot)
    return meters == null || rate == null ? null : money(new Decimal(meters).times(rate))
}

/**
 * One row per worker, machine and quality for each day and shift. A machine
 * breakdown gives one row per machine; zero and absent entries are kept so the
 * attendance behind the metres stays visible. Rows from the first Base entry
 * form (before the daily sheet) have no shift or machine.
 */
export function buildDailyProductionCsv(input: {
    batches: Row[]
    entries: Row[]
    allocations: Row[]
    workers: Row[]
    legacyEntries: Row[]
    jobs: Row[]
}) {
    const workerName = new Map(input.workers.map(worker => [text(worker.id), text(worker.name)]))
    const jobLabel = new Map(input.jobs.map(job => [text(job.id), text(job.quality_label)]))
    const batchById = new Map(input.batches.map(batch => [text(batch.id), batch]))
    const allocationsByEntry = new Map<string, Row[]>()
    for (const allocation of input.allocations) {
        const rows = allocationsByEntry.get(text(allocation.entry_id)) ?? []
        rows.push(allocation)
        allocationsByEntry.set(text(allocation.entry_id), rows)
    }

    type Line = { date: string; shift: string; worker: string; machine: string; cells: CsvValue[] }
    const lines: Line[] = []
    const push = (date: string, shift: string, worker: string, machine: string, rest: CsvValue[]) => lines.push({
        date, shift, worker, machine,
        cells: [date, label(SHIFT_LABELS, shift), worker, machine, ...rest],
    })

    for (const entry of input.entries) {
        const status = text(entry.entry_status)
        if (status === 'blank') continue
        const batch = batchById.get(text(entry.batch_id))
        if (!batch) continue
        const date = text(batch.production_date)
        const shift = text(batch.shift)
        const worker = workerName.get(text(entry.worker_id)) || 'Unknown worker'
        const sheetStatus = label(SHEET_STATUS_LABELS, batch.status)
        const allocations = entry.allocation_mode === 'machine_breakdown' ? allocationsByEntry.get(text(entry.id)) ?? [] : []
        if (allocations.length > 0) {
            for (const allocation of allocations) {
                const meters = num(allocation.meters)
                push(date, shift, worker, text(allocation.machine_label), [
                    text(allocation.job_label), meters, label(ENTRY_STATUS_LABELS, status),
                    payBasis(allocation), num(allocation.worker_rate_snapshot),
                    pieceEarning(allocation, meters), sheetStatus, text(entry.notes),
                ])
            }
            continue
        }
        const meters = num(entry.meters)
        push(date, shift, worker, text(entry.machine_label), [
            text(entry.job_label) || jobLabel.get(text(entry.job_id)) || '', meters, label(ENTRY_STATUS_LABELS, status),
            payBasis(entry), num(entry.worker_rate_snapshot),
            status === 'entered' ? pieceEarning(entry, meters) : null, sheetStatus, text(entry.notes),
        ])
    }

    for (const entry of input.legacyEntries) {
        const meters = num(entry.meters)
        push(text(entry.production_date), '', workerName.get(text(entry.worker_id)) || 'Unknown worker', '', [
            jobLabel.get(text(entry.job_id)) || '', meters, 'Produced', payBasis(entry),
            num(entry.worker_rate_snapshot), pieceEarning(entry, meters), 'Earlier entry form', text(entry.notes),
        ])
    }

    lines.sort((a, b) => (
        a.date.localeCompare(b.date)
        || (SHIFT_ORDER[a.shift] ?? -1) - (SHIFT_ORDER[b.shift] ?? -1)
        || byText(a.worker, b.worker)
        || byText(a.machine, b.machine)
    ))
    return toCsv(DAILY_PRODUCTION_CSV_HEADERS, lines.map(line => line.cells))
}
