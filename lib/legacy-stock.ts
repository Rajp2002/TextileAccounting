import Decimal from 'decimal.js'
import { z } from 'zod'

/**
 * Legacy fabric stock: untagged fabric that was in the godown before Weavly tracked stock.
 * It lives next to orange stock (quality_stock.meters, fed by production) and is never mixed with it.
 * See supabase/migrations/20261015120000_legacy_fabric_stock.sql and docs/features/legacy_fabric_stock.md.
 */

export type LegacyBasis = 'unknown' | 'estimated' | 'counted'
export type LegacyStock = {
    id: string
    quality_id: string
    basis: LegacyBasis
    /** Null exactly when the basis is unknown. Never read null as zero. May be negative. */
    balance_meters: number | null
    basis_meters: number | null
    basis_at: string | null
    dispatched_meters: number
    onboarded_meters: number
    status: 'open' | 'closed'
    started_at: string
    closed_at: string | null
    version: number
}
export type LegacyMovementKind = 'start' | 'estimate' | 'count' | 'dispatch' | 'dispatch_reversal' | 'onboard' | 'close' | 'reopen'
export type LegacyMovement = {
    id: string
    quality_id: string
    kind: LegacyMovementKind
    meters_delta: number | null
    balance_after: number | null
    basis_after: LegacyBasis
    entered_meters: number | null
    expected_meters: number | null
    reason: string | null
    lines: { lot: string; meters: number }[] | null
    source_table: string | null
    source_id: string | null
    created_at: string
}

/** Which stock a challan line comes from. A line without a source is Orange, as every challan before legacy stock was. */
export type LineSource = 'tracked' | 'legacy'
export const lineSource = (line: { source?: LineSource }): LineSource => line.source ?? 'tracked'

/** What the stock page says about one quality's legacy stock. */
export type LegacyStatus =
    | 'unknown'           // nobody knows how much untagged fabric is left
    | 'estimated'         // a rough figure, less what has gone since
    | 'estimateExceeded'  // more went out than the estimate allowed: count needed
    | 'estimateAtZero'    // an estimate reached zero; that does not prove the fabric is gone
    | 'counted'
    | 'countExceeded'     // more went out than was counted: recount
    | 'readyToClose'      // a count shows nothing left
    | 'closed'            // fully tracked: confirmed after a zero count

export function legacyStatus(row: Pick<LegacyStock, 'basis' | 'balance_meters' | 'status'>): LegacyStatus {
    if (row.status === 'closed') return 'closed'
    if (row.basis === 'unknown' || row.balance_meters === null) return 'unknown'
    const balance = Number(row.balance_meters)
    if (row.basis === 'estimated') return balance < 0 ? 'estimateExceeded' : balance === 0 ? 'estimateAtZero' : 'estimated'
    return balance < 0 ? 'countExceeded' : balance === 0 ? 'readyToClose' : 'counted'
}

/** Statuses that need someone to go and count the untagged fabric. */
export const needsCount = (status: LegacyStatus) => status === 'estimateExceeded' || status === 'estimateAtZero' || status === 'countExceeded'

/**
 * The factory's whole stock. Orange stock is exact. Legacy stock adds a figure only where one exists, and the
 * total is called exact only when no open legacy stock is unknown or estimated. A negative legacy balance adds
 * nothing: it is a discrepancy to count, not stock.
 */
export function stockTotals(orangeMeters: readonly number[], legacy: readonly Pick<LegacyStock, 'basis' | 'balance_meters' | 'status'>[]) {
    const orange = orangeMeters.reduce((sum, value) => sum.plus(value || 0), new Decimal(0))
    let counted = new Decimal(0), estimated = new Decimal(0)
    let unknown = 0, estimates = 0
    for (const row of legacy) {
        if (row.status === 'closed') continue
        if (row.basis === 'unknown' || row.balance_meters === null) { unknown++; continue }
        const balance = Decimal.max(row.balance_meters, 0)
        if (row.basis === 'estimated') { estimated = estimated.plus(balance); estimates++ }
        else counted = counted.plus(balance)
    }
    const total = orange.plus(counted).plus(estimated)
    return {
        orange: orange.toNumber(),
        legacyCounted: counted.toNumber(),
        legacyEstimated: estimated.toNumber(),
        /** Open qualities whose legacy amount is unknown. While any exist, the total is incomplete. */
        unknownQualities: unknown,
        estimatedQualities: estimates,
        total: total.toNumber(),
        exact: unknown === 0 && estimates === 0,
    }
}

