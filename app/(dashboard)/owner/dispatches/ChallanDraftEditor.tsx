'use client'

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Plus, Trash2, Eye, Printer } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SwitchField } from '@/components/ui/switch-field'
import { useTranslation } from '@/lib/i18n/context'
import {
    focusAndSelectInput,
    handleEnterKeyNavigation,
} from '@/lib/form-navigation'
import {
    REQUIRED_CHALLAN_DOCUMENT_FIELDS,
    challanDraftProgress,
    challanPrintReadiness,
    isEmptyChallanLine,
    prepareChallanDraft,
} from '@/lib/challan-draft-entry'
import { type ChallanDraft } from '@/lib/delivery-challans'
import {
    WEAVLY_LOGO_DATA_URI,
    WEAVLY_LOGO_HEIGHT,
    WEAVLY_LOGO_WIDTH,
} from '@/lib/estimator-export-logo'
import type { StockQuality } from '@/lib/quality-stock'

const required: readonly string[] = REQUIRED_CHALLAN_DOCUMENT_FIELDS
const LOGO_WIDTH = 88
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * WEAVLY_LOGO_HEIGHT) / WEAVLY_LOGO_WIDTH)
const optional = [
    'customer_phone',
    'sender_gstin',
    'customer_gstin',
    'place_of_supply',
    'hsn',
    'transport',
    'vehicle',
    'lr_reference',
    'invoice_reference',
    'eway_bill_reference',
    'external_reference',
    'external_attachment',
    'tax_details',
    'notes',
]

