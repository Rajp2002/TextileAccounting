'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Decimal from 'decimal.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SignedQuantity } from '@/components/stock/stock-presentation'
import { useTranslation } from '@/lib/i18n/context'
import { focusAndSelectInput } from '@/lib/form-navigation'
import type { StockQuality } from '@/lib/quality-stock'
import {
    LegacyActionSchema,
    countGap,
    legacyStatus,
    type LegacyAction,
    type LegacyBasis,
    type LegacyMovement,
    type LegacyStock,
} from '@/lib/legacy-stock'
import { findOnboardedTakas, getLegacyStockHistory, mutateLegacyStock } from './actions'
import { LegacyStatusLine } from './LegacyStatusLine'

type View = 'summary' | 'start' | 'onboard' | 'count' | 'estimate' | 'close' | 'reopen'
type Pending = { requestId: string; version: number; input: LegacyAction }
type Taka = { lot: string; meters: string }

const field = 'h-10 rounded-xl border-hairline bg-surface shadow-xs max-md:min-h-[44px]'
const secondary = 'h-10 rounded-lg border-hairline bg-surface font-semibold text-ink shadow-xs hover:bg-surface-soft max-md:min-h-[44px]'
const BASES: LegacyBasis[] = ['unknown', 'estimated', 'counted']

