'use client'

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import {
    focusAndSelectInput,
    handleEnterKeyNavigation,
} from '@/lib/form-navigation'
import {
    challanDraftProgress,
    isEmptyChallanLine,
    prepareChallanDraft,
} from '@/lib/challan-draft-entry'
import { type ChallanDraft } from '@/lib/delivery-challans'
import type { StockQuality } from '@/lib/quality-stock'

const required = [
    'date',
    'sender_name',
    'sender_address',
    'customer_name',
    'customer_address',
    'delivery_address',
]
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
    qualities,
    number,
    disabled,
    error,
}: {
    draft: ChallanDraft
    onChange: (draft: ChallanDraft) => void
    onSave: (draft: ChallanDraft) => void
    qualities: StockQuality[]
    number?: string
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
                <span className="font-medium">
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
                    <section className="space-y-3 rounded-xl border bg-card p-4">
                        <h3 className="font-semibold">
                            1 · {tx('fabricAndRate')}
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="font-medium">
                                    {tx('quality')} *
                                </span>
                                <select
                                    required
                                    className="h-10 w-full min-w-0 rounded-md border bg-background px-3"
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
                                <span className="font-medium">
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
                        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                            {documentField('payment_due_date')}
                            {documentField('payment_terms')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {tx('paymentTermsHelp')}
                        </p>
                    </section>
                    <section className="space-y-3 rounded-xl border bg-card p-4">
                        <h3 className="font-semibold">
                            2 · {tx('senderAndDelivery')}
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {required.map(documentField)}
                        </div>
                    </section>
                    <section className="space-y-3 rounded-xl border bg-card p-4">
                        <h3 className="font-semibold">3 · {tx('lotEntry')}</h3>
                        <p
                            id="challan-keyboard-help"
                            className="text-xs leading-relaxed text-muted-foreground"
                        >
                            {tx('keyboardHelp')}
                        </p>
                        <div
                            className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_2.25rem] gap-2 text-xs font-semibold text-muted-foreground"
                            aria-hidden="true"
                        >
                            <span>{tx('rowNo')}</span>
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
                                        className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.8fr)_2.25rem] items-start gap-2"
                                    >
                                        <span className="pt-2.5 text-center text-sm tabular-nums text-muted-foreground">
                                            {index + 1}
                                        </span>
                                        <Input
                                            data-lot-row={index}
                                            aria-label={`${tx('lot')} ${index + 1}`}
                                            aria-describedby="challan-keyboard-help"
                                            autoComplete="off"
                                            enterKeyHint="next"
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
                                            ×
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={draft.lines.length >= 500}
                            onClick={addLine}
                        >
                            {tx('addLine')}
                        </Button>
                        {progress.incomplete > 0 && (
                            <p className="text-xs text-amber-700">
                                {tx('incompleteRows')}
                            </p>
                        )}
                    </section>
                    <details className="rounded-xl border bg-card p-4">
                        <summary className="cursor-pointer font-medium">
                            {tx('optionalDetails')}
                        </summary>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {optional.map(documentField)}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            {tx('taxHelp')}
                        </p>
                    </details>
                </fieldset>
                <aside
                    aria-label={tx('livePreview')}
                    className={`${showPreview ? 'block' : 'hidden'} min-w-0 overflow-y-auto bg-muted/30 p-3 lg:block lg:border-l lg:p-5`}
                >
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tx('livePreview')}
                    </p>
                    <div className="space-y-4 rounded-lg border bg-white p-5 text-slate-900 shadow-sm">
                        <header className="flex flex-wrap justify-between gap-2 border-b pb-3">
                            <div>
                                <h3 className="text-lg font-bold">
                                    {tx('title')}
                                </h3>
                                <span className="text-xs text-amber-700">
                                    {tx('draft')}
                                </span>
                            </div>
                            <div className="text-right text-xs">
                                <p>{number ?? tx('numberOnSave')}</p>
                                <p>{draft.document.date}</p>
                            </div>
                        </header>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-xs text-slate-500">
                                    {tx('sender_name')}
                                </p>
                                <p className="break-words font-medium">
                                    {draft.document.sender_name || '—'}
                                </p>
                                <p className="break-words whitespace-pre-wrap">
                                    {draft.document.sender_address || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">
                                    {tx('customer_name')}
                                </p>
                                <p className="break-words font-medium">
                                    {draft.document.customer_name || '—'}
                                </p>
                                <p className="break-words whitespace-pre-wrap">
                                    {draft.document.customer_address || '—'}
                                </p>
                            </div>
                        </div>
                        <p className="break-words text-xs">
                            <strong>{tx('delivery_address')}:</strong>{' '}
                            {draft.document.delivery_address || '—'}
                        </p>
                        <p className="text-sm">
                            <strong>{tx('quality')}:</strong>{' '}
                            {quality?.quality_label || '—'}
                        </p>
                        <table className="w-full table-fixed border-collapse text-left text-sm">
                            <thead className="bg-slate-50 text-xs">
                                <tr>
                                    <th className="w-10 border p-2">
                                        {tx('rowNo')}
                                    </th>
                                    <th className="border p-2">{tx('lot')}</th>
                                    <th className="w-24 border p-2 text-right">
                                        {tx('sentMeters')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {draft.lines
                                    .filter((line) => !isEmptyChallanLine(line))
                                    .map((line, i) => (
                                        <tr key={i}>
                                            <td className="border p-2">
                                                {i + 1}
                                            </td>
                                            <td className="break-words border p-2">
                                                {line.lot || '—'}
                                            </td>
                                            <td className="border p-2 text-right tabular-nums">
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
                                            className="border p-6 text-center text-xs text-slate-500"
                                        >
                                            {tx('previewEmpty')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-semibold">
                                    <td colSpan={2} className="border p-2">
                                        {progress.count} {tx('lots')} —{' '}
                                        {tx('totalSent')}
                                    </td>
                                    <td className="border p-2 text-right tabular-nums">
                                        {format(progress.meters)} m
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        <p className="text-xs">
                            {tx('sellingRate')}: Rs {format(draft.selling_rate)}{' '}
                            / m
                        </p>
                        <p className="flex justify-between font-semibold">
                            <span>{tx('fabricValue')}</span>
                            <span>Rs {format(progress.value)}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                            {tx('beforeCharges')}
                        </p>
                        <p className="text-xs">
                            <strong>{tx('payment_due_date')}:</strong>{' '}
                            {draft.document.payment_due_date ||
                                tx('dueDateNotSet')}
                        </p>
                        {draft.document.payment_terms && (
                            <p className="break-words text-xs">
                                <strong>{tx('payment_terms')}:</strong>{' '}
                                {draft.document.payment_terms}
                            </p>
                        )}
                        {optional
                            .filter((key) => draft.document[key])
                            .map((key) => (
                                <p key={key} className="break-words text-xs">
                                    <strong>{tx(key)}:</strong>{' '}
                                    {draft.document[key]}
                                </p>
                            ))}
                        <div className="grid grid-cols-2 gap-5 border-t pt-8 text-xs text-slate-500">
                            <span>{tx('recipientSignature')}</span>
                            <span>{tx('senderSignature')}</span>
                        </div>
                    </div>
                </aside>
            </div>
            <footer className="z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background py-3">
                <div aria-live="polite" aria-atomic="true" className="min-w-0">
                    <p className="font-semibold tabular-nums">
                        {progress.count} {tx('lots')} — {tx('totalSent')}:{' '}
                        {format(progress.meters)} m
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Rs {format(progress.value)} · {tx('beforeCharges')}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="lg:hidden"
                    aria-pressed={showPreview}
                    onClick={() => setShowPreview(!showPreview)}
                >
                    {tx(showPreview ? 'backToEntry' : 'livePreview')}
                </Button>
                <Button
                    ref={saveButton}
                    className={
                        showPreview ? 'hidden lg:inline-flex' : undefined
                    }
                    type="submit"
                    disabled={disabled}
                >
                    {tx('saveDraft')}
                </Button>
                {error && (
                    <p role="alert" className="w-full text-sm text-red-700">
                        {error}
                    </p>
                )}
            </footer>
        </form>
    )
}
