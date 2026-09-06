import { normalizeYarnName } from './yarn-rate-reconciliation'
import { getEffectiveYarnDenier, type WarpRow, type WeftRow } from './estimator'

export interface SavedYarnOption {
    name: string
    category: 'yarn_warp' | 'yarn_weft' | 'both'
    denier: number
    yarnRate: number
    linearDensityUnit?: 'denier' | 'cotton_count_ne'
    cottonCountNe?: number | null
    source: 'rate_book' | 'saved_quality'
    qualityNames?: string[]
}

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

/**
 * Parses denier from a yarn label/name commonly used in Indian/Surat textile markets.
 * Examples:
 * - "80/72 Micro" -> 80
 * - "50/48 Bright" -> 50
 * - "75D Roto" or "75 D" -> 75
 * - "150D Spun" -> 150
 * - "30/1 Cotton" -> 30
 */
export function extractDenierFromName(name: string): number | null {
    if (!name || typeof name !== 'string') return null
    const trimmed = name.trim()

    // 1. Explicit denier with "D" / "den" / "denier" suffix: e.g. "75D", "75 D", "150D Bright", "30 denier"
    const explicitMatch = trimmed.match(/\b(\d+(?:\.\d+)?)\s*(?:d\b|den\b|denier\b)/i)
    if (explicitMatch) {
        const val = parseFloat(explicitMatch[1])
        if (Number.isFinite(val) && val > 0 && val <= 5000) return val
    }

    // 2. Count with 's' or 'Ne': e.g. "40s Cotton", "30's PC", "60 Ne"
    const countMatch = trimmed.match(/\b(\d+(?:\.\d+)?)\s*(?:s\b|'s\b|ne\b)/i)
    if (countMatch) {
        const val = parseFloat(countMatch[1])
        if (Number.isFinite(val) && val > 0 && val <= 5000) return val
    }

    // 3. Fraction format: "80/72", "50/48", "30/1", "2/40", "1/69"
    // - If it's 2/40 or 1/69 (ply/count where first <= 4 and second >= 10), count is the second number
    // - If it's 80/72 or 50/48 or 30/1 (denier/filaments or count/ply where first >= 10), denier/count is the first number
    const fractionMatch = trimmed.match(/\b(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
    if (fractionMatch) {
        const num1 = parseFloat(fractionMatch[1])
        const num2 = parseFloat(fractionMatch[2])
        if (Number.isFinite(num1) && Number.isFinite(num2)) {
            // If num1 is 1-4 and num2 >= 10, it's ply/count (e.g. 2/40, 1/69)
            if (num1 >= 1 && num1 <= 4 && num2 >= 10) {
                return num2
            }
            // Otherwise first number is denier/count (e.g. 80/72, 30/1, 50/48)
            if (num1 > 0 && num1 <= 5000) {
                return num1
            }
        }
    }

    return null
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
        denier: number
        yarnRate: number
        linearDensityUnit?: 'denier' | 'cotton_count_ne'
        cottonCountNe?: number | null
        categories: Set<'yarn_warp' | 'yarn_weft'>
        source: 'rate_book' | 'saved_quality'
        qualityNames: Set<string>
    }>()

    // 1. Index yarns from Saved Qualities
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

                const rowDenier = row.calcDenier ?? 0
                const effectiveDenier = (rowDenier > 0
                    ? getEffectiveYarnDenier({ calcDenier: rowDenier, linearDensityUnit: row.linearDensityUnit, cottonCountNe: row.cottonCountNe })
                    : 0) || extractDenierFromName(label) || 0
                const rate = Number(row.yarnRate) || 0

                const existing = map.get(norm)
                if (existing) {
                    existing.categories.add(cat)
                    if (tplName) existing.qualityNames.add(tplName)
                    if (!existing.denier && effectiveDenier > 0) {
                        existing.denier = effectiveDenier
                    }
                    if (row.linearDensityUnit) existing.linearDensityUnit = row.linearDensityUnit
                    if (row.cottonCountNe) existing.cottonCountNe = row.cottonCountNe
                } else {
                    map.set(norm, {
                        name: label.replace(/\s+/g, ' '),
                        denier: effectiveDenier,
                        yarnRate: rate,
                        linearDensityUnit: row.linearDensityUnit,
                        cottonCountNe: row.cottonCountNe,
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
        const parsedDenier = extractDenierFromName(name) || 0

        const existing = map.get(norm)
        if (existing) {
            existing.yarnRate = rate // Rate Book current rate takes precedence!
            existing.source = 'rate_book'
            existing.categories.add(cat)
            if (!existing.denier && parsedDenier > 0) {
                existing.denier = parsedDenier
            }
        } else {
            map.set(norm, {
                name: name.replace(/\s+/g, ' '),
                denier: parsedDenier,
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
            denier: entry.denier,
            yarnRate: entry.yarnRate,
            linearDensityUnit: entry.linearDensityUnit,
            cottonCountNe: entry.cottonCountNe,
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
