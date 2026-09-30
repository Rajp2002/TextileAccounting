'use client'

import React, { useState, useMemo } from 'react'
import { Users } from 'lucide-react'
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
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3 py-1 text-xs font-semibold text-[var(--wv-ochre-800)]">
                        <Users className="h-3.5 w-3.5" />
                        <span>{tx('Step 4 of 6 · Workforce Setup')}</span>
                    </div>

                    <div className="rounded-full bg-[var(--wv-cotton-200)] px-3 py-1 font-mono text-xs font-semibold text-[var(--wv-neel-800)]">
                        {tx('Total Workers')}: <span className="font-bold text-[var(--wv-brand-accent-strong)]">{counts.total}</span>
                    </div>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-[var(--wv-neel-900)] sm:text-3xl">
                    {tx('Initialize your workforce')}
                </h2>
                <p className="text-sm text-[var(--wv-neel-700)]">
                    {tx('Add piece-rate weavers and salaried staff. Press Enter to quickly add the next worker, or paste a list from Excel/WhatsApp.')}
                </p>
            </div>

            {/* Segmented Control Tabs */}
            <div className="flex rounded-xl bg-[var(--wv-cotton-200)] p-1">
                <button
                    type="button"
                    onClick={() => setActiveTab('pieceRate')}
                    className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all',
                        activeTab === 'pieceRate'
                            ? 'bg-white text-[var(--wv-neel-900)] shadow-sm'
                            : 'text-[var(--wv-neel-600)] hover:text-[var(--wv-neel-900)]'
                    )}
                >
                    <span>{tx('Piece Rate')}</span>
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
                            activeTab === 'pieceRate'
                                ? 'bg-[var(--wv-saffron-100)] text-[var(--wv-brand-ink)]'
                                : 'bg-[var(--wv-cotton-300)] text-[var(--wv-neel-700)]'
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
                            ? 'bg-white text-[var(--wv-neel-900)] shadow-sm'
                            : 'text-[var(--wv-neel-600)] hover:text-[var(--wv-neel-900)]'
                    )}
                >
                    <span>{tx('Fixed Salary')}</span>
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
                            activeTab === 'fixedSalary'
                                ? 'bg-[var(--wv-saffron-100)] text-[var(--wv-brand-ink)]'
                                : 'bg-[var(--wv-cotton-300)] text-[var(--wv-neel-700)]'
                        )}
                    >
                        {counts.fixedSalary}
                    </span>
                </button>
            </div>

            {/* Active Workforce Workspace */}
            {activeTab === 'pieceRate' ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-medium text-[var(--wv-neel-600)]">
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
                    <div className="flex items-center justify-between text-xs font-medium text-[var(--wv-neel-600)]">
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
                <div className="rounded-lg border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3 text-sm text-[var(--wv-madder-700)]">
                    {tx(error)}
                </div>
            )}
        </div>
    )
}
