import Link from 'next/link'

export function ReportHeader({ title, children }: { title: string; children: React.ReactNode }) {
    return <header className="mb-6"><h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-body">{children}</p></header>
}
export function ReportSurface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <section className={`overflow-hidden rounded-xl border border-hairline bg-surface ${className}`}>{children}</section>
}
export function SourceUnavailable({ title = 'This source is unavailable', children }: { title?: string; children?: React.ReactNode }) {
    return <div role="status" className="rounded-xl border border-hairline bg-surface p-6"><h2 className="font-semibold text-ink">{title}</h2><p className="mt-2 text-sm leading-6 text-body">{children ?? 'No result can be established. Refresh to try again; no customer records were changed.'}</p></div>
}
export function ReportTime({ value, zone = 'Asia/Kolkata' }: { value: string | null; zone?: string }) {
    if (!value || !Number.isFinite(Date.parse(value))) return <span>Not recorded</span>
    return <time dateTime={value}>{new Intl.DateTimeFormat('en-IN', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} {zone === 'Asia/Kolkata' ? 'IST' : 'UTC'}</time>
}
export function ReportLink({ href, children }: { href: string; children: React.ReactNode }) {
    return <Link href={href} prefetch={false} className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline decoration-hairline-strong underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{children}</Link>
}
