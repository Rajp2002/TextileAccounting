import type { BaseProductionMachine } from './base-production-core'

export type MachineReadinessStatus = 'active' | 'needs_setup'

export type MachineReadiness = {
    isActive: boolean
    hasWorker: boolean
    hasCosting: boolean
    workerName: string | null
    costingLabel: string | null
    status: MachineReadinessStatus
}

export type BaseProductionMachineWithReadiness = BaseProductionMachine & {
    assignedWorkerName?: string | null
    assignedCostingLabel?: string | null
    hasWorker?: boolean
    hasCosting?: boolean
    readinessStatus?: MachineReadinessStatus
}

/**
 * Authoritative business rule:
 * A machine is considered ACTIVE only when BOTH of the following are true:
 * 1. A valid/current costing is assigned to that machine.
 * 2. A worker is assigned to that machine.
 *
 * Otherwise, the machine status is NEEDS SETUP.
 */
export function getMachineReadiness(machine: BaseProductionMachineWithReadiness): MachineReadiness {
    const hasWorker = typeof machine.hasWorker === 'boolean'
        ? machine.hasWorker
        : Boolean(machine.assignedWorkerName && machine.assignedWorkerName.trim().length > 0)

    const hasCosting = typeof machine.hasCosting === 'boolean'
        ? machine.hasCosting
        : Boolean(machine.assignedCostingLabel && machine.assignedCostingLabel.trim().length > 0)

    const isActive = hasWorker && hasCosting
    const status: MachineReadinessStatus = isActive ? 'active' : 'needs_setup'

    return {
        isActive,
        hasWorker,
        hasCosting,
        workerName: machine.assignedWorkerName ?? null,
        costingLabel: machine.assignedCostingLabel ?? null,
        status,
    }
}
