import { hasExplicitProductionMode } from './production-mode'
import { hasAnyShiftLoomAssignment } from './production-worker-assignment-policy'

export type FactoryTodayMachineSetupRow = {
  id?: string | null
  current_order_id?: string | null
  orders?: { status?: string | null } | Array<{ status?: string | null }> | null
}

export type FactoryTodayAssignmentSetupRow = {
  machine_id?: string | null
  shift?: string | null
  worker_id?: string | number | null
}

export type FactoryTodayPayrollConfigSetupRow = {
  cycle_start_day?: number | string | null
  pay_date_day?: number | string | null
  pay_reminder_days?: number | string | null
} | null

export type FactoryTodaySetupChecklistInput = {
  onboardingComplete?: boolean | null
  productionMode?: string | null
  machines: FactoryTodayMachineSetupRow[]
  machineAssignments: FactoryTodayAssignmentSetupRow[]
  hasQuality: boolean
  hasEstimate: boolean
  hasOrder: boolean
  hasMarketRun: boolean
  hasMeterWorker: boolean
  hasFixedWorker: boolean
  hasSupervisor: boolean
  payrollConfig: FactoryTodayPayrollConfigSetupRow
  hasPlan: boolean
}

export type FactoryTodaySetupChecklist = {
  hasProductionMode: boolean
  hasMachine: boolean
  hasLoomAssignment: boolean
  hasLoomTarget: boolean
  hasQuality: boolean
  hasMeterWorker: boolean
  hasFixedWorker: boolean
  hasSupervisor: boolean
  hasPayrollConfig: boolean
  hasPlan: boolean
}

function firstRelatedOrderStatus(order: FactoryTodayMachineSetupRow['orders']): string | null {
  if (!order) return null
  const related = Array.isArray(order) ? order[0] : order
  return related?.status ?? null
}

export function hasCompletedCostingEvidence(input: Pick<
  FactoryTodaySetupChecklistInput,
  'hasQuality' | 'hasEstimate' | 'hasOrder' | 'hasMarketRun'
>): boolean {
  return input.hasQuality || input.hasEstimate || input.hasOrder || input.hasMarketRun
}

export function hasLinkedActiveProductionTarget(machines: FactoryTodayMachineSetupRow[]): boolean {
  return machines.some((machine) => {
    if (!machine.current_order_id) return false
    return firstRelatedOrderStatus(machine.orders) === 'active'
  })
}

export function hasDayNightLoomAssignment(assignments: FactoryTodayAssignmentSetupRow[]): boolean {
  const shiftsByMachine = new Map<string, Set<string>>()

  for (const assignment of assignments) {
    const machineId = String(assignment.machine_id ?? '')
    const shift = String(assignment.shift ?? '')
    if (!machineId || !assignment.worker_id || (shift !== 'day' && shift !== 'night')) continue

    const shifts = shiftsByMachine.get(machineId) ?? new Set<string>()
    shifts.add(shift)
    shiftsByMachine.set(machineId, shifts)
  }

  return Array.from(shiftsByMachine.values()).some((shifts) => (
    shifts.has('day') && shifts.has('night')
  ))
}

export function hasUsablePayrollConfig(config: FactoryTodayPayrollConfigSetupRow): boolean {
  if (!config) return false

  const cycleStartDay = Number(config.cycle_start_day ?? 1)
  const payDateDay = Number(config.pay_date_day ?? 10)
  const payReminderDays = Number(config.pay_reminder_days ?? 3)

  return (
    Number.isInteger(cycleStartDay) &&
    cycleStartDay >= 1 &&
    cycleStartDay <= 28 &&
    Number.isInteger(payDateDay) &&
    payDateDay >= 1 &&
    payDateDay <= 28 &&
    Number.isInteger(payReminderDays) &&
    payReminderDays >= 0 &&
    payReminderDays <= 14
  )
}

export function buildFactoryTodaySetupChecklist(input: FactoryTodaySetupChecklistInput): FactoryTodaySetupChecklist {
  return {
    hasProductionMode: input.onboardingComplete === true
      ? true
      : hasExplicitProductionMode(input.productionMode),
    hasMachine: input.machines.length > 0,
    hasLoomAssignment: hasAnyShiftLoomAssignment(input.machineAssignments),
    hasLoomTarget: hasLinkedActiveProductionTarget(input.machines),
    hasQuality: hasCompletedCostingEvidence(input),
    hasMeterWorker: input.hasMeterWorker,
    hasFixedWorker: input.hasFixedWorker,
    hasSupervisor: input.hasSupervisor,
    hasPayrollConfig: hasUsablePayrollConfig(input.payrollConfig),
    hasPlan: input.hasPlan,
  }
}
