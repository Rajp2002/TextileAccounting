import type { Language } from '@/lib/i18n/context'
import type { QualityStockBoard, StockMovement, StockQuality } from '@/lib/quality-stock'
import type { YarnBoard, YarnMovement, YarnRecipe } from '@/lib/yarn-stock'
import type { FabricStockTourStep, YarnStockTourStep } from '@/lib/stock-tour'
import { fabricStockPreviewCopy } from '@/lib/i18n/stock-tutorial'

/**
 * Sample data for the Fabric Stock and Yarn Stock tours. The real stock pages render it exactly as they render a
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

// ── Yarn ─────────────────────────────────────────────────────────────────────────────────────────
/** One yarn in a warp/weft recipe (6 + 4 = 10 kg per 100 m): 100 kg opening, 20 kg received, 200 m woven uses 20 kg, counted 98 kg. */
export const YARN_SAMPLE = { warpKgPer100: 6, weftKgPer100: 4, opening: 100, receipt: 20, producedMetres: 200, kgPer100: 10, used: 20, counted: 98 } as const
export type YarnStockPhase = 'opened' | 'received' | 'used'

export function yarnStockPhase(step: YarnStockTourStep): YarnStockPhase {
    if (step === 'ys-receipt' || step === 'ys-link') return 'received'
    if (step === 'ys-usage' || step === 'ys-correct') return 'used'
    return 'opened'
}

const YARN_NAMES: Record<Language, { yarn: string; quality: string; reference: string; receiptReference: string; formulaReference: string }> = {
    en: { yarn: 'Sample yarn', quality: 'Sample fabric', reference: 'Verified count', receiptReference: 'Receipt 001', formulaReference: 'Verified formula' },
    gu: { yarn: 'નમૂના યાર્ન', quality: 'નમૂના કાપડ', reference: 'ચકાસેલી ગણતરી', receiptReference: 'રસીદ 001', formulaReference: 'ચકાસેલું સૂત્ર' },
    hi: { yarn: 'नमूना धागा', quality: 'नमूना कपड़ा', reference: 'सत्यापित गिनती', receiptReference: 'रसीद 001', formulaReference: 'सत्यापित सूत्र' },
}

export function yarnStockSample(language: Language, phase: YarnStockPhase, linked: boolean): YarnBoard {
    const { yarn, quality } = YARN_NAMES[language]
    const { opening, receipt, used } = YARN_SAMPLE
    const balance = phase === 'opened' ? opening : phase === 'received' ? opening + receipt : opening + receipt - used
    const recipe: YarnRecipe = [
        { yarn_name: yarn, yarn_key: 'sample yarn', kg_per_100m: YARN_SAMPLE.warpKgPer100, role: 'warp' },
        { yarn_name: yarn, yarn_key: 'sample yarn', kg_per_100m: YARN_SAMPLE.weftKgPer100, role: 'weft' },
    ]
    const move = (id: string, kind: YarnMovement['kind'], delta: number, after: number, reason: string, day: string, extra: Partial<YarnMovement> = {}): YarnMovement => ({
        id, yarn_id: 'tour-yarn-1', yarn_name: yarn, kind, kg_delta: delta, balance_after: after, reason, created_at: STAMP(day), created_by: null,
        challan_id: null, recipe_snapshot: null, ...extra,
    })
    return {
        org_id: 'tour-org', started_at: STAMP('10'), as_of: null,
        yarns: [{ id: 'tour-yarn-1', yarn_name: yarn, yarn_key: 'sample yarn', weight_kg: balance, opening_recorded: true }],
        qualities: [{ id: 'tour-yq-1', quality_label: quality, quality_key: 'sample fabric', meters: YARN_SAMPLE.producedMetres, recipe: linked ? recipe : null, costing_id: linked ? 'tour-ycosting-2' : null, version: 1 }],
        costings: [{ id: 'tour-ycosting-2', quality_label: quality, quality_key: 'sample fabric', version_number: 2, saved_at: STAMP('12'), recipe }],
        movements: [
            ...(phase === 'used' ? [move('tour-ymove-3', 'production_consumption', -used, balance, '', '15', { recipe_snapshot: { meters: YARN_SAMPLE.producedMetres, kg_per_100m: YARN_SAMPLE.kgPer100 } })] : []),
            ...(phase !== 'opened' ? [move('tour-ymove-2', 'receipt', receipt, opening + receipt, YARN_NAMES[language].receiptReference, '14')] : []),
            move('tour-ymove-1', 'opening', opening, opening, YARN_NAMES[language].reference, '11'),
        ],
        nextCursor: null,
    }
}

/** The values the real yarn dialogs show for each step; `link` opens the formula dialog for the first quality. */
export function yarnStockSampleEntry(language: Language, step: YarnStockTourStep) {
    const names = YARN_NAMES[language]
    if (step === 'ys-opening') return { kind: 'opening' as const, name: names.yarn, weight: String(YARN_SAMPLE.opening), reason: names.reference }
    if (step === 'ys-receipt') return { kind: 'receipt' as const, name: names.yarn, weight: String(YARN_SAMPLE.receipt), reason: names.receiptReference }
    if (step === 'ys-correct') return { kind: 'correction' as const, name: names.yarn, weight: String(YARN_SAMPLE.counted), reason: names.reference }
    if (step === 'ys-link') return { kind: 'recipe' as const, name: '', weight: '', reason: names.formulaReference }
    return null
}
