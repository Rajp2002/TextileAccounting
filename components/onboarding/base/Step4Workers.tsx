'use client'

import React, { useState, useMemo } from 'react'
import { Users, UserCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import {
    parsePastedWorkerLines,
    type WorkerRowInput,
} from '@/lib/base-onboarding'
import { BulkEntryGrid, type BulkColumn } from './BulkEntryGrid'

interface Step4WorkersProps {
    workers: {
        pieceRate: WorkerRowInput[]
        fixedSalary: WorkerRowInput[]
    }
    onChangeWorkers: (updated: {
        pieceRate: WorkerRowInput[]
        fixedSalary: WorkerRowInput[]
    }) => void
    error?: string
}

export function Step4Workers({
    workers,
    onChangeWorkers,
    error,
}: Step4WorkersProps) {
    const { tx } = useTranslation()
    const [activeTab, setActiveTab] = useState<'pieceRate' | 'fixedSalary'>('pieceRate')

    // Count active entered workers
    const counts = useMemo(() => {
        const pieceRateCount = workers.pieceRate.filter(w => w.name && w.name.trim().length > 0).length
        const fixedSalaryCount = workers.fixedSalary.filter(w => w.name && w.name.trim().length > 0).length
        return {
            pieceRate: pieceRateCount,
            fixedSalary: fixedSalaryCount,
            total: pieceRateCount + fixedSalaryCount,
        }
    }, [workers])

    // Piece Rate Handlers
    const handlePieceRateChange = (rows: WorkerRowInput[]) => {
        onChangeWorkers({
            ...workers,
            pieceRate: rows,
        })
    }

    const createEmptyPieceRateRow = (): WorkerRowInput => ({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wrk_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: '',
        payType: 'piece_rate',
    })

    const isPieceRateEmpty = (row: WorkerRowInput) => !row.name || !row.name.trim()

    // Fixed Salary Handlers
    const handleFixedSalaryChange = (rows: WorkerRowInput[]) => {
        onChangeWorkers({
            ...workers,
            fixedSalary: rows,
        })
    }

    const createEmptyFixedSalaryRow = (): WorkerRowInput => ({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wrk_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: '',
        payType: 'fixed_monthly',
        monthlySalary: 0,
        role: '',
    })

    const isFixedSalaryEmpty = (row: WorkerRowInput) => !row.name || !row.name.trim()

    const pieceRateColumns: BulkColumn<WorkerRowInput>[] = [
        {
            key: 'name',
            label: 'Worker Name',
            placeholder: 'e.g. Ramesh Patel',
        },
    ]

    const fixedSalaryColumns: BulkColumn<WorkerRowInput>[] = [
        {
            key: 'name',
            label: 'Worker Name',
            placeholder: 'e.g. Mahesh Patel',
        },
        {
            key: 'monthlySalary',
            label: 'Monthly Salary',
            placeholder: '18000',
            type: 'number',
            prefix: '₹',
        },
        {
            key: 'role',
            label: 'Role / Designation',
            placeholder: 'e.g. Supervisor',
        },
    ]

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                        <Users className="h-3.5 w-3.5" />
                        <span>{tx('Step 4 of 6 · Workforce Setup')}</span>
                    </div>

                    <div className="rounded-full bg-stone-100 px-3 py-1 font-mono text-xs font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                        {tx('Total Workers')}: <span className="font-bold text-amber-600">{counts.total}</span>
                    </div>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
                    {tx('Initialize your workforce')}
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                    {tx('Add piece-rate weavers and salaried staff. Press Enter to quickly add the next worker, or paste a list from Excel/WhatsApp.')}
                </p>
            </div>

            {/* Segmented Control Tabs */}
            <div className="flex rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
                <button
                    type="button"
                    onClick={() => setActiveTab('pieceRate')}
                    className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all',
                        activeTab === 'pieceRate'
                            ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100'
                            : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                    )}
                >
                    <span>{tx('Piece Rate')}</span>
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
                            activeTab === 'pieceRate'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
                        )}
                    >
                        {counts.pieceRate}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('fixedSalary')}
                    className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all',
                        activeTab === 'fixedSalary'
                            ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100'
                            : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                    )}
                >
                    <span>{tx('Fixed Salary')}</span>
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
                            activeTab === 'fixedSalary'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
                        )}
                    >
                        {counts.fixedSalary}
                    </span>
                </button>
            </div>

            {/* Active Workforce Workspace */}
            {activeTab === 'pieceRate' ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-medium text-stone-500 dark:text-stone-400">
                        <span>{tx('Piece-Rate Weavers (Paid per meter produced)')}</span>
                        <span>{counts.pieceRate} {tx('entered')}</span>
                    </div>

                    <BulkEntryGrid
                        columns={pieceRateColumns}
                        rows={workers.pieceRate}
                        onChange={handlePieceRateChange}
                        createEmptyRow={createEmptyPieceRateRow}
                        isRowEmpty={isPieceRateEmpty}
                        onPasteText={text => parsePastedWorkerLines(text, 'piece_rate')}
                        entityName="worker"
                        helperText="Type weaver name and press Enter to quickly add next weaver. Multiline paste is supported."
                    />
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-medium text-stone-500 dark:text-stone-400">
                        <span>{tx('Fixed-Salary Staff (Supervisors, managers, operators)')}</span>
                        <span>{counts.fixedSalary} {tx('entered')}</span>
                    </div>

                    <BulkEntryGrid
                        columns={fixedSalaryColumns}
                        rows={workers.fixedSalary}
                        onChange={handleFixedSalaryChange}
                        createEmptyRow={createEmptyFixedSalaryRow}
                        isRowEmpty={isFixedSalaryEmpty}
                        onPasteText={text => parsePastedWorkerLines(text, 'fixed_monthly')}
                        entityName="staff member"
                        helperText="Use Tab/Enter to move between Name and Salary. Press Enter on Role to create the next row. Tab-separated paste is supported."
                    />
                </div>
            )}

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {tx(error)}
                </div>
            )}
        </div>
    )
}
