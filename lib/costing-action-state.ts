import {
    describeConstructionChanges,
    type ConstructionChange,
    type ConstructionRows,
} from '@/lib/quality-construction'

// Which save actions the Lite/Base estimator offers. The fabric decides:
// a new fabric saves a costing or a quality; the same fabric updates the
// costing; a changed fabric can only be saved as a new quality.

export type CostingActionInput = {
    /** A saved quality is loaded (appliedTemplate). */
    hasSavedQuality: boolean
    /** A saved costing is open (sourceQuoteId set on a costing record). */
    hasOpenedCosting: boolean
    /** The loaded quality's rows, else the opened costing's rows, else null. */
    baseline: ConstructionRows | null
    current: ConstructionRows
    /** Highest saved version in this lineage, null when it has none. */
    latestVersion: number | null
}

export type CostingActionState =
    /** Save Costing (costing only) and Save Quality & Costing. */
    | { kind: 'new' }
    /** Update Costing saves the next version; Save as New Quality is disabled unless canSaveQuality. */
    | { kind: 'sameFabric'; nextVersion: number; firstCosting: boolean; canSaveQuality: boolean }
    /** Save as New Quality; Update Costing is disabled. */
    | { kind: 'fabricChanged'; changes: ConstructionChange[] }

export function resolveCostingActionState(input: CostingActionInput): CostingActionState {
    if (!input.hasSavedQuality && !input.hasOpenedCosting) return { kind: 'new' }

    // A restored draft can point at a costing without its baseline. Saving must
    // stay possible, so treat it as the same fabric.
    const changes = input.baseline ? describeConstructionChanges(input.baseline, input.current) : []
    if (changes.length > 0) return { kind: 'fabricChanged', changes }

    return {
        kind: 'sameFabric',
        nextVersion: (input.latestVersion ?? 0) + 1,
        firstCosting: input.latestVersion === null,
        // A costing with no saved quality can still become one.
        canSaveQuality: !input.hasSavedQuality,
    }
}