export default function ChallanDraftEditor({
    draft,
    onChange,
    onSave,
    onSavePrint,
    qualities,
    number,
    businessName,
    disabled,
    error,
}: {
    draft: ChallanDraft
    onChange: (draft: ChallanDraft) => void
    onSave: (draft: ChallanDraft) => void
    /** Saves the draft, which assigns its number, then prints it. */
    onSavePrint: (draft: ChallanDraft) => void
    qualities: StockQuality[]
    number?: string
    /** The factory's name from its account, shown on the document as on the printed copy. */
    businessName?: string
    disabled: boolean
    error?: string
}) {
    const { t, language } = useTranslation()
    const tx = (key: string) => t(`challan.${key}`)
    const [showPreview, setShowPreview] = useState(false)
    const form = useRef<HTMLFormElement>(null)
    const focusRow = useRef<number | null>(null)
    const saveButton = useRef<HTMLButtonElement>(null)
    const progress = challanDraftProgress(draft)
    const readiness = challanPrintReadiness(draft)
    const quality = qualities.find((q) => q.id === draft.quality_id)
    const format = (n: number) =>
        n.toLocaleString(`${language}-IN`, { maximumFractionDigits: 2 })
    useLayoutEffect(() => {
        if (focusRow.current === null) return
        const input = form.current?.querySelector<HTMLInputElement>(
            `[data-lot-row="${focusRow.current}"]`,
        )
        if (input) {
            focusAndSelectInput(input)
            focusRow.current = null
        }
    }, [draft.lines.length])

    useLayoutEffect(() => {
        const inputs =
            form.current?.querySelectorAll<HTMLInputElement>('[data-lot-row]')
        inputs?.forEach((input, index) => {
            const lot = draft.lines[index]?.lot.trim()
            input.setCustomValidity(
                lot &&
                    draft.lines.some(
                        (line, other) =>
                            other !== index && line.lot.trim() === lot,
                    )
                    ? t('challan.duplicateLot')
                    : '',
            )
        })
    }, [draft.lines, t])

    function updateLine(
        index: number,
        patch: Partial<ChallanDraft['lines'][number]>,
    ) {
        onChange({
            ...draft,
            lines: draft.lines.map((line, i) =>
                i === index ? { ...line, ...patch } : line,
            ),
        })
    }
    function addLine() {
        const blankIndex = draft.lines.findIndex(isEmptyChallanLine)
        if (blankIndex >= 0) {
            const input = form.current?.querySelector<HTMLInputElement>(
                `[data-lot-row="${blankIndex}"]`,
            )
            if (input) focusAndSelectInput(input)
        } else if (draft.lines.length < 500) {
            focusRow.current = draft.lines.length
            onChange({
                ...draft,
                lines: [...draft.lines, { lot: '', meters: 0 }],
            })
        }
    }
    function rowEnter(
        e: KeyboardEvent<HTMLInputElement>,
        index: number,
        column: 'lot' | 'meters',
    ) {
        if (
            e.key !== 'Enter' ||
            e.nativeEvent.isComposing ||
            e.nativeEvent.keyCode === 229 ||
            e.shiftKey
        )
            return
        e.preventDefault()
        const input = e.currentTarget
        const line = draft.lines[index]
        if (!input.reportValidity()) return
        if (column === 'lot') {
            if (!line.lot.trim()) return
            const duplicate = draft.lines.some(
                (other, i) =>
                    i !== index && other.lot.trim() === line.lot.trim(),
            )
            if (duplicate) {
                input.setCustomValidity(tx('duplicateLot'))
                input.reportValidity()
                return
            }
            const next = form.current?.querySelector<HTMLInputElement>(
                `[data-meters-row="${index}"]`,
            )
            if (next) focusAndSelectInput(next)
        } else {
            if (!line.lot.trim() || line.meters <= 0) return
            const next = form.current?.querySelector<HTMLInputElement>(
                `[data-lot-row="${index + 1}"]`,
            )
            if (next) focusAndSelectInput(next)
            else if (draft.lines.length < 500) {
                focusRow.current = index + 1
                onChange({
                    ...draft,
                    lines: [...draft.lines, { lot: '', meters: 0 }],
                })
            } else saveButton.current?.focus()
        }
    }
    function navigate(e: KeyboardEvent<HTMLFormElement>) {
        if (
            e.defaultPrevented ||
            e.key !== 'Enter' ||
            e.nativeEvent.isComposing ||
            e.nativeEvent.keyCode === 229
        )
            return
        if (!(e.target instanceof HTMLInputElement)) return
        if (!e.target.reportValidity()) {
            e.preventDefault()
            return
        }
        handleEnterKeyNavigation(e)
        // Enter in an input always navigates; saving stays an explicit action.
        e.preventDefault()
    }
    function documentField(key: string) {
        return (
            <label
                key={key}
                className={`grid gap-1.5 text-sm ${key.endsWith('_address') ? 'sm:col-span-2' : ''}`}
            >
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {tx(key)}
                    {required.includes(key) ? ' *' : ''}
                </span>
                <Input
                    type={
                        key === 'date' || key === 'payment_due_date'
                            ? 'date'
                            : key === 'external_attachment'
                              ? 'url'
                              : key === 'customer_phone'
                                ? 'tel'
                                : 'text'
                    }
                    className="h-10 rounded-xl border-hairline bg-surface px-3 font-semibold text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                    required={required.includes(key)}
                    maxLength={1000}
                    autoComplete="off"
                    enterKeyHint="next"
                    value={draft.document[key] ?? ''}
                    onChange={(e) =>
                        onChange({
                            ...draft,
                            document: {
                                ...draft.document,
                                [key]: e.target.value,
                            },
                        })
                    }
                />
            </label>
        )
    }
    return (
        <form
            ref={form}
            onKeyDown={navigate}
            onSubmit={(e) => {
                e.preventDefault()
                if (!disabled) onSave(prepareChallanDraft(draft))
            }}
            className="flex min-h-0 flex-1 flex-col"
        >
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <fieldset
                    disabled={disabled}
                    className={`${showPreview ? 'hidden' : 'block'} min-w-0 space-y-6 overflow-y-auto px-1 pb-6 pr-3 lg:block lg:pr-6`}
                >
                    <section data-dispatch-tour="quality" className="space-y-4 rounded-2xl border border-hairline bg-surface p-4 sm:p-5 shadow-xs">
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-loom text-white text-xs font-bold">1</span>
                            <h3 className="font-extrabold text-ink text-sm sm:text-base">
                                {tx('fabricAndRate')}
                            </h3>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {tx('quality')} *
                                </span>
                                <select
                                    required
                                    className="h-10 w-full min-w-0 rounded-xl border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                                    value={draft.quality_id}
                                    onChange={(e) =>
                                        onChange({
                                            ...draft,
                                            quality_id: e.target.value,
                                        })
                                    }
                                >
                                    <option value="">
                                        {tx('chooseQuality')}
                                    </option>
                                    {qualities.map((q) => (
                                        <option key={q.id} value={q.id}>
                                            {q.quality_label} ·{' '}
                                            {format(Number(q.meters))} m{' '}
                                            {tx('available')}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {tx('sellingRate')} *
                                </span>
                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    enterKeyHint="next"
                                    min="0.01"
                                    max="100000000"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    className="h-10 rounded-xl border-hairline bg-surface px-3 font-bold tabular-nums text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                                    value={draft.selling_rate || ''}
                                    onChange={(e) =>
                                        onChange({
                                            ...draft,
                                            selling_rate: Number(
                                                e.target.value,
                                            ),
                                        })
                                    }
                                />
                            </label>
                        </div>
                        <div className="grid gap-3 border-t border-hairline pt-3 sm:grid-cols-2">
                            {documentField('payment_due_date')}
                            {documentField('payment_terms')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {tx('paymentTermsHelp')}
                        </p>
                    </section>
                    <section data-dispatch-tour="parties" className="space-y-4 rounded-2xl border border-hairline bg-surface p-4 sm:p-5 shadow-xs">
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-loom text-white text-xs font-bold">2</span>
                            <h3 className="font-extrabold text-ink text-sm sm:text-base">
                                {tx('senderAndDelivery')}
                            </h3>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {required.map(documentField)}
                        </div>
                    </section>
                    <section data-dispatch-tour="lots" className="space-y-4 rounded-2xl border border-hairline bg-surface p-4 sm:p-5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-loom text-white text-xs font-bold">3</span>
                                <h3 className="font-extrabold text-ink text-sm sm:text-base">{tx('lotEntry')}</h3>
                            </div>
                            <span className="text-xs font-bold text-muted-foreground tabular-nums">
                                {draft.lines.length} rows
                            </span>
                        </div>
                        <div
                            id="challan-keyboard-help"
                            className="text-xs leading-relaxed text-muted-foreground bg-surface-soft p-3 rounded-xl border border-hairline/60"
                        >
                            {tx('keyboardHelp')}
                        </div>
                        <div
                            className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_2.25rem] gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                            aria-hidden="true"
                        >
                            <span className="text-center">{tx('rowNo')}</span>
                            <span>{tx('lot')}</span>
                            <span>{tx('sentMeters')} (m)</span>
                            <span />
                        </div>
                        <div className="space-y-2">
                            {draft.lines.map((line, index) => {
                                const touched = !isEmptyChallanLine(line)
                                return (
                                    <div
                                        key={index}
                                        className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_2.25rem] items-center gap-2"
                                    >
                                        <span className="text-center text-xs font-bold tabular-nums text-muted-foreground">
                                            {index + 1}
                                        </span>
                                        <Input
                                            data-lot-row={index}
                                            aria-label={`${tx('lot')} ${index + 1}`}
                                            aria-describedby="challan-keyboard-help"
                                            autoComplete="off"
                                            enterKeyHint="next"
                                            className="h-10 rounded-xl border-hairline bg-surface px-3 font-mono font-bold text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                                            placeholder={
                                                index === 0
                                                    ? '89895'
                                                    : tx('nextLot')
                                            }
                                            maxLength={80}
                                            required={
                                                touched ||
                                                draft.lines.length === 1
                                            }
                                            value={line.lot}
                                            onKeyDown={(e) =>
                                                rowEnter(e, index, 'lot')
                                            }
                                            onChange={(e) => {
                                                e.target.setCustomValidity('')
                                                updateLine(index, {
                                                    lot: e.target.value,
                                                })
                                            }}
                                        />
                                        <Input
                                            data-meters-row={index}
                                            aria-label={`${tx('sentMeters')} ${index + 1}`}
                                            inputMode="decimal"
                                            enterKeyHint="next"
                                            type="number"
                                            min="0.01"
                                            max="100000000"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="h-10 rounded-xl border-hairline bg-surface px-3 font-bold tabular-nums text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                                            required={
                                                touched ||
                                                draft.lines.length === 1
                                            }
                                            value={line.meters || ''}
                                            onKeyDown={(e) =>
                                                rowEnter(e, index, 'meters')
                                            }
                                            onChange={(e) =>
                                                updateLine(index, {
                                                    meters: Number(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            aria-label={`${tx('remove')} ${index + 1}`}
                                            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-[var(--wv-madder-600)] hover:bg-[var(--wv-madder-50)]"
                                            disabled={draft.lines.length === 1}
                                            onClick={() =>
                                                onChange({
                                                    ...draft,
                                                    lines: draft.lines.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                })
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 px-4 rounded-xl border-hairline font-bold text-ink shadow-xs hover:bg-surface-soft gap-1.5"
                            disabled={draft.lines.length >= 500}
                            onClick={addLine}
                        >
                            <Plus className="h-4 w-4" />
                            {tx('addLine')}
                        </Button>
                        {progress.incomplete > 0 && (
                            <p className="text-xs font-semibold text-[var(--wv-ochre-800)] bg-[var(--wv-ochre-50)] p-2.5 rounded-xl border border-[var(--wv-ochre-200)]">
                                {tx('incompleteRows')}
                            </p>
                        )}
                    </section>
                    <details className="ui-details group rounded-2xl border border-hairline bg-surface p-4 sm:p-5 shadow-xs transition-all">
                        <summary className="cursor-pointer font-bold text-ink flex items-center justify-between select-none">
                            <span className="text-sm font-extrabold uppercase tracking-wider text-ink">
                                4 · {tx('optionalDetails')}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground group-open:rotate-180 transition-transform">
                                ▼
                            </span>
                        </summary>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 border-t border-hairline pt-3">
                            {optional.map(documentField)}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            {tx('taxHelp')}
                        </p>
                    </details>
                </fieldset>
                <aside
                    aria-label={tx('livePreview')}
                    className={`${showPreview ? 'block' : 'hidden'} min-w-0 overflow-y-auto bg-surface-soft/40 p-3 lg:block lg:border-l lg:border-hairline lg:p-6`}
                >
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-loom" />
                        {tx('livePreview')}
                    </p>
                    <div className="space-y-4 rounded-2xl border border-hairline bg-surface p-5 sm:p-6 text-ink shadow-sm">
                        <div className="flex h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                            <i className="block w-[88%] bg-ink" />
                            <i className="block w-[12%] bg-saffron" />
                        </div>
                        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
                            <div className="flex min-w-0 items-center">
                                {/* Embedded data URI, as on the printed copy: it renders offline and identically. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={WEAVLY_LOGO_DATA_URI}
                                    width={LOGO_WIDTH}
                                    height={LOGO_HEIGHT}
                                    alt="Weavly"
                                    className="block flex-none"
                                />
                                <div className="ml-3.5 min-w-0 border-l border-hairline pl-3.5">
                                    <p
                                        data-i18n-skip="true"
                                        className="break-words text-sm font-extrabold leading-tight text-ink"
                                    >
                                        {businessName?.trim() ||
                                            draft.document.sender_name ||
                                            '—'}
                                    </p>
                                    <h3 className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-saffron-deep">
                                        {tx('documentTitle')}
                                    </h3>
                                </div>
                            </div>
                            <div className="text-right text-xs font-medium text-body">
                                <p className="font-mono font-bold text-ink">{number ?? tx('numberOnSave')}</p>
                                <p>{draft.document.date}</p>
                                <span className="mt-0.5 inline-block text-xs font-bold text-[var(--wv-ochre-800)] bg-[var(--wv-ochre-50)] px-2 py-0.5 rounded-md">
                                    {tx('draft')}
                                </span>
                            </div>
                        </header>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {tx('sender_name')}
                                </p>
                                <p className="break-words font-bold text-ink">
                                    {draft.document.sender_name || '—'}
                                </p>
                                <p className="break-words whitespace-pre-wrap text-xs text-body">
                                    {draft.document.sender_address || '—'}
                                </p>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {tx('customer_name')}
                                </p>
                                <p className="break-words font-bold text-ink">
                                    {draft.document.customer_name || '—'}
                                </p>
                                <p className="break-words whitespace-pre-wrap text-xs text-body">
                                    {draft.document.customer_address || '—'}
                                </p>
                            </div>
                        </div>
                        <p className="break-words text-xs text-body">
                            <strong className="text-ink font-semibold">{tx('delivery_address')}:</strong>{' '}
                            {draft.document.delivery_address || '—'}
                        </p>
                        <p className="text-sm">
                            <strong className="text-ink font-semibold">{tx('quality')}:</strong>{' '}
                            <span className="font-bold text-ink">{quality?.quality_label || '—'}</span>
                        </p>
                        <div className="rounded-xl border border-hairline overflow-hidden">
                            <table className="w-full table-fixed border-collapse text-left text-sm">
                                <thead className="bg-surface-soft text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-hairline">
                                    <tr>
                                        <th className="w-10 p-2.5">
                                            {tx('rowNo')}
                                        </th>
                                        <th className="p-2.5">{tx('lot')}</th>
                                        <th className="w-24 p-2.5 text-right">
                                            {tx('sentMeters')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {draft.lines
                                        .filter((line) => !isEmptyChallanLine(line))
                                        .map((line, i) => (
                                            <tr key={i} className="hover:bg-surface-soft/40 transition-colors">
                                                <td className="p-2.5 text-xs text-muted-foreground tabular-nums">
                                                    {i + 1}
                                                </td>
                                                <td className="break-words p-2.5 font-mono text-xs font-semibold text-ink">
                                                    {line.lot || '—'}
                                                </td>
                                                <td className="p-2.5 text-right font-bold text-ink tabular-nums text-xs">
                                                    {line.meters > 0 &&
                                                    Number.isFinite(line.meters)
                                                        ? format(line.meters)
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    {!draft.lines.some(
                                        (line) => !isEmptyChallanLine(line),
                                    ) && (
                                        <tr>
                                            <td
                                                colSpan={3}
                                                className="p-6 text-center text-xs text-muted-foreground"
                                            >
                                                {tx('previewEmpty')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-surface-soft font-bold border-t border-hairline text-ink">
                                        <td colSpan={2} className="p-2.5 text-xs">
                                            {progress.count} {tx('lots')} —{' '}
                                            {tx('totalSent')}
                                        </td>
                                        <td className="p-2.5 text-right tabular-nums text-xs font-black">
                                            {format(progress.meters)} m
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="space-y-1 text-xs">
                            <p className="text-body">
                                <span className="font-semibold text-ink">{tx('sellingRate')}:</span> Rs {format(draft.selling_rate)}{' '}
                                / m
                            </p>
                            <p className="flex justify-between font-extrabold text-sm text-ink pt-1 border-t border-hairline">
                                <span>{tx('fabricValue')}</span>
                                <span className="tabular-nums">Rs {format(progress.value)}</span>
                            </p>
                            <p className="text-2xs text-muted-foreground">
                                {tx('beforeCharges')}
                            </p>
                        </div>
                        <div className="space-y-1 text-xs pt-2 border-t border-hairline text-body">
                            <p>
                                <strong className="text-ink">{tx('payment_due_date')}:</strong>{' '}
                                {draft.document.payment_due_date ||
                                    tx('dueDateNotSet')}
                            </p>
                            {draft.document.payment_terms && (
                                <p className="break-words">
                                    <strong className="text-ink">{tx('payment_terms')}:</strong>{' '}
                                    {draft.document.payment_terms}
                                </p>
                            )}
                            {optional
                                .filter((key) => draft.document[key])
                                .map((key) => (
                                    <p key={key} className="break-words">
                                        <strong className="text-ink">{tx(key)}:</strong>{' '}
                                        {draft.document[key]}
                                    </p>
                                ))}
                        </div>
                        <div className="grid grid-cols-2 gap-5 border-t border-hairline pt-8 text-xs text-muted-foreground">
                            <span>{tx('recipientSignature')}</span>
                            <span>{tx('senderSignature')}</span>
                        </div>
                    </div>
                </aside>
            </div>
            <footer data-dispatch-tour="saveDraft" className="z-10 flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface/95 backdrop-blur-md px-4 py-3.5 shadow-xs">
                <div aria-live="polite" aria-atomic="true" className="min-w-0">
                    <p className="font-extrabold text-ink tabular-nums text-sm sm:text-base">
                        {progress.count} {tx('lots')} — {tx('totalSent')}:{' '}
                        {format(progress.meters)} m
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                        Rs {format(progress.value)} · {tx('beforeCharges')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <SwitchField variant="pill" className="lg:hidden" checked={showPreview} onCheckedChange={setShowPreview}>
                        {tx('livePreview')}
                    </SwitchField>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 min-h-[44px] gap-1.5 rounded-xl border-hairline px-4 font-bold text-ink shadow-xs hover:bg-surface-soft"
                        disabled={disabled || !readiness.ready}
                        aria-describedby={
                            readiness.ready ? undefined : 'challan-print-hint'
                        }
                        onClick={() => onSavePrint(prepareChallanDraft(draft))}
                    >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        {tx('saveAndPrint')}
                    </Button>
                    <Button
                        ref={saveButton}
                        className={`${
                            showPreview ? 'hidden lg:inline-flex' : ''
                        } h-11 px-6 rounded-xl bg-loom text-white font-bold hover:bg-loom-elevated shadow-xs`}
                        type="submit"
                        disabled={disabled}
                    >
                        {tx('saveDraft')}
                    </Button>
                </div>
                {!readiness.ready && (
                    <p
                        id="challan-print-hint"
                        className="w-full text-xs font-semibold text-muted-foreground"
                    >
                        {t('challan.printNeeds', {
                            items: readiness.missing.map(tx).join(', '),
                        })}
                    </p>
                )}
                {error && (
                    <p role="alert" className="w-full text-xs font-semibold text-[var(--wv-madder-600)] bg-[var(--wv-madder-50)] p-3 rounded-xl border border-[var(--wv-madder-200)]">
                        {error}
                    </p>
                )}
            </footer>
        </form>
    )
}
