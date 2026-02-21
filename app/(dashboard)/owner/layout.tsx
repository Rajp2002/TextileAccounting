import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/(auth)/actions'
import { Settings } from 'lucide-react'

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

                <div className="flex items-center gap-4">
                    <a href="/owner/machines" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                        Machines
                    </a>
                    <a href="/owner/fixed-workers" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                        Fixed Workers
                    </a>
                    <a href="/owner/payroll" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                        Payroll
                    </a>
                    <a href="/owner/system-health" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                        System Health
                    </a>
                    <a href="/owner/settings" className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Settings">
                        <Settings className="h-5 w-5 text-gray-600" />
                    </a>
                </div>
            </header>
            <main className="max-w-6xl mx-auto py-8">
                {children}
            </main>
        </div>
    )
}
