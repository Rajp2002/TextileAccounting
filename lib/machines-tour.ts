import type { BaseProductionMachineWithReadiness } from './machine-readiness'

export const machinesTourSteps = ['purpose', 'details', 'label', 'readiness', 'production', 'assignments'] as const
export type MachinesTourStep = typeof machinesTourSteps[number]
export function machinesTourEditor(step: MachinesTourStep) {
    return step === 'details' ? 'add' : null
}
export function machinesTourSection(step: MachinesTourStep) {
    return machinesTourSteps.indexOf(step)
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
const ready = '[data-machines-tour-id="tour-machines-ready"]'
const preview = '[data-machines-tour-preview="true"][data-state="open"]'
export const machinesTourSelectors: Record<MachinesTourStep, string> = {
    purpose: '[data-machines-tour="header"]',
    details: `${preview} [data-machines-tour-field="details"]`,
    label: `${ready} [data-machines-tour="identity"]`,
    readiness: '[data-machines-tour-id="tour-machines-incomplete"]',
    production: '[data-machines-tour="production-next"]',
    assignments: '[data-machines-tour="assignments-next"]',
}
