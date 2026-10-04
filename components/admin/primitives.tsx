import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl"><h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-subtle">{description}</p></div>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
}

export function AdminSurface({ children, className, ...props }: React.ComponentProps<'section'>) {
    return <section className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)} {...props}>{children}</section>
}

export function AdminEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <div className="px-6 py-12 text-center"><h2 className="text-base font-semibold text-ink">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-subtle">{description}</p>{action && <div className="mt-5 flex justify-center">{action}</div>}</div>
}

export function AdminUnavailable({ title = 'This source is unavailable', description = 'Refresh to try again. No count has been assumed while the source is unavailable.' }: { title?: string; description?: string }) {
    return <AdminSurface><div role="status" className="flex items-start gap-3 p-6"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning"/><div><h2 className="font-semibold text-ink">{title}</h2><p className="mt-1 text-sm leading-6 text-subtle">{description}</p></div></div></AdminSurface>
}

export function AdminMetric({ label, value, detail, href }: { label: string; value: ReactNode; detail: string; href?: string }) {
    const content = <><p className="text-sm text-subtle">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p><p className="mt-2 text-xs leading-5 text-subtle">{detail}</p>{href && <ArrowUpRight aria-hidden="true" className="absolute right-4 top-4 size-4 text-subtle"/>}</>
    return href ? <Link href={href} prefetch={false} className="relative block rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-hairline-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">{content}</Link>
        : <div className="relative rounded-xl border border-hairline bg-surface p-5">{content}</div>
}

export function AdminFreshness({ asOf, children }: { asOf?: string | null; children?: ReactNode }) {
    const timestamp = asOf && Number.isFinite(Date.parse(asOf)) ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(asOf)) : 'Unavailable'
    return <p className="mt-4 text-xs leading-5 text-subtle">Snapshot: {timestamp} · Asia/Kolkata{children && <> · {children}</>}</p>
}
