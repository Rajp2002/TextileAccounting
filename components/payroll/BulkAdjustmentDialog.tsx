'use client'

import React, { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createBaseWorkerAdjustmentsBulk } from '@/app/(dashboard)/owner/production/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
    DEDUCTION_REASONS,
    bulkAdjustmentTotal,
    bulkEligibleWorkers,
    bulkGroupCounts,
    bulkGroupState,
    bulkWorkerGroup,
    toggleBulkGroup,
    toggleBulkWorker,
    type BulkAdjustmentKind,
    type BulkAdjustmentWorker,
    type BulkWorkerGroup,
    type DeductionReason,
} from '@/lib/base-bulk-adjustment'
import { formatINR } from '@/lib/finance'
import { useTranslation } from '@/lib/i18n/context'
import { trackPlanEvent } from '@/lib/plan-analytics'

const GROUPS: BulkWorkerGroup[] = ['piece_rate', 'fixed_monthly']
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

type PanelProps = {
    workers: BulkAdjustmentWorker[]
    onSaved: () => void
    onClose: () => void
}

export function BulkAdjustmentDialog({ open, onOpenChange, ...panel }: Omit<PanelProps, 'onClose'> & {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const { tx } = useTranslation()
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-payroll-bulk-dialog>
                <DialogHeader>
                    <DialogTitle>{tx('Bulk advance / deduction')}</DialogTitle>
                    <DialogDescription>{tx('Record the same amount for several workers at once. Everyone is selected to start with.')}</DialogDescription>
                </DialogHeader>
                {/* Mounted only while open, so every opening starts with everyone selected. */}
                <BulkAdjustmentPanel {...panel} onClose={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    )
}

export function BulkAdjustmentPanel({ workers, onSaved, onClose }: PanelProps) {
    const { tx } = useTranslation()
    const eligible = useMemo(() => bulkEligibleWorkers(workers), [workers])
    const groupCounts = useMemo(() => bulkGroupCounts(eligible), [eligible])

    const [kind, setKind] = useState<BulkAdjustmentKind>('deduction')
    const [amountText, setAmountText] = useState('')
    const [deductionReason, setDeductionReason] = useState<DeductionReason>('Water access / Utilities')
    const [advanceReason, setAdvanceReason] = useState('')
    const [notes, setNotes] = useState('')
    const [selected, setSelected] = useState<Set<string>>(() => new Set(eligible.map(worker => worker.id)))
    const [step, setStep] = useState<'form' | 'confirm'>('form')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const amountValid = AMOUNT_PATTERN.test(amountText.trim()) && Number.parseFloat(amountText) > 0
    const amount = amountValid ? Number.parseFloat(amountText) : 0
    const count = selected.size
    const total = bulkAdjustmentTotal(amount, count)
    const allSelected = eligible.length > 0 && count === eligible.length
    const kindLabel = kind === 'advance' ? tx('Advance') : tx('Deduction')
    const reasonText = kind === 'advance' ? advanceReason.trim() : [deductionReason, notes.trim()].filter(Boolean).join(' · ')
    const countLabel = (value: number) => value === 1 ? tx('1 worker') : tx('{count} workers', { count: value })

    function change(update: () => void) {
        setError(null)
        update()
    }

    async function save() {
        if (pending || !amountValid || count === 0) return
        setPending(true)
        setError(null)
        try {
            const result = await createBaseWorkerAdjustmentsBulk({
                kind,
                workerIds: eligible.filter(worker => selected.has(worker.id)).map(worker => worker.id),
                amount,
                ...(kind === 'deduction'
                    ? { reason: deductionReason, description: notes }
                    : { description: advanceReason }),
            })
            if ('error' in result && result.error) { setError(tx(String(result.error))); return }
            if (!('success' in result)) { setError(tx('Could not record this. Please try again.')); return }
            toast.success(result.count === 1 ? tx('Recorded for 1 worker.') : tx('Recorded for {count} workers.', { count: result.count }))
            trackPlanEvent('production_activity', { action: `bulk-${kind}-create` })
            onSaved()
            onClose()
        } catch {
            setError(tx('Could not record this. Please try again.'))
        } finally {
            setPending(false)
        }
    }

    if (eligible.length === 0) {
        return (
            <div className="space-y-4">
                <p role="status" className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-sm text-ink">{tx('No active workers to record this for.')}</p>
                <DialogFooter>
                    <Button type="button" variant="outline" className="min-h-[44px]" onClick={onClose}>{tx('Cancel')}</Button>
                </DialogFooter>
            </div>
        )
    }

    if (step === 'confirm') {
        return (
            <div className="space-y-4">
                <p className="text-sm font-semibold text-ink">{tx('Check before recording')}</p>
                <dl className="divide-y divide-hairline rounded-lg border border-hairline text-sm">
                    <SummaryRow label={tx('Type')} value={kindLabel} />
                    <SummaryRow label={tx('Per worker')} value={formatINR(amount)} />
                    <SummaryRow label={tx('Workers')} value={countLabel(count)} />
                    <SummaryRow label={tx('Total')} value={formatINR(total)} strong />
                    {reasonText && <SummaryRow label={tx('Reason')} value={reasonText} />}
                </dl>
                <p className="text-xs text-subtle">{tx('Each worker gets their own entry. Amounts are recovered through payroll settlement and cannot be removed from this screen.')}</p>
                {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
                <DialogFooter>
                    <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setStep('form')} disabled={pending}>{tx('Back')}</Button>
                    <Button type="button" className="min-h-[44px]" onClick={save} disabled={pending}>
                        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {pending ? tx('Recording…') : kind === 'advance' ? tx('Record advance') : tx('Record deduction')}
                    </Button>
                </DialogFooter>
            </div>
        )
    }

    return (
        <form
            className="space-y-5"
            onSubmit={(event) => { event.preventDefault(); if (amountValid && count > 0) setStep('confirm') }}
        >
            <div role="radiogroup" aria-label={tx('Type')} className="grid grid-cols-2 gap-1 rounded-lg border border-hairline bg-surface-soft p-1">
                {(['advance', 'deduction'] as const).map(option => (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={kind === option}
                        onClick={() => change(() => setKind(option))}
                        className={`min-h-[44px] rounded-md px-3 text-sm font-semibold transition-colors ${kind === option ? 'bg-ink text-surface' : 'text-body hover:bg-surface'}`}
                    >
                        {option === 'advance' ? tx('Advance') : tx('Deduction')}
                    </button>
                ))}
            </div>

            <div className="space-y-2">
                <Label htmlFor="bulk-adjustment-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Amount per worker')}</Label>
                <Input
                    id="bulk-adjustment-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(event) => change(() => setAmountText(event.target.value))}
                    placeholder="0.00"
                    className="min-h-[44px]"
                />
                {amountText !== '' && !amountValid && (
                    <p role="alert" className="text-sm text-destructive">{tx('Enter an amount above 0 with at most two decimals.')}</p>
                )}
            </div>

            {kind === 'deduction' ? (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="bulk-adjustment-reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Reason')}</Label>
                        <Select value={deductionReason} onValueChange={(value) => change(() => setDeductionReason(value as DeductionReason))}>
                            <SelectTrigger id="bulk-adjustment-reason" className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>{DEDUCTION_REASONS.map(reason => <SelectItem key={reason} value={reason}>{tx(reason)}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bulk-adjustment-notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Notes (optional)')}</Label>
                        <Textarea id="bulk-adjustment-notes" rows={2} value={notes} onChange={(event) => change(() => setNotes(event.target.value))} placeholder={tx('e.g. Water bill for October')} />
                    </div>
                </>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor="bulk-adjustment-advance-reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Reason (optional)')}</Label>
                    <Textarea id="bulk-adjustment-advance-reason" rows={2} value={advanceReason} onChange={(event) => change(() => setAdvanceReason(event.target.value))} placeholder={tx('e.g. Diwali advance')} />
                </div>
            )}

            <section className="space-y-2" aria-labelledby="bulk-adjustment-workers">
                <div className="flex items-center justify-between gap-3">
                    <h3 id="bulk-adjustment-workers" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tx('Workers')}</h3>
                    <p className="text-sm text-subtle" aria-live="polite">{tx('{selected} of {total} selected', { selected: count, total: eligible.length })}</p>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={tx('Worker types')}>
                    {GROUPS.filter(group => groupCounts[group] > 0).map(group => {
                        const state = bulkGroupState(selected, eligible, group)
                        return (
                            <button
                                key={group}
                                type="button"
                                aria-pressed={state === 'all' ? true : state === 'some' ? 'mixed' : false}
                                onClick={() => change(() => setSelected(toggleBulkGroup(selected, eligible, group)))}
                                className={`min-h-[44px] rounded-lg border px-3 text-sm font-semibold transition-colors ${state === 'all' ? 'border-ink bg-ink text-surface' : state === 'some' ? 'border-ink bg-surface-soft text-ink' : 'border-hairline bg-surface text-body hover:bg-surface-soft'}`}
                            >
                                {group === 'piece_rate' ? tx('Piece rate ({count})', { count: groupCounts[group] }) : tx('Fixed monthly ({count})', { count: groupCounts[group] })}
                            </button>
                        )
                    })}
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => change(() => setSelected(allSelected ? new Set() : new Set(eligible.map(worker => worker.id))))}
                    >
                        {allSelected ? tx('Clear all') : tx('Select all')}
                    </Button>
                </div>
                <ul className="max-h-56 divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline">
                    {eligible.map(worker => (
                        <li key={worker.id}>
                            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-soft">
                                <input
                                    type="checkbox"
                                    className="size-5 shrink-0 cursor-pointer accent-ink"
                                    checked={selected.has(worker.id)}
                                    onChange={() => change(() => setSelected(toggleBulkWorker(selected, worker.id)))}
                                    aria-label={tx('Include {name}', { name: worker.name })}
                                />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{worker.name}</span>
                                <span className="shrink-0 text-sm text-subtle">{bulkWorkerGroup(worker) === 'fixed_monthly' ? tx('Fixed monthly') : tx('Piece rate')}</span>
                            </label>
                        </li>
                    ))}
                </ul>
            </section>

            <p className="min-h-5 text-sm font-semibold text-ink" aria-live="polite">
                {amountValid && count > 0
                    ? count === 1
                        ? tx('{amount} for 1 worker', { amount: formatINR(amount) })
                        : tx('{amount} × {count} workers = {total}', { amount: formatINR(amount), count, total: formatINR(total) })
                    : null}
            </p>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

            <DialogFooter>
                <Button type="button" variant="outline" className="min-h-[44px]" onClick={onClose}>{tx('Cancel')}</Button>
                <Button type="submit" className="min-h-[44px]" disabled={!amountValid || count === 0}>{tx('Review')}</Button>
            </DialogFooter>
        </form>
    )
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-4 px-3 py-2.5">
            <dt className="text-subtle">{label}</dt>
            <dd className={`min-w-0 break-words text-right ${strong ? 'font-bold text-ink' : 'font-medium text-ink'}`}>{value}</dd>
        </div>
    )
}
