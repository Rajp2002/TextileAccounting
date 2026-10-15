export type MachineAssignmentRow<W extends { id: string }, M extends { id: string }> = {
    worker: W
    machines: M[]
}

/**
 * Lays workers and machines out for the Machine Assignments board.
 *
 * - `rows`: one entry per worker that has machines (in the order given), holding
 *   that worker's machines so the board can show them together beside the worker.
 * - `idleWorkers`: workers with no machine in view, in the order given.
 * - `ungrouped`: machines that belong to no listed worker (unassigned, or assigned
 *   to a worker that is not shown), in their original order.
 *
 * Machines keep their original relative order inside a group, and every worker and
 * machine is placed exactly once.
 */
export function groupMachinesByWorker<W extends { id: string }, M extends { id: string }>(
    workers: readonly W[],
    machines: readonly M[],
    workerIdByMachineId: ReadonlyMap<string, string>,
): { rows: MachineAssignmentRow<W, M>[]; idleWorkers: W[]; ungrouped: M[] } {
    const groups = workers.map((worker): MachineAssignmentRow<W, M> => ({ worker, machines: [] }))
    const groupByWorkerId = new Map(groups.map((group) => [group.worker.id, group]))
    const ungrouped: M[] = []

    for (const machine of machines) {
        const workerId = workerIdByMachineId.get(machine.id)
        const group = workerId === undefined ? undefined : groupByWorkerId.get(workerId)
        if (group) group.machines.push(machine)
        else ungrouped.push(machine)
    }

    return {
        rows: groups.filter((group) => group.machines.length > 0),
        idleWorkers: groups.filter((group) => group.machines.length === 0).map((group) => group.worker),
        ungrouped,
    }
}

type AssignmentOrderRow = { worker_id: string; created_at?: string }

/**
 * Orders workers for the Machine Assignments board so the board grows downwards:
 * workers who already have machines come first, earliest first assigned at the top,
 * and everyone else follows in the order given. A worker's position comes from their
 * oldest assignment, so adding another machine to them does not move them. Rows
 * without a saved time (just placed in the browser) count as newest.
 */
export function orderWorkersByAssignment<W extends { id: string }>(
    workers: readonly W[],
    assignments: readonly AssignmentOrderRow[],
): W[] {
    const firstAssigned = new Map<string, number>()
    for (const assignment of assignments) {
        const parsed = assignment.created_at ? Date.parse(assignment.created_at) : Number.NaN
        const time = Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
        const known = firstAssigned.get(assignment.worker_id)
        if (known === undefined || time < known) firstAssigned.set(assignment.worker_id, time)
    }
    const assigned = workers.filter((worker) => firstAssigned.has(worker.id))
    const rest = workers.filter((worker) => !firstAssigned.has(worker.id))
    // Array sort is stable, so equal times keep the order given.
    assigned.sort((left, right) => {
        const a = firstAssigned.get(left.id)!
        const b = firstAssigned.get(right.id)!
        return a === b ? 0 : a < b ? -1 : 1
    })
    return [...assigned, ...rest]
}

/**
 * Workers already placed on the other shift and not on this one. The board hides
 * them: moving a worker between shifts is done with switch workers.
 */
export function workersHeldByOtherShift(
    thisShiftAssignments: readonly { worker_id: string }[],
    otherShiftAssignments: readonly { worker_id: string }[],
): Set<string> {
    const onThisShift = new Set(thisShiftAssignments.map((assignment) => assignment.worker_id))
    return new Set(otherShiftAssignments.map((assignment) => assignment.worker_id).filter((id) => !onThisShift.has(id)))
}
