import { requireRole } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    await requireRole(['admin'])

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
            <div className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Weavly</p>
                        <h1 className="text-lg font-black tracking-tight">Admin Console</h1>
                    </div>
                </div>
            </div>
            <main className="mx-auto max-w-7xl px-6 py-6 lg:px-10 lg:py-8">
                {children}
            </main>
        </div>
    )
}
