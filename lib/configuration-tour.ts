import type { TourStepSpec } from './tours/tour-types'
import { isSampleRecordId } from './tours/sample-ids'
import type { BaseMachineJobContext, BaseProductionJob, BaseProductionMachine, BaseProductionWorker, BaseWorkerMachineAssignment } from './base-production-core'

export const configurationTourSteps = ['ma-purpose', 'ma-shift', 'ma-job', 'ma-assign', 'ma-choose', 'ma-linked', 'ma-handoff'] as const
export type ConfigurationTourStep = typeof configurationTourSteps[number]
export const CONFIGURATION_SAMPLE_WORKER = 'tour-configuration-worker'
export const CONFIGURATION_SAMPLE_MACHINE = 'tour-configuration-machine'

export function configurationTourView(step: ConfigurationTourStep) {
    if (step === 'ma-handoff') return null
    return {
        shift: 'day' as const,
        mobileView: step === 'ma-job' || step === 'ma-linked' ? 'machines' as const : 'workers' as const,
        pickerWorkerId: step === 'ma-choose' ? CONFIGURATION_SAMPLE_WORKER : null,
        showInactive: false,
    }
}

export function configurationTourControlLabels(t: (key: string) => string, tx: (text: string) => string) {
    return {
        assign: t('assignments.assign'), noJob: t('assignments.noJob'),
        assignLooms: t('production.assignLooms'),
        choose: tx('Choose'), undo: tx('Undo'), addWorker: tx('Add worker'),
    }
}

/** Reuse the page's eligible candidates, including its retained-assignment rule. */
export function configurationHandoffWorker(workers: readonly BaseProductionWorker[]) {
    return workers.find(worker => !isSampleRecordId(worker.id) && worker.is_active && worker.pay_type === 'piece_rate')
}

/** Ephemeral illustrations only: non-UUID IDs cannot identify persisted business records. */
export function makeConfigurationTourExample(today: string, step: ConfigurationTourStep): {
    workers: BaseProductionWorker[]; machines: BaseProductionMachine[]; jobs: BaseProductionJob[]
    assignments: BaseWorkerMachineAssignment[]; machineJobContexts: BaseMachineJobContext[]
} {
    const connected = step === 'ma-linked'
    const example: ReturnType<typeof makeConfigurationTourExample> = {
        workers: [{ id: CONFIGURATION_SAMPLE_WORKER, name: 'Sample worker', pay_type: 'piece_rate', rate_per_meter: 0, shift_availability: 'both', is_active: true }],
        machines: [
            { id: CONFIGURATION_SAMPLE_MACHINE, name: 'Sample loom', machine_type: 'power_loom', custom_label: null, is_active: true },
        ],
        jobs: [{ id: 'tour-configuration-job', costing_id: 'tour-configuration-costing', costing_group_id: null, costing_version: 1, quality_label: 'Sample fabric', target_meters: 1000, start_date: today, due_date: null, customer_reference: null, notes: null, status: 'active', worker_rate_per_meter: 1, planned_cost_per_meter: 10, planned_price_per_meter: 12, created_at: `${today}T00:00:00Z` }],
        assignments: connected ? [{ id: 'tour-configuration-assignment', worker_id: CONFIGURATION_SAMPLE_WORKER, machine_id: CONFIGURATION_SAMPLE_MACHINE, shift: 'day', active: true, effective_from: today, effective_to: null }] : [],
        machineJobContexts: step === 'ma-job' ? [] : [{ id: 'tour-configuration-context', machine_id: CONFIGURATION_SAMPLE_MACHINE, job_id: 'tour-configuration-job', active: true, effective_from: today, effective_to: null }],
    }
    return example
}

export const configurationTourSelectors: Record<ConfigurationTourStep, string> = {
    'ma-purpose': '[data-configuration-tour="board"]',
    'ma-shift': '[data-configuration-tour="shift"]',
    'ma-job': '[data-configuration-tour="job"]',
    'ma-assign': '[data-configuration-tour="assign"]',
    'ma-choose': '[data-configuration-picker-state="available"]',
    'ma-linked': '[data-configuration-tour="saved-preview"]',
    'ma-handoff': '[data-tour-anchor="assignments.first-assign"]',
}

export function configurationTourSpecs(hasWorker: boolean): readonly TourStepSpec<ConfigurationTourStep>[] {
    return configurationTourSteps.map(id => ({
        id, kind: id === 'ma-handoff' ? 'handoff' : 'sample',
        anchor: id === 'ma-handoff' && !hasWorker ? '[data-tour-anchor="assignments.add-worker"]' : configurationTourSelectors[id],
        ...(id === 'ma-choose' ? { context: '[data-configuration-picker-preview="true"]', detail: true } : {}),
    }))
}
