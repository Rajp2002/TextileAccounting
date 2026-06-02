const METER_EPSILON = 0.01

export type DispatchArchiveEligibilityInput = {
    pendingDispatchMeters: number
    totalSaleMeters: number
    totalDispatchedMeters: number
    hasUnconfirmedReceipt: boolean
    hasDisputedDispatch: boolean
    hasOpenDiscrepancy: boolean
    hasEwayGap?: boolean
}

export function isDispatchGroupActionable(group: DispatchArchiveEligibilityInput): boolean {
    if (group.pendingDispatchMeters > METER_EPSILON) return true
    if (Math.max(group.totalSaleMeters - group.totalDispatchedMeters, 0) > METER_EPSILON) return true
    if (group.hasUnconfirmedReceipt) return true
    if (group.hasDisputedDispatch) return true
    if (group.hasOpenDiscrepancy) return true
    if (group.hasEwayGap) return true

    return false
}

export function shouldArchiveDispatchGroup(group: DispatchArchiveEligibilityInput): boolean {
    return !isDispatchGroupActionable(group)
}
