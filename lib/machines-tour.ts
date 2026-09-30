import type { BaseProductionMachineWithReadiness } from './machine-readiness'
import type { TourStepSpec } from './tours/tour-types'

export const machinesTourSteps = ['mc-purpose', 'mc-details', 'mc-readiness', 'mc-quality', 'mc-worker', 'mc-handoff'] as const
export type MachinesTourStep = typeof machinesTourSteps[number]
export type MachinesTourCopyKey = 'purpose' | 'details' | 'readiness' | 'quality' | 'worker' | 'handoff'
export function machinesTourEditor(step: MachinesTourStep) {
    return step === 'mc-details' ? 'add' : null
}
export type MachinesTourExampleLabels = {
    readyName: string; incompleteName: string; label: string; worker: string; fabric: string
}
/** Ephemeral, non-UUID examples: never send these records to persistence actions. */
export function makeMachinesTourExamples(labels: MachinesTourExampleLabels = {
    readyName: 'Sample loom 1', incompleteName: 'Sample loom 2', label: 'Sample Rapier', worker: 'Sample worker', fabric: 'Sample fabric',
}): BaseProductionMachineWithReadiness[] {
    return [
        { id: 'tour-machines-ready', name: labels.readyName, machine_type: 'rapier', custom_label: labels.label, is_active: true, hasWorker: true, hasCosting: true, assignedWorkerName: labels.worker, assignedCostingLabel: labels.fabric },
        { id: 'tour-machines-incomplete', name: labels.incompleteName, machine_type: 'power_loom', custom_label: null, is_active: true, hasWorker: false, hasCosting: false, assignedWorkerName: null, assignedCostingLabel: null },
    ]
}
const preview = '[data-machines-tour-preview="true"][data-state="open"]'
export const machinesTourSelectors: Record<MachinesTourStep, string> = {
    'mc-purpose': '[data-machines-tour="header"]',
    'mc-details': '[data-machines-tour-field="details"]',
    'mc-readiness': '[data-machines-tour-id="tour-machines-incomplete"]',
    'mc-quality': '[data-machines-tour="production-next"]',
    'mc-worker': '[data-machines-tour="assignments-next"]',
    'mc-handoff': '[data-tour-anchor="machines.add"]',
}
export const machinesTourSpecs: readonly TourStepSpec<MachinesTourStep>[] = machinesTourSteps.map(id => ({
    id, anchor: machinesTourSelectors[id],
    kind: id === 'mc-handoff' ? 'handoff' : id === 'mc-details' || id === 'mc-readiness' ? 'sample' : 'live',
    ...(id === 'mc-details' ? { context: preview, detail: true } : {}),
}))
