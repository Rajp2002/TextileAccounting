import type { BaseMachineJobContext, BaseProductionJob, BaseProductionMachine, BaseProductionWorker, BaseWorkerMachineAssignment } from './base-production-core'

export const configurationTourSteps = ['purpose', 'dayShift', 'nightShift', 'workers', 'search', 'machines', 'machineTypes', 'jobRequired', 'assign', 'picker', 'drag', 'connected', 'replace', 'remove', 'inactive', 'addWorker', 'addMachine', 'setup', 'finish'] as const
export type ConfigurationTourStep = typeof configurationTourSteps[number]
export const CONFIGURATION_SAMPLE_WORKER = 'tour-configuration-worker'
export const CONFIGURATION_SAMPLE_MACHINE = 'tour-configuration-machine'

export function configurationTourView(step: ConfigurationTourStep) {
    return {
        shift: step === 'nightShift' ? 'night' as const : 'day' as const,
        mobileView: ['machines', 'machineTypes', 'jobRequired', 'connected', 'replace', 'remove', 'inactive'].includes(step) ? 'machines' as const : 'workers' as const,
        pickerWorkerId: step === 'picker' ? CONFIGURATION_SAMPLE_WORKER : null,
        showInactive: step === 'inactive',
    }
}

/** Ephemeral illustrations only: non-UUID IDs cannot identify persisted business records. */
export function makeConfigurationTourExample(today: string, step: ConfigurationTourStep): {
    workers: BaseProductionWorker[]; machines: BaseProductionMachine[]; jobs: BaseProductionJob[]
    assignments: BaseWorkerMachineAssignment[]; machineJobContexts: BaseMachineJobContext[]
} {
    const connected = ['connected', 'replace', 'remove', 'inactive', 'addWorker', 'addMachine', 'setup', 'finish'].includes(step)
    return {
        workers: [{ id: CONFIGURATION_SAMPLE_WORKER, name: 'Sample worker', pay_type: 'piece_rate', rate_per_meter: 0, shift_availability: 'both', is_active: true }],
        machines: [
            { id: CONFIGURATION_SAMPLE_MACHINE, name: 'Sample loom', machine_type: 'power_loom', custom_label: null, is_active: true },
            ...(step === 'inactive' ? [{ id: 'tour-configuration-inactive-machine', name: 'Sample inactive loom', machine_type: 'power_loom', custom_label: null, is_active: false }] : []),
        ],
        jobs: [{ id: 'tour-configuration-job', costing_id: 'tour-configuration-costing', costing_group_id: null, costing_version: 1, quality_label: 'Sample fabric', target_meters: 1000, start_date: today, due_date: null, customer_reference: null, notes: null, status: 'active', worker_rate_per_meter: 1, planned_cost_per_meter: 10, planned_price_per_meter: 12, created_at: `${today}T00:00:00Z` }],
        assignments: connected ? [{ id: 'tour-configuration-assignment', worker_id: CONFIGURATION_SAMPLE_WORKER, machine_id: CONFIGURATION_SAMPLE_MACHINE, shift: 'day', active: true, effective_from: today, effective_to: null }] : [],
        machineJobContexts: step === 'jobRequired' ? [] : [{ id: 'tour-configuration-context', machine_id: CONFIGURATION_SAMPLE_MACHINE, job_id: 'tour-configuration-job', active: true, effective_from: today, effective_to: null }],
    }
}

export const configurationTourSelectors: Record<ConfigurationTourStep, string> = {
    purpose: '[data-configuration-tour="board"]',
    dayShift: '[data-configuration-tour="shift"]', nightShift: '[data-configuration-tour="shift"]',
    workers: '[data-configuration-tour="worker"]', search: '[data-configuration-tour="search"]',
    machines: '[data-configuration-tour="machine"]', machineTypes: '[data-configuration-tour="types"]',
    jobRequired: '[data-configuration-tour="job"]', assign: '[data-configuration-tour="assign"]',
    picker: '[data-configuration-tour="picker"]', drag: '[data-configuration-tour="drag"], [data-configuration-tour-drag-fallback]',
    connected: '[data-configuration-tour-connections]', replace: '[data-configuration-tour="machine"]',
    remove: '[data-configuration-tour="remove"]', inactive: '[data-configuration-tour="inactive"]',
    addWorker: '[data-configuration-tour="add-worker"]', addMachine: '[data-configuration-tour="add-machine"]',
    setup: '[data-configuration-tour="setup"]', finish: '[data-configuration-tour="count"]',
}
