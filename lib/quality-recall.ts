/**
 * Recall helpers for choosing a saved quality: a compact construction cue
 * built only from what the recipe holds, and a search over the name and that
 * construction. Nothing is inferred; a missing part is simply left out.
 */

type RecipeRow = {
    label?: unknown
    calcDenier?: unknown
    linearDensityUnit?: unknown
    cottonCountNe?: unknown
    picks?: unknown
    effectiveCostingWidthCm?: unknown
    reedSpace?: unknown
}

type RecallQuality = { name?: string | null; warp_rows?: unknown; weft_rows?: unknown }

function rowsOf(value: unknown): RecipeRow[] {
    return Array.isArray(value) ? value.filter((row): row is RecipeRow => Boolean(row) && typeof row === 'object') : []
}

function positive(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
}

function compactNumber(value: number) {
    return String(Number(value.toFixed(2)))
}

function yarnText(row: RecipeRow) {
    const label = typeof row.label === 'string' ? row.label.trim().replace(/\s+/g, ' ') : ''
    if (label) return label
    if (row.linearDensityUnit === 'cotton_count_ne') {
        const count = positive(row.cottonCountNe)
        return count ? `${compactNumber(count)} Ne` : null
    }
    const denier = positive(row.calcDenier)
    return denier ? `${compactNumber(denier)} D` : null
}

/** "80/72 Micro × 75D Roto · 68 PPI · 160 cm", or null when nothing is known. */
export function buildQualityConstructionCue(quality: RecallQuality): string | null {
    const warp = rowsOf(quality.warp_rows).map(yarnText).filter((text): text is string => Boolean(text))
    const wefts = rowsOf(quality.weft_rows)
    const weft = wefts.map(yarnText).filter((text): text is string => Boolean(text))
    // Each weft row holds that yarn's own picks, so the fabric's PPI is the sum.
    const pickValues = wefts.map(row => positive(row.picks)).filter((value): value is number => value !== null)
    const width = wefts.map(row => positive(row.effectiveCostingWidthCm) ?? positive(row.reedSpace)).find(value => value !== null) ?? null

    const yarns = [warp.join(' + '), weft.join(' + ')].filter(Boolean).join(' × ')
    const parts = [
        yarns,
        pickValues.length ? `${compactNumber(pickValues.reduce((sum, value) => sum + value, 0))} PPI` : '',
        width ? `${compactNumber(width)} cm` : '',
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : null
}

/** Every word of the query must appear in the name or the construction. */
export function matchesQualitySearch(quality: RecallQuality, query: string) {
    const words = query.toLocaleLowerCase('en-IN').split(/\s+/).filter(Boolean)
    if (words.length === 0) return true
    const haystack = [
        quality.name ?? '',
        buildQualityConstructionCue(quality) ?? '',
        ...[...rowsOf(quality.warp_rows), ...rowsOf(quality.weft_rows)].map(row => yarnText(row) ?? ''),
    ].join(' ').toLocaleLowerCase('en-IN')
    return words.every(word => haystack.includes(word))
}
