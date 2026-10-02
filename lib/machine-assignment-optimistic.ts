import type { BaseProductionShift, BaseWorkerMachineAssignment } from '@/lib/base-production-core'

/**
 * An assignment change the owner has made on the Machine Assignments board that the
 * server has not confirmed yet (or has confirmed, but the refreshed page data has not
 * arrived). The board shows these straight away so a drop feels instant.
 */
export type PendingAssignmentChange =
    | { id: string; kind: 'assign'; workerId: string; machineId: string; shift: BaseProductionShift }
    | { id: string; kind: 'remove'; assignmentId: string; machineId: string; shift: BaseProductionShift }

const PENDING_ASSIGNMENT_PREFIX = 'pending-assignment-'

/** The id of the placeholder assignment shown for a pending `assign` change. */
export function pendingAssignmentId(changeId: string) {
    return `${PENDING_ASSIGNMENT_PREFIX}${changeId}`
}

/** Placeholder assignments made for pending changes use this id prefix; they have no row yet. */
export function isPendingAssignmentId(id: string | null | undefined) {
    return Boolean(id?.startsWith(PENDING_ASSIGNMENT_PREFIX))
}

function isActiveOn(assignment: BaseWorkerMachineAssignment, date: string) {
    return assignment.active && assignment.effective_from <= date && (!assignment.effective_to || assignment.effective_to >= date)
}

/** True when the given assignments already show the change, so it no longer needs to be overlaid. */
export function isAssignmentChangeReflected(
    assignments: readonly BaseWorkerMachineAssignment[],
    change: PendingAssignmentChange,
    today: string,
) {
    if (change.kind === 'remove') {
        return !assignments.some((assignment) => assignment.id === change.assignmentId && isActiveOn(assignment, today))
    }
    return assignments.some((assignment) => (
        assignment.machine_id === change.machineId
        && assignment.shift === change.shift
        && assignment.worker_id === change.workerId
        && isActiveOn(assignment, today)
    ))
}

/**
 * Overlays pending changes, in order, on the server's assignments.
 *
 * - `assign` replaces whatever worker the machine has for that shift (one worker per
 *   machine per shift) with a placeholder assignment effective today.
 * - `remove` drops that assignment.
 *
 * Changes the server data already reflects are skipped, and the input is returned
 * unchanged when nothing applies.
 */
export function applyPendingAssignmentChanges(
    assignments: readonly BaseWorkerMachineAssignment[],
    changes: readonly PendingAssignmentChange[],
    today: string,
): readonly BaseWorkerMachineAssignment[] {
    let result = assignments
    for (const change of changes) {
        if (isAssignmentChangeReflected(result, change, today)) continue
        if (change.kind === 'remove') {
            result = result.filter((assignment) => assignment.id !== change.assignmentId)
            continue
        }
        result = [
            ...result.filter((assignment) => !(
                assignment.machine_id === change.machineId
                && assignment.shift === change.shift
                && isActiveOn(assignment, today)
            )),
            {
                id: pendingAssignmentId(change.id),
                worker_id: change.workerId,
                machine_id: change.machineId,
                shift: change.shift,
                active: true,
                effective_from: today,
                effective_to: null,
            },
        ]
    }
    return result
}
