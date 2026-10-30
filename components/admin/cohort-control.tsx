'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Cohort = 'production' | 'test' | 'demo' | 'internal' | 'unclassified'
const OPTIONS = [['test', 'Test'], ['demo', 'Demo'], ['internal', 'Internal']] as const

/** Mark a factory as a test, demo or internal account, or count it as a customer again. */
export function CohortControl({ orgId, cohort }: { orgId: string; cohort: Cohort }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [choice, setChoice] = useState<'test' | 'demo' | 'internal'>('test')
    const [reason, setReason] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const counted = cohort === 'production' || cohort === 'unclassified'

    async function save(next: 'production' | 'test' | 'demo' | 'internal') {
        setBusy(true); setError(null)
        try {
            const response = await fetch(`/api/admin/factories/${orgId}/cohort`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reason.trim().length >= 3 ? { cohort: next, reason: reason.trim() } : { cohort: next }),
            })
            if (!response.ok) {
                const body = await response.json().catch(() => null) as { message?: string } | null
                setError(body?.message ?? 'The factory could not be updated. Nothing changed.')
                return
            }
            setOpen(false); setReason('')
            router.refresh()
        } catch {
            setError('The factory could not be updated. Nothing changed.')
        } finally {
            setBusy(false)
        }
    }

    const button = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:opacity-60'
    return <div className="space-y-3">
        <p className="text-sm text-body">{counted ? 'Counted as a customer in totals.' : `Marked as ${cohort}. Left out of customer totals.`}</p>
        {counted && !open && <button type="button" className={`${button} border border-hairline bg-surface text-ink`} onClick={() => setOpen(true)}>Mark as test account</button>}
        {counted && open && <fieldset className="space-y-3" disabled={busy}>
            <legend className="text-sm font-medium text-ink">What kind of account is this?</legend>
            <div className="flex flex-wrap gap-2">{OPTIONS.map(([value, label]) => <label key={value} className={`${button} cursor-pointer border ${choice === value ? 'border-ink bg-ink text-surface' : 'border-hairline bg-surface text-ink'}`}>
                <input type="radio" name={`cohort-${orgId}`} value={value} checked={choice === value} onChange={() => setChoice(value)} className="sr-only"/>{label}
            </label>)}</div>
            <label className="block text-sm text-body">Reason (optional)
                <input value={reason} onChange={event => setReason(event.currentTarget.value)} maxLength={500} className="mt-1 block min-h-11 w-full rounded-lg border border-hairline bg-surface px-3 text-ink"/>
            </label>
            <div className="flex flex-wrap gap-2">
                <button type="button" className={`${button} bg-ink text-surface`} onClick={() => save(choice)}>Confirm</button>
                <button type="button" className={`${button} border border-hairline bg-surface text-ink`} onClick={() => { setOpen(false); setError(null) }}>Cancel</button>
            </div>
        </fieldset>}
        {!counted && <button type="button" disabled={busy} className={`${button} bg-ink text-surface`} onClick={() => save('production')}>Count as customer</button>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
}
