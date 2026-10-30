import Link from 'next/link'
import type { ContactRow } from '@/lib/admin/growth-usage'
import { indianPhoneLinks } from '@/lib/phone'

/** Tap-to-call and WhatsApp for an owner's stored mobile, or a plain note when there is none. */
export function PhoneLinks({ phone }: { phone: string | null }) {
    const links = indianPhoneLinks(phone)
    if (!links) return <p className="text-sm text-subtle">No mobile on file</p>
    return <div className="flex flex-wrap gap-x-4">
        <a href={links.tel} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{links.display}</a>
        <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">WhatsApp</a>
    </div>
}

/** One "Customers to contact" list on Today: who to phone, why, and how engaged they are. */
export function ContactList({ title, rows, seeAllHref, empty }: { title: string; rows: ContactRow[]; seeAllHref: string; empty: string }) {
    return <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <Link href={seeAllHref} prefetch={false} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">See all</Link>
        </div>
        {rows.length === 0 ? <p className="text-sm text-body">{empty}</p> : <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {rows.map(row => <li key={`${row.orgId}:${row.detail}`} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                    <Link href={`/admin/factories/${row.orgId}`} prefetch={false} className="font-medium text-ink underline-offset-4 hover:underline">{row.factory}</Link>
                    <p className="text-sm text-body">{row.ownerName ?? 'Owner name not on file'} · {row.detail}</p>
                    <p className="text-xs text-subtle">{row.minutesLast30} min in 30 days · {row.costingsSaved} {row.costingsSaved === 1 ? 'costing' : 'costings'} saved</p>
                </div>
                <PhoneLinks phone={row.phone}/>
            </li>)}
        </ul>}
    </section>
}
