import { normalizeYarnName } from './yarn-rate-reconciliation'
import { cottonCountNeToDenier, type WarpRow, type WeftRow } from './estimator'

/**
 * A density suggestion always carries its unit. `value` is denier for
 * `denier` and the English cotton count for `cotton_count_ne`.
 */
export type YarnDensitySuggestion =
    | { unit: 'denier'; value: number }
    | { unit: 'cotton_count_ne'; value: number }

export interface SavedYarnOption {
    name: string
    category: 'yarn_warp' | 'yarn_weft' | 'both'
    /** Effective denier for display and search; 0 when the density is unknown. */
    denier: number
    /** Typed density; null or missing means the owner must enter it. */
    density?: YarnDensitySuggestion | null
    yarnRate: number
    source: 'rate_book' | 'saved_quality'
    qualityNames?: string[]
}

export type YarnSuggestionSelection = Pick<SavedYarnOption, 'name' | 'density' | 'yarnRate'>

export interface RateBookYarnRecord {
    id: string
    name: string
    category: 'yarn_warp' | 'yarn_weft' | string
    currentValue: number
    unit?: string
}

export type TemplateRowLike = {
    label?: string | null
    calcDenier?: number | null
    yarnRate?: number | null
    linearDensityUnit?: 'denier' | 'cotton_count_ne'
    cottonCountNe?: number | null
}

export type TemplateWithRows = {
    id?: string
    name?: string
    warp_rows?: TemplateRowLike[] | null
    weft_rows?: TemplateRowLike[] | null
}

function plausibleDensity(value: number) {
    return Number.isFinite(value) && value > 0 && value <= 5000
}

/**
 * Reads a density from a yarn name only when the name states its unit.
 * - "75D", "80 den", "150 Denier" -> denier
 * - "40 Ne", "60Ne", "40s", "30's" -> English cotton count (Ne)
 * - "80/72", "50/48" (denier/filaments, both parts at least 10) -> denier
 * Ply and count/ply notation ("2/40", "30/1", "40/2") and bare numbers are
 * ambiguous: they return null and the owner enters the density.
 */
