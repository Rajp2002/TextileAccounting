import type { WarpRow, WeftRow } from '@/lib/estimator'

export type YarnLayerKind = 'warp' | 'weft'

export type YarnRateDiscoverySource = 'saved_quality' | 'saved_costing'

export const YARN_RATE_DISCOVERY_SOURCE_LABELS: Record<YarnRateDiscoverySource, string> = {
    saved_quality: 'Saved quality',
    saved_costing: 'Saved costing',
}

export type YarnRateTemplate = {
    id: string
    name: string
    discoverySource?: YarnRateDiscoverySource
    warp_rows?: WarpRow[] | null
    weft_rows?: WeftRow[] | null
}

export type YarnRateUsage = {
    templateId: string
    templateName: string
    layer: YarnLayerKind
    layerNumber: number
    rate: number
}

export type YarnRateConflict = {
    yarnName: string
    normalizedName: string
    rates: number[]
    usages: YarnRateUsage[]
}

export type YarnRateCandidate = {
    yarnName: string
    normalizedName: string
    category: 'yarn_warp' | 'yarn_weft'
    currentValue: number
    conflict: YarnRateConflict | null
    discoverySource: YarnRateDiscoverySource
    fabricNames: string[]
    usageNotes: string
    savedQualityCount: number
}

export type ExistingYarnRate = {
    name: string
    category: string
}

type MutableYarnCandidate = {
    yarnName: string
    normalizedName: string
    firstLayer: YarnLayerKind
    discoverySource: YarnRateDiscoverySource
    usages: YarnRateUsage[]
    savedQualityIds: Set<string>
}

export function normalizeYarnName(value: unknown): string {
    if (typeof value !== 'string') return ''
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN')
}

export function formatYarnRateUsageNotes(fabricNames: string[]): string {
    const uniqueNames = Array.from(new Set(
        fabricNames
            .map(name => name.normalize('NFKC').trim().replace(/\s+/g, ' '))
            .filter(Boolean),
    ))
    return uniqueNames.length ? `Used in: ${uniqueNames.join(', ')}` : ''
}

export function isYarnRateDiscoverySource(value: unknown): boolean {
    return Boolean(getYarnRateDiscoverySource(value)) || isAmbiguousYarnRateDiscoverySource(value)
}

export function getYarnRateDiscoverySource(value: unknown): YarnRateDiscoverySource | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim().toLocaleLowerCase('en-IN')
    if (normalized === 'saved quality') return 'saved_quality'
    if (normalized === 'saved costing') return 'saved_costing'
    return null
}

function isAmbiguousYarnRateDiscoverySource(value: unknown): boolean {
    if (typeof value !== 'string') return false
    const normalized = value.trim().toLocaleLowerCase('en-IN')
    return normalized === 'saved quality or costing'
        || normalized === 'saved qualities or costings — review needed'
}

function normalizeRate(value: unknown): number | null {
    const rate = Number(value)
    if (!Number.isFinite(rate) || rate < 0) return null
    return Math.round(rate * 10_000) / 10_000
}

export function collectYarnRateCandidates(templates: YarnRateTemplate[]): YarnRateCandidate[] {
    const byName = new Map<string, MutableYarnCandidate>()

    for (const template of templates) {
        const templateDiscoverySource = template.discoverySource ?? 'saved_quality'
        const layers: Array<{ kind: YarnLayerKind; rows: Array<WarpRow | WeftRow> }> = [
            { kind: 'warp', rows: template.warp_rows ?? [] },
            { kind: 'weft', rows: template.weft_rows ?? [] },
        ]

        for (const { kind, rows } of layers) {
            rows.forEach((row, index) => {
                const normalizedName = normalizeYarnName(row.label)
                const rate = normalizeRate(row.yarnRate)
                if (!normalizedName || rate === null) return

                const candidate = byName.get(normalizedName) ?? {
                    yarnName: row.label!.normalize('NFKC').trim().replace(/\s+/g, ' '),
                    normalizedName,
                    firstLayer: kind,
                    discoverySource: templateDiscoverySource,
                    usages: [],
                    savedQualityIds: new Set<string>(),
                }
                candidate.usages.push({
                    templateId: template.id,
                    templateName: template.name,
                    layer: kind,
                    layerNumber: index + 1,
                    rate,
                })
                if (templateDiscoverySource === 'saved_quality') {
                    candidate.savedQualityIds.add(template.id)
                }
                byName.set(normalizedName, candidate)
            })
        }
    }

    return Array.from(byName.values())
        .map(candidate => {
            const rates = Array.from(new Set(candidate.usages.map(usage => usage.rate))).sort((a, b) => a - b)
            const fabricNames = Array.from(new Map(
                candidate.usages.map(usage => [usage.templateId, usage.templateName]),
            ).values())
            const conflict = rates.length > 1
                ? {
                    yarnName: candidate.yarnName,
                    normalizedName: candidate.normalizedName,
                    rates,
                    usages: candidate.usages,
                }
                : null
            return {
                yarnName: candidate.yarnName,
                normalizedName: candidate.normalizedName,
                category: candidate.firstLayer === 'warp' ? 'yarn_warp' as const : 'yarn_weft' as const,
                currentValue: rates[0] ?? 0,
                conflict,
                discoverySource: candidate.discoverySource,
                fabricNames,
                usageNotes: formatYarnRateUsageNotes(fabricNames),
                savedQualityCount: candidate.savedQualityIds.size,
            }
        })
        .sort((a, b) => a.yarnName.localeCompare(b.yarnName, 'en-IN'))
}

