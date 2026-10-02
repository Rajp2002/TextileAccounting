export const PWA_WORKFLOW_SUCCESS_EVENT = 'weavly:workflow-success'
export const PWA_INSTALL_SAFETY_EVENT = 'weavly:install-safety-change'
export const PWA_SUCCESSFUL_WORKFLOWS = ['costing', 'production', 'payroll', 'stock', 'dispatch', 'assignments', 'rates'] as const
export type PwaSuccessfulWorkflow = typeof PWA_SUCCESSFUL_WORKFLOWS[number]

/** In-browser product signal only. Never include record IDs, names, amounts, or form data. */
export function reportPwaWorkflowSuccess(workflow: PwaSuccessfulWorkflow) {
    if (typeof window === 'undefined' || !PWA_SUCCESSFUL_WORKFLOWS.includes(workflow)) return
    window.dispatchEvent(new CustomEvent(PWA_WORKFLOW_SUCCESS_EVENT, { detail: { workflow } }))
}

const blockers = new Set<() => boolean>()
function notifySafetyChanged() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(PWA_INSTALL_SAFETY_EVENT))
}

/** Pure visibility guards; unlike refresh guards these never flush draft storage. */
export function registerPwaInstallBlocker(blocker: () => boolean) {
    blockers.add(blocker)
    notifySafetyChanged()
    return () => { blockers.delete(blocker); notifySafetyChanged() }
}

export function isPwaInstallBlocked() {
    for (const blocker of blockers) {
        try { if (blocker()) return true } catch { return true }
    }
    return false
}
