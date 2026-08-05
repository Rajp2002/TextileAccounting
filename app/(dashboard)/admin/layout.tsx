import { requireRole } from '@/lib/auth'
import { BrandBackground } from '@/components/brand-background'
import { createSignInServerTimerFromCookie } from '@/lib/sign-in-telemetry.server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const signInTelemetry = await createSignInServerTimerFromCookie('sign_in_dashboard_layout')
    await signInTelemetry.measure('auth_profile', () => requireRole(['admin']))
    signInTelemetry.log('success', { route: '/admin' })

    return (
        <div className="relative isolate min-h-screen overflow-x-hidden bg-background text-foreground">
            <BrandBackground />
            <div className="relative z-10 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Weavly</p>
                        <h1 className="text-lg font-black tracking-tight">Admin Console</h1>
                    </div>
                </div>
            </div>
            <main className="dashboard-main relative z-10 mx-auto max-w-7xl px-6 py-6 lg:px-10 lg:py-8">
                {children}
            </main>
        </div>
    )
}
