import { allocateWeftPicks, getTotalWeftPicks, getWeftPickConvention, type WeftPickConvention, type WeftRow } from './estimator'

/**
 * Row transforms for the two weft pick-density input conventions. The engine
 * always reads each row's `picks` as that weft system's own PPI; in the
 * total-PPI convention these helpers keep those picks equal to the total
 * shared by the rows' ratios, so the saved rows stay self-describing.
 */

function reallocate(rows: WeftRow[], totalPicks: number): WeftRow[] {
    const ratios = rows.map(row => Number(row.pickRatio))
    const allocation = allocateWeftPicks(totalPicks, ratios)
    if (allocation.ok) return rows.map((row, index) => ({ ...row, picks: allocation.picks[index] }))
    // A missing total or an invalid ratio leaves nothing to share. Validation
    // reports it; the ratios are kept so the owner only fixes what is wrong.
    if (!(totalPicks > 0)) return rows.map(row => ({ ...row, picks: 0 }))
    return rows
}

/** Switch convention without changing any system's physical picks. */
export function applyWeftPickConvention(rows: WeftRow[], convention: WeftPickConvention): WeftRow[] {
    if (convention === 'per_system') return rows.map(row => ({ ...row, pickRatio: null }))
    const total = getTotalWeftPicks(rows)
    const everyRowHasPicks = rows.every(row => Number(row.picks) > 0)
    // Seed the ratio from the picks already entered so switching is lossless.
    const seeded = rows.map(row => ({ ...row, pickRatio: everyRowHasPicks ? Number(row.picks) : 1 }))
    return reallocate(seeded, total)
}

export function setWeftTotalPicks(rows: WeftRow[], totalPicks: number | null): WeftRow[] {
    return reallocate(rows, Number(totalPicks) || 0)
}

export function setWeftPickRatio(rows: WeftRow[], id: string, ratio: number | null): WeftRow[] {
    const total = getTotalWeftPicks(rows)
    return reallocate(rows.map(row => row.id === id ? { ...row, pickRatio: ratio ?? 0 } : row), total)
}

/**
 * Carry the convention across added or removed weft systems. A fabric that
 * grows from one weft to several starts as the quality's total picks shared
 * 1:1, the way owners describe a multi-weft quality, and the panel shows that
 * choice so nothing is assumed out of sight. A saved multi-weft recipe that
 * never recorded a convention stays ambiguous until the owner picks one.
 */
export function reconcileWeftPickConvention(previous: WeftRow[], next: WeftRow[]): WeftRow[] {
    if (next.length === 1 && previous.length > 1 && getWeftPickConvention(previous) === 'total_ratio') {
        // The one remaining weft takes the fabric's whole total.
        return [{ ...next[0], pickRatio: 1, picks: getTotalWeftPicks(previous) }]
    }
    if (next.length <= 1) return next
    const convention = previous.length > 1
        ? getWeftPickConvention(previous)
        : previous[0]?.pickRatio === null ? 'per_system' : 'total_ratio'
    if (convention === 'per_system') return next.map(row => row.pickRatio === undefined ? { ...row, pickRatio: null } : row)
    if (convention === 'total_ratio') {
        const withRatios = next.map(row => typeof row.pickRatio === 'number' ? row : { ...row, pickRatio: 1 })
        return reallocate(withRatios, getTotalWeftPicks(previous))
    }
    return next
}
