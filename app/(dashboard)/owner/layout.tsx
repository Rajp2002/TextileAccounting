import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OwnerNav } from '@/components/navigation/owner-nav'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
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

    if (profile?.role !== 'owner') {
        redirect('/supervisor/production')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-900">Textile SaaS <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-normal">Owner</span></h1>

                <OwnerNav />
            </header>
            <main className="max-w-6xl mx-auto py-8">
                {children}
            </main>
        </div>
    )
}
