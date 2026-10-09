import Decimal from 'decimal.js'
import { z } from 'zod'

const reason = z.string().trim().min(3).max(500)
const weight = z.number().finite().min(0).max(100_000_000)
    .refine(value => new Decimal(value).decimalPlaces() <= 3, 'Use up to three decimals for kg.')
const name = z.string().trim().min(1).max(160).transform(value => value.replace(/\s+/g, ' '))
const stockPayload = z.object({ yarn_name: name, weight_kg: weight, reason, expected_kg: z.number().finite().nonnegative().optional() })
export const YarnMutationSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('opening'), payload: stockPayload, requestId: z.string().uuid() }),
    z.object({ action: z.literal('receipt'), payload: stockPayload.refine(value => value.weight_kg > 0), requestId: z.string().uuid() }),
    z.object({ action: z.literal('correction'), payload: stockPayload.refine(value => value.expected_kg !== undefined), requestId: z.string().uuid() }),
    z.object({ action: z.literal('recipe'), payload: z.object({ quality_id: z.string().uuid(), costing_id: z.string().uuid(), expected_version: z.number().int().nonnegative(), reason }), requestId: z.string().uuid() }),
])
export type YarnMutation = z.input<typeof YarnMutationSchema>
export type YarnRecipe = { yarn_name: string; yarn_key: string; kg_per_100m: number; role: 'warp' | 'weft' }[]
export type YarnBalance = { id: string; yarn_name: string; yarn_key: string; weight_kg: number; opening_recorded: boolean }
export type YarnQuality = { id: string; quality_label: string; quality_key: string; meters: number; recipe: YarnRecipe | null; costing_id: string | null; version: number }
export type YarnCosting = { id: string; quality_label: string; quality_key: string; version_number: number; saved_at: string; recipe: YarnRecipe }
export type YarnMovement = {
    id: string; yarn_id: string; yarn_name: string; kind: 'opening' | 'receipt' | 'correction' | 'production_consumption' | 'production_reversal' | 'dispatch' | 'dispatch_reversal' | 'audit_adjustment'
    kg_delta: number; balance_after: number; reason: string; created_at: string; created_by: string | null
    challan_id: string | null; recipe_snapshot: { recipe?: YarnRecipe; sent_meters?: number; meters?: number; kg_per_100m?: number; costing_id?: string | null; version?: number } | null
}
export type YarnCursor = { at: string; id: string }
/** A movement of the last three weeks, read for week totals, daily use and trend lines (see lib/stock-activity.ts). */
export type YarnActivity = Pick<YarnMovement, 'id' | 'yarn_id' | 'kind' | 'kg_delta' | 'balance_after' | 'reason' | 'challan_id' | 'recipe_snapshot' | 'created_at'>
export type YarnBoard = {
    org_id: string
    started_at: string | null; as_of: string | null; yarns: YarnBalance[]; qualities: YarnQuality[]
    costings: YarnCosting[]; movements: YarnMovement[]; nextCursor: YarnCursor | null
    /** Movements since `activitySince()`, newest first. Absent for a dated, filtered or paged load and for tour samples; null when it could not be read. */
    activity?: YarnActivity[] | null
}
export const YarnFilterSchema = z.object({
    asOf: z.iso.date().optional(), yarnId: z.string().uuid().optional(),
    cursor: z.object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() }).optional(),
    activity: z.boolean().optional(),
})
/** Which week total a yarn movement counts towards. Production uses yarn; older records used it at dispatch. */
export function yarnActivityBucket(kind: string): 'received' | 'used' | 'adjusted' | null {
    if (kind === 'receipt') return 'received'
    if (kind === 'production_consumption' || kind === 'production_reversal' || kind === 'dispatch' || kind === 'dispatch_reversal') return 'used'
    if (kind === 'opening' || kind === 'correction' || kind === 'audit_adjustment') return 'adjusted'
    return null
}
/** Each fabric whose linked recipe draws on this yarn, with the role and rate. */
export function yarnFeeds(yarnKey: string, qualities: readonly YarnQuality[]) {
    return qualities.flatMap(quality => (quality.recipe ?? [])
        .filter(layer => layer.yarn_key === yarnKey)
        .map(layer => ({ qualityId: quality.id, quality: quality.quality_label, role: layer.role, kgPer100m: layer.kg_per_100m })))
}
export type YarnFilter = z.input<typeof YarnFilterSchema>
export function yarnHistoryPage(rows: YarnMovement[]) {
    const movements = rows.slice(0, 50), last = movements.at(-1)
    return { movements, nextCursor: rows.length > 50 && last ? { at: last.created_at, id: last.id } : null }
}
export function totalYarnKg(rows: YarnBalance[]) {
    return rows.reduce((total, row) => total.plus(row.weight_kg), new Decimal(0)).toNumber()
}

// Dispatch movements retain the whole recipe; production movements retain the
// rate for this yarn. Both are valid ledger snapshots and need different reads.
export function yarnMovementUsage(row: Pick<YarnMovement, 'yarn_id' | 'recipe_snapshot'>, yarns: YarnBalance[]) {
    const snapshot = row.recipe_snapshot
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
    const meters = snapshot.sent_meters ?? snapshot.meters
    if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return null

    if (typeof snapshot.kg_per_100m === 'number' && Number.isFinite(snapshot.kg_per_100m) && snapshot.kg_per_100m > 0) {
        return { meters, kgPer100m: snapshot.kg_per_100m }
    }

    if (!Array.isArray(snapshot.recipe)) return null
    const yarnKey = yarns.find(yarn => yarn.id === row.yarn_id)?.yarn_key
    if (!yarnKey) return null
    const rates = snapshot.recipe
        .filter(layer => layer && typeof layer === 'object' && layer.yarn_key === yarnKey && typeof layer.kg_per_100m === 'number' && Number.isFinite(layer.kg_per_100m))
        .map(layer => layer.kg_per_100m)
    if (rates.length === 0) return null
    return { meters, kgPer100m: rates.reduce((sum, rate) => sum + rate, 0) }
}
// Escape spreadsheet formulas as well as CSV quotes in user-entered yarn names.
export function yarnAuditCsv(board: YarnBoard) {
    const cell = (value: string | number) => `"${String(value).replace(/^[\s]*[=+@-]/, match => `'${match}`).replaceAll('"', '""')}"`
    return '\uFEFF' + [
        ['Unused yarn physically in stock', 'Weight kg', 'As of (Asia/Kolkata)', 'Tracking started'],
        ...board.yarns.map(row => [row.yarn_name, row.weight_kg, board.as_of ?? 'Current at export', board.started_at ?? 'Not started']),
        ['Total', totalYarnKg(board.yarns), board.as_of ?? 'Current at export', board.started_at ?? 'Not started'],
    ].map(row => row.map(cell).join(',')).join('\r\n')
}
