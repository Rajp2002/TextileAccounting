'use client'

import { Plus, X } from 'lucide-react'
import { BulkEntryGrid, type BulkColumn } from '@/components/onboarding/base/BulkEntryGrid'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n/context'
import {
    BASE_MACHINE_TYPE_OPTIONS,
    newBulkId,
    nextUnusedMachineType,
    parseBulkNamePaste,
    type BaseMachineType,
    type BulkMachineRow,
    type BulkMachinesDraft,
    type BulkMachinesEvaluation,
} from '@/lib/base-bulk-register'

const COLUMNS: BulkColumn<BulkMachineRow>[] = [
    { key: 'name', label: 'Machine name or number', placeholder: 'e.g. 01' },
]
const createRow = (): BulkMachineRow => ({ id: newBulkId('mach'), name: '' })
const isRowEmpty = (row: BulkMachineRow) => !row.name || !row.name.trim()

const gridId = (index: number) => `machines-${index}`

export function BulkMachineEntry({ draft, onChange, evaluation, submitButtonId }: {
    draft: BulkMachinesDraft
    onChange: (update: (current: BulkMachinesDraft) => BulkMachinesDraft) => void
    evaluation: BulkMachinesEvaluation
    /** Enter on a blank row in the last section moves focus here. */
    submitButtonId: string
}) {
    const { tx } = useTranslation()

    const issueMessage = (issue: BulkMachinesEvaluation['sections'][number][number]) => {
        switch (issue) {
            case 'exists': return tx('Already on your list.')
            case 'repeated': return tx('Repeated in this list.')
            case 'too_long': return tx('Use at most 120 characters.')
            default: return undefined
        }
    }
    const sections = draft.sections.map((section, sectionIndex) => ({
        ...section,
        rows: section.rows.map((row, rowIndex) => ({ ...row, error: issueMessage(evaluation.sections[sectionIndex]?.[rowIndex]) })),
    }))

    const updateSection = (id: string, update: (section: BulkMachinesDraft['sections'][number]) => BulkMachinesDraft['sections'][number]) =>
        onChange(current => ({ ...current, sections: current.sections.map(section => section.id === id ? update(section) : section) }))

    return <div data-machines-bulk-entry className="space-y-6">
        {sections.map((section, index) => <section key={section.id} aria-label={`${tx('Machine type')} ${index + 1}`} className="space-y-2">
            <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor={`base-bulk-machine-type-${section.id}`}>{tx('Machine type')}</Label>
                    <Select value={section.machineType} onValueChange={value => updateSection(section.id, current => ({ ...current, machineType: value as BaseMachineType }))}>
                        <SelectTrigger id={`base-bulk-machine-type-${section.id}`} className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {BASE_MACHINE_TYPE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {draft.sections.length > 1 && <Button type="button" variant="outline" className="min-h-11 shrink-0 sm:min-h-10" onClick={() => onChange(current => ({ ...current, sections: current.sections.filter(entry => entry.id !== section.id) }))}>
                    <X className="h-4 w-4" />{tx('Remove type')}
                </Button>}
            </div>
            <BulkEntryGrid
                variant="dialog"
                gridId={gridId(index)}
                autoFocus
                columns={COLUMNS}
                rows={section.rows}
                onChange={rows => updateSection(section.id, current => ({ ...current, rows }))}
                createEmptyRow={createRow}
                isRowEmpty={isRowEmpty}
                onPasteText={text => parseBulkNamePaste(text).map(name => ({ id: newBulkId('mach'), name }))}
                onEnterOnEmptyRow={() => index < draft.sections.length - 1
                    ? document.querySelector<HTMLInputElement>(`[data-bulk-grid="${gridId(index + 1)}"] input`)?.focus()
                    : document.getElementById(submitButtonId)?.focus()}
                entityName="machine"
            />
        </section>)}
        <div className="space-y-2">
            <Button type="button" variant="outline" className="min-h-11 sm:min-h-10" onClick={() => onChange(current => ({
                ...current,
                sections: [...current.sections, { id: newBulkId('section'), machineType: nextUnusedMachineType(current.sections.map(section => section.machineType)), rows: [] }],
            }))}>
                <Plus className="h-4 w-4" />{tx('Add another type')}
            </Button>
            <p className="text-xs text-body">{tx('Each machine name must be different, even across types.')}</p>
        </div>
    </div>
}