const metres = z.number().finite().min(0).max(100_000_000)
    .refine(value => new Decimal(value).decimalPlaces() <= 2, 'Use at most two decimal places.')
const note = z.string().trim().max(500).optional()

export const OnboardLineSchema = z.object({
    lot: z.string().trim().min(1, 'Enter the taka number.').max(80),
    meters: metres.refine(value => value >= 0.01, 'Enter the metres on the taka.'),
})

export const LegacyActionSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('start'), basis: z.enum(['unknown', 'estimated', 'counted']), meters: metres.optional(), reason: note }),
    z.object({ action: z.literal('estimate'), meters: metres, reason: note }),
    z.object({ action: z.literal('count'), meters: metres, reason: note }),
    z.object({ action: z.literal('onboard'), lines: z.array(OnboardLineSchema).min(1, 'Enter at least one taka.').max(500), reason: note }),
    z.object({ action: z.literal('close'), confirmed: z.literal(true), reason: note }),
    z.object({ action: z.literal('reopen'), basis: z.enum(['unknown', 'estimated', 'counted']), meters: metres.optional(), reason: z.string().trim().min(3, 'Explain why legacy stock is reopened.').max(500) }),
]).superRefine((value, ctx) => {
    if ((value.action === 'start' || value.action === 'reopen') && (value.basis === 'unknown') !== (value.meters === undefined))
        ctx.addIssue({ code: 'custom', path: ['meters'], message: value.basis === 'unknown' ? 'Leave metres empty when the amount is not known.' : 'Enter the metres.' })
    if (value.action === 'onboard') {
        const lots = value.lines.map(line => line.lot.trim())
        if (new Set(lots).size !== lots.length) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Each taka number can appear only once.' })
        if (value.lines.reduce((sum, line) => sum.plus(line.meters), new Decimal(0)).gt(100_000_000)) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Total metres exceed the limit.' })
    }
})
export type LegacyAction = z.input<typeof LegacyActionSchema>

export const LegacyMutationSchema = z.object({
    qualityId: z.string().uuid(),
    requestId: z.string().uuid(),
    /** The legacy_stock version the owner reviewed; 0 before legacy stock exists. */
    version: z.number().int().nonnegative(),
    input: LegacyActionSchema,
})
export type LegacyMutation = z.input<typeof LegacyMutationSchema>

/** The RPC payload for an action: everything but the action name, with blank notes left out. */
export function legacyPayload(input: z.output<typeof LegacyActionSchema>) {
    const { action, ...rest } = input
    void action
    const payload: Record<string, unknown> = { ...rest }
    if (!payload.reason) delete payload.reason
    if (payload.meters === undefined) delete payload.meters
    return payload
}

/** Orange and Legacy metres of a challan's lines, in exact decimals. */
export function sourceTotals(lines: readonly { meters: number; source?: LineSource }[]) {
    let tracked = new Decimal(0), legacy = new Decimal(0)
    for (const line of lines) {
        const value = Number.isFinite(line.meters) ? line.meters : 0
        if (lineSource(line) === 'legacy') legacy = legacy.plus(value)
        else tracked = tracked.plus(value)
    }
    return { tracked: tracked.toNumber(), legacy: legacy.toNumber() }
}

/** The gap a count reveals against what Weavly expected; null when nothing was expected. */
export function countGap(expected: number | null, counted: number) {
    return expected === null ? null : new Decimal(counted).minus(expected).toNumber()
}

/** Taka numbers in `lots` already onboarded for this quality, with the date each was added. */
export function repeatedTakas(lots: readonly string[], movements: readonly Pick<LegacyMovement, 'kind' | 'lines' | 'created_at'>[]) {
    const wanted = new Set(lots.map(lot => lot.trim()).filter(Boolean))
    const found = new Map<string, string>()
    for (const movement of movements) {
        if (movement.kind !== 'onboard') continue
        for (const line of movement.lines ?? []) if (wanted.has(line.lot) && !found.has(line.lot)) found.set(line.lot, movement.created_at)
    }
    return [...found].map(([lot, at]) => ({ lot, at }))
}