export function getMissingYarnRateCandidates(
    templates: YarnRateTemplate[],
    existingRates: ExistingYarnRate[],
): YarnRateCandidate[] {
    const existingNames = new Set(
        existingRates
            .filter(rate => rate.category === 'yarn_warp' || rate.category === 'yarn_weft')
            .map(rate => normalizeYarnName(rate.name))
            .filter(Boolean),
    )
    return collectYarnRateCandidates(templates).filter(candidate => !existingNames.has(candidate.normalizedName))
}

export function getYarnRateConflicts(templates: YarnRateTemplate[]): YarnRateConflict[] {
    // The conflict review is an editable Saved Quality concern. Saved costings
    // are immutable historical snapshots, so an older snapshot rate must not
    // make a current Saved Quality appear inconsistent.
    const savedQualityTemplates = templates.filter(template => template.discoverySource !== 'saved_costing')
    return collectYarnRateCandidates(savedQualityTemplates)
        .flatMap(candidate => candidate.conflict ? [candidate.conflict] : [])
}

export function applyYarnRateToTemplate(
    template: Pick<YarnRateTemplate, 'warp_rows' | 'weft_rows'>,
    yarnName: string,
    yarnRate: number,
): { warpRows: WarpRow[]; weftRows: WeftRow[]; changed: boolean } {
    const normalizedName = normalizeYarnName(yarnName)
    let changed = false
    const updateRows = <T extends WarpRow | WeftRow>(rows: T[] | null | undefined): T[] => (rows ?? []).map(row => {
        if (normalizeYarnName(row.label) !== normalizedName || Number(row.yarnRate) === yarnRate) return row
        changed = true
        return { ...row, yarnRate }
    })

    return {
        warpRows: updateRows(template.warp_rows),
        weftRows: updateRows(template.weft_rows),
        changed,
    }
}

export type YarnRenameAction =
    | {
          kind: 'rename'
          category: 'yarn_warp' | 'yarn_weft'
          oldNormalizedName: string
          newName: string
          newNormalizedName: string
          newRate: number
      }
    | {
          kind: 'delete_orphan'
          category: 'yarn_warp' | 'yarn_weft'
          oldNormalizedName: string
      }

function collectLayerYarnKeys(
    sources: Array<Pick<YarnRateTemplate, 'warp_rows' | 'weft_rows'>>,
): Set<string> {
    const keys = new Set<string>()
    for (const source of sources) {
        for (const row of source.warp_rows ?? []) {
            const norm = normalizeYarnName(row.label)
            if (norm) keys.add(`yarn_warp:${norm}`)
        }
        for (const row of source.weft_rows ?? []) {
            const norm = normalizeYarnName(row.label)
            if (norm) keys.add(`yarn_weft:${norm}`)
        }
    }
    return keys
}

