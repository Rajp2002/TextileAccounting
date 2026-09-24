import { describe, expect, it } from 'vitest'
import { YarnMutationSchema, YarnFilterSchema, totalYarnKg, yarnAuditCsv, yarnHistoryPage, yarnMovementUsage, type YarnBoard, type YarnMovement } from '@/lib/yarn-stock'
import { calcFullTotals, makeDefaultEstimateState, buildCostingResult } from '@/lib/estimator'

const requestId = '10000000-0000-4000-8000-000000000001'
describe('yarn inventory entry and audit', () => {
    it('the saved costing audit exposes named final weights used by dispatch inventory', () => {
        const state = makeDefaultEstimateState()
        state.warpCrimpPct = 0
        state.warpRows[0] = { ...state.warpRows[0], label: 'Warp Yarn 1', calculationMode: 'manual', manualKgPer100m: 12 }
        state.weftRows[0] = { ...state.weftRows[0], label: 'Weft Yarn 1', calculationMode: 'manual', manualKgPer100m: 8 }
        const snapshot = buildCostingResult(state, calcFullTotals(state))
        expect(snapshot.audit?.warp.layers[0]).toMatchObject({ name: 'Warp Yarn 1', finalKgPer100m: 12 })
        expect(snapshot.audit?.weft.layers[0]).toMatchObject({ name: 'Weft Yarn 1', finalKgPer100m: 8 })
    })
    it('normalizes names and requires positive gram-precision receipts', () => {
        const input = { action: 'receipt', requestId, payload: { yarn_name: '  Warp   Yarn 1 ', weight_kg: 12.125, reason: 'Supplier receipt' } }
        expect(YarnMutationSchema.parse(input).payload).toMatchObject({ yarn_name: 'Warp Yarn 1' })
        for (const weight_kg of [0, -1, NaN, Infinity, 0.0001]) expect(YarnMutationSchema.safeParse({ ...input, payload: { ...input.payload, weight_kg } }).success).toBe(false)
    })
    it('requires a reviewed balance for correction, and valid dates for audits', () => {
        const input = { action: 'correction', requestId, payload: { yarn_name: 'Yarn', weight_kg: 0, reason: 'Verified weight' } }
        expect(YarnMutationSchema.safeParse(input).success).toBe(false)
        expect(YarnMutationSchema.safeParse({ ...input, payload: { ...input.payload, expected_kg: 0.123456789 } }).success).toBe(true)
        expect(YarnFilterSchema.safeParse({ asOf: '2026-02-30' }).success).toBe(false)
        expect(YarnFilterSchema.safeParse({ asOf: '2026-03-31' }).success).toBe(true)
    })
    it('exports all balances accurately and escapes formula-like names and quotes', () => {
        const board = { org_id: requestId, started_at: '2026-01-01T00:00:00Z', as_of: '2026-03-31', yarns: [
            { id: 'a', yarn_name: '=HYPERLINK("unsafe")', yarn_key: 'a', weight_kg: 0.1, opening_recorded: true },
            { id: 'b', yarn_name: 'Yarn, two', yarn_key: 'b', weight_kg: 0.2, opening_recorded: true },
        ], costings: [], qualities: [], movements: [], nextCursor: null } satisfies YarnBoard
        expect(totalYarnKg(board.yarns)).toBe(0.3)
        const csv = yarnAuditCsv(board)
        expect(csv).toContain('Unused yarn physically in stock')
        expect(csv).toContain('"\'=HYPERLINK(""unsafe"")"')
        expect(csv).toContain('"Yarn, two","0.2","2026-03-31"')
        expect(csv).toContain('"Total","0.3"')
    })
    it('uses a lookahead row for history pagination', () => {
        const rows = Array.from({ length: 51 }, (_, index) => ({ id: String(index), created_at: '2026-09-12T00:00:00Z' }) as YarnMovement)
        expect(yarnHistoryPage(rows)).toMatchObject({ nextCursor: { id: '49' } })
        expect(yarnHistoryPage(rows).movements).toHaveLength(50)
        expect(yarnHistoryPage(rows.slice(0, 50)).nextCursor).toBeNull()
    })
    it('shows both production and dispatch movement snapshots without assuming a recipe array', () => {
        const yarns = [{ id: 'yarn-1', yarn_name: 'Warp', yarn_key: 'warp', weight_kg: 80, opening_recorded: true }]
        expect(yarnMovementUsage({ yarn_id: 'yarn-1', recipe_snapshot: { meters: 346, kg_per_100m: 5.866666666666666 } }, yarns))
            .toEqual({ meters: 346, kgPer100m: 5.866666666666666 })
        expect(yarnMovementUsage({ yarn_id: 'yarn-1', recipe_snapshot: { sent_meters: 100, recipe: [
            { yarn_name: 'Warp', yarn_key: 'warp', kg_per_100m: 3, role: 'warp' },
            { yarn_name: 'Warp', yarn_key: 'warp', kg_per_100m: 2, role: 'weft' },
        ] } }, yarns)).toEqual({ meters: 100, kgPer100m: 5 })
        expect(yarnMovementUsage({ yarn_id: 'yarn-1', recipe_snapshot: { meters: 100 } }, yarns)).toBeNull()
    })
})
