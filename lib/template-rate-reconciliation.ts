import { stableValue } from './costing-input-changes'
import type { WarpRow, WeftRow } from './estimator'

/**
 * The state of a saved quality after a rate update whose answer was lost.
 * - `not_applied`: still at the version the update expected, so it did not
 *   commit (every commit moves `updated_at`); sending it again is safe because
 *   the server re-checks that version
 * - `matches_proposal`: the quality now has exactly the proposed rows. This is
 *   a matching current state, not proof that this request wrote it
 * - `conflict`: the quality changed to something else
 * - `missing`: the quality is gone or archived
 */
export type TemplateRateReconciliation = 'not_applied' | 'matches_proposal' | 'conflict' | 'missing'

type RecipeRows = { warp_rows?: WarpRow[] | null; weft_rows?: WeftRow[] | null }

function rowsKey(warp: WarpRow[] | null | undefined, weft: WeftRow[] | null | undefined) {
    return JSON.stringify(stableValue({ warp: warp ?? [], weft: weft ?? [] }))
}

export function reconcileTemplateRateUpdate(input: {
    expectedUpdatedAt: string
    proposedWarp: WarpRow[]
    proposedWeft: WeftRow[]
    current: (RecipeRows & { updated_at: string }) | null
}): TemplateRateReconciliation {
    const { current } = input
    if (!current) return 'missing'
    if (current.updated_at === input.expectedUpdatedAt) return 'not_applied'
    return rowsKey(current.warp_rows, current.weft_rows) === rowsKey(input.proposedWarp, input.proposedWeft)
        ? 'matches_proposal'
        : 'conflict'
}
