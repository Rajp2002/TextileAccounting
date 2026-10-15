import { z } from 'zod'
import type { LegacyStock } from './legacy-stock'

export const StockAdjustmentSchema = z.object({
    qualityLabel: z.string().trim().min(1, 'Choose a quality.').max(160).transform(value => value.replace(/\s+/g, ' ')),
    meters: z.number().finite().min(0).max(100_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use at most two decimal places.'),
    kind: z.enum(['opening', 'correction']),
    reason: z.string().trim().min(3, 'Enter a reason (at least 3 characters).').max(500),
    clientRequestId: z.string().uuid(),
    expectedMeters: z.number().finite().nonnegative().optional(),
}).superRefine((value, ctx) => {
    if (value.kind === 'correction' && value.expectedMeters === undefined) ctx.addIssue({ code: 'custom', message: 'Reload the balance before correcting stock.' })
})
export type StockAdjustmentInput = z.input<typeof StockAdjustmentSchema>
export type StockQuality = { id: string; quality_label: string; quality_key: string; meters: number; production_meters: number; opening_recorded: boolean }
export type StockMovement = {
    id: string; quality_id: string; quality_label: string; kind: StockMovementKind
    meters_delta: number; balance_after: number; reason: string; created_at: string; created_by: string | null
    source_table: string | null; source_id: string | null; production_before: number | null; production_after: number | null
}
export type StockMovementKind = 'production' | 'production_reversal' | 'opening' | 'correction' | 'dispatch' | 'dispatch_reversal' | 'audit_adjustment' | 'legacy_onboarding'
/** A movement of the last three weeks, read for week totals and trend lines (see lib/stock-activity.ts). */
export type StockActivity = Pick<StockMovement, 'id' | 'quality_id' | 'kind' | 'meters_delta' | 'balance_after' | 'reason' | 'source_table' | 'source_id' | 'created_at'>
export type StockCursor = { at: string; id: string }
export type QualityStockBoard = {
    qualities: StockQuality[]; total_meters: number; movements: StockMovement[]; nextCursor: StockCursor | null
    cutover: { started_at: string; historical_production_meters: number; legacy_lot_count: number; unallocated_production_meters: number } | null
    /** Movements since `activitySince()`, newest first. Absent for a filtered or paged load and for tour samples; null when it could not be read. */
    activity?: StockActivity[] | null
    /** Legacy (untagged) stock per quality that has started it. Absent for tour samples; null when it could not be read. */
    legacy?: LegacyStock[] | null
}
/** Which week total a fabric movement counts towards. */
export function fabricActivityBucket(kind: string): 'woven' | 'dispatched' | 'onboarded' | 'adjusted' | null {
    if (kind === 'production' || kind === 'production_reversal') return 'woven'
    if (kind === 'legacy_onboarding') return 'onboarded'
    if (kind === 'dispatch' || kind === 'dispatch_reversal') return 'dispatched'
    if (kind === 'opening' || kind === 'correction' || kind === 'audit_adjustment') return 'adjusted'
    return null
}
export function stockHistoryPage(rows: StockMovement[]) {
    const movements = rows.slice(0, 50)
    const last = movements.at(-1)
    return { movements, nextCursor: rows.length > 50 && last ? { at: last.created_at, id: last.id } : null }
}
