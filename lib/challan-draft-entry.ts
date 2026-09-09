import { challanTotals, type ChallanDraft } from './delivery-challans'

export function isEmptyChallanLine(line: ChallanDraft['lines'][number]) {
    return !line.lot.trim() && line.meters === 0
}

export function isCompleteChallanLine(line: ChallanDraft['lines'][number]) {
    return (
        Boolean(line.lot.trim()) &&
        Number.isFinite(line.meters) &&
        line.meters > 0 &&
        line.meters <= 100_000_000 &&
        Math.abs(line.meters * 100 - Math.round(line.meters * 100)) < 0.00001
    )
}

/** Count measured, identified lots, never the blank row offered for the next entry. */
export function challanDraftProgress(draft: ChallanDraft) {
    const completed = draft.lines.filter(isCompleteChallanLine)
    return {
        completed,
        ...challanTotals(completed, draft.selling_rate),
        incomplete: draft.lines.filter(
            (line) => !isEmptyChallanLine(line) && !isCompleteChallanLine(line),
        ).length,
    }
}

/** Drop untouched entry rows; preserve partial/invalid lines for validation. */
export function prepareChallanDraft(draft: ChallanDraft): ChallanDraft {
    return {
        ...draft,
        lines: draft.lines.filter((line) => !isEmptyChallanLine(line)),
    }
}
