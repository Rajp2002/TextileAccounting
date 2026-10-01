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
