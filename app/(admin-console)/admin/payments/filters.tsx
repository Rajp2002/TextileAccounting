'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PaymentFilters({ from, to, zone }: { from: string; to: string; zone: string }) {
    const [start, setStart] = useState(from.slice(0, 16)), [end, setEnd] = useState(to.slice(0, 16)), [error, setError] = useState('')
    const router = useRouter()
    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const a = new Date(`${start}:00Z`), b = new Date(`${end}:00Z`)
        if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || a >= b || b.getTime() > Date.now() || b.getTime() - a.getTime() > 366 * 86400000) { setError('Choose a period up to 366 days ending no later than now.'); return }
        setError('')
        router.push(`/admin/payments?${new URLSearchParams({ from: a.toISOString(), to: b.toISOString(), timezone: zone, currency: 'INR' })}`)
    }
    return <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-b border-hairline p-5">
        <label className="grid gap-2 text-sm font-medium">From (UTC, included)<input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required className="h-11 rounded-lg border border-hairline bg-surface px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-saffron"/></label>
        <label className="grid gap-2 text-sm font-medium">To (UTC, excluded)<input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required className="h-11 rounded-lg border border-hairline bg-surface px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-saffron"/></label>
        <button className="h-11 rounded-lg bg-ink px-5 text-sm font-medium text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron" type="submit">Apply period</button>
        <p className="w-full text-xs text-subtle">INR only · Display zone {zone} · Default trailing 30 days</p>
        {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
    </form>
}
