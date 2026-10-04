import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

export function FounderAuthFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return <main className="safe-area-page flex min-h-svh flex-col bg-app-bg px-4 py-8 text-ink sm:px-6">
        <Link href="/" className="self-start text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">weavly<span className="text-saffron-deep">.</span></Link>
        <div className="mx-auto my-auto w-full max-w-md py-10">
            <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-subtle"><ShieldCheck aria-hidden="true" className="size-4"/>Founder access</div>
            <section className="rounded-xl border border-hairline bg-surface p-6 sm:p-8"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mb-6 mt-2 text-sm leading-6 text-subtle">{description}</p>{children}</section>
            <p className="mt-5 text-center text-xs leading-5 text-subtle">This uses your Weavly sign-in session. Signing out also ends the customer session in this browser.</p>
        </div>
    </main>
}
