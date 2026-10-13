import type { Language } from '@/lib/i18n/context'
import type { QualityStockBoard, StockMovement, StockQuality } from '@/lib/quality-stock'
import type { FabricStockTourStep } from '@/lib/stock-tour'
import { fabricStockPreviewCopy } from '@/lib/i18n/stock-tutorial'

/**
 * Sample data for the Fabric Stock tour. The real stock page renders it exactly as it renders a
 * real account's stock, and move through the same story as the copy: stock before its opening balance, after it,
 * and after a correction. Every id starts with `tour-` (see sample-ids.ts).
 */
const STAMP = (day: string) => `2026-09-${day}T10:00:00+05:30`

// ── Fabric ───────────────────────────────────────────────────────────────────────────────────────
/** 200 m produced, 100 m dispatched, a 500 m opening count, then a physical count of 590 m. */
export const FABRIC_SAMPLE = { production: 200, dispatch: 100, opening: 500, counted: 590 } as const
export type FabricStockPhase = 'pending' | 'opened' | 'corrected'

export function fabricStockPhase(step: FabricStockTourStep): FabricStockPhase {
    if (step === 'fs-correct') return 'opened'
    if (step === 'fs-history') return 'corrected'
    return 'pending'
}

export function fabricStockSample(language: Language, phase: FabricStockPhase): QualityStockBoard {
    const { quality: label, countReference, correctionReference } = fabricStockPreviewCopy[language]
    const { production, dispatch, opening, counted } = FABRIC_SAMPLE
    const balance = phase === 'pending' ? production - dispatch : phase === 'opened' ? production - dispatch + opening : counted
    const quality: StockQuality = { id: 'tour-fabric-1', quality_label: label, quality_key: 'sample fabric', meters: balance, production_meters: production, opening_recorded: phase !== 'pending' }
    const move = (id: string, kind: StockMovement['kind'], delta: number, after: number, reason: string, day: string): StockMovement => ({
        id, quality_id: quality.id, quality_label: label, kind, meters_delta: delta, balance_after: after, reason, created_at: STAMP(day), created_by: null,
        source_table: null, source_id: null, production_before: null, production_after: null,
    })
    const movements = [
        ...(phase === 'corrected' ? [move('tour-fmove-4', 'correction', counted - (production - dispatch + opening), counted, correctionReference, '16')] : []),
        ...(phase !== 'pending' ? [move('tour-fmove-3', 'opening', opening, production - dispatch + opening, countReference, '15')] : []),
        move('tour-fmove-2', 'dispatch', -dispatch, production - dispatch, '', '14'),
        move('tour-fmove-1', 'production', production, production, '', '13'),
    ]
    return { qualities: [quality], total_meters: balance, movements, nextCursor: null, cutover: null }
}

/** The values the real opening and correction dialogs show for each fabric step. */
export function fabricStockSampleForm(language: Language, step: FabricStockTourStep) {
    const { countReference, correctionReference } = fabricStockPreviewCopy[language]
    if (step === 'fs-opening') return { kind: 'opening' as const, meters: String(FABRIC_SAMPLE.opening), reason: countReference }
    if (step === 'fs-correct') return { kind: 'correction' as const, meters: String(FABRIC_SAMPLE.counted), reason: correctionReference }
    return null
}
