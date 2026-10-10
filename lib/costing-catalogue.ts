/**
 * Figures for the Saved Costings catalogue: where a costing's money goes, the yarns behind a quality and the
 * margin ranking in the page's band. Pure so the page and its tests read the same numbers.
 */

export type CostMixKey = 'yarn' | 'weaving' | 'processing' | 'factory'
export type CostMix = { parts: { key: CostMixKey; value: number }[]; total: number }

const num = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
    return Number.isFinite(parsed) ? parsed : null
}

/**
 * A saved costing's per-metre breakdown folded into four parts: yarn (warp and weft, wastage included), weaving,
 * sizing and processing (warping, sizing, winding, processing, finishing) and factory expenses. Null when the
 * costing was saved without a breakdown or the breakdown has no yarn or weaving figure.
 */
export function costMix(breakdown: unknown): CostMix | null {
    if (!breakdown || typeof breakdown !== 'object') return null
    const source = breakdown as Record<string, unknown>
    const warp = num(source.warpCostPerM), weft = num(source.weftCostPerM), weave = num(source.weaveCostPerM)
    if (warp == null || weft == null || weave == null) return null
    const processing = ['warpingAndSizingPerM', 'windingPerM', 'processingPerM', 'finishingPerM']
        .reduce((sum, key) => sum + Math.max(num(source[key]) ?? 0, 0), 0)
    const parts: CostMix['parts'] = [
        { key: 'yarn', value: Math.max(warp, 0) + Math.max(weft, 0) },
        { key: 'weaving', value: Math.max(weave, 0) },
        { key: 'processing', value: processing },
        { key: 'factory', value: Math.max(num(source.overheadPerM) ?? 0, 0) },
    ]
    const total = parts.reduce((sum, part) => sum + part.value, 0)
    return total > 0 ? { parts, total } : null
}

/** Yarn's share of cost across the costings that have a breakdown, as a whole percent; null when none do. */
export function averageYarnShare(mixes: readonly (CostMix | null)[]) {
    const shares = mixes.flatMap(mix => mix ? [mix.parts[0].value / mix.total] : [])
    return shares.length ? Math.round((shares.reduce((sum, share) => sum + share, 0) / shares.length) * 100) : null
}

type YarnRow = { label?: string | null }

const distinctLabels = (rows: unknown) => {
    const seen = new Set<string>()
    const labels: string[] = []
    for (const row of Array.isArray(rows) ? rows as YarnRow[] : []) {
        const label = typeof row?.label === 'string' ? row.label.normalize('NFKC').trim().replace(/\s+/g, ' ') : ''
        const key = label.toLocaleLowerCase('en-IN')
        if (!label || seen.has(key)) continue
        seen.add(key)
        labels.push(label)
    }
    return labels
}

/** The named warp and weft yarns of a saved quality's recipe, each once, in recipe order. */
export function qualityYarns(recipe: { warp_rows?: unknown; weft_rows?: unknown } | null | undefined) {
    return { warp: distinctLabels(recipe?.warp_rows), weft: distinctLabels(recipe?.weft_rows) }
}

export type MarginEntry = { key: string; name: string; margin: number }

/**
 * The band's margin bars: every quality, highest margin first, while they fit; beyond `limit` only the lowest
 * margins, lowest first, because those are the ones to look at.
 */
export function marginRanking(entries: readonly MarginEntry[], limit = 6) {
    const ranked = [...entries].sort((left, right) => right.margin - left.margin || left.name.localeCompare(right.name, 'en-IN'))
    if (ranked.length <= limit) return { entries: ranked, lowestOnly: false }
    return { entries: ranked.slice(-limit).reverse(), lowestOnly: true }
}

/** Average of the margins, to one decimal; null for none. */
export function averageMargin(margins: readonly number[]) {
    return margins.length ? Math.round((margins.reduce((sum, margin) => sum + margin, 0) / margins.length) * 10) / 10 : null
}
