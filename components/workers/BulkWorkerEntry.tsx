'use client'

import { BulkEntryGrid, type BulkColumn } from '@/components/onboarding/base/BulkEntryGrid'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/lib/i18n/context'
import {
    isBulkStaffRowBlank,
    newBulkId,
    parseBulkNamePaste,
    parseBulkStaffPaste,
    type BulkPieceRow,
    type BulkStaffIssue,
    type BulkStaffRow,
    type BulkWorkersDraft,
    type BulkWorkersEvaluation,
} from '@/lib/base-bulk-register'

const PIECE_COLUMNS: BulkColumn<BulkPieceRow>[] = [
    { key: 'name', label: 'Worker name', placeholder: 'e.g. Ramesh Patel' },
]
const STAFF_COLUMNS: BulkColumn<BulkStaffRow>[] = [
    { key: 'name', label: 'Worker name', placeholder: 'e.g. Mahesh Patel' },
    { key: 'role', label: 'Role', placeholder: 'e.g. Supervisor' },
    { key: 'monthlySalary', label: 'Monthly salary (₹)', placeholder: '18000', type: 'number', prefix: '₹' },
]

const createPieceRow = (): BulkPieceRow => ({ id: newBulkId('wrk'), name: '' })
const createStaffRow = (): BulkStaffRow => ({ id: newBulkId('stf'), name: '', role: '' })
const isPieceRowEmpty = (row: BulkPieceRow) => !row.name || !row.name.trim()

export const BULK_WORKERS_PIECE_GRID = 'workers-piece'
export const BULK_WORKERS_STAFF_GRID = 'workers-staff'

export function focusBulkGrid(gridId: string) {
    document.querySelector<HTMLInputElement>(`[data-bulk-grid="${gridId}"] input`)?.focus()
}

export function BulkWorkerEntry({ draft, onChange, evaluation, joiningLabel, submitButtonId }: {
    draft: BulkWorkersDraft
    onChange: (update: (current: BulkWorkersDraft) => BulkWorkersDraft) => void
    evaluation: BulkWorkersEvaluation
    joiningLabel: string
    /** Enter on a blank row in the last section moves focus here. */
    submitButtonId: string
}) {
    const { tx } = useTranslation()

    const nameMessage = (issue: BulkStaffIssue['name'] | BulkWorkersEvaluation['piece'][number]) => {
        switch (issue) {
            case 'exists': return tx('Already on your list.')
            case 'repeated': return tx('Repeated in this list.')
            case 'too_long': return tx('Use at most 120 characters.')
            case 'missing_name': return tx('Enter a name.')
            default: return undefined
        }
    }
    const pieceRows = draft.piece.map((row, index) => ({ ...row, error: nameMessage(evaluation.piece[index]) }))
    const staffRows = draft.staff.map((row, index) => {
        const issue = evaluation.staff[index] ?? {}
        const error = nameMessage(issue.name)
            ?? (issue.role ? tx('Role: use at most 80 characters.') : undefined)
            ?? (issue.salary === 'missing_salary' ? tx('Enter a monthly salary.') : issue.salary === 'invalid_salary' ? tx('Enter a salary above 0, up to ₹1,00,00,000.') : undefined)
        return { ...row, error }
    })

    return <div data-workers-bulk-entry className="space-y-6">
        <section aria-labelledby="base-bulk-piece-heading" className="space-y-2">
            <div>
                <h3 id="base-bulk-piece-heading" className="text-sm font-semibold text-ink">{tx('Piece rate workers')}</h3>
                <p className="text-xs text-body">{tx('Paid per metre. Added as approved loom operators on day and night shifts.')}</p>
            </div>
            <BulkEntryGrid
                variant="dialog"
                gridId={BULK_WORKERS_PIECE_GRID}
                autoFocus
                columns={PIECE_COLUMNS}
                rows={pieceRows}
                onChange={rows => onChange(current => ({ ...current, piece: rows }))}
                createEmptyRow={createPieceRow}
                isRowEmpty={isPieceRowEmpty}
                onPasteText={text => parseBulkNamePaste(text).map(name => ({ id: newBulkId('wrk'), name }))}
                onEnterOnEmptyRow={() => focusBulkGrid(BULK_WORKERS_STAFF_GRID)}
                entityName="worker"
            />
        </section>
        <section aria-labelledby="base-bulk-staff-heading" className="space-y-2">
            <div>
                <h3 id="base-bulk-staff-heading" className="text-sm font-semibold text-ink">{tx('Fixed rate staff')}</h3>
                <p className="text-xs text-body">{tx('Paid a monthly salary. Not added as loom operators.')}</p>
            </div>
            <BulkEntryGrid
                variant="dialog"
                gridId={BULK_WORKERS_STAFF_GRID}
                columns={STAFF_COLUMNS}
                rows={staffRows}
                onChange={rows => onChange(current => ({ ...current, staff: rows }))}
                createEmptyRow={createStaffRow}
                isRowEmpty={isBulkStaffRowBlank}
                onPasteText={text => parseBulkStaffPaste(text).map(row => ({ id: newBulkId('stf'), ...row }))}
                onEnterOnEmptyRow={() => document.getElementById(submitButtonId)?.focus()}
                entityName="staff member"
            />
            <div className="space-y-2 pt-2">
                <Label htmlFor="base-bulk-joining">{joiningLabel}</Label>
                <Input
                    id="base-bulk-joining"
                    type="date"
                    required={evaluation.fixedStaff.length > 0}
                    value={draft.joiningDate}
                    onChange={event => onChange(current => ({ ...current, joiningDate: event.target.value }))}
                    aria-describedby="base-bulk-joining-help"
                />
                <p id="base-bulk-joining-help" className="text-xs text-body">{tx('Applies to all fixed rate staff added here.')}</p>
            </div>
        </section>
    </div>
}