/** Legacy (untagged) stock of one quality: its status, ledger and the owner's actions on it. */
export default function LegacyStockDialog({ quality, legacy, onClose, onSaved }: {
    quality: StockQuality | null
    legacy: LegacyStock | undefined
    onClose: () => void
    onSaved: (message: string) => Promise<void> | void
}) {
    const { t, language } = useTranslation()
    const tx = (key: string, values?: Record<string, string | number>) => t(`qualityStock.${key}`, values)
    const metres = (value: number) => Number(value).toLocaleString(language === 'en' ? 'en-IN' : `${language}-IN`, { maximumFractionDigits: 2 })
    const shortDate = (iso: string) => new Date(iso).toLocaleDateString(`${language}-IN`, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

    const [view, setView] = useState<View>('summary')
    const [basis, setBasis] = useState<LegacyBasis>('unknown')
    const [meters, setMeters] = useState('')
    const [reason, setReason] = useState('')
    const [confirmed, setConfirmed] = useState(false)
    const [takas, setTakas] = useState<Taka[]>([{ lot: '', meters: '' }])
    const [repeats, setRepeats] = useState<{ lot: string; at: string }[] | null>(null)
    const [pending, setPending] = useState<Pending | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [history, setHistory] = useState<LegacyMovement[] | null>(null)
    const [historyError, setHistoryError] = useState(false)
    const writing = useRef(false)
    const rows = useRef<HTMLDivElement>(null)
    const focusRow = useRef<number | null>(null)

    const qualityId = quality?.id
    const open = Boolean(quality)
    // Reset when the dialog opens for a quality; an owner who never started legacy stock lands on the start form.
    useEffect(() => {
        if (!qualityId) return
        setView(legacy ? 'summary' : 'start')
        reset()
        setHistory(null); setHistoryError(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only a newly opened quality resets the form
    }, [qualityId])

    useEffect(() => {
        if (!qualityId || !legacy || view !== 'summary' || history) return
        let live = true
        void getLegacyStockHistory(qualityId).then(result => {
            if (!live) return
            if ('error' in result) setHistoryError(true)
            else setHistory(result.data)
        }).catch(() => { if (live) setHistoryError(true) })
        return () => { live = false }
    }, [qualityId, legacy, view, history])

    useEffect(() => {
        if (focusRow.current === null) return
        const input = rows.current?.querySelector<HTMLInputElement>(`[data-taka-row="${focusRow.current}"]`)
        focusRow.current = null
        if (input) focusAndSelectInput(input)
    }, [takas.length])

    function reset() {
        setBasis('unknown'); setMeters(''); setReason(''); setConfirmed(false)
        setTakas([{ lot: '', meters: '' }]); setRepeats(null); setPending(null); setError('')
    }
    function go(next: View) {
        reset()
        if (next === 'count' || next === 'estimate') setMeters('')
        setView(next)
    }

    const status = legacy ? legacyStatus(legacy) : null
    const expected = legacy?.balance_meters ?? null
    const countedValue = meters.trim() ? Number(meters) : NaN
    const gap = view === 'count' && Number.isFinite(countedValue) ? countGap(expected, countedValue) : null
    const filledTakas = takas.filter(row => row.lot.trim() || row.meters.trim())
    const takaTotal = filledTakas.reduce((sum, row) => sum.plus(Number(row.meters) || 0), new Decimal(0)).toNumber()

    function buildInput(): LegacyAction {
        const amount = meters.trim() ? Number(meters) : undefined
        const note = reason.trim() || undefined
        switch (view) {
            case 'start': return { action: 'start', basis, meters: basis === 'unknown' ? undefined : amount, reason: note }
            case 'reopen': return { action: 'reopen', basis, meters: basis === 'unknown' ? undefined : amount, reason: reason.trim() }
            case 'estimate': return { action: 'estimate', meters: amount ?? NaN, reason: note }
            case 'count': return { action: 'count', meters: amount ?? NaN, reason: note }
            case 'close': return { action: 'close', confirmed: confirmed as true, reason: note }
            default: return { action: 'onboard', lines: filledTakas.map(row => ({ lot: row.lot.trim(), meters: row.meters.trim() ? Number(row.meters) : NaN })), reason: note }
        }
    }

    async function save() {
        if (!quality || writing.current) return
        // After an uncertain failure, resend the exact reviewed request so the server can recognise it.
        const request = pending ?? { requestId: crypto.randomUUID(), version: legacy?.version ?? 0, input: buildInput() }
        const parsed = LegacyActionSchema.safeParse(request.input)
        if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? tx('validation')); return }
        if (request.input.action === 'count' && gap !== null && gap !== 0 && (request.input.reason ?? '').trim().length < 3) { setError(tx('countReason')); return }
        writing.current = true; setSaving(true); setError('')
        try {
            if (request.input.action === 'onboard' && !pending && repeats === null) {
                const lots = request.input.lines.map(line => line.lot)
                const check = await findOnboardedTakas(quality.id, lots)
                if (!('error' in check) && check.data.length > 0) { setRepeats(check.data); return }
            }
            setPending(request)
            const result = await mutateLegacyStock({ qualityId: quality.id, ...request })
            if ('error' in result) {
                setError(result.errorKey === 'forbidden' ? tx('legacyForbidden') : result.errorKey === 'retrySame' ? tx('retrySame') : result.error)
                if (!result.uncertain) setPending(null)
                return
            }
            setPending(null)
            await onSaved(tx('legacySaved'))
            setHistory(null)
            setView('summary')
        } catch {
            setError(tx('retrySame'))
        } finally { writing.current = false; setSaving(false) }
    }

    function takaEnter(event: KeyboardEvent<HTMLInputElement>, index: number, column: 'lot' | 'meters') {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.shiftKey) return
        event.preventDefault()
        const row = takas[index]
        if (column === 'lot') {
            if (!row.lot.trim()) return
            const next = rows.current?.querySelector<HTMLInputElement>(`[data-taka-metres="${index}"]`)
            if (next) focusAndSelectInput(next)
            return
        }
        if (!row.lot.trim() || !(Number(row.meters) > 0)) return
        const next = rows.current?.querySelector<HTMLInputElement>(`[data-taka-row="${index + 1}"]`)
        if (next) focusAndSelectInput(next)
        else if (takas.length < 500) { focusRow.current = index + 1; setTakas([...takas, { lot: '', meters: '' }]) }
    }
    const editTaka = (index: number, patch: Partial<Taka>) => { setRepeats(null); setTakas(takas.map((row, i) => i === index ? { ...row, ...patch } : row)) }

    const locked = Boolean(pending) || saving
    const titles: Record<View, string> = {
        summary: tx('legacyTitle'), start: tx('legacyStart'), onboard: tx('legacyOnboard'), count: tx('legacyCount'),
        estimate: tx('legacyEstimate'), close: tx('legacyClose'), reopen: tx('legacyReopen'),
    }
    const helps: Record<View, string> = {
        summary: tx('legacyIntro'), start: tx('legacyIntro'), onboard: tx('legacyOnboardHelp'), count: tx('legacyCountHelp'),
        estimate: tx('legacyEstimateHelp'), close: tx('legacyCloseHelp'), reopen: tx('legacyReopenHelp'),
    }
    const submitLabel: Partial<Record<View, string>> = {
        start: tx('legacyStart'), onboard: repeats ? tx('saveAnyway') : tx('onboardSave'), count: tx('legacyCount'),
        estimate: tx('legacyEstimate'), close: tx('legacyClose'), reopen: tx('legacyReopen'),
    }

    const metresField = (label: string) => (
        <div className="space-y-1.5">
            <Label htmlFor="legacy-metres" className="text-xs font-semibold text-body">{label}</Label>
            <Input id="legacy-metres" type="number" inputMode="decimal" min="0" max="100000000" step="0.01" value={meters}
                disabled={locked} onChange={event => setMeters(event.target.value)} required className={field} />
        </div>
    )
    const noteField = (label: string, required = false) => (
        <div className="space-y-1.5">
            <Label htmlFor="legacy-note" className="text-xs font-semibold text-body">{label}</Label>
            <textarea id="legacy-note" value={reason} disabled={locked} onChange={event => setReason(event.target.value)}
                maxLength={500} minLength={required ? 3 : undefined} required={required}
                className="min-h-16 w-full rounded-xl border border-hairline bg-surface p-3 text-sm shadow-xs focus:border-loom focus:outline-none focus:ring-1 focus:ring-loom" />
        </div>
    )
    const basisField = (
        <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-body">{tx('legacyBasis')}</legend>
            <div className="grid gap-2">
                {BASES.map(option => (
                    <label key={option} className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${basis === option ? 'border-ink bg-surface-soft' : 'border-hairline bg-surface'}`}>
                        <input type="radio" name="legacy-basis" value={option} checked={basis === option} disabled={locked}
                            onChange={() => { setBasis(option); if (option === 'unknown') setMeters('') }} className="mt-0.5 accent-ink" />
                        <span>
                            <span className="block font-semibold text-ink">{tx(`basis_${option}`)}</span>
                            <span className="block text-xs text-muted-foreground">{tx(`basisHelp_${option}`)}</span>
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    )

    return (
        <Dialog open={open} onOpenChange={value => { if (!value && !saving) onClose() }}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border-hairline" data-i18n-skip="true">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-ink">{titles[view]}</DialogTitle>
                    <DialogDescription className="text-xs text-body">
                        <span className="font-semibold text-ink">{quality?.quality_label}</span> · {helps[view]}
                    </DialogDescription>
                </DialogHeader>

                {view === 'summary' && legacy && status ? (
                    <div className="space-y-5">
                        <LegacyStatusLine legacy={legacy} className="text-sm" />
                        <dl className="grid grid-cols-3 gap-3 rounded-xl border border-hairline p-3 text-sm">
                            <div>
                                <dt className="text-xs text-muted-foreground">{tx('legacyBalance')}</dt>
                                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                                    {legacy.balance_meters === null ? tx('legacyUnknownBalance') : `${legacy.basis === 'estimated' ? '~' : ''}${metres(legacy.balance_meters)} ${tx('metres')}`}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{tx('legacySent')}</dt>
                                <dd className="mt-0.5 font-semibold tabular-nums text-ink">{metres(legacy.dispatched_meters)} {tx('metres')}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{tx('legacyTagged')}</dt>
                                <dd className="mt-0.5 font-semibold tabular-nums text-ink">{metres(legacy.onboarded_meters)} {tx('metres')}</dd>
                            </div>
                        </dl>
                        <p className="text-xs text-muted-foreground">{tx('legacyStartedOn', { date: shortDate(legacy.started_at) })}</p>

                        <div className="flex flex-wrap gap-2">
                            {status === 'closed' ? (
                                <Button onClick={() => go('reopen')} className="h-10 rounded-lg font-semibold max-md:min-h-[44px]">{tx('legacyReopen')}</Button>
                            ) : (
                                <>
                                    <Button onClick={() => go('onboard')} className="h-10 rounded-lg font-semibold max-md:min-h-[44px]">{tx('legacyOnboard')}</Button>
                                    <Button variant="outline" onClick={() => go('count')} className={secondary}>{tx('legacyCount')}</Button>
                                    {legacy.basis !== 'counted' && <Button variant="outline" onClick={() => go('estimate')} className={secondary}>{tx('legacyEstimate')}</Button>}
                                    {status === 'readyToClose' && <Button variant="outline" onClick={() => go('close')} className={secondary}>{tx('legacyClose')}</Button>}
                                </>
                            )}
                        </div>
                        {status !== 'closed' && status !== 'readyToClose' && <p className="text-xs text-muted-foreground">{tx('legacyCloseNeedsCount')}</p>}

                        <section aria-labelledby="legacy-history" className="space-y-2 border-t border-hairline pt-4">
                            <h3 id="legacy-history" className="text-sm font-semibold text-ink">{tx('legacyHistory')}</h3>
                            {historyError ? <p className="text-xs text-[var(--wv-madder-600)]">{tx('legacyLoadError')}</p>
                                : history === null ? <p className="text-xs text-muted-foreground">{tx('loading')}</p>
                                : history.length === 0 ? <p className="text-xs text-muted-foreground">{tx('legacyHistoryEmpty')}</p>
                                : (
                                    <ol className="divide-y divide-hairline">
                                        {history.map(row => (
                                            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2 text-sm">
                                                <span className="min-w-0">
                                                    <span className="font-semibold text-ink">{tx(`lkind_${row.kind}`)}</span>
                                                    {row.entered_meters !== null && <span className="text-body"> · {metres(row.entered_meters)} {tx('metres')}</span>}
                                                    {row.lines && <span className="text-body"> · {tx('onboardTotal', { count: row.lines.length, meters: metres(row.lines.reduce((sum, line) => sum + Number(line.meters), 0)) })}</span>}
                                                    <span className="block truncate text-xs text-muted-foreground" title={row.reason ?? undefined}>
                                                        {new Date(row.created_at).toLocaleString(`${language}-IN`, { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                                                        {row.reason ? ` · ${row.reason}` : ''}
                                                    </span>
                                                </span>
                                                <span className="text-right text-xs">
                                                    {row.meters_delta !== null && <SignedQuantity value={row.meters_delta} unit={tx('metres')} format={metres} className="block text-sm" />}
                                                    <span className="block text-muted-foreground">
                                                        {row.balance_after === null ? tx('legacyUnknownBalance') : `${metres(row.balance_after)} ${tx('metres')}`}
                                                    </span>
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                        </section>
                    </div>
                ) : (
                    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save() }}>
                        {(view === 'start' || view === 'reopen') && (
                            <>
                                {basisField}
                                {basis !== 'unknown' && metresField(tx('legacyMetres'))}
                                {view === 'reopen' ? noteField(tx('reopenReason'), true) : noteField(tx('legacyNote'))}
                            </>
                        )}
                        {view === 'estimate' && <>{metresField(tx('legacyMetres'))}{noteField(tx('legacyNote'))}</>}
                        {view === 'count' && (
                            <>
                                {metresField(tx('countedNow'))}
                                <p className="text-xs text-muted-foreground">
                                    {tx('expectedNow')}: <span className="font-semibold text-ink">{expected === null ? tx('legacyUnknownBalance') : `${metres(expected)} ${tx('metres')}`}</span>
                                    {gap !== null && gap !== 0 && <span className="ml-2 font-semibold text-[var(--wv-ochre-800)]">{tx('countGap', { meters: `${gap > 0 ? '+' : '−'}${metres(Math.abs(gap))}` })}</span>}
                                </p>
                                {noteField(gap !== null && gap !== 0 ? tx('countReason') : tx('legacyNote'), gap !== null && gap !== 0)}
                            </>
                        )}
                        {view === 'close' && (
                            <>
                                <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-hairline p-3 text-sm text-ink">
                                    <input type="checkbox" checked={confirmed} disabled={locked} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5 accent-ink" />
                                    {tx('legacyCloseConfirm')}
                                </label>
                                {noteField(tx('legacyNote'))}
                            </>
                        )}
                        {view === 'onboard' && (
                            <div className="space-y-3">
                                <div ref={rows} className="space-y-2">
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_2.75rem] gap-2 text-xs font-semibold text-muted-foreground" aria-hidden="true">
                                        <span>{tx('takaNumber')}</span><span>{tx('takaMetres')}</span><span />
                                    </div>
                                    {takas.map((row, index) => (
                                        <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_2.75rem] gap-2">
                                            <Input data-taka-row={index} aria-label={`${tx('takaNumber')} ${index + 1}`} autoComplete="off" enterKeyHint="next" maxLength={80}
                                                value={row.lot} disabled={locked} onKeyDown={event => takaEnter(event, index, 'lot')}
                                                onChange={event => editTaka(index, { lot: event.target.value })} className={`${field} font-mono font-semibold`} />
                                            <Input data-taka-metres={index} aria-label={`${tx('takaMetres')} ${index + 1}`} type="number" inputMode="decimal" enterKeyHint="next"
                                                min="0.01" max="100000000" step="0.01" value={row.meters} disabled={locked} onKeyDown={event => takaEnter(event, index, 'meters')}
                                                onChange={event => editTaka(index, { meters: event.target.value })} className={`${field} tabular-nums`} />
                                            <Button type="button" variant="ghost" size="icon" aria-label={tx('removeTaka', { row: index + 1 })} disabled={locked || takas.length === 1}
                                                onClick={() => { setRepeats(null); setTakas(takas.filter((_, i) => i !== index)) }} className="h-10 w-full rounded-lg text-muted-foreground max-md:min-h-[44px]">
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Button type="button" variant="outline" disabled={locked || takas.length >= 500}
                                        onClick={() => { focusRow.current = takas.length; setTakas([...takas, { lot: '', meters: '' }]) }} className={secondary}>
                                        <Plus className="h-4 w-4" aria-hidden="true" />{tx('addTaka')}
                                    </Button>
                                    <p aria-live="polite" className="text-sm font-semibold tabular-nums text-ink">{tx('onboardTotal', { count: filledTakas.length, meters: metres(takaTotal) })}</p>
                                </div>
                                {repeats && (
                                    <p role="alert" className="rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-2.5 text-xs font-semibold text-[var(--wv-ochre-800)]">
                                        {tx('repeatedTakas', { lots: repeats.map(row => `${row.lot} (${shortDate(row.at)})`).join(', ') })}
                                    </p>
                                )}
                                {noteField(tx('legacyNote'))}
                            </div>
                        )}

                        {error && <p role="alert" className="text-xs font-medium text-[var(--wv-madder-600)]">{error}</p>}
                        {pending && !saving && <p className="text-xs text-muted-foreground">{tx('retrySame')}</p>}
                        <div className="flex flex-wrap justify-between gap-2 pt-1">
                            {legacy ? (
                                <Button type="button" variant="ghost" disabled={saving} onClick={() => go('summary')} className="h-10 rounded-lg font-semibold text-body max-md:min-h-[44px]">
                                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />{tx('legacyBack')}
                                </Button>
                            ) : <span />}
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" disabled={saving} onClick={onClose} className={secondary}>{tx('close')}</Button>
                                <Button type="submit" disabled={saving || (view === 'close' && !confirmed)} className="h-10 rounded-lg font-semibold max-md:min-h-[44px]">
                                    {saving ? tx('saving') : pending ? tx('retry') : submitLabel[view]}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
