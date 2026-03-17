import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/(auth)/actions'
import { OfflineSyncProvider } from '@/components/offline-sync-provider'
import { SupervisorNav } from '@/components/navigation/supervisor-nav'
import Image from 'next/image'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'supervisor' && profile?.role !== 'owner') {
        redirect('/login')
    }

    let factoryName = 'Textile SaaS'
    if (profile?.org_id) {
        const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', profile.org_id)
            .single()
        if (org?.name) factoryName = org.name
    }

    return (
        <div className="min-h-screen bg-background bg-grid-pattern pb-28">
            <header className="bg-background shadow-sm border-b border-border sticky top-0 z-30">
                <div className="px-4 py-3 flex justify-between items-center max-w-5xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden">
                            <Image src="/logo.png" alt="Vastra Logo" fill className="object-contain" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-tight truncate max-w-[200px] sm:max-w-xs">{factoryName || "Vastra"}</h1>
                            <span className="text-[10px] uppercase tracking-widest text-teal-600 font-bold">Supervisor</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <form action={signOut}>
                            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">Logout</Button>
                        </form>
                    </div>
                </div>

                <SupervisorNav />
            </header>

            <main className="max-w-5xl mx-auto p-4 md:p-6">
                <OfflineSyncProvider>
                    {children}
                </OfflineSyncProvider>
            </main>
        </div>
    )
}
