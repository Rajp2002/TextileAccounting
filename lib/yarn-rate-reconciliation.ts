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
