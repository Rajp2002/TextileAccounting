export type RotationShift = 'day' | 'night'

export type RotationWorker = {
    id: string
    name: string
    pay_type?: 'piece_rate' | 'fixed_monthly'
    shift_availability: RotationShift | 'both'
    is_active: boolean
}

/** A current (open-ended, active) loom assignment. */
export type RotationAssignment = {
    worker_id: string
    machine_id: string
    shift: RotationShift
}

export type ShiftMove = {
    workerId: string
    workerName: string
    from: RotationShift
    to: RotationShift
    loomCount: number
}

export type ShiftClash = {
    workerId: string
    workerName: string
    machineId: string
    machineName: string
    /** The shift the worker would move into, where the loom is already taken. */
    shift: RotationShift
    heldByWorkerId: string
    heldByWorkerName: string
}

export type ShiftRotationPlan = {
    moves: ShiftMove[]
    clashes: ShiftClash[]
}

export function oppositeShift(shift: RotationShift): RotationShift {
    return shift === 'day' ? 'night' : 'day'
}

/**
 * Workers the rotation can move: active piece-rate workers fixed to one shift.
 * Fixed-salary staff and "day & night" workers have no single shift to swap.
 */
export function listRotatableWorkers<T extends RotationWorker>(workers: readonly T[]): T[] {
    return workers.filter(worker =>
        worker.is_active
        && worker.pay_type !== 'fixed_monthly'
        && (worker.shift_availability === 'day' || worker.shift_availability === 'night'))
}

/**
 * Plans a shift switch for the selected workers. Each selected worker moves to the
 * opposite shift together with every loom they run. A loom can have only one worker
 * per shift, so a move clashes when the target slot is held by someone who is not
 * themselves moving out of it.
 */
export function planShiftRotation(input: {
    workers: readonly RotationWorker[]
    assignments: readonly RotationAssignment[]
    machineNames: ReadonlyMap<string, string>
    selectedIds: Iterable<string>
}): ShiftRotationPlan {
    const selected = new Set(input.selectedIds)
    const rotatable = listRotatableWorkers(input.workers)
    const moving = new Map(rotatable.filter(worker => selected.has(worker.id)).map(worker => [worker.id, worker]))
    const names = new Map(input.workers.map(worker => [worker.id, worker.name]))

    const holderBySlot = new Map<string, string>()
    for (const assignment of input.assignments) {
        holderBySlot.set(`${assignment.machine_id}:${assignment.shift}`, assignment.worker_id)
    }

    const moves: ShiftMove[] = []
    const clashes: ShiftClash[] = []
    for (const worker of rotatable) {
        if (!moving.has(worker.id)) continue
        const from = worker.shift_availability as RotationShift
        const looms = input.assignments.filter(assignment => assignment.worker_id === worker.id)
        moves.push({ workerId: worker.id, workerName: worker.name, from, to: oppositeShift(from), loomCount: looms.length })

        for (const loomAssignment of looms) {
            const target = oppositeShift(loomAssignment.shift)
            const holderId = holderBySlot.get(`${loomAssignment.machine_id}:${target}`)
            // A selected holder is a day/night worker, so they leave this slot as we enter it.
            if (!holderId || holderId === worker.id || moving.has(holderId)) continue
            clashes.push({
                workerId: worker.id,
                workerName: worker.name,
                machineId: loomAssignment.machine_id,
                machineName: input.machineNames.get(loomAssignment.machine_id) ?? 'Loom',
                shift: target,
                heldByWorkerId: holderId,
                heldByWorkerName: names.get(holderId) ?? 'Another worker',
            })
        }
    }
    return { moves, clashes }
}
