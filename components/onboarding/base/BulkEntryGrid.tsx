'use client'

import React, { useRef, useEffect } from 'react'
import { Trash2, AlertCircle } from 'lucide-react'
import { toast } from '@/lib/app-notifications'
import { resolveInputMode } from '@/lib/input-mode'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'

export interface BulkColumn<T> {
    key: keyof T
    label: string
    placeholder: string
    type?: 'text' | 'number'
    width?: string
    prefix?: string
}

interface BulkEntryGridProps<T extends { id: string; error?: string }> {
    columns: BulkColumn<T>[]
    rows: T[]
    onChange: (rows: T[]) => void
    createEmptyRow: () => T
    isRowEmpty: (row: T) => boolean
    onPasteText?: (text: string) => T[]
    entityName?: string
    helperText?: string
    className?: string
    /** `dialog` stacks wide rows on phones, keeps remove buttons visible and lets the dialog scroll. */
    variant?: 'page' | 'dialog'
    /** Focus the first cell when the grid mounts. */
    autoFocus?: boolean
    /** Called when Enter is pressed in any cell of a blank row, e.g. to move to the next section. */
    onEnterOnEmptyRow?: () => void
    /** Lets a parent find this grid's inputs: `[data-bulk-grid="<gridId>"] input`. */
    gridId?: string
}

