export type ProductionShift = 'day' | 'night'

export type ProductionMetersDraft = Record<string, number>

export type ProductionMetersDraftKeyInput = {
    orgId?: string | number | null
    userId?: string | number | null
    date: string
    shift: ProductionShift
}

function sanitizeDraftKeyPart(value: string | number | null | undefined, fallback: string) {
    const raw = typeof value === 'number' ? String(value) : value?.trim()
    if (!raw) return fallback
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function getProductionMetersDraftKey({
    orgId,
    userId,
    date,
    shift,
}: ProductionMetersDraftKeyInput) {
    return [
        'production_meters',
        sanitizeDraftKeyPart(orgId, 'unknownOrg'),
        sanitizeDraftKeyPart(userId, 'unknownUser'),
        sanitizeDraftKeyPart(date, 'unknownDate'),
        shift,
    ].join('_')
}

export function parseProductionMetersDraft(cached: string): ProductionMetersDraft {
    const parsed = JSON.parse(cached) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.entries(parsed).reduce<ProductionMetersDraft>((acc, [machineId, value]) => {
        const meters = Number(value)
        if (Number.isFinite(meters)) acc[machineId] = meters
        return acc
    }, {})
}

export function countRestoredUnsavedDraftMeters(
    draftMeters: ProductionMetersDraft,
    savedMeters: ProductionMetersDraft
) {
    return Object.entries(draftMeters).filter(([machineId, meters]) => {
        const saved = savedMeters[machineId] ?? 0
        return Math.abs(meters - saved) > 0.001
    }).length
}
