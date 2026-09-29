'use client'

import React, { useState, useMemo } from 'react'
import { Cpu, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import {
    BASE_MACHINE_PRESETS,
    getMachineTypeLabel,
    parsePastedMachineLines,
    type MachineRowInput,
} from '@/lib/base-onboarding'
import { BulkEntryGrid, type BulkColumn } from './BulkEntryGrid'

interface Step3MachinesProps {
    machines: Record<string, MachineRowInput[]>
    onChangeMachines: (updated: Record<string, MachineRowInput[]>) => void
    error?: string
}

export function Step3Machines({
    machines,
    onChangeMachines,
    error,
}: Step3MachinesProps) {
    const { tx } = useTranslation()

    // Determine available machine types (presets + any existing custom in draft)
    const availableTypes = useMemo(() => {
        const set = new Set<string>(BASE_MACHINE_PRESETS.map(p => p.key))
        for (const key of Object.keys(machines)) {
            set.add(key)
        }
        return Array.from(set)
    }, [machines])

    const [activeType, setActiveType] = useState<string>(availableTypes[0] || 'rapier')
    const [showCustomModal, setShowCustomModal] = useState(false)
    const [customTypeName, setCustomTypeName] = useState('')

    // Get current rows for active type
    const activeRows = machines[activeType] || []

    const handleRowsChange = (newRows: MachineRowInput[]) => {
        onChangeMachines({
            ...machines,
            [activeType]: newRows,
        })
    }

    const createEmptyMachineRow = (): MachineRowInput => ({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mach_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: '',
        machineType: BASE_MACHINE_PRESETS.some(p => p.key === activeType) ? activeType : 'other',
        customLabel: BASE_MACHINE_PRESETS.some(p => p.key === activeType) ? undefined : activeType,
    })

    const isRowEmpty = (row: MachineRowInput) => !row.name || !row.name.trim()

    // Total machine counts
    const countsByType = useMemo(() => {
        const counts: Record<string, number> = {}
        let total = 0
        for (const [type, rows] of Object.entries(machines)) {
            const count = rows.filter(r => r.name && r.name.trim().length > 0).length
            counts[type] = count
            total += count
        }
        return { byType: counts, total }
    }, [machines])

    const handleAddCustomType = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = customTypeName.trim()
        if (!trimmed) return

        const key = trimmed.toLowerCase().replace(/\s+/g, '_')
        if (!machines[key]) {
            onChangeMachines({
                ...machines,
                [key]: [],
            })
        }
        setActiveType(key)
        setCustomTypeName('')
        setShowCustomModal(false)
    }

    const columns: BulkColumn<MachineRowInput>[] = [
        {
            key: 'name',
            label: 'Machine Name / Number',
            placeholder: activeType === 'water_jet' ? 'e.g. WJ-01' : activeType === 'air_jet' ? 'e.g. AJ-01' : 'e.g. RP-01',
        },
    ]

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3 py-1 text-xs font-semibold text-[var(--wv-ochre-800)]">
                        <Cpu className="h-3.5 w-3.5" />
                        <span>{tx('Step 3 of 6 · Machine Inventory')}</span>
                    </div>

                    <div className="rounded-full bg-[var(--wv-cotton-200)] px-3 py-1 font-mono text-xs font-semibold text-[var(--wv-neel-800)]">
                        {tx('Total Machines')}: <span className="font-bold text-[var(--wv-brand-accent-strong)]">{countsByType.total}</span>
                    </div>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-[var(--wv-neel-900)] sm:text-3xl">
                    {tx('Enter your factory machines')}
                </h2>
                <p className="text-sm text-[var(--wv-neel-700)]">
                    {tx('Keyboard-first bulk entry: type a machine number, press Enter to advance, or paste a list from Excel.')}
                </p>
            </div>

            {/* Machine Type Chips / Tabs */}
            <div className="flex flex-wrap items-center gap-2">
                {availableTypes.map(typeKey => {
                    const count = countsByType.byType[typeKey] || 0
                    const isSelected = activeType === typeKey
                    const label = getMachineTypeLabel(typeKey)

                    return (
                        <button
                            key={typeKey}
                            type="button"
                            onClick={() => setActiveType(typeKey)}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all',
                                isSelected
                                    ? 'border-[var(--wv-action-primary)] bg-[var(--wv-action-primary)] text-white shadow-sm'
                                    : 'border-[var(--wv-cotton-300)] bg-white text-[var(--wv-neel-700)] hover:border-[var(--wv-cotton-400)] hover:bg-[var(--wv-cotton-100)]'
                            )}
                        >
                            <span>{tx(label)}</span>
                            <span
                                className={cn(
                                    'rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold',
                                    isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-[var(--wv-cotton-200)] text-[var(--wv-neel-700)]'
                                )}
                            >
                                {count}
                            </span>
                        </button>
                    )
                })}

                <button
                    type="button"
                    onClick={() => setShowCustomModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[var(--wv-cotton-400)] bg-[var(--wv-cotton-100)]/50 px-3 py-2 text-xs font-semibold text-[var(--wv-neel-700)] transition hover:border-[var(--wv-cotton-500)] hover:bg-[var(--wv-cotton-200)]"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{tx('Other type')}</span>
                </button>
            </div>

            {/* Custom Machine Type Modal */}
            {showCustomModal && (
                <form
                    onSubmit={handleAddCustomType}
                    className="flex items-center gap-2 rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-3"
                >
                    <input
                        type="text"
                        autoFocus
                        placeholder={tx('e.g. Jacquard, Circular Loom')}
                        value={customTypeName}
                        onChange={e => setCustomTypeName(e.target.value)}
                        className="h-9 flex-1 rounded-md border border-[var(--wv-cotton-400)] bg-white px-3 text-xs text-[var(--wv-neel-900)] focus:border-[var(--wv-brand-accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--wv-brand-accent-strong)]"
                    />
                    <button
                        type="submit"
                        disabled={!customTypeName.trim()}
                        className="h-9 rounded-md bg-[var(--wv-action-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--wv-action-primary-hover)] disabled:opacity-50"
                    >
                        {tx('Add')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowCustomModal(false)
                            setCustomTypeName('')
                        }}
                        className="rounded p-1 text-[var(--wv-cotton-500)] hover:text-[var(--wv-neel-800)]"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </form>
            )}

            {/* Active Machine Bulk Entry Grid */}
            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-[var(--wv-neel-600)]">
                    <span>
                        {tx(getMachineTypeLabel(activeType))} {tx('Machines')}
                    </span>
                    <span>
                        {countsByType.byType[activeType] || 0} {tx('machines entered')}
                    </span>
                </div>

                <BulkEntryGrid
                    columns={columns}
                    rows={activeRows}
                    onChange={handleRowsChange}
                    createEmptyRow={createEmptyMachineRow}
                    isRowEmpty={isRowEmpty}
                    onPasteText={text => parsePastedMachineLines(text, activeType)}
                    entityName="machine"
                    helperText="Type machine identifier and press Enter to quickly add next machine. Multiline paste is supported."
                />
            </div>

            {error && (
                <div className="rounded-lg border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3 text-sm text-[var(--wv-madder-700)]">
                    {tx(error)}
                </div>
            )}
        </div>
    )
}
