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

/**
 * Where a worker's looms sit before the switch: their shift, or 'both' for a Day & night
 * worker who runs looms on each shift (every loom swaps, so they stay on both).
 */
export type RotationSide = RotationShift | 'both'

export type ShiftMove = {
    workerId: string
    workerName: string
    from: RotationSide
    to: RotationSide
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
 * Workers the rotation can move: active piece-rate workers on one shift, and "day &
 * night" workers who run at least one loom (each of their looms swaps shift). Fixed-salary
 * staff are left out, and a day & night worker with no loom has nothing to swap.
 */
export function listRotatableWorkers<T extends RotationWorker>(workers: readonly T[], assignments: readonly RotationAssignment[]): T[] {
    const withLooms = new Set(assignments.map(assignment => assignment.worker_id))
    return workers.filter(worker =>
        worker.is_active
        && worker.pay_type !== 'fixed_monthly'
        && (worker.shift_availability !== 'both' || withLooms.has(worker.id)))
}

/** The shift a worker moves away from: their setting, or where a day & night worker's looms are. */
export function rotationSide(worker: RotationWorker, assignments: readonly RotationAssignment[]): RotationSide {
    if (worker.shift_availability !== 'both') return worker.shift_availability
    const shifts = new Set(assignments.filter(assignment => assignment.worker_id === worker.id).map(assignment => assignment.shift))
    return shifts.size === 1 ? [...shifts][0] : 'both'
}

function oppositeSide(side: RotationSide): RotationSide {
    return side === 'both' ? 'both' : oppositeShift(side)
}

/**
 * Plans a shift switch for the selected workers. Every loom a selected worker runs moves
 * to the opposite shift, and single-shift workers change shift with them. A loom can have
 * only one worker per shift, so a move clashes when the target slot is held by someone
 * who is not themselves moving out of it.
 */
export function planShiftRotation(input: {
    workers: readonly RotationWorker[]
    assignments: readonly RotationAssignment[]
    machineNames: ReadonlyMap<string, string>
    selectedIds: Iterable<string>
}): ShiftRotationPlan {
    const selected = new Set(input.selectedIds)
    const rotatable = listRotatableWorkers(input.workers, input.assignments)
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
        const from = rotationSide(worker, input.assignments)
        const looms = input.assignments.filter(assignment => assignment.worker_id === worker.id)
        moves.push({ workerId: worker.id, workerName: worker.name, from, to: oppositeSide(from), loomCount: looms.length })

        for (const loomAssignment of looms) {
            const target = oppositeShift(loomAssignment.shift)
            const holderId = holderBySlot.get(`${loomAssignment.machine_id}:${target}`)
            // Every loom of a selected worker swaps, so a selected holder leaves this slot as we enter it.
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
