'use client'

import React, { useRef, useEffect, useCallback } from 'react'
import { Trash2, Plus, AlertCircle, Undo2 } from 'lucide-react'
import { toast } from '@/lib/app-notifications'
import { Button } from '@/components/ui/button'
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
}: BulkEntryGridProps<T>) {
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
            if (!isLastCol) {
                // Focus next column in same row
                const nextColKey = String(columns[colIndex + 1].key)
                focusTargetRef.current = { rowId, colKey: nextColKey }
                inputRefs.current.get(`${rowId}-${nextColKey}`)?.focus()
            } else {
                // We're at the last column of the row
                if (isRowEmpty(currentRow)) {
                    // Current row is empty, nothing to advance
                    return
                }

                // If next row exists, focus its first column
                if (rowIndex < rows.length - 1) {
                    const nextRow = rows[rowIndex + 1]
                    const firstColKey = String(columns[0].key)
                    focusTargetRef.current = { rowId: nextRow.id, colKey: firstColKey }
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
        <div className={cn('space-y-2', className)}>
            {helperText && (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                    {tx(helperText)}
                </p>
            )}

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
                {/* Table Header */}
                <div className="grid grid-cols-[3rem_1fr_3rem] items-center border-b border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-600 dark:border-stone-800 dark:bg-stone-800/50 dark:text-stone-400">
                    <div className="text-center font-mono">#</div>
                    <div className={cn('grid gap-3', columns.length === 1 ? 'grid-cols-1' : columns.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
                        {columns.map(col => (
                            <div key={String(col.key)}>{tx(col.label)}</div>
                        ))}
                    </div>
                    <div className="text-center">{tx('Action')}</div>
                </div>

                {/* Table Rows */}
                <div className="max-h-[380px] divide-y divide-stone-100 overflow-y-auto dark:divide-stone-800/60">
                    {rows.map((row, rowIndex) => {
                        const empty = isRowEmpty(row)
                        return (
                            <div
                                key={row.id}
                                className={cn(
                                    'group grid grid-cols-[3rem_1fr_3rem] items-center px-3 py-1.5 transition-colors',
                                    empty ? 'bg-stone-50/40 opacity-70 hover:opacity-100' : 'hover:bg-amber-50/30 dark:hover:bg-amber-950/10',
                                    row.error && 'bg-red-50/60 dark:bg-red-950/20'
                                )}
                            >
                                <div className="text-center font-mono text-xs text-stone-400">
                                    {rowIndex + 1}
                                </div>

                                <div className={cn('grid gap-3', columns.length === 1 ? 'grid-cols-1' : columns.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
                                    {columns.map((col, colIndex) => {
                                        const val = row[col.key] as string | number | undefined
                                        const refKey = `${row.id}-${String(col.key)}`

                                        return (
                                            <div key={String(col.key)} className="relative flex items-center">
                                                {col.prefix && (
                                                    <span className="pointer-events-none absolute left-2 text-xs text-stone-400">
                                                        {col.prefix}
                                                    </span>
                                                )}
                                                <input
                                                    ref={el => {
                                                        if (el) inputRefs.current.set(refKey, el)
                                                        else inputRefs.current.delete(refKey)
                                                    }}
                                                    type={col.type || 'text'}
                                                    value={val ?? ''}
                                                    placeholder={tx(col.placeholder)}
                                                    onChange={e => {
                                                        const raw = e.target.value
                                                        const newVal = col.type === 'number' ? (raw === '' ? 0 : Number(raw)) : raw
                                                        handleCellChange(row.id, col.key, newVal)
                                                    }}
                                                    onKeyDown={e => handleKeyDown(e, rowIndex, colIndex, row.id)}
                                                    onPaste={e => handlePaste(e, rowIndex)}
                                                    className={cn(
                                                        'h-9 w-full rounded-md border border-stone-200 bg-white px-2.5 text-sm text-stone-900 transition-all placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500',
                                                        col.prefix && 'pl-6',
                                                        row.error && 'border-red-400 focus:border-red-500 focus:ring-red-500'
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
                                            className="rounded p-1 text-stone-300 opacity-0 transition hover:bg-stone-100 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 dark:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-red-400"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {row.error && (
                                    <div className="col-span-3 mt-1 flex items-center gap-1.5 px-2 text-xs text-red-600 dark:text-red-400">
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
