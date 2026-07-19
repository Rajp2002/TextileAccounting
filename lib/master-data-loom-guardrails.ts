export const DUPLICATE_LOOM_NAME_ERROR =
    'Machine names must be unique within this organization.'

export type LoomNameRecord = {
    id?: string | null
    name?: string | null
}

export function normalizeLoomName(name: string) {
    return name.trim().toLowerCase()
}

export function buildDuplicateLoomNameError(name: string) {
    const trimmedName = name.trim()
    return trimmedName
        ? `A machine named "${trimmedName}" already exists. ${DUPLICATE_LOOM_NAME_ERROR}`
        : DUPLICATE_LOOM_NAME_ERROR
}

export function findDuplicateLoomName(
    name: string,
    existing: LoomNameRecord[],
    excludeMachineId?: string | null
) {
    const normalizedName = normalizeLoomName(name)
    if (!normalizedName) return null

    return existing.find((machine) => (
        normalizeLoomName(machine.name ?? '') === normalizedName
        && (!excludeMachineId || machine.id !== excludeMachineId)
    )) ?? null
}

export function findDuplicateLoomNameInBatch(candidates: LoomNameRecord[]) {
    const seen = new Map<string, LoomNameRecord>()

    for (const candidate of candidates) {
        const normalizedName = normalizeLoomName(candidate.name ?? '')
        if (!normalizedName) continue

        const first = seen.get(normalizedName)
        if (first) {
            return {
                normalizedName,
                first,
                duplicate: candidate,
            }
        }

        seen.set(normalizedName, candidate)
    }

    return null
}

export type DuplicateNameDbError = {
    code?: string
    message?: string
    details?: string
}

export function isDuplicateLoomNameDbError(error: DuplicateNameDbError | null | undefined) {
    if (!error || error.code !== '23505') return false

    const text = `${error.message ?? ''} ${error.details ?? ''}`
    return /machines_org_normalized_name_unique|lower\(btrim\(name\)\)|org_id/i.test(text)
}

export type LoomLifecycleProtectionInput = {
    currentOrderId?: string | null
    currentOrderStatus?: string | null
    standingAssignmentCount?: number
    shiftAssignmentCount?: number
    productionLogCount?: number
}

export type LoomLifecycleAction = 'delete' | 'deactivate' | 'unlink'

export function getLoomLifecycleProtectionReasons(input: LoomLifecycleProtectionInput) {
    const reasons: string[] = []

    if (input.currentOrderId && input.currentOrderStatus === 'active') {
        reasons.push('an active production target')
    } else if (input.currentOrderId) {
        reasons.push('a linked production target')
    }

    if ((input.standingAssignmentCount ?? 0) > 0) {
        reasons.push('active worker assignments')
    }

    if ((input.shiftAssignmentCount ?? 0) > 0) {
        reasons.push('dated shift assignment history')
    }

    if ((input.productionLogCount ?? 0) > 0) {
        reasons.push('production history')
    }

    return reasons
}

function formatReasonList(reasons: string[]) {
    if (reasons.length <= 1) return reasons[0] ?? 'protected references'
    if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`

    return `${reasons.slice(0, -1).join(', ')}, and ${reasons[reasons.length - 1]}`
}

export function buildProtectedLoomActionError(action: LoomLifecycleAction, reasons: string[]) {
    const actionLabel = action === 'delete'
        ? 'delete'
        : action === 'unlink'
            ? 'unlink'
            : 'deactivate'
    if (action === 'unlink') {
        return `Cannot ${actionLabel} this machine because it has ${formatReasonList(reasons)}. Resolve protected references first; machines with production or shift history must be preserved.`
    }

    return `Cannot ${actionLabel} this machine because it has ${formatReasonList(reasons)}. Unlink active targets and assignments first; machines with production or shift history must be preserved.`
}
