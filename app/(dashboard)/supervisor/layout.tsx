import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/(auth)/actions'
import { OfflineSyncProvider } from '@/components/offline-sync-provider'
import { SupervisorNav, MobileSupervisorNav, SupervisorRoleLabel } from '@/components/navigation/supervisor-nav'
import Image from 'next/image'
import LogoutButton from '@/components/auth/logout-button'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { requireRole } from '@/lib/auth'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
    // 🔐 F-8 fix: Server-side role check with DB-fallback against stale JWTs
    const { profile } = await requireRole(['supervisor'])
    const userRole = profile.role
    const userOrgId = profile.org_id

    let factoryName = 'Textile SaaS'
    if (userOrgId) {
        const supabase = await createClient()
        const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', userOrgId)
            .single()
        if (org?.name) factoryName = org.name
    }

    return (
        <div className="min-h-screen bg-background bg-grid-pattern">
            <header className="bg-background shadow-sm border-b border-border sticky top-0 z-30">
                <div className="px-4 py-3 flex justify-between items-center max-w-5xl mx-auto">
                    <div className="flex items-center gap-3">
                        <MobileSupervisorNav />
                        <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden">
                            <Image src="/logo.png" alt="Vastra Logo" fill className="object-contain" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-tight truncate max-w-[200px] sm:max-w-xs">{factoryName || "Vastra"}</h1>
                            <SupervisorRoleLabel />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <LogoutButton variant="header" />
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
