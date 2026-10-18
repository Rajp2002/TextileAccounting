import type { WarpRow, WeftRow, YarnCalculationMode, YarnLinearDensityUnit } from '@/lib/estimator'
import { normalizeYarnName } from '@/lib/yarn-rate-reconciliation'

// What makes two estimates the same fabric. A saved quality is a fabric, so a
// different fabric is always a different quality; everything else (yarn rate,
// GST, wastage, crimp, loom, overhead, margin) is costing and can change
// without leaving the quality.

export type ConstructionRows = { warpRows: WarpRow[]; weftRows: WeftRow[] }

export type ConstructionChange = {
    kind: 'warpLayers' | 'weftLayers' | 'beamEnds' | 'yarnCount' | 'yarnName' | 'picks' | 'pickRatio' | 'width' | 'calculation' | 'manualKg'
    side: 'warp' | 'weft'
    /** 1-based layer, null for a change in the number of layers. */
    layer: number | null
    from: string
    to: string
}

type LayerFabric = {
    beamEnds: number | null
    picks: number | null
    pickRatio: number | null
    width: number | null
    unit: YarnLinearDensityUnit
    count: number | null
    name: string
    displayName: string
    mode: YarnCalculationMode
    manualKg: number | null
}

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

function layerFabric(row: WarpRow | WeftRow): LayerFabric {
    const weft = row as Partial<WeftRow>
    const warp = row as Partial<WarpRow>
    const unit: YarnLinearDensityUnit = row.linearDensityUnit === 'cotton_count_ne' ? 'cotton_count_ne' : 'denier'
    const mode: YarnCalculationMode = row.calculationMode === 'manual' ? 'manual' : 'formula'
    return {
        beamEnds: toNumber(warp.beamEnds),
        picks: toNumber(weft.picks),
        pickRatio: toNumber(weft.pickRatio),
        width: toNumber(weft.effectiveCostingWidthCm ?? weft.reedSpace),
        unit,
        count: toNumber(unit === 'cotton_count_ne' ? row.cottonCountNe : row.calcDenier),
        name: normalizeYarnName(row.label),
        displayName: typeof row.label === 'string' ? row.label.trim().replace(/\s+/g, ' ') : '',
        mode,
        // Manual kg only matters while the layer is in manual mode.
        manualKg: mode === 'manual' ? toNumber(row.manualKgPer100m) : null,
    }
}

const WARP_FIELDS = ['beamEnds', 'yarnCount', 'yarnName', 'calculation', 'manualKg'] as const
const WEFT_FIELDS = ['picks', 'pickRatio', 'width', 'yarnCount', 'yarnName', 'calculation', 'manualKg'] as const

function formatNumber(value: number | null): string {
    return value === null ? '' : String(value)
}

function formatCount(layer: LayerFabric): string {
    if (layer.count === null) return ''
    return layer.unit === 'cotton_count_ne' ? `${layer.count} Ne` : `${layer.count}D`
}

function fieldValue(layer: LayerFabric, kind: (typeof WARP_FIELDS | typeof WEFT_FIELDS)[number]): string {
    switch (kind) {
        case 'beamEnds': return formatNumber(layer.beamEnds)
        case 'picks': return formatNumber(layer.picks)
        case 'pickRatio': return formatNumber(layer.pickRatio)
        case 'width': return formatNumber(layer.width)
        case 'yarnCount': return `${layer.unit}:${formatNumber(layer.count)}`
        case 'yarnName': return layer.name
        case 'calculation': return layer.mode
        case 'manualKg': return formatNumber(layer.manualKg)
    }
}

function fieldLabel(layer: LayerFabric, kind: (typeof WARP_FIELDS | typeof WEFT_FIELDS)[number]): string {
    if (kind === 'yarnCount') return formatCount(layer)
    if (kind === 'yarnName') return layer.displayName
    if (kind === 'calculation') return layer.mode
    return fieldValue(layer, kind)
}

/**
 * A stable string of the fabric inputs only: layer counts and, per layer in
 * order, ends or picks, ratio, width, yarn count and unit, yarn name, mode and
 * manual kg. Prices, tax, wastage, crimp, loom and overhead are not in it.
 */
