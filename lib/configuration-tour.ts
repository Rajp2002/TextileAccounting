import type { BaseMachineJobContext, BaseProductionJob, BaseProductionMachine, BaseProductionWorker, BaseWorkerMachineAssignment } from './base-production-core'

export const configurationTourSteps = ['purpose', 'dayShift', 'nightShift', 'workers', 'search', 'machines', 'machineTypes', 'jobRequired', 'assign', 'picker', 'pickerCurrent', 'pickerOccupied', 'pickerBlocked', 'drag', 'connected', 'undo', 'replace', 'remove', 'inactive', 'addWorker', 'addMachine', 'setup', 'finish'] as const
export type ConfigurationTourStep = typeof configurationTourSteps[number]
export const CONFIGURATION_SAMPLE_WORKER = 'tour-configuration-worker'
export const CONFIGURATION_SAMPLE_MACHINE = 'tour-configuration-machine'

export function configurationTourSection(step: ConfigurationTourStep) {
    if (['purpose', 'dayShift', 'nightShift'].includes(step)) return 0
    if (['workers', 'search', 'machines', 'machineTypes'].includes(step)) return 1
    if (step === 'jobRequired') return 2
    if (['assign', 'picker', 'pickerCurrent', 'pickerOccupied', 'pickerBlocked', 'drag', 'connected', 'undo'].includes(step)) return 3
    if (['replace', 'remove', 'inactive'].includes(step)) return 4
    return 5
}
export const configurationPickerSteps: readonly ConfigurationTourStep[] = ['picker', 'pickerCurrent', 'pickerOccupied', 'pickerBlocked']

export function configurationTourView(step: ConfigurationTourStep) {
    return {
        shift: step === 'nightShift' ? 'night' as const : 'day' as const,
        mobileView: ['machines', 'machineTypes', 'jobRequired', 'connected', 'replace', 'remove', 'inactive'].includes(step) ? 'machines' as const : 'workers' as const,
        pickerWorkerId: configurationPickerSteps.includes(step) ? CONFIGURATION_SAMPLE_WORKER : null,
        showInactive: step === 'inactive',
    }
}

/** Ephemeral illustrations only: non-UUID IDs cannot identify persisted business records. */
export function makeConfigurationTourExample(today: string, step: ConfigurationTourStep): {
    workers: BaseProductionWorker[]; machines: BaseProductionMachine[]; jobs: BaseProductionJob[]
    assignments: BaseWorkerMachineAssignment[]; machineJobContexts: BaseMachineJobContext[]
} {
    const connected = ['connected', 'undo', 'replace', 'remove', 'inactive', 'addWorker', 'addMachine', 'setup', 'finish'].includes(step)
    const picker = configurationPickerSteps.includes(step)
    const example: ReturnType<typeof makeConfigurationTourExample> = {
        workers: [{ id: CONFIGURATION_SAMPLE_WORKER, name: 'Sample worker', pay_type: 'piece_rate', rate_per_meter: 0, shift_availability: 'both', is_active: true }],
        machines: [
            { id: CONFIGURATION_SAMPLE_MACHINE, name: 'Sample loom', machine_type: 'power_loom', custom_label: null, is_active: true },
            ...(step === 'inactive' ? [{ id: 'tour-configuration-inactive-machine', name: 'Sample inactive loom', machine_type: 'power_loom', custom_label: null, is_active: false }] : []),
        ],
        jobs: [{ id: 'tour-configuration-job', costing_id: 'tour-configuration-costing', costing_group_id: null, costing_version: 1, quality_label: 'Sample fabric', target_meters: 1000, start_date: today, due_date: null, customer_reference: null, notes: null, status: 'active', worker_rate_per_meter: 1, planned_cost_per_meter: 10, planned_price_per_meter: 12, created_at: `${today}T00:00:00Z` }],
        assignments: connected ? [{ id: 'tour-configuration-assignment', worker_id: CONFIGURATION_SAMPLE_WORKER, machine_id: CONFIGURATION_SAMPLE_MACHINE, shift: 'day', active: true, effective_from: today, effective_to: null }] : [],
        machineJobContexts: step === 'jobRequired' ? [] : [{ id: 'tour-configuration-context', machine_id: CONFIGURATION_SAMPLE_MACHINE, job_id: 'tour-configuration-job', active: true, effective_from: today, effective_to: null }],
    }
    if (picker || step === 'replace') example.workers.push({ ...example.workers[0], id: 'tour-configuration-worker-two', name: 'Second sample worker' })
    if (picker) {
        for (const kind of ['current', 'occupied', 'blocked'] as const) {
            const machineId = `tour-configuration-${kind}`
            example.machines.push({ id: machineId, name: `Sample ${kind} loom`, machine_type: kind === 'occupied' ? 'rapier' : 'power_loom', custom_label: null, is_active: true })
            if (kind !== 'blocked') {
                example.machineJobContexts.push({ id: `tour-configuration-job-${kind}`, machine_id: machineId, job_id: example.jobs[0].id, active: true, effective_from: today, effective_to: null })
                example.assignments.push({ id: `tour-configuration-link-${kind}`, machine_id: machineId, worker_id: kind === 'current' ? CONFIGURATION_SAMPLE_WORKER : 'tour-configuration-worker-two', shift: 'day', active: true, effective_from: today, effective_to: null })
            }
        }
    }
    return example
}

export const configurationTourSelectors: Record<ConfigurationTourStep, string> = {
    purpose: '[data-configuration-tour="board"]',
    dayShift: '[data-configuration-tour="shift"]', nightShift: '[data-configuration-tour="shift"]',
    workers: '[data-configuration-tour="worker"]', search: '[data-configuration-tour="search"]',
    machines: '[data-configuration-tour="machine"]', machineTypes: '[data-configuration-tour="types"]',
    jobRequired: '[data-configuration-tour="job"]', assign: '[data-configuration-tour="assign"]',
    picker: '[data-configuration-picker-state="available"]',
    pickerCurrent: '[data-configuration-picker-state="current"]',
    pickerOccupied: '[data-configuration-picker-state="occupied"]',
    pickerBlocked: '[data-configuration-picker-state="blocked"]',
    undo: '[data-configuration-tour="undo"]', drag: '[data-configuration-tour="drag"], [data-configuration-tour-drag-fallback]',
    connected: '[data-configuration-tour-connections]', replace: '[data-configuration-tour="replace-preview"]',
    remove: '[data-configuration-tour="remove"]', inactive: '[data-configuration-tour="inactive"]',
    addWorker: '[data-configuration-tour="add-worker"]', addMachine: '[data-configuration-tour="add-machine"]',
    setup: '[data-configuration-tour="setup"]', finish: '[data-configuration-tour="count"]',
}
