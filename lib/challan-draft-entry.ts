import { validPaymentDueDate } from './challan-payment-terms'
import {
    ChallanDraftSchema,
    challanTotals,
    safeEvidenceUrl,
    type ChallanDraft,
} from './delivery-challans'
import { lineSource } from './legacy-stock'

/** The document fields a challan cannot be saved, and so cannot be printed, without. */
export const REQUIRED_CHALLAN_DOCUMENT_FIELDS = [
    'date',
    'sender_name',
    'sender_address',
    'customer_name',
    'customer_address',
    'delivery_address',
] as const

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

export type ChallanPrintReadiness = {
    ready: boolean
    /** `challan.*` translation keys for what still blocks printing, in form order. */
    missing: string[]
}

/**
 * A challan prints with a serial number, which is only assigned on save, so it
 * is printable exactly when it is saveable: every required field, a positive
 * rate, and at least one complete lot with no unfinished or duplicate rows.
 * Optional fields stay optional, but a value in them must be a valid one.
 */
export function challanPrintReadiness(draft: ChallanDraft): ChallanPrintReadiness {
    const missing: string[] = []
    const document = draft.document
    const filled = (key: string) => Boolean(document[key]?.trim())
    if (!draft.quality_id) missing.push('quality')
    if (!(draft.selling_rate > 0)) missing.push('sellingRate')
    for (const key of REQUIRED_CHALLAN_DOCUMENT_FIELDS)
        if (!filled(key) || (key === 'date' && !validPaymentDueDate(document.date)))
            missing.push(key)
    const progress = challanDraftProgress(draft)
    const lots = progress.completed.map((line) => line.lot.trim())
    if (
        progress.completed.length === 0 ||
        progress.incomplete > 0 ||
        new Set(lots).size !== lots.length
    )
        missing.push('lotEntry')
    if (filled('payment_due_date') && !validPaymentDueDate(document.payment_due_date))
        missing.push('payment_due_date')
    if (filled('external_attachment') && !safeEvidenceUrl(document.external_attachment))
        missing.push('external_attachment')
    // The schema is the final word: it is exactly what saving enforces. Limits
    // the checks above do not name (an over-long note, too many lots) are
    // attributed to their field so a blocked Print always says why.
    const parsed = ChallanDraftSchema.safeParse(prepareChallanDraft(draft))
    if (!parsed.success)
        for (const issue of parsed.error.issues) {
            const [root, key] = issue.path
            // Required-field and date issues carry no field name; they are named above.
            if (root === 'document' && key === undefined) continue
            const field =
                root === 'quality_id'
                    ? 'quality'
                    : root === 'selling_rate'
                      ? 'sellingRate'
                      : root === 'document' && typeof key === 'string'
                        ? key
                        : 'lotEntry'
            if (!missing.includes(field)) missing.push(field)
        }
    return { ready: missing.length === 0 && parsed.success, missing }
}

/**
 * True when saving this draft would write what is already saved, so printing
 * can skip a save that would only add a version and a history entry. A key
 * that is absent and one that is empty are the same, and the blank entry row
 * is not part of the document.
 */
export function isSameChallanDraft(a: ChallanDraft, b: ChallanDraft) {
    const linesA = prepareChallanDraft(a).lines
    const linesB = prepareChallanDraft(b).lines
    const keys = new Set([...Object.keys(a.document), ...Object.keys(b.document)])
    return (
        a.quality_id === b.quality_id &&
        Number(a.selling_rate) === Number(b.selling_rate) &&
        [...keys].every((key) => (a.document[key] ?? '') === (b.document[key] ?? '')) &&
        linesA.length === linesB.length &&
        linesA.every(
            (line, i) =>
                line.lot === linesB[i].lot &&
                line.meters === linesB[i].meters &&
                lineSource(line) === lineSource(linesB[i]),
        )
    )
}
