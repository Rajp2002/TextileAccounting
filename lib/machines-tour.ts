import type { BaseProductionMachineWithReadiness } from './machine-readiness'

export const machinesTourSteps = ['search', 'filter', 'identity', 'readiness', 'worker', 'costing', 'add', 'name', 'type', 'label', 'edit', 'availability', 'assignments', 'compare', 'finish'] as const
export type MachinesTourStep = typeof machinesTourSteps[number]
export function machinesTourEditor(step: MachinesTourStep) {
    if (['name', 'type', 'label'].includes(step)) return 'add'
    return step === 'availability' ? 'edit' : null
}
export function machinesTourSection(step: MachinesTourStep) {
    const index = machinesTourSteps.indexOf(step)
    return index < 2 ? 0 : index < 6 ? 1 : index < 10 ? 2 : index < 12 ? 3 : 4
}
/** Ephemeral, non-UUID examples: never send these records to persistence actions. */
export function makeMachinesTourExamples(): BaseProductionMachineWithReadiness[] {
    return [
        { id: 'tour-machines-ready', name: 'Sample loom 1', machine_type: 'rapier', custom_label: 'Sample Rapier', is_active: true, hasWorker: true, hasCosting: true, assignedWorkerName: 'Sample worker', assignedCostingLabel: 'Sample fabric' },
        { id: 'tour-machines-incomplete', name: 'Sample loom 2', machine_type: 'power_loom', custom_label: null, is_active: true, hasWorker: false, hasCosting: false, assignedWorkerName: null, assignedCostingLabel: null },
    ]
}
const ready = '[data-machines-tour-id="tour-machines-ready"]'
const preview = '[data-machines-tour-preview="true"][data-state="open"]'
export const machinesTourSelectors: Record<MachinesTourStep, string> = {
    search: '[data-machines-tour="toolbar"] input',
    filter: '[data-machines-tour="toolbar"] select',
    identity: `${ready} [data-machines-tour="identity"]`,
    readiness: `${ready} [data-machines-tour="readiness"]`,
    worker: `${ready} [data-machines-tour="worker"]`,
    costing: `${ready} [data-machines-tour="costing"]`,
    add: '[data-machines-tour="header"] button',
    name: `${preview} [data-machines-tour-field="name"]`,
    type: `${preview} [data-machines-tour-field="type"]`,
    label: `${preview} [data-machines-tour-field="label"]`,
    edit: `${ready} [data-machines-tour="edit"]`,
    availability: `${preview} [data-machines-tour-field="availability"]`,
    assignments: `${ready} [data-machines-tour="assignments"]`,
    compare: '[data-machines-tour-id="tour-machines-incomplete"]',
    finish: '[data-machines-tour="launcher"]',
}
