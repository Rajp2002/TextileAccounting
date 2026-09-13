import { describe, expect, it } from 'vitest'
import { getMachineReadiness } from '../lib/machine-readiness'
import type { BaseProductionMachineWithReadiness } from '../lib/machine-readiness'

describe('Machine Operational Readiness Business Logic', () => {
  const baseMachine: BaseProductionMachineWithReadiness = {
    id: 'mach-1',
    name: 'Rapier Loom 01',
    custom_label: null,
    machine_type: 'rapier',
    is_active: true,
  }

  it('marks machine as active when BOTH worker and costing are assigned', () => {
    const machine: BaseProductionMachineWithReadiness = {
      ...baseMachine,
      assignedWorkerName: 'Ramesh Patel',
      assignedCostingLabel: 'Quality 60x60 Cotton',
    }

    const readiness = getMachineReadiness(machine)
    expect(readiness.isActive).toBe(true)
    expect(readiness.status).toBe('active')
    expect(readiness.hasWorker).toBe(true)
    expect(readiness.hasCosting).toBe(true)
    expect(readiness.workerName).toBe('Ramesh Patel')
    expect(readiness.costingLabel).toBe('Quality 60x60 Cotton')
  })

  it('marks machine as needs_setup when worker is assigned but costing is missing', () => {
    const machine: BaseProductionMachineWithReadiness = {
      ...baseMachine,
      assignedWorkerName: 'Ramesh Patel',
      assignedCostingLabel: null,
    }

    const readiness = getMachineReadiness(machine)
    expect(readiness.isActive).toBe(false)
    expect(readiness.status).toBe('needs_setup')
    expect(readiness.hasWorker).toBe(true)
    expect(readiness.hasCosting).toBe(false)
    expect(readiness.workerName).toBe('Ramesh Patel')
    expect(readiness.costingLabel).toBeNull()
  })

  it('marks machine as needs_setup when costing is assigned but worker is missing', () => {
    const machine: BaseProductionMachineWithReadiness = {
      ...baseMachine,
      assignedWorkerName: null,
      assignedCostingLabel: 'Quality 60x60 Cotton',
    }

    const readiness = getMachineReadiness(machine)
    expect(readiness.isActive).toBe(false)
    expect(readiness.status).toBe('needs_setup')
    expect(readiness.hasWorker).toBe(false)
    expect(readiness.hasCosting).toBe(true)
    expect(readiness.workerName).toBeNull()
    expect(readiness.costingLabel).toBe('Quality 60x60 Cotton')
  })

  it('marks machine as needs_setup when neither worker nor costing are assigned', () => {
    const machine: BaseProductionMachineWithReadiness = {
      ...baseMachine,
      assignedWorkerName: null,
      assignedCostingLabel: null,
    }

    const readiness = getMachineReadiness(machine)
    expect(readiness.isActive).toBe(false)
    expect(readiness.status).toBe('needs_setup')
    expect(readiness.hasWorker).toBe(false)
    expect(readiness.hasCosting).toBe(false)
    expect(readiness.workerName).toBeNull()
    expect(readiness.costingLabel).toBeNull()
  })

  it('honors boolean overrides hasWorker and hasCosting when provided', () => {
    const machine: BaseProductionMachineWithReadiness = {
      ...baseMachine,
      hasWorker: true,
      hasCosting: false,
    }

    const readiness = getMachineReadiness(machine)
    expect(readiness.isActive).toBe(false)
    expect(readiness.status).toBe('needs_setup')
    expect(readiness.hasWorker).toBe(true)
    expect(readiness.hasCosting).toBe(false)
  })

  it('handles empty string or whitespace gracefully as missing', () => {
    const machine: BaseProductionMachineWithReadiness = {
      ...baseMachine,
      assignedWorkerName: '   ',
      assignedCostingLabel: '',
    }

    const readiness = getMachineReadiness(machine)
    expect(readiness.isActive).toBe(false)
    expect(readiness.status).toBe('needs_setup')
    expect(readiness.hasWorker).toBe(false)
    expect(readiness.hasCosting).toBe(false)
  })
})
