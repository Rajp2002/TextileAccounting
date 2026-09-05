'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calculator, HelpCircle, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OverheadItem } from '@/lib/estimator'
import { useTranslation } from '@/lib/i18n/context'
import {
    deriveCostingOverheadPerMetre,
    formatIndianMoney,
    getMonthlyOverheadTotal,
    getOverheadDifferencePerMetre,
    MAX_MONTHLY_OVERHEAD_AMOUNT,
    MAX_STANDARD_MONTHLY_PRODUCTION_METRES,
} from '@/lib/monthly-overhead'
import { parseNonNegativeInput } from '@/lib/numeric-input'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { cn } from '@/lib/utils'

type CalculatorView = 'summary' | 'edit' | 'confirm'

type MonthlyOverheadCalculatorProps = {
    salaryStaff?: Array<{ id: string; name: string; monthlySalary: number }>
    open: boolean
    onOpenChange: (open: boolean) => void
    savedItems: OverheadItem[]
    savedStandardProductionMetres: number
    currentOverheadPerMetre: number
    initialView?: Extract<CalculatorView, 'summary' | 'edit'>
    onApply: (input: {
        expenses: OverheadItem[]
        standardMonthlyProductionMetres: number
        derivedOverheadPerMetre: number
    }) => Promise<{ success: true } | { success: false; error: string }>
}

function formatMoney(value: number, digits?: number) {
    return formatIndianMoney(value, digits)
}

function formatSignedMoney(value: number, digits = 2) {
    const sign = value > 0 ? '+' : value < 0 ? '−' : ''
    return `${sign}${formatMoney(Math.abs(value), digits)}`
}

function cloneItems(items: OverheadItem[]) {
    return items.map(item => ({ ...item, meta: item.meta ? { ...item.meta } : undefined }))
}