export function BulkEntryGrid<T extends { id: string; error?: string }>({
    columns,
    rows,
    onChange,
    createEmptyRow,
    isRowEmpty,
    onPasteText,
    entityName = 'item',
    helperText,
    className,
    variant = 'page',
    autoFocus = false,
    onEnterOnEmptyRow,
    gridId,
}: BulkEntryGridProps<T>) {
    const dialog = variant === 'dialog'
    const { tx } = useTranslation()
    const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
    const focusTargetRef = useRef<{ rowId: string; colKey: string } | null>(null)

    // Ensure there is always an empty trailing row
    useEffect(() => {
        const lastRow = rows[rows.length - 1]
        if (!lastRow || !isRowEmpty(lastRow)) {
            const nextEmpty = createEmptyRow()
            onChange([...rows, nextEmpty])
        }
    }, [rows, isRowEmpty, createEmptyRow, onChange])

    // Focus management when focusTargetRef is set
    useEffect(() => {
        if (focusTargetRef.current) {
            const { rowId, colKey } = focusTargetRef.current
            const refKey = `${rowId}-${colKey}`
            const el = inputRefs.current.get(refKey)
            if (el) {
                el.focus()
                focusTargetRef.current = null
            }
        }
    }, [rows])

    const didAutoFocus = useRef(false)
    useEffect(() => {
        if (!autoFocus || didAutoFocus.current || !rows[0]) return
        const el = inputRefs.current.get(`${rows[0].id}-${String(columns[0].key)}`)
        if (el) {
            el.focus()
            didAutoFocus.current = true
        }
    }, [autoFocus, rows, columns])

    const handleCellChange = (rowId: string, colKey: keyof T, value: unknown) => {
        const updated = rows.map(r => {
            if (r.id === rowId) {
                return { ...r, [colKey]: value, error: undefined }
            }
            return r
        })
        onChange(updated)
    }

    const handleDeleteRow = (index: number) => {
        const rowToDelete = rows[index]
        if (!rowToDelete) return

        // If it's an empty row, just ignore
        if (isRowEmpty(rowToDelete)) return

        const updated = rows.filter((_, i) => i !== index)
        onChange(updated)

        toast.info(tx(`${entityName.charAt(0).toUpperCase() + entityName.slice(1)} removed`), {
            action: {
                label: tx('Undo'),
                onClick: () => {
                    const restored = [...updated]
                    restored.splice(index, 0, rowToDelete)
                    onChange(restored)
                },
            },
        })
    }

    const rowGrid = dialog ? 'grid-cols-[2rem_minmax(0,1fr)_2.75rem] sm:grid-cols-[3rem_minmax(0,1fr)_3rem]' : 'grid-cols-[3rem_1fr_3rem]'
    const cellsGrid = dialog
        ? columns.length === 1 ? 'grid-cols-1' : columns.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]'
        : columns.length === 1 ? 'grid-cols-1' : columns.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        rowIndex: number,
        colIndex: number,
        rowId: string
    ) => {
        const isLastCol = colIndex === columns.length - 1
        const currentRow = rows[rowIndex]

        if (e.key === 'Enter') {
            e.preventDefault()
            if (onEnterOnEmptyRow && isRowEmpty(currentRow)) {
                // A blank row means the list is finished, whichever cell Enter was pressed in.
                onEnterOnEmptyRow()
                return
            }
            if (!isLastCol) {
                // Focus next column in same row
                const nextColKey = String(columns[colIndex + 1].key)
                inputRefs.current.get(`${rowId}-${nextColKey}`)?.focus()
            } else {
                // We're at the last column of the row
                if (isRowEmpty(currentRow)) {
                    // Current row is empty, nothing to advance
                    onEnterOnEmptyRow?.()
                    return
                }

                // If next row exists, focus its first column
                if (rowIndex < rows.length - 1) {
                    const nextRow = rows[rowIndex + 1]
                    const firstColKey = String(columns[0].key)
                    // The cell already exists, so focus it now. A remembered target would
                    // pull focus back here the next time the rows change.
                    inputRefs.current.get(`${nextRow.id}-${firstColKey}`)?.focus()
                } else {
                    // Generate new empty row and focus it
                    const newEmpty = createEmptyRow()
                    focusTargetRef.current = { rowId: newEmpty.id, colKey: String(columns[0].key) }
                    onChange([...rows, newEmpty])
                }
            }
        } else if (e.key === 'Backspace' && isRowEmpty(currentRow) && rows.length > 1) {
            // If row is empty and user hits backspace, focus previous row
            if (rowIndex > 0) {
                e.preventDefault()
                const prevRow = rows[rowIndex - 1]
                const lastColKey = String(columns[columns.length - 1].key)
                inputRefs.current.get(`${prevRow.id}-${lastColKey}`)?.focus()
                // If this empty row is not the very last one, remove it
                if (rowIndex < rows.length - 1) {
                    onChange(rows.filter((_, i) => i !== rowIndex))
                }
            }
        }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number) => {
        const text = e.clipboardData.getData('text')
        if (!text || (!text.includes('\n') && !text.includes('\t'))) {
            // Plain single value paste, let default input behavior handle
            return
        }

        e.preventDefault()

        if (onPasteText) {
            const parsedRows = onPasteText(text)
            if (parsedRows.length > 0) {
                const currentRowsWithoutTrailingEmpty = rows.filter((r, i) => i < rowIndex || !isRowEmpty(r))
                const nextEmpty = createEmptyRow()
                const updated = [...currentRowsWithoutTrailingEmpty, ...parsedRows, nextEmpty]
                focusTargetRef.current = { rowId: nextEmpty.id, colKey: String(columns[0].key) }
                onChange(updated)
                toast.success(tx(`Pasted ${parsedRows.length} ${entityName}s`))
            }
        }
    }

    return (
        <div className={cn('space-y-2', className)} data-bulk-grid={gridId}>
            {helperText && (
                <p className="text-xs text-[var(--wv-neel-500)]">
                    {tx(helperText)}
                </p>
            )}

            <div className="overflow-hidden rounded-xl border border-[var(--wv-cotton-400)] bg-[var(--wv-cotton-0)] shadow-sm">
                {/* Table Header */}
                <div className={cn('grid items-center border-b border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-200)] px-3 py-2 text-xs font-semibold text-[var(--wv-neel-500)]', rowGrid, dialog && columns.length > 1 && 'max-sm:hidden')}>
                    <div className="text-center font-mono">#</div>
                    <div className={cn('grid gap-3', cellsGrid)}>
                        {columns.map(col => (
                            <div key={String(col.key)}>{tx(col.label)}</div>
                        ))}
                    </div>
                    <div className="text-center">{tx('Action')}</div>
                </div>

                {/* Table Rows */}
                <div className={cn('divide-y divide-[var(--wv-cotton-200)]', !dialog && 'max-h-[380px] overflow-y-auto')}>
                    {rows.map((row, rowIndex) => {
                        const empty = isRowEmpty(row)
                        return (
                            <div
                                key={row.id}
                                className={cn(
                                    'group grid items-center px-3 py-1.5 transition-colors',
                                    rowGrid,
                                    empty ? 'bg-[var(--wv-cotton-100)]/40 opacity-70 hover:opacity-100' : 'hover:bg-[var(--wv-cotton-100)]',
                                    row.error && 'bg-[var(--wv-madder-50)]/60'
                                )}
                            >
                                <div className="text-center font-mono text-xs text-[var(--wv-cotton-500)]">
                                    {rowIndex + 1}
                                </div>

                                <div className={cn('grid gap-3', cellsGrid)}>
                                    {columns.map((col, colIndex) => {
                                        const val = row[col.key] as string | number | undefined
                                        const refKey = `${row.id}-${String(col.key)}`

                                        return (
                                            <div key={String(col.key)} className={cn('relative flex items-center', dialog && columns.length === 3 && colIndex === 0 && 'col-span-2 sm:col-span-1')}>
                                                {col.prefix && (
                                                    <span className="pointer-events-none absolute left-2 text-xs text-[var(--wv-cotton-500)]">
                                                        {col.prefix}
                                                    </span>
                                                )}
                                                <input
                                                    ref={el => {
                                                        if (el) inputRefs.current.set(refKey, el)
                                                        else inputRefs.current.delete(refKey)
                                                    }}
                                                    type={col.type || 'text'}
                                                    inputMode={resolveInputMode({ type: col.type })}
                                                    step={col.type === 'number' ? 'any' : undefined}
                                                    aria-label={`${tx(col.label)} ${rowIndex + 1}`}
                                                    value={col.type === 'number' && !val ? '' : val ?? ''}
                                                    placeholder={tx(col.placeholder)}
                                                    onChange={e => {
                                                        const raw = e.target.value
                                                        const newVal = col.type === 'number' ? (raw === '' ? 0 : Number(raw)) : raw
                                                        handleCellChange(row.id, col.key, newVal)
                                                    }}
                                                    onKeyDown={e => handleKeyDown(e, rowIndex, colIndex, row.id)}
                                                    onPaste={e => handlePaste(e, rowIndex)}
                                                    className={cn(
                                                        dialog ? 'h-11 sm:h-10' : 'h-9',
                                                        'w-full rounded-md border border-[var(--wv-cotton-400)] bg-white px-2.5 text-sm text-[var(--wv-neel-900)] transition-all placeholder:text-[var(--wv-cotton-500)] focus:border-[var(--wv-brand-accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]',
                                                        col.prefix && 'pl-6',
                                                        row.error && 'border-[var(--wv-madder-600)] focus:border-[var(--wv-madder-600)] focus:ring-[var(--wv-madder-600)]'
                                                    )}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="flex justify-center">
                                    {!empty && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRow(rowIndex)}
                                            title={tx(`Remove ${entityName}`)}
                                            aria-label={`${tx(`Remove ${entityName}`)} ${rowIndex + 1}`}
                                            className={cn(
                                                'rounded p-1 text-[var(--wv-cotton-400)] transition hover:bg-[var(--wv-cotton-200)] hover:text-[var(--wv-madder-600)] focus:opacity-100',
                                                dialog ? 'inline-flex h-11 w-11 items-center justify-center text-[var(--wv-cotton-500)] sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                                            )}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {row.error && (
                                    <div className="col-span-3 mt-1 flex items-center gap-1.5 px-2 text-xs text-[var(--wv-madder-600)]">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                        <span>{row.error}</span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
