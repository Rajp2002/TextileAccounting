'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n/context'
import {
    challanTotals,
    paymentStatus,
    safeEvidenceUrl,
    type Challan,
    type ChallanDraft,
    type ChallanEvent,
    type ChallanMutation,
} from '@/lib/delivery-challans'
import type { StockQuality } from '@/lib/quality-stock'
import { getChallan, listChallans, mutateChallan } from './challan-actions'
const documentFields = [
    'date',
    'sender_name',
    'sender_address',
    'sender_gstin',
    'customer_name',
    'customer_address',
    'customer_phone',
    'customer_gstin',
    'delivery_address',
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
const requiredFields = [
    'date',
    'sender_name',
    'sender_address',
    'customer_name',
    'customer_address',
    'delivery_address',
]
const blank = (): ChallanDraft => ({
    quality_id: '',
    selling_rate: 0,
    document: { date: new Date().toLocaleDateString('en-CA') },
    lines: [{ lot: '', meters: 0 }],
})
export default function ChallansClient({
    initialData,
    qualities,
}: {
    initialData: Challan[]
    qualities: StockQuality[]
}) {
    const { t } = useTranslation()
    const tx = (s: string) => t(`challan.${s}`)
    const [rows, setRows] = useState(initialData),
        [history, setHistory] = useState(false),
        [search, setSearch] = useState(''),
        [busy, setBusy] = useState(false),
        [error, setError] = useState('')
    const [selected, setSelected] = useState<Challan | null>(null),
        [events, setEvents] = useState<ChallanEvent[]>([]),
        [draft, setDraft] = useState<ChallanDraft | null>(null)
    const [operation, setOperation] = useState<
            ChallanMutation['action'] | null
        >(null),
        [fields, setFields] = useState<Record<string, string>>({}),
        [pending, setPending] = useState<ChallanMutation | null>(null)
    const lock = useRef(false),
        draftId = useRef('')
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem('weavly-challan-pending')
            if (stored) setPending(JSON.parse(stored))
        } catch {
            /* Storage may be unavailable. */
        }
    }, [])
    function remember(req: ChallanMutation | null) {
        setPending(req)
        try {
            if (req)
                sessionStorage.setItem(
                    'weavly-challan-pending',
                    JSON.stringify(req),
                )
            else sessionStorage.removeItem('weavly-challan-pending')
        } catch {
            /* Keep in-memory retry protection. */
        }
    }
    const money = (n: number) =>
        Number(n).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    async function load(h = history, more = false) {
        setBusy(true)
        try {
            const result = await listChallans(h, search, more ? rows.length : 0)
            if (result.error) setError(result.error)
            else {
                setRows((old) =>
                    more ? [...old, ...result.data!] : result.data!,
                )
                setHistory(h)
            }
        } catch {
            setError(tx('loadError'))
        } finally {
            setBusy(false)
        }
    }
    async function view(id: string) {
        setBusy(true)
        try {
            const r = await getChallan(id)
            if (r.error) setError(r.error)
            else {
                setSelected(r.data!)
                setEvents(r.events!)
                setDraft(null)
            }
        } catch {
            setError(tx('loadError'))
        } finally {
            setBusy(false)
        }
    }
    async function save(
        action: ChallanMutation['action'],
        payload: Record<string, unknown>,
    ) {
        if (lock.current) return
        lock.current = true
        setBusy(true)
        setError('')
        const req = pending ?? {
            id: selected?.id ?? draftId.current,
            requestId: crypto.randomUUID(),
            version: selected?.version ?? 0,
            action,
            payload,
        }
        remember(req)
        try {
            const result = await mutateChallan(req)
            if ('error' in result) {
                setError(result.error!)
                if (!result.uncertain) remember(null)
                return
            }
            remember(null)
            setDraft(null)
            setOperation(null)
            await view(result.id)
            await load()
        } catch {
            setError(tx('retry'))
        } finally {
            lock.current = false
            setBusy(false)
        }
    }
    function start(action: ChallanMutation['action']) {
        setOperation(action)
        setFields(
            action === 'receipt'
                ? { meters: String(selected?.sent_meters ?? '') }
                : action === 'resolve'
                  ? { decision: 'accepted' }
                  : ['payment', 'refund'].includes(action)
                    ? {
                          date: new Date().toLocaleDateString('en-CA'),
                          method: 'bank',
                      }
                    : {},
        )
        setError('')
    }
    const totals = draft ? challanTotals(draft.lines, draft.selling_rate) : null
    const field = (key: string, type = 'text', required = false) => (
        <label key={key} className="grid gap-1 text-sm">
            {tx(key === 'evidence' ? 'evidenceLink' : key)}
            {required ? ' *' : ''}
            <Input
                type={type}
                step={type === 'number' ? '0.01' : undefined}
                required={required}
                maxLength={1000}
                value={fields[key] ?? ''}
                onChange={(e) =>
                    setFields({ ...fields, [key]: e.target.value })
                }
            />
        </label>
    )
    return (
        <div data-i18n-skip="true" className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
            <div className="flex flex-wrap justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{tx('title')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {tx('intro')}
                    </p>
                </div>
                <Button
                    disabled={busy || !!pending}
                    onClick={() => {
                        setSelected(null)
                        setDraft(blank())
                        draftId.current = crypto.randomUUID()
                        setError('')
                    }}
                >
                    {tx('new')}
                </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant={history ? 'outline' : 'default'}
                    onClick={() => load(false)}
                    disabled={busy}
                >
                    {tx('active')}
                </Button>
                <Button
                    variant={history ? 'default' : 'outline'}
                    onClick={() => load(true)}
                    disabled={busy}
                >
                    {tx('history')}
                </Button>
                <Input
                    className="max-w-xs"
                    aria-label={tx('search')}
                    placeholder={tx('search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <Button
                    variant="outline"
                    onClick={() => load()}
                    disabled={busy}
                >
                    {tx('searchButton')}
                </Button>
                <Link
                    className="text-sm underline"
                    href="/owner/dispatches/legacy"
                >
                    {tx('legacy')}
                </Link>
            </div>
            {error && (
                <p
                    role="alert"
                    className="rounded border border-red-300 p-3 text-red-700"
                >
                    {error}
                </p>
            )}
            {pending && !busy && (
                <Button onClick={() => save(pending.action, pending.payload)}>
                    {tx('retryButton')}
                </Button>
            )}
            <div className="grid gap-3">
                {rows.map((d) => (
                    <button
                        key={d.id}
                        className="flex flex-wrap justify-between gap-3 rounded-xl border bg-card p-4 text-left hover:bg-muted"
                        onClick={() => view(d.id)}
                        disabled={busy || !!pending}
                    >
                        <div>
                            <strong>
                                {d.number} · {d.document.customer_name}
                            </strong>
                            <p>
                                {d.quality_label} · {d.sent_meters} m ·{' '}
                                {d.document.date}
                            </p>
                        </div>
                        <div>
                            <p>
                                {tx(d.delivery_status)} · {tx(paymentStatus(d))}
                            </p>
                            <p>
                                {Number(d.balance) < 0
                                    ? tx('credit')
                                    : tx('balance')}
                                : Rs {money(Math.abs(d.balance))}
                            </p>
                            {['review', 'disputed'].includes(
                                d.difference_status,
                            ) && (
                                <p className="text-amber-700">
                                    {tx(d.difference_status)}
                                </p>
                            )}
                        </div>
                    </button>
                ))}
            </div>
            {!rows.length && (
                <p className="rounded-xl border p-10 text-center text-muted-foreground">
                    {tx('empty')}
                </p>
            )}
            {rows.length > 0 && rows.length % 50 === 0 && (
                <Button onClick={() => load(history, true)} disabled={busy}>
                    {tx('more')}
                </Button>
            )}
            <Dialog
                open={!!draft}
                onOpenChange={(open) => {
                    if (!open && !busy && !pending) setDraft(null)
                }}
            >
                <DialogContent data-i18n-skip="true" className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{tx('draftTitle')}</DialogTitle>
                        <DialogDescription>{tx('draftHelp')}</DialogDescription>
                    </DialogHeader>
                    {draft && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                save('save', draft)
                            }}
                            className="space-y-4"
                        >
                            <fieldset
                                disabled={busy || !!pending}
                                className="space-y-4"
                            >
                                <label className="grid gap-1">
                                    {tx('quality')} *
                                    <select
                                        required
                                        className="h-10 rounded border bg-background px-3"
                                        value={draft.quality_id}
                                        onChange={(e) =>
                                            setDraft({
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
                                                {q.quality_label} · {q.meters} m{' '}
                                                {tx('available')}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="grid gap-1">
                                    {tx('sellingRate')} *
                                    <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        required
                                        value={draft.selling_rate || ''}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                selling_rate: Number(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                    />
                                </label>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {documentFields.map((key) => (
                                        <label
                                            key={key}
                                            className="grid gap-1 text-sm"
                                        >
                                            {tx(key)}
                                            {requiredFields.includes(key)
                                                ? ' *'
                                                : ''}
                                            <Input
                                                type={
                                                    key === 'date'
                                                        ? 'date'
                                                        : key ===
                                                            'external_attachment'
                                                          ? 'url'
                                                          : 'text'
                                                }
                                                required={requiredFields.includes(
                                                    key,
                                                )}
                                                maxLength={1000}
                                                autoComplete="off"
                                                value={
                                                    draft.document[key] ?? ''
                                                }
                                                onChange={(e) =>
                                                    setDraft({
                                                        ...draft,
                                                        document: {
                                                            ...draft.document,
                                                            [key]: e.target
                                                                .value,
                                                        },
                                                    })
                                                }
                                            />
                                        </label>
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {tx('taxHelp')}
                                </p>
                                <div className="space-y-2">
                                    {draft.lines.map((line, i) => (
                                        <div key={i} className="flex gap-2">
                                            <Input
                                                aria-label={`${tx('lot')} ${i + 1}`}
                                                placeholder={tx('lot')}
                                                required
                                                maxLength={80}
                                                value={line.lot}
                                                onChange={(e) =>
                                                    setDraft({
                                                        ...draft,
                                                        lines: draft.lines.map(
                                                            (l, j) =>
                                                                j === i
                                                                    ? {
                                                                          ...l,
                                                                          lot: e
                                                                              .target
                                                                              .value,
                                                                      }
                                                                    : l,
                                                        ),
                                                    })
                                                }
                                            />
                                            <Input
                                                aria-label={`${tx('meters')} ${i + 1}`}
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                required
                                                value={line.meters || ''}
                                                onChange={(e) =>
                                                    setDraft({
                                                        ...draft,
                                                        lines: draft.lines.map(
                                                            (l, j) =>
                                                                j === i
                                                                    ? {
                                                                          ...l,
                                                                          meters: Number(
                                                                              e
                                                                                  .target
                                                                                  .value,
                                                                          ),
                                                                      }
                                                                    : l,
                                                        ),
                                                    })
                                                }
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                aria-label={tx('remove')}
                                                disabled={
                                                    draft.lines.length === 1
                                                }
                                                onClick={() =>
                                                    setDraft({
                                                        ...draft,
                                                        lines: draft.lines.filter(
                                                            (_, j) => j !== i,
                                                        ),
                                                    })
                                                }
                                            >
                                                ×
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={draft.lines.length >= 500}
                                    onClick={() =>
                                        setDraft({
                                            ...draft,
                                            lines: [
                                                ...draft.lines,
                                                { lot: '', meters: 0 },
                                            ],
                                        })
                                    }
                                >
                                    {tx('addLine')}
                                </Button>
                                <p className="font-semibold">
                                    {totals?.count} {tx('lots')} ·{' '}
                                    {totals?.meters} m · Rs{' '}
                                    {money(totals?.value ?? 0)}
                                </p>
                                <Button type="submit">{tx('saveDraft')}</Button>
                            </fieldset>
                            {error && (
                                <p role="alert" className="text-red-700">
                                    {error}
                                </p>
                            )}
                            {pending && !busy && (
                                <Button
                                    type="button"
                                    onClick={() =>
                                        save(pending.action, pending.payload)
                                    }
                                >
                                    {tx('retryButton')}
                                </Button>
                            )}
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            {selected && !draft && (
                <section className="space-y-4 rounded-xl border bg-card p-5">
                    <div className="flex flex-wrap justify-between gap-2">
                        <Button
                            variant="outline"
                            disabled={busy || !!pending}
                            onClick={() => view(selected.id)}
                        >
                            {tx('refresh')}
                        </Button>
                        <h2 className="text-xl font-semibold">
                            {selected.number} ·{' '}
                            {selected.document.customer_name}
                        </h2>
                        <Link
                            className="underline"
                            target="_blank"
                            href={`/owner/dispatches/${selected.id}/print`}
                        >
                            {tx('print')}
                        </Link>
                    </div>
                    <p>
                        {selected.quality_label} · {tx('sentMeters')}:{' '}
                        {selected.sent_meters} m · {tx('acknowledged')}:{' '}
                        {selected.acknowledged_meters ?? '—'} m ·{' '}
                        {tx('chargeable')}: {selected.chargeable_meters} m
                        {selected.acknowledged_meters !== null && <> · {tx('differenceMeters')}: {(Number(selected.sent_meters)-Number(selected.acknowledged_meters)).toFixed(2)} m</>}
                    </p>
                    <p>
                        {tx('sellingRate')}: Rs {money(selected.selling_rate)} ·{' '}
                        {tx('adjustments')}: Rs{' '}
                        {money(selected.adjustment_amount)} · {tx('paid')}: Rs{' '}
                        {money(selected.paid_amount)} ·{' '}
                        {Number(selected.balance) < 0
                            ? tx('credit')
                            : tx('balance')}
                        : Rs {money(Math.abs(selected.balance))}
                    </p>
                    <p>
                        {tx(selected.delivery_status)} ·{' '}
                        {tx(selected.difference_status)} ·{' '}
                        {tx(paymentStatus(selected))}
                        {selected.archived_at ? ` · ${tx('archived')}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {selected.delivery_status === 'draft' ? (
                            <>
                                <Button
                                    disabled={busy || !!pending}
                                    onClick={() =>
                                        setDraft({
                                            quality_id: selected.quality_id,
                                            selling_rate: selected.selling_rate,
                                            document: selected.document,
                                            lines: selected.lines,
                                        })
                                    }
                                >
                                    {tx('edit')}
                                </Button>
                                <Button
                                    disabled={busy || !!pending}
                                    onClick={() => start('confirm')}
                                >
                                    {tx('confirm')}
                                </Button>
                            </>
                        ) : (
                            selected.delivery_status !== 'reversed' && (
                                <>
                                    {selected.delivery_status === 'sent' && (
                                        <Button
                                            disabled={busy || !!pending}
                                            onClick={() =>
                                                save('receipt', {
                                                    meters: selected.sent_meters,
                                                })
                                            }
                                        >
                                            {tx('receivedAsSent')}
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        disabled={busy || !!pending}
                                        onClick={() => start('receipt')}
                                    >
                                        {tx('receipt')}
                                    </Button>
                                    {selected.acknowledged_meters !== null &&
                                        Number(selected.acknowledged_meters) !==
                                            Number(selected.sent_meters) && (
                                            <Button
                                                variant="outline"
                                                disabled={busy || !!pending}
                                                onClick={() => start('resolve')}
                                            >
                                                {tx('resolve')}
                                            </Button>
                                        )}
                                    {(
                                        [
                                            'payment',
                                            'adjustment',
                                            ...(Number(selected.balance) < 0
                                                ? ['refund']
                                                : []),
                                        ] as ChallanMutation['action'][]
                                    ).map((a) => (
                                        <Button
                                            key={a}
                                            variant="outline"
                                            disabled={busy || !!pending}
                                            onClick={() => start(a)}
                                        >
                                            {tx(a)}
                                        </Button>
                                    ))}
                                    {selected.delivery_status === 'sent' &&
                                        !events.some((e) =>
                                            [
                                                'payment',
                                                'refund',
                                                'adjustment',
                                            ].includes(e.action),
                                        ) && (
                                            <Button
                                                variant="outline"
                                                disabled={busy || !!pending}
                                                onClick={() =>
                                                    start('reverse_dispatch')
                                                }
                                            >
                                                {tx('reverse_dispatch')}
                                            </Button>
                                        )}
                                </>
                            )
                        )}
                    </div>
                    <details>
                        <summary className="cursor-pointer font-medium">
                            {tx('details')}
                        </summary>
                        <dl className="grid gap-2 pt-3 sm:grid-cols-2">
                            {Object.entries(selected.document)
                                .filter(([, v]) => v)
                                .map(([k, v]) => (
                                    <div key={k}>
                                        <dt className="text-sm text-muted-foreground">
                                            {tx(k)}
                                        </dt>
                                        <dd className="break-words">
                                            {k === 'external_attachment' &&
                                            safeEvidenceUrl(v) ? (
                                                <a
                                                    className="underline"
                                                    href={safeEvidenceUrl(v)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {tx('evidence')}
                                                </a>
                                            ) : (
                                                v
                                            )}
                                        </dd>
                                    </div>
                                ))}
                        </dl>
                        <p className="mt-3">
                            {selected.lines
                                .map((l) => `${l.lot}: ${l.meters} m`)
                                .join(' · ')}
                        </p>
                    </details>
                    <details open>
                        <summary className="cursor-pointer font-medium">
                            {tx('audit')}
                        </summary>
                        <ol className="mt-3 space-y-3">
                            {events.map((e) => (
                                <li
                                    key={e.id}
                                    className="border-t pt-3 text-sm"
                                >
                                    <div className="flex flex-wrap justify-between gap-2">
                                        <span>
                                            {tx(e.action)} ·{' '}
                                            {new Date(
                                                e.created_at,
                                            ).toLocaleString()}
                                            {e.amount !== null
                                                ? ` · Rs ${money(e.amount)}`
                                                : ''}
                                        </span>
                                        {[
                                            'payment',
                                            'refund',
                                            'adjustment',
                                        ].includes(e.action) &&
                                            !events.some(
                                                (r) => r.reverses_id === e.id,
                                            ) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy || !!pending}
                                                    onClick={() => {
                                                        start('reverse_entry')
                                                        setFields({
                                                            event_id: e.id,
                                                        })
                                                    }}
                                                >
                                                    {tx('reverse_entry')}
                                                </Button>
                                            )}
                                    </div>
                                    {e.action === 'receipt' && (
                                        <p>
                                            {tx('acknowledged')}:{' '}
                                            {String(e.payload.data.meters)} m
                                        </p>
                                    )}
                                    {e.action === 'resolve' && (
                                        <p>
                                            {tx(
                                                String(e.payload.data.decision),
                                            )}
                                        </p>
                                    )}
                                    <p>
                                        {String(e.payload.data.reason ?? '')}{' '}
                                        {String(e.payload.data.date ?? '')}{' '}
                                        {String(e.payload.data.method ?? '')}
                                    </p>
                                    {typeof e.payload.data.evidence ===
                                        'string' &&
                                        safeEvidenceUrl(
                                            e.payload.data.evidence,
                                        ) && (
                                            <a
                                                className="underline"
                                                href={
                                                    safeEvidenceUrl(
                                                        e.payload.data.evidence,
                                                    )!
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {tx('evidence')}
                                            </a>
                                        )}
                                    {e.reverses_id && (
                                        <p>
                                            {tx('reverses')}: {e.reverses_id}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </details>
                </section>
            )}
            <Dialog
                open={!!operation}
                onOpenChange={(open) => {
                    if (!open && !busy && !pending) setOperation(null)
                }}
            >
                <DialogContent data-i18n-skip="true">
                    <DialogHeader>
                        <DialogTitle>
                            {operation ? tx(operation) : ''}
                        </DialogTitle>
                        <DialogDescription>
                            {operation === 'confirm'
                                ? tx('confirmHelp')
                                : operation === 'reverse_dispatch'
                                  ? tx('reverseHelp')
                                  : tx('operationHelp')}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault()
                            if (!operation) return
                            const payload: Record<string, unknown> = {
                                ...fields,
                            }
                            if (
                                ['payment', 'refund', 'adjustment'].includes(
                                    operation,
                                )
                            )
                                payload.amount = Number(fields.amount)
                            if (operation === 'receipt')
                                payload.meters = Number(fields.meters)
                            if (operation === 'reverse_dispatch')
                                payload.stock_present =
                                    fields.stock_present === 'true'
                            save(operation, payload)
                        }}
                    >
                        <fieldset
                            disabled={busy || !!pending}
                            className="space-y-3"
                        >
                            {operation === 'receipt' && (
                                <>
                                    {field('meters', 'number', true)}
                                    {field('evidence', 'url')}
                                </>
                            )}
                            {operation === 'resolve' && (
                                <label className="grid gap-1">
                                    {tx('decision')}
                                    <select
                                        className="rounded border bg-background p-2"
                                        value={fields.decision}
                                        onChange={(e) =>
                                            setFields({
                                                ...fields,
                                                decision: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="accepted">
                                            {tx('accepted')}
                                        </option>
                                        <option value="disputed">
                                            {tx('disputed')}
                                        </option>
                                    </select>
                                </label>
                            )}
                            {operation &&
                                ['payment', 'refund', 'adjustment'].includes(
                                    operation,
                                ) &&
                                field('amount', 'number', true)}
                            {operation &&
                                ['payment', 'refund'].includes(operation) && (
                                    <>
                                        {field('date', 'date', true)}
                                        {field('method', 'text', true)}
                                    </>
                                )}
                            {operation !== 'confirm' &&
                                field(
                                    'reason',
                                    'text',
                                    operation !== 'receipt' ||
                                        selected?.delivery_status ===
                                            'received',
                                )}
                            {operation === 'reverse_dispatch' && (
                                <label className="flex gap-2">
                                    <input
                                        type="checkbox"
                                        required
                                        checked={
                                            fields.stock_present === 'true'
                                        }
                                        onChange={(e) =>
                                            setFields({
                                                ...fields,
                                                stock_present: String(
                                                    e.target.checked,
                                                ),
                                            })
                                        }
                                    />
                                    {tx('stockPresent')}
                                </label>
                            )}
                            <Button type="submit">{tx('save')}</Button>
                        </fieldset>
                        {error && (
                            <p role="alert" className="text-red-700">
                                {error}
                            </p>
                        )}
                        {pending && !busy && (
                            <Button
                                type="button"
                                onClick={() =>
                                    save(pending.action, pending.payload)
                                }
                            >
                                {tx('retryButton')}
                            </Button>
                        )}
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
