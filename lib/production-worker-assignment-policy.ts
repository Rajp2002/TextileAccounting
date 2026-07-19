export type WorkerAssignmentShift = 'day' | 'night'

export type StandingWorkerAssignments = Partial<Record<WorkerAssignmentShift, number | null | undefined>>

export type ProductionWorkerAssignmentPolicyInput = {
  machineName?: string | null
  machineStatus?: string | null
  currentOrderId?: string | null
  logOrderId?: string | null
  activeOrderStatus?: string | null
  shift: WorkerAssignmentShift
  logWorkerId?: number | null
  standingAssignments?: StandingWorkerAssignments | null
}

export type ProductionWorkerAssignmentPolicyResult =
  | { ok: true }
  | { ok: false; code: 'LOOM_SETUP_INCOMPLETE' | 'SHIFT_WORKER_REQUIRED' | 'SUBSTITUTE_REASSIGNMENT_REQUIRED'; message: string }

type AssignmentLike = {
  machine_id?: string | null
  shift?: string | null
  worker_id?: string | number | null
}

function readableMachineName(name?: string | null) {
  return name?.trim() || 'This machine'
}

function shiftLabel(shift: WorkerAssignmentShift) {
  return shift === 'day' ? 'Day' : 'Night'
}

export function hasAnyShiftLoomAssignment(assignments: AssignmentLike[]): boolean {
  return assignments.some((assignment) => {
    const machineId = String(assignment.machine_id ?? '')
    const shift = String(assignment.shift ?? '')
    return Boolean(machineId && assignment.worker_id && (shift === 'day' || shift === 'night'))
  })
}

export function buildMissingShiftWorkerMessage(machineName: string | null | undefined, shift: WorkerAssignmentShift) {
  const label = shiftLabel(shift)
  const dayOnlyNote = shift === 'night'
    ? 'Day-shift production can still be logged with the day worker; assign a night worker before saving night production.'
    : 'Assign a day worker before saving day production.'

  return `${readableMachineName(machineName)} needs a ${shift} worker assigned before ${label} shift production can be saved. ${dayOnlyNote}`
}

export function buildSubstituteWorkerReassignmentMessage(machineName: string | null | undefined, shift: WorkerAssignmentShift) {
  return `${readableMachineName(machineName)} is assigned to another worker for this ${shift} shift. Reassign the ${shift} worker before logging a substitute so production, payroll, and machine accountability stay correct.`
}

export function evaluateProductionWorkerAssignmentPolicy(
  input: ProductionWorkerAssignmentPolicyInput
): ProductionWorkerAssignmentPolicyResult {
  if (
    input.machineStatus !== 'active' ||
    !input.currentOrderId ||
    input.currentOrderId !== input.logOrderId ||
    input.activeOrderStatus !== 'active'
  ) {
    return {
      ok: false,
      code: 'LOOM_SETUP_INCOMPLETE',
      message: `${readableMachineName(input.machineName)} needs an active cost analysis or quality before production can be saved.`,
    }
  }

  const expectedShiftWorkerId = input.standingAssignments?.[input.shift] ?? null

  if (!expectedShiftWorkerId) {
    return {
      ok: false,
      code: 'SHIFT_WORKER_REQUIRED',
      message: buildMissingShiftWorkerMessage(input.machineName, input.shift),
    }
  }

  if (expectedShiftWorkerId !== input.logWorkerId) {
    return {
      ok: false,
      code: 'SUBSTITUTE_REASSIGNMENT_REQUIRED',
      message: buildSubstituteWorkerReassignmentMessage(input.machineName, input.shift),
    }
  }

  return { ok: true }
}