export function parseYarnDensityFromName(name: string): YarnDensitySuggestion | null {
    if (!name || typeof name !== 'string') return null
    const trimmed = name.trim()

    const fraction = trimmed.match(/\b(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
    const fractionParts = fraction ? [parseFloat(fraction[1]), parseFloat(fraction[2])] : null
    if (fractionParts && fractionParts.some(part => !(part >= 10))) return null

    const explicitDenier = trimmed.match(/\b(\d+(?:\.\d+)?)\s*(?:d|den|denier)\b/i)
    if (explicitDenier) {
        const value = parseFloat(explicitDenier[1])
        if (plausibleDensity(value)) return { unit: 'denier', value }
    }

    const explicitCount = trimmed.match(/\b(\d+(?:\.\d+)?)\s*(?:ne\b|'?s\b)/i)
    if (explicitCount) {
        // A count beside a fraction ("40/40s") has no single reading.
        if (fractionParts) return null
        const value = parseFloat(explicitCount[1])
        if (plausibleDensity(value)) return { unit: 'cotton_count_ne', value }
    }

    if (fractionParts && plausibleDensity(fractionParts[0])) return { unit: 'denier', value: fractionParts[0] }
    return null
}

function effectiveDenierOf(density: YarnDensitySuggestion | null | undefined) {
    if (!density) return 0
    return density.unit === 'cotton_count_ne' ? cottonCountNeToDenier(density.value) : density.value
}

/** The density a saved recipe row already holds, in that row's own unit. */
function recipeRowDensity(row: TemplateRowLike): YarnDensitySuggestion | null {
    if (row.linearDensityUnit === 'cotton_count_ne') {
        const count = Number(row.cottonCountNe)
        return plausibleDensity(count) ? { unit: 'cotton_count_ne', value: count } : null
    }
    const denier = Number(row.calcDenier)
    return plausibleDensity(denier) ? { unit: 'denier', value: denier } : null
}

/**
 * Applies a chosen yarn to one row. The row takes the suggestion's density in
 * the suggestion's unit; with no density the row's density is cleared, so the
 * previous yarn's value cannot satisfy readiness. Construction and allowance
 * fields are left as they were.
 */
export function applyYarnSuggestionToRow<T extends WarpRow | WeftRow>(row: T, suggestion: YarnSuggestionSelection): T {
    const base = {
        ...row,
        label: suggestion.name,
        yarnRate: suggestion.yarnRate > 0 ? suggestion.yarnRate : row.yarnRate,
    }
    const density = suggestion.density ?? null
    if (!density) return { ...base, linearDensityUnit: 'denier', calcDenier: 0, cottonCountNe: null }
    if (density.unit === 'cotton_count_ne') {
        return { ...base, linearDensityUnit: 'cotton_count_ne', cottonCountNe: density.value, calcDenier: cottonCountNeToDenier(density.value) }
    }
    return { ...base, linearDensityUnit: 'denier', cottonCountNe: null, calcDenier: density.value }
}

/**
 * Combines Rate Book yarn rates with Saved Quality templates to create a unified
 * list of saved yarn suggestions with their current rate and denier.
 */
export function buildSavedYarnOptions(
    rateBookYarns: RateBookYarnRecord[] = [],
    templates: TemplateWithRows[] = [],
): SavedYarnOption[] {
    const map = new Map<string, {
        name: string
        density: YarnDensitySuggestion | null
        yarnRate: number
        categories: Set<'yarn_warp' | 'yarn_weft'>
        source: 'rate_book' | 'saved_quality'
        qualityNames: Set<string>
    }>()

    // 1. Index yarns from Saved Qualities. A recipe's own density is the
    // owner's entered value and keeps its unit.
    for (const tpl of templates) {
        const tplName = tpl.name?.trim() ?? ''
        const layers: Array<{ cat: 'yarn_warp' | 'yarn_weft'; rows: TemplateRowLike[] }> = [
            { cat: 'yarn_warp', rows: tpl.warp_rows ?? [] },
            { cat: 'yarn_weft', rows: tpl.weft_rows ?? [] },
        ]

        for (const { cat, rows } of layers) {
            for (const row of rows) {
                const label = row.label?.trim()
                if (!label) continue
                const norm = normalizeYarnName(label)
                if (!norm) continue

                const density = recipeRowDensity(row) ?? parseYarnDensityFromName(label)
                const rate = Number(row.yarnRate) || 0

                const existing = map.get(norm)
                if (existing) {
                    existing.categories.add(cat)
                    if (tplName) existing.qualityNames.add(tplName)
                    if (!existing.density && density) existing.density = density
                } else {
                    map.set(norm, {
                        name: label.replace(/\s+/g, ' '),
                        density,
                        yarnRate: rate,
                        categories: new Set([cat]),
                        source: 'saved_quality',
                        qualityNames: new Set(tplName ? [tplName] : []),
                    })
                }
            }
        }
    }

    // 2. Merge yarns from the Rate Book (authoritative current rate)
    for (const r of rateBookYarns) {
        const name = r.name?.trim()
        if (!name) continue
        const norm = normalizeYarnName(name)
        if (!norm) continue

        const cat = r.category === 'yarn_weft' ? 'yarn_weft' : 'yarn_warp'
        const rate = Number(r.currentValue) || 0
        const parsedDensity = parseYarnDensityFromName(name)

        const existing = map.get(norm)
        if (existing) {
            existing.yarnRate = rate // Rate Book current rate takes precedence!
            existing.source = 'rate_book'
            existing.categories.add(cat)
            if (!existing.density && parsedDensity) existing.density = parsedDensity
        } else {
            map.set(norm, {
                name: name.replace(/\s+/g, ' '),
                density: parsedDensity,
                yarnRate: rate,
                categories: new Set([cat]),
                source: 'rate_book',
                qualityNames: new Set(),
            })
        }
    }

    // 3. Format as SavedYarnOption array
    const result: SavedYarnOption[] = []
    for (const entry of map.values()) {
        const hasWarp = entry.categories.has('yarn_warp')
        const hasWeft = entry.categories.has('yarn_weft')
        const category: 'yarn_warp' | 'yarn_weft' | 'both' =
            hasWarp && hasWeft ? 'both' : hasWarp ? 'yarn_warp' : 'yarn_weft'

        result.push({
            name: entry.name,
            category,
            denier: effectiveDenierOf(entry.density),
            density: entry.density,
            yarnRate: entry.yarnRate,
            source: entry.source,
            qualityNames: Array.from(entry.qualityNames),
        })
    }

    // Sort alphabetically by name
    return result.sort((a, b) => a.name.localeCompare(b.name, 'en-IN'))
}

/**
 * Filters and ranks yarn options based on user input and target category (warp/weft).
 */
export function filterYarnOptions(
    options: SavedYarnOption[],
    query: string = '',
    preferredCategory?: 'yarn_warp' | 'yarn_weft',
    limit: number = 8,
): SavedYarnOption[] {
    const q = query.trim().toLowerCase()

    let matched: SavedYarnOption[]
    if (!q) {
        matched = [...options]
    } else {
        matched = options.filter(opt => {
            const nameMatch = opt.name.toLowerCase().includes(q)
            const denierMatch = opt.denier > 0 && `${opt.denier}`.includes(q)
            return nameMatch || denierMatch
        })
    }

    // Rank:
    // 1. Exact name match first
    // 2. Starts with query
    // 3. Category match (preferredCategory / both)
    // 4. Alphabetical
    matched.sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()

        if (q) {
            const aExact = aName === q
            const bExact = bName === q
            if (aExact && !bExact) return -1
            if (!aExact && bExact) return 1

            const aStarts = aName.startsWith(q)
            const bStarts = bName.startsWith(q)
            if (aStarts && !bStarts) return -1
            if (!aStarts && bStarts) return 1
        }

        if (preferredCategory) {
            const aCatMatch = a.category === preferredCategory || a.category === 'both'
            const bCatMatch = b.category === preferredCategory || b.category === 'both'
            if (aCatMatch && !bCatMatch) return -1
            if (!aCatMatch && bCatMatch) return 1
        }

        return a.name.localeCompare(b.name, 'en-IN')
    })

    return matched.slice(0, limit)
}
