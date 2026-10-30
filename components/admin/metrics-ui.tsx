import Link from 'next/link'
import type { Rate } from '@/lib/admin/growth-money'

/** Server-rendered building blocks for the founder Metrics page (spec 2026-10-30 section E). */

export function formatRupees(paise: number): string {
    const rupees = Math.round(Math.abs(paise) / 100)
    return `${paise < 0 ? '−' : ''}₹${rupees.toLocaleString('en-IN')}`
}

export function RateText({ rate }: { rate: Rate }) {
    if (rate.percent === null) return <span>None yet</span>
    return <span>{rate.count} of {rate.of} · {Math.round(rate.percent)}%</span>
}

export function NotYet({ children = 'Starts at go-live' }: { children?: React.ReactNode }) {
    return <span className="text-base font-medium text-subtle">{children}</span>
}

export function MetricTile({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
    return <div>
        <dt className="text-sm text-body">{label}</dt>
        <dd className="mt-2 text-2xl font-semibold tracking-tight text-ink">{href ? <Link href={href} prefetch={false} className="underline-offset-4 hover:underline">{value}</Link> : value}</dd>
        {sub && <p className="mt-1 text-xs leading-5 text-subtle">{sub}</p>}
    </div>
}

export type BarRow = { label: string; value: number; display: string; segments?: { value: number; className: string }[]; href?: string }

/** Horizontal bars with the value printed on every row; widths are shares of the largest absolute value. */
export function BarList({ rows, emptyText = 'Nothing recorded yet.' }: { rows: BarRow[]; emptyText?: string }) {
    const max = Math.max(0, ...rows.map(row => Math.abs(row.value)))
    if (rows.length === 0) return <p className="text-sm text-body">{emptyText}</p>
    return <ul className="space-y-2">
        {rows.map(row => {
            const width = max === 0 ? 0 : (Math.abs(row.value) / max) * 100
            const label = row.href ? <Link href={row.href} prefetch={false} className="underline-offset-4 hover:underline">{row.label}</Link> : row.label
            return <li key={row.label} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-body">{label}</span>
                <span className="relative block h-3 overflow-hidden rounded-sm bg-surface-soft" aria-hidden="true">
                    {row.value < 0
                        ? <span className="absolute inset-y-0 left-0 rounded-sm border border-hairline" style={{ width: `${width}%` }}/>
                        : row.segments
                            ? <span className="absolute inset-y-0 left-0 flex" style={{ width: `${width}%` }}>{row.segments.filter(segment => segment.value > 0).map((segment, index) => <span key={index} className={segment.className} style={{ flexGrow: segment.value }}/>)}</span>
                            : <span className="absolute inset-y-0 left-0 rounded-sm bg-ink" style={{ width: `${width}%` }}/>}
                </span>
                <span className="text-right font-medium tabular-nums text-ink">{row.display}</span>
            </li>
        })}
    </ul>
}
