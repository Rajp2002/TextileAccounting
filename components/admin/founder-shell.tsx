'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, ClipboardList, Factory, LayoutDashboard, LifeBuoy, LogOut, ShieldCheck, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

const destinations = [
    { href: '/admin', label: 'Today', icon: LayoutDashboard },
    { href: '/admin/factories', label: 'Factories', icon: Factory },
    { href: '/admin/support', label: 'Support', icon: LifeBuoy },
    { href: '/admin/payments', label: 'Payments', icon: Wallet },
    { href: '/admin/system', label: 'System', icon: Activity },
]

function FounderNavigation({ mobile = false }: { mobile?: boolean }) {
    const pathname = usePathname()
    return <nav aria-label="Founder console" className={cn(mobile ? 'grid grid-cols-3 gap-1 min-[400px]:grid-cols-5' : 'space-y-1')}>
        {destinations.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
            return <Link key={href} href={href} prefetch={false} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron', mobile && 'flex-col justify-center gap-1 px-2 py-2 text-xs', active ? 'bg-surface text-ink' : mobile ? 'text-body hover:bg-surface' : 'text-wv-text-inverse-secondary hover:bg-loom-elevated hover:text-white')}>
                <Icon aria-hidden="true" className="size-4 shrink-0"/>{label}
            </Link>
        })}
    </nav>
}

export function FounderShell({ children }: { children: React.ReactNode }) {
    return <div className="safe-area-page min-h-svh bg-app-bg text-ink">
        <a href="#founder-content" className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-ink px-4 py-3 text-sm text-surface focus:translate-y-0">Skip to content</a>
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-loom p-5 text-white lg:flex">
            <Link href="/admin" prefetch={false} className="mb-9 px-3 py-2 focus-visible:outline-2 focus-visible:outline-saffron"><span className="text-xl font-semibold tracking-tight">weavly<span className="text-saffron">.</span></span><span className="mt-1 block text-xs text-wv-text-inverse-secondary">Founder console</span></Link>
            <FounderNavigation/>
            <div className="mt-auto space-y-4 border-t border-wv-border-inverse pt-5">
                <nav aria-label="Secondary navigation" className="space-y-1"><Link href="/admin/audit" prefetch={false} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-wv-text-inverse-secondary hover:text-white focus-visible:outline-2 focus-visible:outline-saffron"><ClipboardList aria-hidden="true" className="size-4"/>Audit</Link><Link href="/admin/formal" prefetch={false} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-wv-text-inverse-secondary hover:text-white focus-visible:outline-2 focus-visible:outline-saffron"><ShieldCheck aria-hidden="true" className="size-4"/>Formal operations</Link></nav>
                <SignOut/>
                <p className="px-3 text-xs leading-5 text-wv-text-inverse-secondary">Signing out also ends the customer session in this browser.</p>
            </div>
        </aside>
        <div className="lg:pl-60">
            <header className="border-b border-hairline bg-surface px-4 py-4 sm:px-6 lg:px-8">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-subtle">Weavly / Founder</p><p className="mt-1 text-sm text-body">Customer work, with clear next actions.</p></div><div className="flex items-center gap-2 text-xs text-subtle"><ShieldCheck aria-hidden="true" className="size-4"/>Verified founder session</div></div>
                <div className="mt-4 border-t border-hairline pt-3 lg:hidden"><FounderNavigation mobile/><div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2"><div className="flex gap-4"><Link href="/admin/audit" prefetch={false} className="py-3 text-xs underline underline-offset-4">Audit</Link><Link href="/admin/formal" prefetch={false} className="py-3 text-xs underline underline-offset-4">Formal operations</Link></div><SignOut compact/></div></div>
            </header>
            <main id="founder-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">{children}</main>
            <footer className="mx-auto max-w-7xl px-4 pb-6 text-xs leading-5 text-subtle sm:px-6 lg:px-8">Reporting zone: Asia/Kolkata · 15 minute inactivity limit · 8 hour absolute session limit.</footer>
        </div>
    </div>
}

function SignOut({ compact = false }: { compact?: boolean }) {
    return <form action="/auth/signout" method="post"><button type="submit" className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron', compact ? 'border border-hairline text-ink' : 'w-full text-wv-text-inverse-secondary hover:bg-loom-elevated hover:text-white')}><LogOut aria-hidden="true" className="size-4"/>Sign out</button></form>
}