export function MonthlyOverheadCalculator({
    salaryStaff = [],
    open,
    onOpenChange,
    savedItems,
    savedStandardProductionMetres,
    currentOverheadPerMetre,
    initialView = 'edit',
    onApply,
}: MonthlyOverheadCalculatorProps) {
    const { tx } = useTranslation()
    const [items, setItems] = useState<OverheadItem[]>(() => cloneItems(savedItems))
    const [productionMetres, setProductionMetres] = useState(savedStandardProductionMetres)
    const [view, setView] = useState<CalculatorView>(initialView)
    const [applying, setApplying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [invalidAmountIds, setInvalidAmountIds] = useState<string[]>([])
    const [invalidProduction, setInvalidProduction] = useState(false)
    const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({})
    const [productionDraft, setProductionDraft] = useState<string | null>(null)
    const errorRef = useRef<HTMLParagraphElement>(null)

    useEffect(() => {
        if (!error) return
        errorRef.current?.focus({ preventScroll: true })
        errorRef.current?.scrollIntoView({ block: 'nearest' })
    }, [error])

    const total = useMemo(() => getMonthlyOverheadTotal(items), [items])
    const recommended = useMemo(
        () => invalidAmountIds.length > 0 || invalidProduction
            ? null
            : deriveCostingOverheadPerMetre(items, productionMetres),
        [invalidAmountIds.length, invalidProduction, items, productionMetres],
    )
    const difference = getOverheadDifferencePerMetre(recommended, currentOverheadPerMetre)

    const reset = () => {
        setItems(cloneItems(savedItems))
        setProductionMetres(savedStandardProductionMetres)
        setView('edit')
        setError(null)
        setInvalidAmountIds([])
        setInvalidProduction(false)
        setAmountDrafts({})
        setProductionDraft(null)
    }

    const updateItem = (id: string, field: 'label' | 'monthlyAmount', value: string | number) => {
        setItems(current => current.map(item => item.id === id && item.source !== 'base_salary_derived' ? { ...item, [field]: value } : item))
        setError(null)
    }

    const updateAmount = (id: string, raw: string) => {
        const parsed = parseNonNegativeInput(raw)
        if (raw.trim() === '') {
            setAmountDrafts(current => {
                const next = { ...current }
                delete next[id]
                return next
            })
            setInvalidAmountIds(current => current.filter(candidate => candidate !== id))
            updateItem(id, 'monthlyAmount', 0)
            return
        }
        if (parsed == null || parsed > MAX_MONTHLY_OVERHEAD_AMOUNT) {
            setAmountDrafts(current => ({ ...current, [id]: raw }))
            setInvalidAmountIds(current => current.includes(id) ? current : [...current, id])
            setError(parsed != null
                ? tx('Monthly expense amount exceeds the supported limit.')
                : tx('Enter a valid non-negative monthly amount.'))
            return
        }
        setAmountDrafts(current => {
            const next = { ...current }
            delete next[id]
            return next
        })
        setInvalidAmountIds(current => current.filter(candidate => candidate !== id))
        updateItem(id, 'monthlyAmount', parsed)
    }

    const updateProduction = (raw: string) => {
        const parsed = parseNonNegativeInput(raw)
        if (raw.trim() === '') {
            setProductionDraft(raw)
            setInvalidProduction(true)
            setProductionMetres(0)
            setError(tx('Enter a valid positive standard monthly production.'))
            return
        }
        if (parsed == null || parsed <= 0 || parsed > MAX_STANDARD_MONTHLY_PRODUCTION_METRES) {
            setProductionDraft(raw)
            setInvalidProduction(true)
            setError(parsed != null && parsed > MAX_STANDARD_MONTHLY_PRODUCTION_METRES
                ? tx('Standard monthly production exceeds the supported limit.')
                : tx('Enter a valid positive standard monthly production.'))
            return
        }
        setProductionDraft(null)
        setInvalidProduction(false)
        setProductionMetres(parsed)
        setError(null)
    }

    const addOtherExpense = () => {
        setItems(current => [...current, {
            id: nanoid(),
            label: '',
            monthlyAmount: 0,
            source: 'manual',
            category: 'custom',
            isPreset: false,
            isLocked: false,
        }])
        void trackPlanEvent('monthly_overhead_custom_expense_added')
    }

    const apply = async () => {
        if (recommended == null) return
        const unnamedCustom = items.some(item => !item.isPreset && !item.label.trim())
        if (unnamedCustom) {
            setView('edit')
            setError(tx('Add a description for each other expense.'))
            return
        }

        setApplying(true)
        setError(null)
        const result = await onApply({
            expenses: items,
            standardMonthlyProductionMetres: productionMetres,
            derivedOverheadPerMetre: recommended,
        })
        setApplying(false)
        if (!result.success) {
            if (view === 'confirm') setView('edit')
            setError(tx(result.error))
            return
        }
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={nextOpen => { if (!applying) onOpenChange(nextOpen) }}>
            <DialogContent className={cn(
                'flex w-full flex-col gap-0 overflow-hidden p-0',
                view === 'edit'
                    ? 'h-[100dvh] max-h-[100dvh] max-w-none rounded-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-lg'
                    : 'max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] rounded-lg sm:max-w-md',
            )}>
                <DialogHeader className="border-b border-hairline px-5 py-4 pr-12 sm:px-6">
                    <DialogTitle className="flex items-center gap-2 text-left">
                        <Calculator className="h-5 w-5 text-saffron" aria-hidden="true" />
                        {tx(view === 'summary'
                            ? 'Use saved monthly overhead?'
                            : view === 'confirm'
                                ? 'Use Recommended Costing Overhead?'
                                : 'Monthly Overhead Calculator')}
                    </DialogTitle>
                    <DialogDescription className="text-left leading-relaxed">
                        {tx(view === 'summary'
                            ? 'Review your saved monthly assumptions before switching the Current Costing Overhead.'
                            : view === 'confirm'
                                ? 'New and repriced costings will use this overhead. Existing Saved Costings will remain unchanged.'
                                : 'Estimate the overhead per metre to use in your costings from your factory’s typical monthly overhead expenses and standard monthly production.')}
                    </DialogDescription>
                </DialogHeader>

                {view === 'summary' && recommended != null ? (
                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-canvas/45">
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                                <span className="text-sm text-body">{tx('Total monthly expenses')}</span>
                                <span className="font-mono text-sm font-black text-ink">{formatMoney(total)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                                <span className="text-sm text-body">{tx('Standard monthly production')}</span>
                                <span className="font-mono text-sm font-black text-ink">{productionMetres.toLocaleString('en-IN')} {tx('m')}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 bg-saffron-soft/45 px-4 py-4">
                                <span className="text-sm font-bold text-saffron-deep">{tx('Derived costing overhead')}</span>
                                <span className="font-mono text-xl font-black text-ink">{formatMoney(recommended, 2)}/{tx('m')}</span>
                            </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {tx('Use the saved result now, or edit the monthly expense details before applying it.')}
                        </p>
                        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-risk/25 bg-risk/5 px-3 py-2 text-sm text-risk">{error}</p>}
                    </div>
                ) : view === 'confirm' && recommended != null ? (
                    <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-6">
                        <div className="rounded-xl border border-saffron/30 bg-saffron-soft/45 p-5 text-center">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-saffron-deep">{tx('Recommended Costing Overhead')}</p>
                            <p className="mt-2 font-mono text-4xl font-black text-ink">{formatMoney(recommended, 2)}<span className="text-base font-bold text-body"> / {tx('metre')}</span></p>
                        </div>
                        <p className="text-sm leading-relaxed text-body">
                            {tx('This changes the Current Costing Overhead only after you select Apply Overhead. Your monthly assumptions will be retained for the next review.')}
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
                        <section className="space-y-3">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-subtle">{tx('Monthly Factory Overhead')}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tx('Include factory expenses that you treat as production overhead.')}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tx('Do not include yarn or material costs already calculated separately in the fabric costing.')}</p>
                            </div>

                            <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
                                {items.map(item => (
                                    <div key={item.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center">
                                        <Input
                                            aria-label={item.isPreset ? tx(item.label) : tx('Other expense description')}
                                            placeholder={tx('Expense description')}
                                            value={item.isPreset ? tx(item.label) : item.label}
                                            disabled={item.isPreset}
                                            onChange={event => updateItem(item.id, 'label', event.target.value)}
                                            className="h-9 border-0 bg-transparent px-0 font-medium shadow-none disabled:cursor-default disabled:opacity-100"
                                        />
                                        <div className="relative">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                                            <Input
                                                aria-label={`${tx(item.label || 'Other expense')} ${tx('monthly amount')}`}
                                                inputMode="decimal"
                                                type="text"
                                                min={0}
                                                step="0.01"
                                                value={amountDrafts[item.id] ?? item.monthlyAmount}
                                                aria-invalid={invalidAmountIds.includes(item.id) || undefined}
                                                readOnly={item.source === 'base_salary_derived'}
                                                onChange={event => updateAmount(item.id, event.target.value)}
                                                className="h-10 pl-7 pr-12 text-right font-mono"
                                            />
                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">/{tx('mo')}</span>
                                        </div>
                                        {!item.isPreset && (
                                            <button
                                                type="button"
                                                aria-label={`${tx('Remove')} ${item.label || tx('other expense')}`}
                                                onClick={() => {
                                                    setItems(current => current.filter(candidate => candidate.id !== item.id))
                                                    setInvalidAmountIds(current => current.filter(candidate => candidate !== item.id))
                                                    setAmountDrafts(current => {
                                                        const next = { ...current }
                                                        delete next[item.id]
                                                        return next
                                                    })
                                                }}
                                                className="justify-self-end rounded-md p-2 text-muted-foreground hover:bg-risk/5 hover:text-risk sm:justify-self-auto"
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {items.some(item => item.source === 'base_salary_derived') && <details className="rounded-lg border border-hairline bg-canvas p-3 text-sm">
                                <summary className="cursor-pointer font-semibold">Fixed staff salaries · automatically linked ({salaryStaff.length})</summary>
                                <p className="mt-2 text-xs text-body">This replaces the manual staff-salary row. Edit salaries in Setup. Do not repeat these salaries under Other Expenses. Advance recovery does not reduce this monthly budget.</p>
                                <ul className="mt-2 space-y-1">{salaryStaff.map(worker => <li key={worker.id} className="flex justify-between gap-3"><span>{worker.name}</span><span>{formatMoney(worker.monthlySalary)}/month</span></li>)}</ul>
                            </details>}
                            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addOtherExpense}>
                                <Plus className="h-4 w-4" aria-hidden="true" /> {tx('Add Other Expense')}
                            </Button>

                            <div className="flex items-center justify-between gap-4 rounded-lg bg-canvas px-4 py-3">
                                <span className="text-sm font-bold text-body">{tx('Total Monthly Overhead')}</span>
                                <span className="font-mono text-lg font-black text-ink">{formatMoney(total)}</span>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="standard-monthly-production" className="text-xs font-black uppercase tracking-[0.14em] text-subtle">{tx('Standard Monthly Production')}</Label>
                                <details className="group relative">
                                    <summary className="cursor-pointer list-none rounded p-1 text-muted-foreground hover:text-ink [&::-webkit-details-marker]:hidden" aria-label={tx('What should I enter?')}>
                                        <HelpCircle className="h-4 w-4" aria-hidden="true" />
                                    </summary>
                                    <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-hairline bg-surface p-3 text-xs leading-relaxed text-body shadow-lg">
                                        <p className="font-bold text-ink">{tx('What should I enter?')}</p>
                                        <p className="mt-1">{tx('Use a production level that reasonably represents normal monthly factory output. Avoid unusually low or unusually high months unless they reflect the level you expect to operate at.')}</p>
                                    </div>
                                </details>
                            </div>
                            <div className="relative">
                                <Input
                                    id="standard-monthly-production"
                                    inputMode="decimal"
                                    type="text"
                                    min={0}
                                    step="1"
                                    value={productionDraft ?? productionMetres}
                                    aria-invalid={invalidProduction || undefined}
                                    onChange={event => updateProduction(event.target.value)}
                                    className="h-12 pr-12 text-right font-mono text-lg font-bold"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">m</span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{tx('Enter the monthly running metres that reasonably represent your factory’s normal production level for costing.')}</p>
                        </section>

                        <section className="rounded-xl border border-saffron/30 bg-saffron-soft/35 p-4 sm:p-5" aria-live="polite">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-saffron-deep">{tx('Recommended Costing Overhead')}</p>
                            {recommended == null ? (
                                <>
                                    <p className="mt-2 text-3xl font-black text-ink">—</p>
                                    <p className="mt-1 text-xs text-body">{tx('Enter standard monthly production to calculate overhead.')}</p>
                                </>
                            ) : (
                                <>
                                    <p className="mt-2 font-mono text-3xl font-black text-ink">{formatMoney(recommended, 2)}<span className="text-sm font-bold text-body"> / {tx('metre')}</span></p>
                                    <p className="mt-2 text-xs text-body">{tx('Based on')}: {formatMoney(total)} {tx('monthly overhead')} / {productionMetres.toLocaleString('en-IN')} {tx('m')} {tx('standard production')}</p>
                                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-saffron/20 pt-3 text-xs">
                                        <div><p className="text-muted-foreground">{tx('Current')}</p><p className="mt-1 font-mono font-bold text-ink">{formatMoney(currentOverheadPerMetre, 2)}/{tx('m')}</p></div>
                                        <div><p className="text-muted-foreground">{tx('Newly Derived')}</p><p className="mt-1 font-mono font-bold text-ink">{formatMoney(recommended, 2)}/{tx('m')}</p></div>
                                        <div><p className="text-muted-foreground">{tx('Difference')}</p><p className="mt-1 font-mono font-bold text-ink">{difference == null ? '—' : `${formatSignedMoney(difference)}/${tx('m')}`}</p></div>
                                    </div>
                                </>
                            )}
                        </section>

                        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-risk/25 bg-risk/5 px-3 py-2 text-sm text-risk">{error}</p>}
                    </div>
                )}

                <DialogFooter className={cn(
                    'sticky bottom-0 gap-2 border-t border-hairline bg-surface px-4 py-4 sm:px-6',
                    view === 'summary' || view === 'edit' ? 'grid grid-cols-2 sm:flex sm:flex-row' : 'flex-row',
                )}>
                    {view === 'summary' ? (
                        <>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>{tx('Cancel')}</Button>
                            <Button type="button" variant="ghost" onClick={() => { setView('edit'); setError(null) }} disabled={applying}>{tx('Edit details')}</Button>
                            <Button type="button" variant="saffron" className="col-span-2 sm:order-none" onClick={() => void apply()} disabled={applying || recommended == null}>
                                {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {recommended == null ? tx('Use saved overhead') : `${tx('Use')} ${formatMoney(recommended, 2)}/${tx('m')}`}
                            </Button>
                        </>
                    ) : view === 'confirm' ? (
                        <>
                            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => setView('edit')} disabled={applying}>{tx('Cancel')}</Button>
                            <Button type="button" variant="saffron" className="flex-1 sm:flex-none" onClick={() => void apply()} disabled={applying}>
                                {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tx('Apply Overhead')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button type="button" variant="ghost" size="sm" className="col-span-2 mr-0 justify-self-start gap-2 sm:col-span-1 sm:mr-auto" onClick={reset}>
                                <RotateCcw className="h-4 w-4" /> {tx('Reset Changes')}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tx('Cancel')}</Button>
                            <Button type="button" variant="saffron" onClick={() => setView('confirm')} disabled={recommended == null}>
                                {recommended == null ? tx('Use recommended overhead') : `${tx('Use')} ${formatMoney(recommended, 2)}/${tx('m')}`}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
