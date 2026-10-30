'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PaidPlansAdmin } from '@/lib/admin/paid-plans'

const DAY = 86_400_000
const date = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value))
const plusMonths = (months: number) => { const next = new Date(); next.setMonth(next.getMonth() + months); return next.toISOString() }
const button = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:opacity-60'
const primary = `${button} bg-ink text-surface`
const secondary = `${button} border border-hairline bg-surface text-ink`

type Preview = { total: number; alreadyEnded: number; newEnd: string }

async function post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const json = await response.json().catch(() => null) as (T & { message?: string }) | null
    if (!response.ok) throw new Error(json?.message ?? 'Nothing changed. Try again.')
    return json as T
}

/** Paid plans before go-live: extend trials, and go live once the company is set up (spec 2026-10-30 C2). */
export function PaidPlansCard({ summary }: { summary: PaidPlansAdmin }) {
    const router = useRouter()
    const [preview, setPreview] = useState<Preview | null>(null)
    const [customDate, setCustomDate] = useState('')
    const [confirmGoLive, setConfirmGoLive] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function run<T>(work: () => Promise<T>, done: (result: T) => void) {
        setBusy(true); setError(null); setMessage(null)
        try { done(await work()) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Nothing changed. Try again.') } finally { setBusy(false) }
    }
    const previewExtension = (newEnd: string) => run(() => post<Preview>('/api/admin/paid-plans/extend', { newEnd, dryRun: true }), setPreview)
    const confirmExtension = () => preview && run(() => post<Preview>('/api/admin/paid-plans/extend', { newEnd: preview.newEnd, dryRun: false }), result => {
        setPreview(null); setMessage(`Done. ${result.total} trials now end on ${date(result.newEnd)}.`); router.refresh()
    })
    const goLive = () => run(() => post<{ goLiveAt: string; movedTrials: number }>('/api/admin/paid-plans/go-live', {}), result => {
        setConfirmGoLive(false); setMessage(`Paid plans are live. ${result.movedTrials} trials moved to ${date(new Date(Date.parse(result.goLiveAt) + 30 * DAY).toISOString())}.`); router.refresh()
    })

    if (summary.goLiveAt) {
        return <div className="rounded-xl border border-hairline bg-surface p-5"><h2 className="font-semibold">Paid plans</h2><p className="mt-1 text-sm text-body">Live since {date(summary.goLiveAt)}. Customers pay when their trial or plan ends.</p></div>
    }
    const ready = summary.readiness.mode === 'live'
    const thirtyDays = date(new Date(Date.now() + 30 * DAY).toISOString())
    return <div className="space-y-6 rounded-xl border border-hairline bg-surface p-5">
        <div><h2 className="font-semibold">Paid plans</h2><p className="mt-1 text-sm text-body">Not live yet. Customers see &ldquo;Notify me&rdquo; instead of paying.</p></div>

        <section className="space-y-3 border-t border-hairline pt-5">
            <h3 className="text-sm font-semibold">Extend trials</h3>
            <p className="text-sm text-body">{summary.endingIn14Days} unpaid trials end in the next 14 days · {summary.alreadyEnded} already ended and dropped to Free.</p>
            {!preview && <div className="flex flex-wrap items-end gap-2">
                {[1, 2, 3].map(months => <button key={months} type="button" disabled={busy} className={secondary} onClick={() => previewExtension(plusMonths(months))}>+{months} {months === 1 ? 'month' : 'months'}</button>)}
                <label className="text-sm text-body">Or a date
                    <input type="date" value={customDate} onChange={event => setCustomDate(event.currentTarget.value)} className="mt-1 block min-h-11 rounded-lg border border-hairline bg-surface px-3 text-ink"/>
                </label>
                <button type="button" disabled={busy || !customDate} className={secondary} onClick={() => previewExtension(`${customDate}T23:59:00+05:30`)}>Check</button>
            </div>}
            {preview && <div className="space-y-3 rounded-lg border border-hairline p-4">
                <p className="text-sm text-ink">This moves {preview.total} trials to end on {date(preview.newEnd)}{preview.alreadyEnded > 0 ? ` (${preview.alreadyEnded} of them had already ended and get Lite back)` : ''}.</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy || preview.total === 0} className={primary} onClick={confirmExtension}>Confirm</button>
                    <button type="button" disabled={busy} className={secondary} onClick={() => setPreview(null)}>Cancel</button>
                </div>
            </div>}
        </section>

        <section className="space-y-3 border-t border-hairline pt-5">
            <h3 className="text-sm font-semibold">Go live</h3>
            {summary.readiness.missing.length === 0
                ? <p className="text-sm text-body">All set: live Razorpay keys and company details are configured.</p>
                : <><p className="text-sm text-body">Still needed before real payments can open:</p><ul className="list-disc space-y-1 pl-5 text-sm text-body">{summary.readiness.missing.map(item => <li key={item}>{item[0].toUpperCase()}{item.slice(1)}</li>)}</ul></>}
            {!confirmGoLive && <button type="button" disabled={!ready || busy} className={primary} onClick={() => setConfirmGoLive(true)}>Go live</button>}
            {confirmGoLive && <div className="space-y-3 rounded-lg border border-hairline p-4">
                <p className="text-sm text-ink">Real payments open now. {summary.endingIn30Days} unpaid trials ending in the next 30 days move to {thirtyDays}. This can&rsquo;t be undone here.</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} className={primary} onClick={goLive}>Confirm go live</button>
                    <button type="button" disabled={busy} className={secondary} onClick={() => setConfirmGoLive(false)}>Cancel</button>
                </div>
            </div>}
        </section>

        {message && <p role="status" className="text-sm font-medium text-ink">{message}</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
}