export function constructionSignature(rows: ConstructionRows): string {
    const side = (name: 'warp' | 'weft', layers: Array<WarpRow | WeftRow>, fields: readonly (typeof WARP_FIELDS | typeof WEFT_FIELDS)[number][]) =>
        `${name}[${layers.length}]` + layers
            .map(layer => {
                const fabric = layerFabric(layer)
                return '{' + fields.map(field => `${field}=${fieldValue(fabric, field)}`).join(';') + '}'
            })
            .join('')
    return `${side('warp', rows.warpRows, WARP_FIELDS)}|${side('weft', rows.weftRows, WEFT_FIELDS)}`
}

function diffSide(
    side: 'warp' | 'weft',
    baseline: Array<WarpRow | WeftRow>,
    current: Array<WarpRow | WeftRow>,
    fields: readonly (typeof WARP_FIELDS | typeof WEFT_FIELDS)[number][],
): ConstructionChange[] {
    const changes: ConstructionChange[] = []
    if (baseline.length !== current.length) {
        changes.push({
            kind: side === 'warp' ? 'warpLayers' : 'weftLayers',
            side,
            layer: null,
            from: String(baseline.length),
            to: String(current.length),
        })
    }
    // Layers beyond the shorter side are covered by the count change above.
    for (let index = 0; index < Math.min(baseline.length, current.length); index += 1) {
        const before = layerFabric(baseline[index])
        const after = layerFabric(current[index])
        for (const field of fields) {
            // Naming a yarn that had no name is not a different fabric.
            if (field === 'yarnName' && before.name === '') continue
            if (fieldValue(before, field) === fieldValue(after, field)) continue
            changes.push({ kind: field, side, layer: index + 1, from: fieldLabel(before, field), to: fieldLabel(after, field) })
        }
    }
    return changes
}

/**
 * What changed in the fabric, in warp-then-weft, layer order. Empty when the
 * fabric is the same.
 */
export function describeConstructionChanges(baseline: ConstructionRows, current: ConstructionRows): ConstructionChange[] {
    return [
        ...diffSide('warp', baseline.warpRows, current.warpRows, WARP_FIELDS),
        ...diffSide('weft', baseline.weftRows, current.weftRows, WEFT_FIELDS),
    ]
}

/**
 * Same fabric as the baseline. A baseline yarn with no name matches any name,
 * because older qualities often have none.
 */
export function sameConstruction(baseline: ConstructionRows, current: ConstructionRows): boolean {
    return describeConstructionChanges(baseline, current).length === 0
}

type TemplateConstructionInput = {
    warp_rows?: WarpRow[] | null
    weft_rows?: WeftRow[] | null
    calculated_yarn_denier?: unknown
    yarn_denier?: unknown
    beam_ends?: unknown
    ppi?: unknown
    reed_space?: unknown
    weft_denier?: unknown
    default_yarn_rate?: unknown
}

/**
 * The rows the estimator builds when it opens a quality: its stored rows, else
 * the single warp and weft row of a legacy quality, with the same defaults the
 * estimator applies. This is the baseline for "did the fabric change".
 */
export function templateConstructionRows(template: TemplateConstructionInput): ConstructionRows {
    const warpRows: WarpRow[] = template.warp_rows && template.warp_rows.length > 0
        ? template.warp_rows
        : [{
            id: 'legacy-warp',
            calcDenier: Number(template.calculated_yarn_denier ?? template.yarn_denier ?? 75),
            beamEnds: Number(template.beam_ends ?? 3200),
            yarnRate: Number(template.default_yarn_rate ?? 107),
            gstPct: 0,
            shortagePct: null,
        }]
    const weftRows: WeftRow[] = template.weft_rows && template.weft_rows.length > 0
        ? template.weft_rows
        : [{
            id: 'legacy-weft',
            picks: Number(template.ppi ?? 68),
            reedSpace: Number(template.reed_space ?? 110),
            calcDenier: Number(template.weft_denier ?? 75),
            yarnRate: Number(template.default_yarn_rate ?? 107),
            gstPct: 0,
            shortagePct: null,
        }]
    return { warpRows, weftRows }
}
