import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/(auth)/actions'
import { OfflineSyncProvider } from '@/components/offline-sync-provider'
import { SupervisorNav } from '@/components/navigation/supervisor-nav'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'supervisor' && profile?.role !== 'owner') {
        redirect('/login')
    }

    return (
        <div className="min-h-screen bg-gray-100 pb-20">
            <header className="bg-white shadow sticky top-0 z-10">
                <div className="p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800">Supervisor</h1>
                    <div className="flex items-center gap-2">
                        <form action={signOut}>
                            <Button variant="ghost" size="sm">Logout</Button>
                        </form>
                    </div>
                </div>

                <SupervisorNav />
            </header>

            <main className="p-4">
                <OfflineSyncProvider>
                    {children}
                </OfflineSyncProvider>
            </main>
        </div>
    )
}
