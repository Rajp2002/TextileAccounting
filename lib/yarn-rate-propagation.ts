import { buildCostingResult, calcFullTotals, type EstimateState } from './estimator'
import { requiresFactoryCapacity, validateEstimatorSnapshot } from './estimator-validation'
import { isSavedCostingArchived } from './saved-costings'
import { normalizeYarnName } from './yarn-rate-reconciliation'

export { chunkIds, PROPAGATION_BATCH_SIZE, summarizeOutcomes, tickedAfterReload, type PropagationOutcome } from './yarn-rate-propagation-batch'

// Pure half of "Propagate a new yarn rate": which saved costings a Rate Book
// yarn rate touches, and how to re-cost them. No I/O; the server actions in
// app/(dashboard)/owner/rates/propagation-actions.ts fetch and save.

export type YarnCategory = 'yarn_warp' | 'yarn_weft'

export type CostingLineageKey = {
    id: string
    costing_group_id: string | null
    version_number: number | null
    created_at: string
    is_archived: boolean | null
    template_id: string | null
}

export type PropagationLayerRef = { layer: 'warp' | 'weft'; index: number }

export type PropagationCandidate = {
    id: string
    qualityLabel: string
    partyName: string | null
    versionNumber: number
    updatedAt: string
    templateId: string | null
    layers: PropagationLayerRef[]
}

export type PropagationPrice = { productionCostPerM: number; sellingPricePerM: number }

export type PropagationPreviewItem = PropagationCandidate & {
    before: PropagationPrice
    after: PropagationPrice
}

export type PropagationSkipped = { id: string; qualityLabel: string; reason: string }

/**
 * The latest version of every costing lineage: highest version number, then
 * newest `created_at`, then highest id, the order the revision RPC uses.
 */
export function latestCostingPerLineage<T extends CostingLineageKey>(rows: readonly T[]): T[] {
    const latest = new Map<string, T>()
    for (const row of rows) {
        const key = row.costing_group_id ?? row.id
        const current = latest.get(key)
        if (!current || isNewer(row, current)) latest.set(key, row)
    }
    return [...latest.values()]
}

function isNewer(candidate: CostingLineageKey, current: CostingLineageKey) {
    const byVersion = (candidate.version_number ?? 1) - (current.version_number ?? 1)
    if (byVersion !== 0) return byVersion > 0
    if (candidate.created_at !== current.created_at) return candidate.created_at > current.created_at
    return candidate.id > current.id
}

/** Archived costings, and costings of an inactive or deleted quality, are left alone. */
export function isCostingEligible(
    row: Pick<CostingLineageKey, 'is_archived' | 'template_id'>,
    activeTemplateIds: ReadonlySet<string>,
): boolean {
    return !isSavedCostingArchived(
        row,
        row.template_id ? { is_active: activeTemplateIds.has(row.template_id) } : null,
    )
}

function rowsFor(estimate: Pick<EstimateState, 'warpRows' | 'weftRows'>, category: YarnCategory) {
    return category === 'yarn_warp' ? estimate.warpRows : estimate.weftRows
}

function rowMatches(row: { label?: string; yarnRate: number }, name: string, newRate: number) {
    return normalizeYarnName(row.label) === normalizeYarnName(name) && row.yarnRate !== newRate
}

/** The layers of the edited category that use this yarn at a different rate. */
export function findAffectedLayers(
    estimate: Pick<EstimateState, 'warpRows' | 'weftRows'>,
    category: YarnCategory,
    name: string,
    newRate: number,
): PropagationLayerRef[] {
    const layer = category === 'yarn_warp' ? 'warp' : 'weft'
    return rowsFor(estimate, category).flatMap((row, index) => rowMatches(row, name, newRate) ? [{ layer, index } as PropagationLayerRef] : [])
}

/** A copy of the estimate with only the matching yarn rows' rate replaced. */
export function applyYarnRate(estimate: EstimateState, category: YarnCategory, name: string, newRate: number): EstimateState {
    const replace = <Row extends { label?: string; yarnRate: number }>(rows: Row[]) =>
        rows.map(row => rowMatches(row, name, newRate) ? { ...row, yarnRate: newRate } : row)
    return category === 'yarn_warp'
        ? { ...estimate, warpRows: replace(estimate.warpRows) }
        : { ...estimate, weftRows: replace(estimate.weftRows) }
}

export type RateBookYarn = { name: string; category: YarnCategory; current_value: number }

/** One yarn layer whose saved rate differs from the Rate Book's rate today. */
export type YarnRateChange = { layer: 'warp' | 'weft'; index: number; name: string; from: number; to: number }

/** A saved costing whose yarns cost something else in the Rate Book today. */
export type RateBookDriftItem = Omit<PropagationCandidate, 'layers'> & {
    changes: YarnRateChange[]
    before: PropagationPrice
    after: PropagationPrice
}

/**
 * A copy of the estimate with every yarn row that the Rate Book prices moved to
 * today's rate, and the layers that moved. Rows the Rate Book has no yarn for
 * keep their own rate. Duplicate names in a category use the first one listed.
 */
export function applyRateBookYarns(estimate: EstimateState, yarns: readonly RateBookYarn[]): { estimate: EstimateState; changes: YarnRateChange[] } {
    const changes: YarnRateChange[] = []
    const priced = (category: YarnCategory) => {
        const byName = new Map<string, number>()
        for (const yarn of yarns) {
            const key = normalizeYarnName(yarn.name)
            if (yarn.category === category && key && !byName.has(key) && Number.isFinite(yarn.current_value)) byName.set(key, yarn.current_value)
        }
        return byName
    }
    const move = <Row extends { label?: string; yarnRate: number }>(rows: Row[], layer: 'warp' | 'weft', byName: Map<string, number>) =>
        rows.map((row, index) => {
            const today = byName.get(normalizeYarnName(row.label))
            if (today == null || today === row.yarnRate) return row
            changes.push({ layer, index, name: row.label?.trim() || '', from: row.yarnRate, to: today })
            return { ...row, yarnRate: today }
        })
    const warpRows = move(estimate.warpRows, 'warp', priced('yarn_warp'))
    const weftRows = move(estimate.weftRows, 'weft', priced('yarn_weft'))
    return { estimate: changes.length ? { ...estimate, warpRows, weftRows } : estimate, changes }
}

/**
 * Production cost and selling price per metre for an estimate, from the same
 * engine and validation a costing save uses. `null` when it cannot be priced.
 */
export function priceEstimate(estimate: EstimateState): PropagationPrice | null {
    try {
        const validation = validateEstimatorSnapshot(estimate, {
            requireTapeLength: false,
            requireCapacity: requiresFactoryCapacity(estimate, false),
        })
        if (!validation.valid) return null
        const result = buildCostingResult(estimate, calcFullTotals(estimate))
        if (!Number.isFinite(result.productionCostPerM) || !Number.isFinite(result.suggestedSellingPricePerM)) return null
        return { productionCostPerM: result.productionCostPerM, sellingPricePerM: result.suggestedSellingPricePerM }
    } catch {
        return null
    }
}