export function detectTemplateYarnRenames(params: {
    oldWarpRows?: WarpRow[] | null
    oldWeftRows?: WeftRow[] | null
    newWarpRows?: WarpRow[] | null
    newWeftRows?: WeftRow[] | null
    otherTemplates?: Array<Pick<YarnRateTemplate, 'warp_rows' | 'weft_rows'>>
    savedCostings?: Array<Pick<YarnRateTemplate, 'warp_rows' | 'weft_rows'>>
    existingRates?: Array<Pick<ExistingYarnRate, 'name' | 'category'>>
}): YarnRenameAction[] {
    const externalUsedKeys = collectLayerYarnKeys([
        ...(params.otherTemplates ?? []),
        ...(params.savedCostings ?? []),
    ])

    const existingRateKeys = new Set(
        (params.existingRates ?? [])
            .map(r => `${r.category}:${normalizeYarnName(r.name)}`)
            .filter(key => !key.endsWith(':')),
    )

    const actions: YarnRenameAction[] = []
    const categories: Array<{
        category: 'yarn_warp' | 'yarn_weft'
        oldRows: Array<WarpRow | WeftRow>
        newRows: Array<WarpRow | WeftRow>
    }> = [
        {
            category: 'yarn_warp',
            oldRows: params.oldWarpRows ?? [],
            newRows: params.newWarpRows ?? [],
        },
        {
            category: 'yarn_weft',
            oldRows: params.oldWeftRows ?? [],
            newRows: params.newWeftRows ?? [],
        },
    ]

    for (const { category, oldRows, newRows } of categories) {
        const newUsedInThisQuality = new Set<string>()
        for (const row of newRows) {
            const norm = normalizeYarnName(row.label)
            if (norm) newUsedInThisQuality.add(norm)
        }

        const handledOldNorms = new Set<string>()

        // 1. Match by row id
        for (const oldRow of oldRows) {
            const oldNorm = normalizeYarnName(oldRow.label)
            if (!oldNorm || handledOldNorms.has(oldNorm)) continue

            const matchingNewRow = oldRow.id
                ? newRows.find(r => r.id === oldRow.id)
                : undefined

            if (matchingNewRow) {
                const newNorm = normalizeYarnName(matchingNewRow.label)
                if (newNorm && newNorm !== oldNorm) {
                    handledOldNorms.add(oldNorm)

                    // Check if old yarn is used anywhere else
                    const isUsedElsewhere =
                        newUsedInThisQuality.has(oldNorm) ||
                        externalUsedKeys.has(`${category}:${oldNorm}`)

                    if (!isUsedElsewhere) {
                        const newExistsInRateBook = existingRateKeys.has(`${category}:${newNorm}`)
                        if (!newExistsInRateBook) {
                            actions.push({
                                kind: 'rename',
                                category,
                                oldNormalizedName: oldNorm,
                                newName: matchingNewRow.label!.trim(),
                                newNormalizedName: newNorm,
                                newRate: normalizeRate(matchingNewRow.yarnRate) ?? 0,
                            })
                            // Mark new yarn as now existing so subsequent rows don't conflict
                            existingRateKeys.add(`${category}:${newNorm}`)
                        } else {
                            actions.push({
                                kind: 'delete_orphan',
                                category,
                                oldNormalizedName: oldNorm,
                            })
                        }
                    }
                }
            } else {
                // Row was removed from this quality
                if (!newUsedInThisQuality.has(oldNorm)) {
                    handledOldNorms.add(oldNorm)
                    const isUsedElsewhere = externalUsedKeys.has(`${category}:${oldNorm}`)
                    if (!isUsedElsewhere) {
                        actions.push({
                            kind: 'delete_orphan',
                            category,
                            oldNormalizedName: oldNorm,
                        })
                    }
                }
            }
        }
    }

    return actions
}

export function getOrphanedYarnRateIds(params: {
    rates: Array<{ id: string; name: string; category: string; source?: string | null; apply_as_default?: boolean | null }>
    templates: YarnRateTemplate[]
    costings?: YarnRateTemplate[]
}): string[] {
    const candidates = collectYarnRateCandidates([...params.templates, ...(params.costings ?? [])])
    const activeYarnKeys = new Set(
        candidates.map(candidate => `${candidate.category}:${candidate.normalizedName}`),
    )

    return params.rates
        .filter(rate => {
            if (rate.category !== 'yarn_warp' && rate.category !== 'yarn_weft') return false
            if (rate.source !== 'Saved quality' && rate.source !== 'Saved costing') return false
            if (rate.apply_as_default) return false
            const key = `${rate.category}:${normalizeYarnName(rate.name)}`
            return !activeYarnKeys.has(key)
        })
        .map(rate => rate.id)
}

